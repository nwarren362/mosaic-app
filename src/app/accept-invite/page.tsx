"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Page, Card, Button } from "@/components/ui";
import { setActiveAgencyId } from "@/lib/agencyContext";

function AcceptInviteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"idle" | "working" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("Preparing…");

  useEffect(() => {
    async function run() {
      setStatus("working");
      setMessage("Validating invitation…");

      const token = searchParams.get("token");
      if (!token) {
        setStatus("error");
        setMessage("Missing token. Please open the invite link exactly as provided.");
        return;
      }

      // If not signed in, store token and redirect to login
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        localStorage.setItem("pending_invite_token", token);
        setStatus("working");
        setMessage("Please log in to accept the invite…");
        router.push("/login");
        return;
      }

      setMessage("Accepting invitation…");

      // Call RPC to accept invite
      const { data, error } = await supabase.rpc("accept_agency_invitation", {
        p_token: token,
      });

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      // If RPC returns membership, use it to set active agency
      // Some supabase typings return object or array depending on RPC definition; handle both safely.
      const row: any = Array.isArray(data) ? data[0] : data;
      const agencyId = row?.agency_id;

      if (agencyId) {
        setActiveAgencyId(agencyId);
      }

      setStatus("success");
      setMessage("Invitation accepted. Redirecting…");

      router.push("/me");
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, searchParams]);

  return (
    <Page title="Accept invitation">
      <Card>
        <p style={{ color: "var(--mutedText)" }}>
          {status === "working" && "Working…"}
          {status === "success" && "Success"}
          {status === "error" && "Failed"}
          {status === "idle" && "Starting…"}
        </p>

        <p style={{ fontSize: 16 }}>{message}</p>

        {status === "error" && (
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="primary" onClick={() => router.push("/login")}>
              Go to login
            </Button>
            <Button variant="ghost" onClick={() => router.push("/signup")}>
              Create account
            </Button>
          </div>
        )}

        <p style={{ marginTop: 12, color: "var(--mutedText)", fontSize: 13 }}>
          Tip: If you were redirected to login, just log in and the invite should resume automatically.
        </p>
      </Card>
    </Page>
  );
}

export default function AcceptInvitePage() {
  // Important: wrapping useSearchParams usage in Suspense avoids Next.js prerender errors.
  return (
    <Suspense
      fallback={
        <Page title="Accept invitation">
          <Card>
            <p>Loading…</p>
          </Card>
        </Page>
      }
    >
      <AcceptInviteInner />
    </Suspense>
  );
}