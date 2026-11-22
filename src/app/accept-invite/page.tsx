"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Page, Card, Button } from "@/components/ui";
import { setActiveAgencyId } from "@/lib/agencyContext";
import { browserInvitationStorage, forgetAcceptedInvitation, rememberInvitation } from "@/lib/authNavigation";

function AcceptInviteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"idle" | "working" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("Preparing…");
  const acceptance = useRef<{ token: string; request: Promise<{ data: unknown; error: { message: string } | null }> } | null>(null);

  useEffect(() => {
    let active = true;
    async function run() {
      setStatus("working");
      setMessage("Validating invitation…");

      const token = searchParams.get("token");
      if (!token) {
        setStatus("error");
        setMessage("Missing token. Please open the invite link exactly as provided.");
        return;
      }

      // Retain the invitation through signup, confirmation and failed acceptance attempts.
      const remembered = rememberInvitation(browserInvitationStorage, token);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;
      const user = sessionData.session?.user;

      if (!user) {
        if (!remembered) {
          setStatus("error");
          setMessage("Browser storage is unavailable. Sign in or create your account, then reopen the original invitation link.");
          return;
        }
        setStatus("working");
        setMessage("Please log in to accept the invite…");
        router.push("/login");
        return;
      }

      setMessage("Accepting invitation…");

      // Call RPC to accept invite
      if (acceptance.current?.token !== token) {
        acceptance.current = { token, request: Promise.resolve(supabase.rpc("accept_agency_invitation", { p_token: token })) };
      }
      const { data, error } = await acceptance.current.request;
      if (!active) return;

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      // If RPC returns membership, use it to set active agency
      // Some supabase typings return object or array depending on RPC definition; handle both safely.
      const row: unknown = Array.isArray(data) ? data[0] : data;
      const agencyId = row && typeof row === "object" && "agency_id" in row
        && typeof row.agency_id === "string" ? row.agency_id : null;

      if (agencyId) {
        setActiveAgencyId(agencyId);
        forgetAcceptedInvitation(browserInvitationStorage, token);
      } else {
        setStatus("error");
        setMessage("Mosaic could not confirm the invitation result. Please reload the invitation before trying again.");
        return;
      }

      setStatus("success");
      setMessage("Invitation accepted. Redirecting…");

      router.push("/me");
    }

    void run().catch(() => {
      if (!active) return;
      setStatus("error");
      setMessage("Mosaic could not confirm the invitation result. Check your connection and reload the invitation before trying again.");
    });
    return () => { active = false; };
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
