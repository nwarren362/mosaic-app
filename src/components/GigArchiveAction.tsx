"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button, Checkbox, Field, SectionCard, Textarea } from "@/components/ui";

type Props = {
  gig: {
    id: string;
    agency_id: string;
    created_by: string | null;
    status: string | null;
    starts_at: string | null;
    archived_at: string | null;
  };
  disabled: boolean;
  onArchived: () => Promise<void>;
};

export function GigArchiveAction({ gig, disabled, onArchived }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [communications, setCommunications] = useState(false);
  const [obligations, setObligations] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from("agency_memberships")
        .select("role").eq("agency_id", gig.agency_id).eq("user_id", user.id).maybeSingle();
      if (active) setAllowed(!error && Boolean(data) && (gig.created_by === user.id || data?.role === "admin"));
    }
    void checkAccess();
    return () => { active = false; };
  }, [gig.agency_id, gig.created_by]);

  if (!allowed || gig.archived_at) return null;
  const eligible = gig.status === "cancelled" && Boolean(gig.starts_at) && new Date(gig.starts_at!).getTime() > now;

  async function archive() {
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("archive_gig", {
        p_gig_id: gig.id,
        p_agency_id: gig.agency_id,
        p_reason: reason.trim(),
        p_communications_complete: communications,
        p_obligations_settled: obligations,
      });
      if (rpcError) { setError(rpcError.message); return; }
      await onArchived();
    } catch {
      setError("Could not confirm the archive result. Reload the gig before trying again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard title="Archive gig">
      <p>Archiving removes this gig from normal lists and keeps its history. Other open tasks will be closed with the archive reason. This cannot be undone in Mosaic.</p>
      {!eligible && <p>Only a cancelled gig with a future start time can be archived. Cancel and save it first.</p>}
      {disabled && <p>Save or discard your changes before archiving.</p>}
      {!open ? (
        <Button variant="danger" onClick={() => setOpen(true)} disabled={!eligible || disabled}>Archive gig…</Button>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <Field label="Archive reason" required>
            <Textarea aria-label="Archive reason" value={reason} onChange={e => setReason(e.target.value)} minLength={3} maxLength={1000} disabled={busy} />
          </Field>
          <Checkbox checked={communications} onChange={e => setCommunications(e.target.checked)} disabled={busy}>
            Cancellation communications are complete, including any cancellation follow-up task.
          </Checkbox>
          <Checkbox checked={obligations} onChange={e => setObligations(e.target.checked)} disabled={busy}>
            Any payments, refunds and other obligations are resolved. Mosaic does not verify these automatically.
          </Checkbox>
          {error && <p role="alert">{error}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
            <Button variant="danger" onClick={archive} disabled={busy || disabled || !eligible || !communications || !obligations || reason.trim().length < 3}>
              {busy ? "Archiving…" : "Confirm archive"}
            </Button>
            <Button variant="secondary" onClick={() => { setOpen(false); setError(null); }} disabled={busy}>Keep gig</Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
