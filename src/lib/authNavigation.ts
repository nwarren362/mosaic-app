// Keep agency invitations until acceptance succeeds; never accept a caller-supplied redirect.
type InviteStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const invitationKey = "pending_invite_token";
// Delay access to the browser's storage property so privacy-mode failures are caught below.
export const browserInvitationStorage: InviteStorage = {
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: key => localStorage.removeItem(key),
};

export function rememberInvitation(storage: InviteStorage, token: string) {
  try { storage.setItem(invitationKey, token); return true; } catch { return false; }
}

export function postAuthDestination(storage: Pick<Storage, "getItem">) {
  try {
    const token = storage.getItem(invitationKey);
    if (token && token.length <= 2048) return `/accept-invite?token=${encodeURIComponent(token)}`;
  } catch { /* Sign-in can still succeed when browser storage is restricted. */ }
  return "/me";
}

export function forgetAcceptedInvitation(storage: InviteStorage, token: string) {
  try {
    // Another tab may have opened another invitation while acceptance was running.
    if (storage.getItem(invitationKey) === token) storage.removeItem(invitationKey);
  } catch { /* An accepted invitation does not depend on local cleanup. */ }
}

export function confirmationRedirectUrl(origin: string) {
  return new URL("/auth/confirm", origin).toString();
}

type ConfirmationAuth = {
  getSession: () => Promise<{ data: { session: unknown | null }; error: unknown }>;
  getUser: () => Promise<{ data: { user: { email_confirmed_at?: string | null } | null }; error: unknown }>;
};
export type ConfirmationResult = { status: "success"; destination: string } | { status: "error"; message: string };

export function confirmationLinkFailed(href: string) {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  return [url.searchParams, fragment].some(params => params.has("error") || params.has("error_code") || params.has("error_description"));
}

export async function checkEmailConfirmation(auth: ConfirmationAuth, href: string, storage: Pick<Storage, "getItem">): Promise<ConfirmationResult> {
  if (confirmationLinkFailed(href)) {
    return { status: "error", message: "This confirmation link has expired or is invalid. Sign in if you have already confirmed your email, or return to sign up to try again." };
  }
  // The existing browser client uses implicit flow and consumes its URL fragment.
  // getSession waits for that initialization; do not parse/store access tokens here.
  try {
    const { data, error } = await auth.getSession();
    if (error || !data.session) return { status: "error", message: "No confirmed sign-in session was found. Open the confirmation link from your email, or sign in if you have already confirmed." };
    const { data: identity, error: identityError } = await auth.getUser();
    if (identityError || !identity.user?.email_confirmed_at) return { status: "error", message: "Mosaic could not verify your email confirmation. Please sign in and try your invitation again." };
    return { status: "success", destination: postAuthDestination(storage) };
  } catch {
    return { status: "error", message: "Mosaic could not check your confirmation. Check your connection, then reload this page or sign in." };
  }
}
