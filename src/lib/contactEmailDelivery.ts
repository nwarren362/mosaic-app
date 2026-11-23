// Server orchestration; injected dependencies keep tests away from real mail providers.
type Dependencies = {
  enabled: boolean;
  configured: boolean;
  authenticate: (token: string) => Promise<string | null>;
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown; error: { code?: string; message?: string } | null;
  }>;
  credential: (encrypted: string, agencyId: string) => string | undefined;
  send: (payload: unknown, id: string, credential: string, connection: unknown) => Promise<{ id: string }>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (status: number, body: Record<string, unknown>) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store" },
});
const uncertain = (id: string) => reply(503, {
  requestId: id,
  error: "Delivery is not yet confirmed. Keep this request and check its status; do not create a replacement email. If it remains unresolved, ask your agency administrator to review it.",
});

export async function handleContactEmail(request: Request, deps: Dependencies): Promise<Response> {
  let id: string | undefined;
  let reserved = false;
  try {
    const bearer = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!bearer) return reply(401, { error: "Please sign in to send email." });
    if (!deps.configured || !deps.enabled) return reply(503, { error: "Agency email sending is not enabled. No new send was attempted. Any earlier request may still need review." });
    const actor = await deps.authenticate(bearer);
    if (!actor) return reply(401, { error: "Please sign in again to send email." });
    if (Number(request.headers.get("content-length")) > 100_000) return reply(413, { error: "Message is too large." });
    const raw = await request.text();
    if (raw.length > 100_000) return reply(413, { error: "Message is too large." });
    let body;
    try { body = JSON.parse(raw); } catch { return reply(400, { error: "Invalid email request." }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply(400, { error: "Invalid email request." });
    const allowed = new Set(["agencyId", "contactId", "requestId", "subject", "textBody", "bccMyself", "retry"]);
    if (Object.keys(body).some(key => !allowed.has(key)) ||
      ![body.agencyId, body.contactId, body.requestId].every(v => typeof v === "string" && uuid.test(v)) ||
      (body.retry !== undefined && typeof body.retry !== "boolean")) return reply(400, { error: "Select an agency contact and a valid request." });
    if (!body.retry && (typeof body.subject !== "string" || !body.subject.trim() || body.subject.length > 200 || /[\r\n]/.test(body.subject) ||
      typeof body.textBody !== "string" || !body.textBody.trim() || body.textBody.length > 20_000 || typeof body.bccMyself !== "boolean")) {
      return reply(400, { error: "Enter a subject (up to 200 characters) and message (up to 20,000 characters)." });
    }
    id = body.requestId;
    const { data, error } = await deps.rpc("prepare_contact_email", {
      p_actor: actor, p_agency: body.agencyId, p_contact: body.contactId, p_id: id,
      p_subject: body.retry ? null : body.subject.trim(), p_text: body.retry ? null : body.textBody.trim(), p_bcc: body.retry ? null : body.bccMyself,
    });
    if (error) {
      const messages: Record<string, [number, string]> = {
        "42501": [403, "You do not have access to this agency contact or email request."],
        "22023": [400, "The contact or message is invalid, or this retry differs from the original email."],
        "55000": [503, "Your agency has no enabled, verified email sender. No message was sent."],
        "54000": [429, "Email limit reached. Please try again later."],
      };
      const [status, message] = messages[error.code ?? ""] ?? [503, "Email preparation could not be confirmed. Retry this same request."];
      return reply(status, { error: message, requestId: id });
    }
    const delivery = data as { state?: string; payload?: unknown; encryptedPassword?: string; connection?: unknown; providerId?: string } | null;
    if (delivery?.state === "sent") return reply(200, { requestId: id, state: "sent" });
    if (delivery?.state === "cancelled") return reply(409, { requestId: id, error: "This request was closed without sending. Close this composer and reopen it to start a new email if needed." });
    if (delivery?.state === "finalize") {
      const complete = await deps.rpc("complete_contact_email", { p_id: id });
      return complete.error ? uncertain(id!) : reply(200, { requestId: id, state: "sent" });
    }
    if (delivery?.state === "busy") return reply(409, { requestId: id, error: "This email request is already being processed. Retry after one minute." });
    if (delivery?.state === "review") return reply(409, { requestId: id, error: "This request needs administrator review. Automatic retry is blocked to avoid duplicate or unauthorised sending." });
    if (delivery?.state !== "ready" || !delivery.payload || typeof delivery.encryptedPassword !== "string") return uncertain(id!);
    reserved = true;
    const credential = deps.credential(delivery.encryptedPassword, body.agencyId);
    if (!credential) return reply(503, { requestId: id, error: "Your agency email connection is unavailable. No message was sent. Ask your administrator to review the connection, then retry this request." });
    // SMTP cannot safely deduplicate retries. Commit the send barrier before any network call.
    const started = await deps.rpc("start_contact_email", { p_id: id });
    if (started.error || started.data !== true) return uncertain(id!);
    const receipt = await deps.send(delivery.payload, id!, credential, delivery.connection);
    if (typeof receipt?.id !== "string" || !receipt.id || receipt.id.length > 200) return uncertain(id!);
    // Save the receipt separately so history failures can recover without another SMTP send.
    const recorded = await deps.rpc("record_contact_email_receipt", { p_id: id, p_provider: receipt.id });
    if (recorded.error) return uncertain(id!);
    const complete = await deps.rpc("complete_contact_email", { p_id: id });
    if (complete.error) return uncertain(id!);
    return reply(200, { requestId: id, state: "sent" });
  } catch {
    return reserved && id ? uncertain(id) : reply(503, { error: "Unable to confirm this request. Keep your message and retry the same request.", ...(id ? { requestId: id } : {}) });
  }
}
