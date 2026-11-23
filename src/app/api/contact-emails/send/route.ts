import { decryptEmailPassword, emailEncryptionReady } from "@/lib/emailCredentialCrypto";
import { sendContactSmtp } from "@/lib/contactEmailSmtp";
import { createClient } from "@supabase/supabase-js";
import { handleContactEmail } from "@/lib/contactEmailDelivery";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const service = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  return handleContactEmail(request, {
    enabled: process.env.CONTACT_EMAIL_SENDING_ENABLED === "true",
    configured: Boolean(url && anon && service && emailEncryptionReady(process.env.EMAIL_CREDENTIAL_ENCRYPTION_KEY)),
    async authenticate(token) {
      const client = createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await client.auth.getUser(token);
      return error ? null : data.user?.id ?? null;
    },
    async rpc(name, args) {
      const client = createClient(url!, service!, { auth: { persistSession: false, autoRefreshToken: false } });
      return client.rpc(name, args);
    },
    credential: (encrypted, agencyId) => decryptEmailPassword(encrypted, agencyId.toLowerCase(), process.env.EMAIL_CREDENTIAL_ENCRYPTION_KEY),
    send: sendContactSmtp,
  });
}
