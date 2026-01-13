"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type MembershipRow = {
  agency_id: string;
  role: string;
  agencies?: { id: string; name: string } | null;
};

export default function MePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [error, setError] = useState<string | null>(null);

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

      const { data, error } = await supabase
        .from("agency_memberships")
        .select("agency_id, role, agencies:agencies(id, name)");

      if (error) return setError(error.message);

      setMemberships((data ?? []) as MembershipRow[]);
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

          <h2>Agencies</h2>
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

          <button onClick={onLogout} style={{ marginTop: 16, padding: 10 }}>
            Log out
          </button>
        </>
      )}
    </main>
  );
}