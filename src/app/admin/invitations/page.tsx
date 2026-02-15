"use client";

import { Page, Card, Button, Input } from "@/components/ui";
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
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

    const { data: ms, error: mErr } = await supabase
      .from("agency_memberships")
      .select("agency_id, role, agencies:agencies(id, name)");

    if (mErr) {
      setMessage(mErr.message);
      return;
    }

    const typed = (ms ?? []) as unknown as Membership[];
    // Deduplicate memberships (safety belt)
    const unique = new Map<string, Membership>();
    for (const m of typed) {
      const key = `${m.agency_id}`;
      // Keep admin if duplicates exist
      const existing = unique.get(key);
      if (!existing) unique.set(key, m);
      else if (existing.role !== "admin" && m.role === "admin") unique.set(key, m);
    }

setMemberships(Array.from(unique.values()));

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

  async function deleteInvite(inviteId: string) {
    setMessage(null);
    setAcceptLink(null);

    const { error } = await supabase.from("agency_invitations").delete().eq("id", inviteId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Invite deleted.");
    await loadInvites(agencyId);
  }

  async function regenerateInvite(invite: InvitationRow) {
    setMessage(null);
    setAcceptLink(null);

    if (!agencyId) {
      setMessage("No agency selected.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      router.push("/login");
      return;
    }

    // Delete old invite first (only if still pending)
    if (!invite.accepted_at) {
      const { error: delErr } = await supabase.from("agency_invitations").delete().eq("id", invite.id);
      if (delErr) {
        setMessage(delErr.message);
        return;
      }
    }

    try {
      const token = randomToken();

      const { data: tokenHash, error: hashErr } = await supabase.rpc("invite_token_hash", {
        p_token: token,
      });
      if (hashErr) throw new Error(hashErr.message);

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: insErr } = await supabase.from("agency_invitations").insert({
        agency_id: agencyId,
        email: invite.email,
        role: invite.role,
        token_hash: tokenHash,
        invited_by: user.id,
        expires_at: expiresAt,
      });
      if (insErr) throw new Error(insErr.message);

      const link = `${window.location.origin}/accept-invite?token=${encodeURIComponent(token)}`;
      setAcceptLink(link);
      setMessage(`New invite link generated for ${invite.email}.`);
      await loadInvites(agencyId);
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to regenerate invite.");
    }
  }

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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (agencyId) loadInvites(agencyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  return (
    <Page title="Invitations">
      {message && (
        <p style={{ color: message.toLowerCase().includes("failed") || message.toLowerCase().includes("error") ? "#ff6b6b" : "var(--primary)" }}>
          {message}
        </p>
      )}

      {acceptLink && (
        <Card>
          <p style={{ color: "var(--mutedText)" }}>Copy this link (shown only once):</p>
          <pre style={{ padding: 12, overflowX: "auto" }}>{acceptLink}</pre>
        </Card>
      )}

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2 style={{ marginBottom: 12 }}>Create invite</h2>

          <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
            <label>
              Agency
              <select
                value={agencyId}
                onChange={(e) => setAgencyId(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  marginTop: 6,
                }}
              >
                {memberships.map((m) => (
                  <option key={m.agency_id} value={m.agency_id}>
                    {m.agencies?.name ?? m.agency_id} (you are {m.role})
                  </option>
                ))}
              </select>
            </label>

            <form onSubmit={onCreateInvite} style={{ display: "grid", gap: 12 }}>
              <label>
                Invitee email
                <div style={{ marginTop: 6 }}>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" autoComplete="email" />
                </div>
              </label>

              <label>
                Role
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "agent" | "admin")}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    marginTop: 6,
                  }}
                >
                  <option value="agent">agent</option>
                  <option value="admin">admin</option>
                </select>
              </label>

              <Button type="submit" disabled={loading} variant="primary">
                {loading ? "Creating..." : "Create invite"}
              </Button>
            </form>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <h2 style={{ marginBottom: 12 }}>Invites for this agency</h2>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: 8 }}>Email</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: 8 }}>Role</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: 8 }}>Expires</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: 8 }}>Accepted</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid var(--border)", padding: 8 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td style={{ borderBottom: "1px solid var(--border)", padding: 8 }}>{i.email}</td>
                    <td style={{ borderBottom: "1px solid var(--border)", padding: 8 }}>{i.role}</td>
                    <td style={{ borderBottom: "1px solid var(--border)", padding: 8 }}>
                      {new Date(i.expires_at).toLocaleString()}
                    </td>
                    <td style={{ borderBottom: "1px solid var(--border)", padding: 8 }}>
                      {i.accepted_at ? new Date(i.accepted_at).toLocaleString() : "—"}
                    </td>
                    <td style={{ borderBottom: "1px solid var(--border)", padding: 8 }}>
                      {i.accepted_at ? (
                        "—"
                      ) : (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <Button onClick={() => regenerateInvite(i)} variant="ghost">
                            Regenerate link
                          </Button>
                          <Button onClick={() => deleteInvite(i.id)} variant="danger">
                            Delete
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

                {invites.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 12, color: "var(--mutedText)" }}>
                      No invites found for this agency.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16 }}>
            <Button onClick={() => supabase.auth.signOut().then(() => router.push("/login"))} variant="ghost">
              Log out
            </Button>
          </div>
        </Card>
      </div>
    </Page>
  );
}