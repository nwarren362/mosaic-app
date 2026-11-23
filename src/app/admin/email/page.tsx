"use client";

import { useEffect, useRef, useState } from "react";
import { Page, Card, Field, Input, Select, Button, FormStack, ErrorNotice, Checkbox } from "@/components/ui";
import { supabase } from "@/lib/supabaseClient";
import type { AgencyEmailSettings } from "@/lib/emailSettingsTypes";

type Agency = { id: string; name: string };

export default function AgencyEmailPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agencyId, setAgencyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Please sign in to manage agency email settings.");
        // Credentials require an actual agency-admin membership, including for support users.
        const { data, error } = await supabase.from("agency_memberships")
          .select("agency_id,agencies(id,name)").eq("user_id", user.id).eq("role", "admin");
        if (error) throw new Error("Unable to check your agency administration access.");
        const rows = (data ?? []) as unknown as { agency_id: string; agencies: Agency | null }[];
        const allowed = rows.filter(row => row.agencies).map(row => row.agencies!).sort((a, b) => a.name.localeCompare(b.name));
        if (active) { setAgencies(allowed); setAgencyId(allowed[0]?.id ?? ""); }
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : "Unable to load agency access.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  return <Page title="Agency email settings">
    <Card>
      <p>Configure the mailbox used for this agency’s contact emails. Account confirmation and password recovery emails are managed separately.</p>
      {loading ? <p role="status">Checking administrator access…</p> : error ? <ErrorNotice>{error}</ErrorNotice> : !agencies.length ?
        <ErrorNotice>Agency admin required. You can manage email settings only for agencies where you are an administrator.</ErrorNotice> : <>
          <Field label="Agency" htmlFor="email-agency">
            <Select id="email-agency" value={agencyId} disabled={busy} onChange={event => setAgencyId(event.target.value)}>
              {agencies.map(agency => <option key={agency.id} value={agency.id}>{agency.name}</option>)}
            </Select>
          </Field>
          <AgencyEmailForm key={agencyId} agencyId={agencyId} onBusyChange={setBusy} />
        </>}
    </Card>
  </Page>;
}

async function settingsRequest(agencyId: string, body?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in again.");
  const result = await fetch(body ? "/api/agency-email-settings" : `/api/agency-email-settings?agencyId=${encodeURIComponent(agencyId)}`, {
    method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify({ ...body, agencyId }) : undefined,
    cache: "no-store", signal: AbortSignal.timeout(40_000),
  });
  const data = await result.json();
  return { ok: result.ok, ...data } as { ok: boolean; settings?: AgencyEmailSettings; error?: string; message?: string };
}

function AgencyEmailForm({ agencyId, onBusyChange }: { agencyId: string; onBusyChange: (value: boolean) => void }) {
  const [settings, setSettings] = useState<AgencyEmailSettings | null>(null);
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [port, setPort] = useState<465 | 587>(587);
  const [password, setPassword] = useState("");
  const [authorised, setAuthorised] = useState(false);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const [reloadNeeded, setReloadNeeded] = useState(false);
  const dirty = Boolean(settings && (fromName.trim() !== settings.fromName || fromEmail.trim().toLowerCase() !== settings.fromEmail || port !== settings.smtpPort || password));
  const busy = loading || Boolean(action);
  function accept(value: AgencyEmailSettings) {
    setSettings(value); setFromName(value.fromName); setFromEmail(value.fromEmail); setPort(value.smtpPort); setPassword(""); setAuthorised(false);
  }
  useEffect(() => {
    let active = true;
    void settingsRequest(agencyId).then(result => {
      if (!active) return;
      if (!result.ok || !result.settings) throw new Error(result.error || "Unable to load email settings.");
      accept(result.settings);
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : "Unable to load email settings."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [agencyId]);
  async function perform(next: "save" | "check" | "enable" | "disable" | "reload") {
    if (inFlight.current) return;
    inFlight.current = true; setAction(next); onBusyChange(true); setError(null); setMessage(null);
    try {
      const result = await settingsRequest(agencyId, next === "reload" ? undefined : {
        action: next, revision: settings?.revision ?? null,
        ...(next === "save" ? { fromName, fromEmail, smtpPort: port, password } : {}),
        ...(next === "enable" ? { authorised } : {}),
      });
      if (result.settings) accept(result.settings);
      if (!result.ok || !result.settings) {
        if (!result.settings) setReloadNeeded(true);
        setError(result.error || "Unable to update email settings. Reload before continuing."); return;
      }
      setReloadNeeded(false); setMessage(result.message ?? "Settings reloaded.");
    } catch {
      setReloadNeeded(true); setError("The request could not be confirmed. Reload the settings before trying again.");
    } finally { setPassword(""); inFlight.current = false; setAction(null); onBusyChange(false); }
  }
  return <FormStack onSubmit={event => { event.preventDefault(); void perform("save"); }} autoComplete="off">
    {loading ? <p role="status">Loading email settings…</p> : null}
    {error ? <ErrorNotice>{error}</ErrorNotice> : null}
    {message ? <p role="status">{message}</p> : null}
    {settings ? <>
      <p role="status">{settings.enabled ? "Agency sender enabled." : "Agency sending paused."} {settings.verifiedAt ? "Saved connection has passed its check." : "Connection has not been checked."}</p>
      {!settings.platformSendingEnabled ? <p>Contact email delivery is currently paused by Mosaic. You can prepare your agency settings without sending email.</p> : null}
      {!settings.credentialStorageReady ? <ErrorNotice>Secure credential storage needs server setup. Ask the Mosaic administrator to complete it before entering a password.</ErrorNotice> : null}
      <Field label="Email provider" htmlFor="smtp-provider" helpText="IONOS is supported initially. Other providers can be added later.">
        <Select id="smtp-provider" disabled value="ionos"><option value="ionos">IONOS UK</option></Select>
      </Field>
      <Field label="Sender name" htmlFor="smtp-name" required>
        <Input id="smtp-name" value={fromName} onChange={event => setFromName(event.target.value)} maxLength={120} required disabled={busy || reloadNeeded} autoComplete="organization" />
      </Field>
      <Field label="Mailbox email address" htmlFor="smtp-email" required helpText="Used as both the sender address and SMTP username. Use a mailbox your agency is authorised to send from.">
        <Input id="smtp-email" type="email" value={fromEmail} onChange={event => setFromEmail(event.target.value)} maxLength={254} required disabled={busy || reloadNeeded} autoComplete="off" />
      </Field>
      <Field label="SMTP server" htmlFor="smtp-host"><Input id="smtp-host" readOnly value={settings.smtpHost} /></Field>
      <Field label="Secure connection" htmlFor="smtp-port">
        <Select id="smtp-port" value={port} onChange={event => setPort(Number(event.target.value) as 465 | 587)} disabled={busy || reloadNeeded}>
          <option value={587}>Port 587 — STARTTLS</option><option value={465}>Port 465 — TLS</option>
        </Select>
      </Field>
      <Field label="Mailbox password" htmlFor="smtp-password" helpText={settings.hasPassword ? "A password is saved securely. Leave blank to keep it, or enter a replacement." : "Saved encrypted. It will never be displayed again."}>
        <Input id="smtp-password" type="password" value={password} onChange={event => setPassword(event.target.value)} maxLength={2048} autoComplete="new-password"
          disabled={busy || reloadNeeded || !settings.credentialStorageReady} placeholder={settings.hasPassword ? "Password saved" : "Enter mailbox password"} />
      </Field>
      {dirty ? <p>Unsaved changes. Saving pauses sending and clears the previous connection check.</p> : null}
      <Button type="submit" disabled={busy || reloadNeeded || !settings.credentialStorageReady || !dirty || (!settings.hasPassword && !password)}>{action === "save" ? "Saving…" : "Save settings"}</Button>
      <Button type="button" variant="secondary" onClick={() => void perform("check")} disabled={busy || reloadNeeded || dirty || !settings.revision || !settings.connectionChecksEnabled}>
        {action === "check" ? "Checking connection…" : "Check connection (no email)"}
      </Button>
      <p>The connection check pauses sending and tests the saved mailbox login. It does not prove inbox delivery or send an email.</p>
      {!settings.connectionChecksEnabled ? <p>Connection checks are paused until server setup is complete.</p> : null}
      {!settings.enabled ? <>
        <Checkbox checked={authorised} onChange={event => setAuthorised(event.target.checked)} disabled={busy || reloadNeeded || dirty || !settings.verifiedAt}>
          I am authorised to use this mailbox to send email for this agency.
        </Checkbox>
        <Button type="button" onClick={() => void perform("enable")} disabled={busy || reloadNeeded || dirty || !settings.verifiedAt || !authorised || !settings.credentialStorageReady}>Enable agency sender</Button>
      </> : <Button type="button" variant="secondary" onClick={() => void perform("disable")} disabled={busy || reloadNeeded}>Pause agency sending</Button>}
    </> : null}
    <Button type="button" variant="secondary" onClick={() => void perform("reload")} disabled={busy}>Reload saved settings</Button>
  </FormStack>;
}
