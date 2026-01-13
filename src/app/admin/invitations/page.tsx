"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Membership = {
  agency_id: string;
  role: "admin" | "agent";
  agencies: { id: string; name: string } | null;
};

type InvitationRow = {
  id: string;
  email: string;
  role: "admin" | "agent";
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

function randomToken(): string {
  // Browser-safe random token
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function InvitationsPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"agent" | "admin">("agent");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [agencyId, setAgencyId] = useState<string>("");
  const [invites, setInvites] = useState<InvitationRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [acceptLink, setAcceptLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedAgencyName = useMemo(() => {
    const m = memberships.find((x) => x.agency_id === agencyId);
    return m?.agencies?.name ?? agencyId;
  }, [memberships, agencyId]);

  async function load() {
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      router.push("/login");
      return;
    }

    // Load agencies user belongs to
    const { data: ms, error: mErr } = await supabase
      .from("agency_memberships")
      .select("agency_id, role, agencies:agencies(id, name)");

    if (mErr) {
      setMessage(mErr.message);
      return;
    }

    const typed = (ms ?? []) as unknown as Membership[];
    setMemberships(typed);

    // Default to first agency
    const firstAgencyId = typed[0]?.agency_id ?? "";
    setAgencyId((prev) => prev || firstAgencyId);
  }

  async function loadInvites(forAgencyId: string) {
    setInvites([]);
    if (!forAgencyId) return;

    const { data, error } = await supabase
      .from("agency_invitations")
      .select("id, email, role, expires_at, accepted_at, created_at")
      .eq("agency_id", forAgencyId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setInvites((data ?? []) as InvitationRow[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (agencyId) loadInvites(agencyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  async function onCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setAcceptLink(null);

    if (!agencyId) {
      setMessage("No agency selected.");
      return;
    }

    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setLoading(false);
      router.push("/login");
      return;
    }

    try {
      const token = randomToken();

      // Hash token in DB (returns bytea)
      const { data: tokenHash, error: hashErr } = await supabase.rpc("invite_token_hash", {
        p_token: token,
      });

      if (hashErr) throw new Error(hashErr.message);

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: insErr } = await supabase.from("agency_invitations").insert({
        agency_id: agencyId,
        email,
        role,
        token_hash: tokenHash,
        invited_by: user.id,
        expires_at: expiresAt,
      });

      if (insErr) throw new Error(insErr.message);

      const link = `${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}`;
      setAcceptLink(link);
      setMessage(`Invite created for ${email} (${role}) in ${selectedAgencyName}.`);
      setEmail("");

      await loadInvites(agencyId);
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to create invite.");
    } finally {
      setLoading(false);
    }
  }

  async function onLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1>Invitations</h1>

      {message && <p style={{ color: message.startsWith("Invite created") ? "green" : "crimson" }}>{message}</p>}

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>Create invite</h2>

        <div style={{ marginBottom: 12 }}>
          <label>
            Agency{" "}
            <select value={agencyId} onChange={(e) => setAgencyId(e.target.value)} style={{ padding: 8 }}>
              {memberships.map((m) => (
                <option key={m.agency_id} value={m.agency_id}>
                  {m.agencies?.name ?? m.agency_id} (you are {m.role})
                </option>
              ))}
            </select>
          </label>
        </div>

        <form onSubmit={onCreateInvite} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <label>
            Invitee email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: 8 }}
              placeholder="person@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as any)} style={{ width: "100%", padding: 8 }}>
              <option value="agent">agent</option>
              <option value="admin">admin</option>
            </select>
          </label>

          <button disabled={loading} type="submit" style={{ padding: 10 }}>
            {loading ? "Creating..." : "Create invite"}
          </button>
        </form>

        {acceptLink && (
          <div style={{ marginTop: 16 }}>
            <p><strong>Acceptance link (copy/paste):</strong></p>
            <pre style={{ padding: 12, background: "#f6f6f6", overflow: "auto" }}>{acceptLink}</pre>
            <p style={{ marginTop: 8 }}>
              Open this link in an incognito/private window to test as a different user.
            </p>
          </div>
        )}
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Invites for this agency</h2>

        {invites.length === 0 ? (
          <p>No invites yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Email</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Role</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Expires</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Accepted</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{i.email}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{i.role}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{new Date(i.expires_at).toLocaleString()}</td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    {i.accepted_at ? new Date(i.accepted_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <button onClick={onLogout} style={{ marginTop: 24, padding: 10 }}>
        Log out
      </button>
    </main>
  );
}