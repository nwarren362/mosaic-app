"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<string>("Starting...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      setError(null);

      if (!token) {
        setStatus("Missing token in URL.");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        setStatus("Please log in first, then return to this link.");
        // send them to login; they can come back to the same link after login
        router.push(`/login`);
        return;
      }

      setStatus("Accepting invitation...");

      const { data, error } = await supabase.rpc("accept_agency_invitation", { p_token: token });

      if (error) {
        setError(error.message);
        setStatus("Failed.");
        return;
      }

      setStatus("Success! You’ve joined the agency.");
      // Take them to /me
      router.push("/me");
    }

    run();
  }, [router, token]);

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>Accept invitation</h1>
      <p>{status}</p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </main>
  );
}