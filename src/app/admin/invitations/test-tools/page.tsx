"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Membership = {
  agency_id: string;
  role: "admin" | "agent";
  agencies: { id: string; name: string } | null;
};

type InviteRow = {
  id: string;
  email: string;
  role: "admin" | "agent";
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

export default function TestToolsPage() {
  const router = useRouter();

  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [agencyId, setAgencyId] = useState<string>("");

  const [email, setEmail] = useState("");
  const [pendingInvites, setPendingInvites] = useState<InviteRow[]>([]);

  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const agencyName = useMemo(() => {
    const m = memberships.find((x) => x.agency_id === agencyId);
    return m?.agencies?.name ?? agencyId;
  }, [memberships, agencyId]);

  useEffect(() => {
    async function load() {
      setMessage(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: ms, error } = await supabase
        .from("agency_memberships")
        .select("agency_id, role, agencies:agencies(id, name)");

      if (error) {
        setMessage(error.message);
        return;
      }

      const typed = (ms ?? []) as unknown as Membership[];
      setMemberships(typed);

      const first = typed[0]?.agency_id ?? "";
      setAgencyId((prev) => prev || first);
    }

    load();
  }, [router]);

  async function findPendingInvites() {
    setMessage(null);
    setPendingInvites([]);

    if (!agencyId) {
      setMessage("Select an agency first.");
      return;
    }
    if (!email.trim()) {
      setMessage("Enter an email address.");
      return;
    }

    const { data, error } = await supabase
      .from("agency_invitations")
      .select("id, email, role, expires_at, accepted_at, created_at")
      .eq("agency_id", agencyId)
      .ilike("email", email.trim())
      .is("accepted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setPendingInvites((data ?? []) as InviteRow[]);
    if ((data ?? []).length === 0) setMessage("No pending invites found for that email in this agency.");
  }

  async function deleteInvite(inviteId: string) {
    setMessage(null);
    setBusy(true);

    const { error } = await supabase
      .from("agency_invitations")
      .delete()
      .eq("id", inviteId);

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Pending invite deleted.");
    await findPendingInvites();
  }

  async function deleteMembershipByUserId() {
    setMessage(null);

    if (!agencyId) {
      setMessage("Select an agency first.");
      return;
    }
    const trimmed = userId.trim();
    if (!trimmed) {
      setMessage("Enter a user_id UUID.");
      return;
    }

    // Basic UUID format check (client-side only)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmed)) {
      setMessage("That doesn’t look like a valid UUID.");
      return;
    }

    setBusy(true);

    const { error } = await supabase
      .from("agency_memberships")
      .delete()
      .eq("agency_id", agencyId)
      .eq("user_id", trimmed);

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Membership deleted (if it existed).");
  }

  async function onLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <h1>Test Tools (safe)</h1>

      <p style={{ marginTop: 8 }}>
        These tools only perform actions allowed by your current login + RLS.
        They <strong>do not</strong> delete Supabase Auth users.
      </p>

      {message && (
        <p style={{ marginTop: 12, color: message.toLowerCase().includes("deleted") ? "green" : "crimson" }}>
          {message}
        </p>
      )}

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>Context</h2>
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
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Selected: <strong>{agencyName || "—"}</strong>
        </p>
      </section>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>Invite cleanup (by email)</h2>
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Deletes <strong>pending</strong> invites (accepted_at is null) for a given email within the selected agency.
        </p>

        <div style={{ display: "grid", gap: 12, maxWidth: 520, marginTop: 12 }}>
          <label>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", padding: 8 }}
              placeholder="person@example.com"
            />
          </label>

          <button disabled={busy} onClick={findPendingInvites} style={{ padding: 10 }}>
            {busy ? "Working..." : "Find pending invites"}
          </button>
        </div>

        {pendingInvites.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3>Pending invites</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Email</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Role</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Created</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Expires</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((i) => (
                  <tr key={i.id}>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{i.email}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{i.role}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                      {new Date(i.created_at).toLocaleString()}
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                      {new Date(i.expires_at).toLocaleString()}
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                      <button disabled={busy} onClick={() => deleteInvite(i.id)} style={{ padding: 6 }}>
                        Delete invite
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p style={{ marginTop: 8, opacity: 0.8 }}>
              Note: because tokens are not stored, deleting an invite is irreversible (by design).
            </p>
          </div>
        )}
      </section>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2>Membership cleanup (by user_id UUID)</h2>
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Deletes the membership record for a user within the selected agency. This does <strong>not</strong> delete the
          Supabase Auth user.
        </p>

        <div style={{ display: "grid", gap: 12, maxWidth: 640, marginTop: 12 }}>
          <label>
            user_id (UUID)
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              style={{ width: "100%", padding: 8 }}
              placeholder="e.g. 2f8c7b3a-...."
            />
          </label>

          <button disabled={busy} onClick={deleteMembershipByUserId} style={{ padding: 10 }}>
            {busy ? "Working..." : "Delete membership in this agency"}
          </button>
        </div>

        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Tip: get a user_id from Supabase Auth → Users, or by adding a small “show my user id” line on `/me`.
        </p>
      </section>

      <button onClick={onLogout} style={{ marginTop: 24, padding: 10 }}>
        Log out
      </button>
    </main>
  );
}