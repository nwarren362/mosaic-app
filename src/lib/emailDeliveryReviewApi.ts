export type DeliveryReview = {
  id: string; subject: string; toEmail: string; from: string; createdAt: string;
  startedAt: string | null; acceptedAt: string | null; reference: string;
  category: "unsent" | "uncertain" | "history"; busy: boolean;
};
type Dependencies = {
  configured: boolean;
  authenticate: (token: string) => Promise<string | null>;
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
function failure(code?: string) {
  const messages: Record<string, [number, string]> = {
    "42501": [403, "Agency admin access is required for this delivery."],
    "22023": [400, "Check the resolution, evidence and acceptance time."],
    "40001": [409, "This request changed or was already resolved. Reload before continuing."],
    "55000": [409, "This delivery may still be in progress. Wait two minutes, then reload before reviewing it."],
  };
  const [status, error] = messages[code ?? ""] ?? [503, "Unable to confirm the review. Reload and check the saved request before trying again."];
  return reply(status, { error });
}
export async function handleEmailDeliveryReview(request: Request, deps: Dependencies): Promise<Response> {
  try {
    const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return reply(401, { error: "Please sign in to review email requests." });
    if (!deps.configured) return reply(503, { error: "Email review needs server setup." });
    const actor = await deps.authenticate(token);
    if (!actor) return reply(401, { error: "Please sign in again." });
    let body: Record<string, unknown> = {};
    if (request.method !== "GET") {
      if (Number(request.headers.get("content-length")) > 16000) return reply(413, { error: "Review is too large." });
      const text = await request.text();
      if (text.length > 16000) return reply(413, { error: "Review is too large." });
      try { body = JSON.parse(text); } catch { return reply(400, { error: "Invalid review." }); }
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(k => !["agencyId", "deliveryId", "reviewId", "outcome", "evidence", "acceptedAt", "confirmed"].includes(k))) return reply(400, { error: "Invalid review." });
    }
    const selected = request.method === "GET" ? new URL(request.url).searchParams.get("agencyId") : body.agencyId;
    if (typeof selected !== "string" || !uuid.test(selected)) return reply(400, { error: "Select an agency." });
    const agency = selected.toLowerCase();
    const args = { p_actor: actor, p_agency: agency };
    if (request.method !== "GET") {
      if (![body.deliveryId, body.reviewId].every(v => typeof v === "string" && uuid.test(v)) ||
        !["finish_history", "accepted", "not_accepted"].includes(String(body.outcome)) || body.confirmed !== true ||
        typeof body.evidence !== "string" || body.evidence.trim().length < 10 || body.evidence.length > 2000 ||
        (body.outcome === "accepted" && (typeof body.acceptedAt !== "string" || !Number.isFinite(Date.parse(body.acceptedAt))))) {
        return reply(400, { error: "Choose a resolution, record the evidence and confirm your decision." });
      }
      const resolved = await deps.rpc("resolve_contact_email_review", {
        ...args, p_id: body.deliveryId, p_review: body.reviewId, p_outcome: body.outcome,
        p_evidence: body.evidence.trim(), p_accepted_at: body.outcome === "accepted" ? body.acceptedAt : null,
      });
      if (resolved.error) return failure(resolved.error.code);
      const result = resolved.data as { state?: string } | null;
      if (result?.state !== "sent" && result?.state !== "not_sent") return failure();
      return reply(200, { state: result.state, message: "Review saved. No email was sent or resent by this action." });
    }
    const result = await deps.rpc("list_contact_email_reviews", args);
    if (result.error) return failure(result.error.code);
    if (!Array.isArray(result.data) || result.data.length > 50) return failure();
    const deliveries = result.data.map((row: DeliveryReview) => ({
      id: row.id, subject: row.subject, toEmail: row.toEmail, from: row.from, createdAt: row.createdAt,
      startedAt: row.startedAt, acceptedAt: row.acceptedAt, reference: row.reference, category: row.category, busy: row.busy,
    }));
    return reply(200, { deliveries });
  } catch { return failure(); }
}
