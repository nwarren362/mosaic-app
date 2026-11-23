import { createClient } from "@supabase/supabase-js";
import { handleAgencyEmailSettings } from "@/lib/agencyEmailSettingsApi";
import { decryptEmailPassword, emailEncryptionReady, encryptEmailPassword } from "@/lib/emailCredentialCrypto";
import { verifyContactSmtp } from "@/lib/contactEmailSmtp";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handle(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY, key = process.env.EMAIL_CREDENTIAL_ENCRYPTION_KEY;
  return handleAgencyEmailSettings(request, {
    serverReady: Boolean(url && anon && service), encryptionReady: emailEncryptionReady(key),
    sendingEnabled: process.env.CONTACT_EMAIL_SENDING_ENABLED === "true",
    checksEnabled: process.env.EMAIL_CONNECTION_CHECKS_ENABLED === "true",
    async authenticate(token) {
      const { data, error } = await createClient(url!, anon!, { auth: { persistSession: false, autoRefreshToken: false } }).auth.getUser(token);
      return error ? null : data.user?.id ?? null;
    },
    async rpc(name, args) {
      return createClient(url!, service!, { auth: { persistSession: false, autoRefreshToken: false } }).rpc(name, args);
    },
    encrypt: (password, agency) => encryptEmailPassword(password, agency, key),
    decrypt: (ciphertext, agency) => decryptEmailPassword(ciphertext, agency, key),
    verify: verifyContactSmtp,
  });
}
export const GET = handle;
export const POST = handle;
