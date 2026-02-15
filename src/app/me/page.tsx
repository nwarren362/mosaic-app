"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { getActiveAgencyId, setActiveAgencyId } from "@/lib/agencyContext";
import { Button } from "@/components/ui";

type MembershipRow = {
  agency_id: string;
  role: string;
  agencies: { id: string; name: string } | null;
};

export default function MePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [activeAgencyId, setActiveAgencyIdState] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setError(null);

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) return setError(sessionErr.message);

      const user = sessionData.session?.user;
      if (!user) {
        router.push("/login");
        return;
      }

      setEmail(user.email ?? "");
      setUserId(user.id);

      const { data, error } = await supabase
       .from("agency_memberships")
       .select("agency_id, role, agencies:agencies(id, name)")
       .eq("user_id", user.id);

      if (error) return setError(error.message);
      const typed = (data ?? []) as unknown as MembershipRow[];
      setMemberships(typed);

      // Initialize active agency
      const stored = getActiveAgencyId();

      if (stored && typed.some((m) => m.agency_id === stored)) {
        setActiveAgencyIdState(stored);
      } else if (typed.length === 1) {
        setActiveAgencyIdState(typed[0].agency_id);
        setActiveAgencyId(typed[0].agency_id);
      }
    }

    load();
  }, [router]);

  async function onLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Me</h1>

      {error ? (
        <p style={{ color: "crimson" }}>{error}</p>
      ) : (
        <>
          <p>
            <strong>Email:</strong> {email}
          </p>
          <p style={{ opacity: 0.7, fontSize: 14 }}>
          User ID: {userId}
          </p>

          <h2>Agencies</h2>
          <label style={{ display: "block", marginBottom: 12 }}>
          Active agency{" "}
          <select
            value={activeAgencyId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              setActiveAgencyIdState(id);
              setActiveAgencyId(id);
            }}
            style={{
              padding: 10,
              marginLeft: 8,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text)", 
            }}
          >
            <option value="" disabled>
              Select…
            </option>
            {memberships.map((m) => (
              <option key={m.agency_id} value={m.agency_id}>
                {m.agencies?.name ?? m.agency_id} ({m.role})
              </option>
            ))}
          </select>
        </label>
          {memberships.length === 0 ? (
            <p>No memberships found.</p>
          ) : (
            <ul>
              {memberships.map((m) => (
                <li key={m.agency_id}>
                  <strong>{m.agencies?.name ?? m.agency_id}</strong> — role:{" "}
                  {m.role}
                </li>
              ))}
            </ul>
          )}

         <div style={{ marginTop: 24 }}>
          <Button onClick={onLogout} variant="primary">Log out</Button>
        </div>
        </>
      )}
    </main>
  );
}