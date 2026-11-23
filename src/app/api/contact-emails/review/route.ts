import { createClient } from "@supabase/supabase-js";
import { handleEmailDeliveryReview } from "@/lib/emailDeliveryReviewApi";

export const runtime = "nodejs";

async function handle(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return handleEmailDeliveryReview(request, {
    configured: Boolean(url && publicKey && secret),
    async authenticate(token) {
      const { data, error } = await createClient(url!, publicKey!, { auth: { persistSession: false, autoRefreshToken: false } }).auth.getUser(token);
      return error ? null : data.user?.id ?? null;
    },
    async rpc(name, args) {
      return createClient(url!, secret!, { auth: { persistSession: false, autoRefreshToken: false } }).rpc(name, args);
    },
  });
}
export const GET = handle;
export const POST = handle;
