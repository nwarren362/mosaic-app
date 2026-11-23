import type { AgencyEmailSettings } from "./emailSettingsTypes";

type StoredSettings = {
  revision: string; from_name: string; from_email: string; smtp_port: 465 | 587;
  encrypted_password: string; enabled: boolean; verified_at: string | null;
};
type RpcResult = { data: unknown; error: { code?: string } | null };
type Dependencies = {
  serverReady: boolean; encryptionReady: boolean; sendingEnabled: boolean; checksEnabled: boolean;
  authenticate: (token: string) => Promise<string | null>;
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
  encrypt: (password: string, agencyId: string) => string;
  decrypt: (ciphertext: string, agencyId: string) => string;
  verify: (connection: { host: string; port: number; user: string }, password: string) => Promise<void>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const response = (status: number, body: Record<string, unknown>) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store", "Pragma": "no-cache" },
});
const failure = (error: { code?: string }) => {
  const map: Record<string, [number, string]> = {
    "42501": [403, "Agency admin access is required for this agency."],
    "40001": [409, "These settings changed. Reload them before continuing."],
    "22023": [400, "Check the sender details and confirm that you are authorised to use the mailbox."],
    "54000": [429, "Please wait one minute before checking the connection again."],
    "55000": [409, "Check the saved connection before enabling email sending."],
  };
  const [status, message] = map[error.code ?? ""] ?? [503, "Email settings are unavailable. Please try again later."];
  return response(status, { error: message });
};

// Explicit safe projection: never return ciphertext, passwords or server configuration.
function publicSettings(s: StoredSettings | null, deps: Dependencies): AgencyEmailSettings {
  return {
    revision: s?.revision ?? null, fromName: s?.from_name ?? "", fromEmail: s?.from_email ?? "",
    smtpHost: "smtp.ionos.co.uk", smtpPort: s?.smtp_port ?? 587,
    hasPassword: Boolean(s?.encrypted_password), enabled: Boolean(s?.enabled), verifiedAt: s?.verified_at ?? null,
    platformSendingEnabled: deps.sendingEnabled, connectionChecksEnabled: deps.checksEnabled && deps.encryptionReady,
    credentialStorageReady: deps.encryptionReady,
  };
}

export async function handleAgencyEmailSettings(request: Request, deps: Dependencies): Promise<Response> {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return response(401, { error: "Please sign in to manage agency email." });
    if (!deps.serverReady) return response(503, { error: "Agency email settings need server setup before they can be used." });
    const actor = await deps.authenticate(token);
    if (!actor) return response(401, { error: "Please sign in again." });
    let body: Record<string, unknown> = {};
    if (request.method !== "GET") {
      if (Number(request.headers.get("content-length")) > 16_000) return response(413, { error: "Settings request is too large." });
      const raw = await request.text();
      if (raw.length > 16_000) return response(413, { error: "Settings request is too large." });
      try { body = JSON.parse(raw); } catch { return response(400, { error: "Invalid settings request." }); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return response(400, { error: "Invalid settings request." });
      const allowed = ["agencyId", "action", "revision", "fromName", "fromEmail", "smtpPort", "password", "authorised"];
      if (Object.keys(body).some(key => !allowed.includes(key))) return response(400, { error: "Invalid settings request." });
    }
    const selectedAgency = request.method === "GET" ? new URL(request.url).searchParams.get("agencyId") : body.agencyId;
    if (typeof selectedAgency !== "string" || !uuid.test(selectedAgency)) return response(400, { error: "Select a valid agency." });
    const agencyId = selectedAgency.toLowerCase();
    const args = { p_actor: actor, p_agency: agencyId };
    const read = () => deps.rpc("read_agency_email_settings", args);
    const initial = await read();
    if (initial.error) return failure(initial.error);
    const current = initial.data as StoredSettings | null;
    if (request.method === "GET") return response(200, { settings: publicSettings(current, deps) });
    if (!["save", "check", "enable", "disable"].includes(String(body.action))) return response(400, { error: "Choose a valid settings action." });
    if (body.revision !== null && (typeof body.revision !== "string" || !uuid.test(body.revision))) return response(400, { error: "Reload the settings before continuing." });
    if ((current?.revision ?? null) !== body.revision) return failure({ code: "40001" });
    if (body.action !== "disable" && !deps.encryptionReady) return response(503, { error: "Secure email credential storage needs server setup. No credentials were saved or checked." });
    if (body.action === "save") {
      const name = typeof body.fromName === "string" ? body.fromName.trim() : "";
      const email = typeof body.fromEmail === "string" ? body.fromEmail.trim().toLowerCase() : "";
      if (!name || name.length > 120 || /[<>\r\n]/.test(name) || email.length > 254 ||
        !/^[A-Za-z0-9.!#$%&*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email) ||
        ![465, 587].includes(Number(body.smtpPort)) || typeof body.smtpPort !== "number" ||
        typeof body.password !== "string" || body.password.length > 2048) {
        return response(400, { error: "Enter a sender name, valid mailbox address and supported SMTP port." });
      }
      if (!body.password && (!current || current.from_email !== email)) return response(400, { error: "Enter the password for this mailbox." });
      const encrypted = body.password ? deps.encrypt(body.password, agencyId) : current!.encrypted_password;
      // Fail closed if retained credentials cannot be decrypted with the active server key.
      deps.decrypt(encrypted, agencyId);
      const saved = await deps.rpc("save_agency_email_settings", {
        ...args, p_revision: body.revision, p_name: name, p_email: email, p_port: body.smtpPort, p_encrypted: encrypted,
      });
      if (saved.error) return failure(saved.error);
    } else {
      if (!current) return response(400, { error: "Save the mailbox details first." });
      const change = (action: string, extras: Record<string, unknown> = {}) => deps.rpc("change_agency_email_settings", {
        ...args, p_revision: body.revision, p_action: action, ...extras,
      });
      if (body.action === "check") {
        if (!deps.checksEnabled) return response(503, { error: "Connection checks are paused on this server. No mailbox connection was attempted." });
        const password = deps.decrypt(current.encrypted_password, agencyId);
        const started = await change("check_start");
        if (started.error) return failure(started.error);
        const testId = (started.data as { testId?: string } | null)?.testId;
        if (!testId || !uuid.test(testId)) return response(503, { error: "Unable to start a connection check. Reload the settings." });
        let passed = false;
        try { await deps.verify({ host: "smtp.ionos.co.uk", port: current.smtp_port, user: current.from_email }, password); passed = true; } catch { /* Provider details may contain credentials; never expose or log them. */ }
        const checked = await change(passed ? "check_passed" : "check_failed", { p_test: testId });
        if (checked.error) return failure(checked.error);
        if (!passed) {
          const refreshed = await read();
          if (refreshed.error) return failure(refreshed.error);
          return response(400, { error: "The mailbox connection check failed. Check the saved address, password and port. Sending remains paused. No email was sent.", settings: publicSettings(refreshed.data as StoredSettings, deps) });
        }
      } else {
        const changed = await change(String(body.action), { p_authorised: body.authorised === true });
        if (changed.error) return failure(changed.error);
      }
    }
    const refreshed = await read();
    if (refreshed.error) return failure(refreshed.error);
    return response(200, { settings: publicSettings(refreshed.data as StoredSettings, deps), message:
      body.action === "save" ? "Mailbox settings saved securely. Check the connection before enabling sending." :
      body.action === "check" ? "Connection and login checked successfully. No email was sent." :
      body.action === "enable" ? "Agency sender enabled. Contact email also requires sending to be enabled on the server." : "Agency sending paused.",
    });
  } catch {
    return response(503, { error: "Unable to complete this settings request. Reload to check its status. No email was sent." });
  }
}
