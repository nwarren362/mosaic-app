"use client";

import { Button, Card, ErrorNotice, Field, FormStack, Input, Page } from "@/components/ui";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { browserInvitationStorage, confirmationRedirectUrl, postAuthDestination } from "@/lib/authNavigation";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function onSignup(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setMessage(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { emailRedirectTo: confirmationRedirectUrl(window.location.origin) },
      });
      if (error) { setMessage(error.message); return; }
      setPassword("");
      if (!data.session) {
        setAwaitingConfirmation(true);
        return;
      }
      router.replace(postAuthDestination(browserInvitationStorage));
    } catch {
      setMessage("Mosaic could not complete sign up. Check your connection and try again.");
    } finally { setLoading(false); }
  }

  return <Page title="Sign up">
    <Card style={{ maxWidth: 480 }}>
      {awaitingConfirmation ? <section role="status" aria-live="polite">
        <h2>Check your email</h2>
        <p>If <strong>{email.trim()}</strong> needs confirmation, you will receive an email with the next step. Check your inbox and spam folder.</p>
        <p>Open the confirmation link, then continue to your agency invitation. If you use another browser or device, reopen the original invitation link there after confirming.</p>
        <Button type="button" onClick={() => router.push("/login")}>Go to login</Button>{" "}
        <Button type="button" variant="secondary" onClick={() => setAwaitingConfirmation(false)}>Back to sign up</Button>
      </section> : <>
        <p>You must have been invited to join an agency.</p>
        <FormStack onSubmit={onSignup}>
          <Field label="Email" htmlFor="signup-email" required>
            <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" disabled={loading} />
          </Field>
          <Field label="Password" htmlFor="signup-password" required>
            <Input id="signup-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" disabled={loading} />
          </Field>
          <Button type="submit" disabled={loading}>{loading ? "Creating account…" : "Create account"}</Button>
          {message && <ErrorNotice>{message}</ErrorNotice>}
        </FormStack>
        <p>Already have an account? <Button type="button" variant="ghost" onClick={() => router.push("/login")}>Log in</Button></p>
      </>}
    </Card>
  </Page>;
}
