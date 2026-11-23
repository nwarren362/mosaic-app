"use client";

import { useEffect, useRef, useState } from "react";
import { SectionCard, Card, Field, Input, Select, Textarea, Button, Checkbox, FormStack, ErrorNotice, SuccessNotice } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import type { DeliveryReview } from "@/lib/emailDeliveryReviewApi";

async function request(agencyId: string, body?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in again.");
  const result = await fetch(body ? "/api/contact-emails/review" : `/api/contact-emails/review?agencyId=${encodeURIComponent(agencyId)}`, {
    method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify({ ...body, agencyId }) : undefined, cache: "no-store", signal: AbortSignal.timeout(25_000),
  });
  return { ok: result.ok, ...await result.json() } as { ok: boolean; deliveries?: DeliveryReview[]; message?: string; error?: string };
}

export default function EmailDeliveryReview({ agencyId, onBusyChange }: { agencyId: string; onBusyChange: (busy: boolean) => void }) {
  const [rows, setRows] = useState<DeliveryReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");
  const [evidence, setEvidence] = useState("");
  const [acceptedAt, setAcceptedAt] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [reloadNeeded, setReloadNeeded] = useState(false);
  const attempt = useRef<Record<string, unknown> | null>(null);
  const inFlight = useRef(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    void request(agencyId).then(result => {
      if (!active) return;
      if (!result.ok || !result.deliveries) throw new Error(result.error || "Unable to load email requests.");
      setRows(result.deliveries);
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : "Unable to load email requests."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [agencyId]);
  useEffect(() => {
    if (!busy && (error || message)) { feedbackRef.current?.focus({ preventScroll: true }); feedbackRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
  }, [busy, error, message]);
  function open(row: DeliveryReview) {
    setSelected(row.id); setOutcome(row.category === "history" ? "finish_history" : row.category === "unsent" ? "not_accepted" : "");
    setEvidence(row.category === "history" ? "Completing history from the SMTP receipt already saved by Mosaic." : "");
    setAcceptedAt(""); setConfirmed(false); setError(null); setMessage(null); setFrozen(false); setReloadNeeded(false); attempt.current = null;
  }
  async function perform(save: boolean) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); onBusyChange(true); setError(null); setMessage(null);
    try {
      if (save) {
        if (!attempt.current) attempt.current = { deliveryId: selected, reviewId: crypto.randomUUID(), outcome, evidence: evidence.trim(), confirmed,
          acceptedAt: outcome === "accepted" ? new Date(acceptedAt).toISOString() : null };
        setFrozen(true);
        const result = await request(agencyId, attempt.current);
        if (!result.ok) { setError(result.error || "Unable to confirm the review. Reload before continuing."); setReloadNeeded(true); return; }
        setMessage(result.message || "Review saved. No email was sent.");
        setRows(previous => previous.filter(row => row.id !== selected)); setSelected(null); attempt.current = null; setFrozen(false);
      }
      const refreshed = await request(agencyId);
      if (!refreshed.ok || !refreshed.deliveries) throw new Error(refreshed.error || "Unable to refresh email requests.");
      setRows(refreshed.deliveries);
      if (!save) { setSelected(null); attempt.current = null; setFrozen(false); setReloadNeeded(false); setMessage("Pending requests reloaded."); }
    } catch {
      setError(save && attempt.current ? "The review result is not confirmed. Retry the saved review or reload the requests; no email will be sent by either action." : "Unable to refresh email requests. Please reload them.");
    } finally { inFlight.current = false; setBusy(false); setLoading(false); onBusyChange(false); }
  }
  return <SectionCard title="Email requests needing review">
    <p>Resolve a saved request without sending or resending it. If the outcome is unknown, leave it pending while you verify it with the provider or recipient.</p>
    {error ? <ErrorNotice ref={feedbackRef}>{error}</ErrorNotice> : message ? <SuccessNotice ref={feedbackRef}>{message}</SuccessNotice> : null}
    <Button type="button" variant="secondary" disabled={busy} onClick={() => void perform(false)}>{busy ? "Working…" : "Reload email requests"}</Button>
    {loading ? <p role="status">Loading pending requests…</p> : !rows.length ? <p>No email requests need review.</p> : null}
    {rows.length >= 50 ? <p>Showing the oldest 50 pending requests. Resolve them and reload to see later requests.</p> : null}
    {rows.map(row => <Card key={row.id}>
      <p><strong>{row.subject}</strong><br />To {row.toEmail}<br />Requested {new Date(row.createdAt).toLocaleString()}</p>
      <p>{row.category === "history" ? "SMTP acceptance was recorded; the history needs completing." : row.category === "unsent" ? "No SMTP send was started for this request." : "Delivery is uncertain. Do not resend until the outcome has been verified."}</p>
      {row.busy ? <p>This request may still be processing. Wait two minutes and reload.</p> : null}
      <Button type="button" variant="secondary" disabled={busy || row.busy || frozen} onClick={() => open(row)}>Review request</Button>
      {selected === row.id ? <FormStack onSubmit={event => { event.preventDefault(); void perform(true); }}>
        <Field label="Message reference" htmlFor="review-reference" helpText="Use this reference when checking provider records or contacting support."><Input id="review-reference" value={row.reference} readOnly /></Field>
        <Field label="Resolution" htmlFor="review-outcome" required>
          <Select id="review-outcome" value={outcome} disabled={busy || frozen} onChange={event => { setOutcome(event.target.value); setConfirmed(false); }} required>
            <option value="" disabled>Choose a verified outcome</option>
            {row.category === "history" ? <option value="finish_history">Complete history from saved acceptance</option> : <>
              {row.category === "uncertain" ? <option value="accepted">Confirmed accepted by the mail server</option> : null}
              <option value="not_accepted">{row.category === "unsent" ? "Cancel this unsent request" : "Confirmed not accepted by the mail server"}</option>
            </>}
          </Select>
        </Field>
        {outcome === "accepted" ? <Field label={`Acceptance time (${Intl.DateTimeFormat().resolvedOptions().timeZone})`} htmlFor="review-accepted-at" required>
          <Input id="review-accepted-at" type="datetime-local" step={1} value={acceptedAt} onChange={event => setAcceptedAt(event.target.value)} required disabled={busy || frozen} />
        </Field> : null}
        <Field label="Evidence or reason" htmlFor="review-evidence" required helpText={row.category === "uncertain" ? "Record provider evidence or confirmed recipient acceptance. A missing message in your Sent folder is not sufficient evidence." : "Explain the reason for this review. The original request will be retained."}>
          <Textarea id="review-evidence" value={evidence} onChange={event => setEvidence(event.target.value)} minLength={10} maxLength={2000} required disabled={busy || frozen} />
        </Field>
        <Checkbox checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy || frozen || !outcome}>
          {row.category === "uncertain" ? "I have verified this outcome for the original recipient and recorded the supporting evidence." : "I understand this records the review and will not send an email."}
        </Checkbox>
        <Button type="submit" disabled={busy || reloadNeeded || !outcome || !confirmed || evidence.trim().length < 10 || (outcome === "accepted" && !acceptedAt)}>
          {busy ? "Saving review…" : frozen ? "Retry saved review" : "Save review without sending"}
        </Button>
        {reloadNeeded ? <p>Reload the requests before making another decision.</p> : null}
      </FormStack> : null}
    </Card>)}
  </SectionCard>;
}
