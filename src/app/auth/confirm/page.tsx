"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ErrorNotice, Page } from "@/components/ui";
import { browserInvitationStorage, checkEmailConfirmation, confirmationLinkFailed, type ConfirmationResult } from "@/lib/authNavigation";
import { supabase } from "@/lib/supabaseClient";

export default function ConfirmEmailPage() {
  const router = useRouter();
  const [result, setResult] = useState<ConfirmationResult | null>(null);
  useEffect(() => {
    let active = true;
    async function check() {
      const href = window.location.href;
      const outcome = await checkEmailConfirmation(supabase.auth, href, browserInvitationStorage);
      if (!active) return;
      // Keep an expired-link result on reload, while discarding all provider tokens/details.
      window.history.replaceState(null, "", confirmationLinkFailed(href) ? "/auth/confirm?error=invalid_link" : "/auth/confirm");
      setResult(outcome);
    }
    void check();
    return () => { active = false; };
  }, []);
  return <Page title="Email confirmation">
    <Card style={{ maxWidth: 480 }}>
      {!result ? <p role="status">Checking your confirmation…</p> : result.status === "error" ? <>
        <ErrorNotice>{result.message}</ErrorNotice>
        <Button type="button" onClick={() => router.push("/login")}>Go to login</Button>{" "}
        <Button type="button" variant="secondary" onClick={() => router.push("/signup")}>Go to sign up</Button>
      </> : <>
        <h2>Email confirmed</h2>
        <p>You can now continue to Mosaic.</p>
        {result.destination === "/me" && <p>If you were invited to an agency, reopen the original invitation link in this browser to join it.</p>}
        <Button type="button" onClick={() => router.replace(result.destination)}>{result.destination === "/me" ? "Continue to Mosaic" : "Continue to invitation"}</Button>
      </>}
    </Card>
  </Page>;
}
