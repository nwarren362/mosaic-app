"use client";

import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

function AcceptInviteInner() {
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
        router.push("/login");
        return;
      }

      setStatus("Accepting invitation...");

      const { error } = await supabase.rpc("accept_agency_invitation", { p_token: token });

      if (error) {
        setError(error.message);
        setStatus("Failed.");
        return;
      }

      setStatus("Success! You’ve joined the agency.");
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

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Loading…</main>}>
      <AcceptInviteInner />
    </Suspense>
  );
}