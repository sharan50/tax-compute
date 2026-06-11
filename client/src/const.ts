export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Name of the short-lived cookie that carries the OAuth CSRF nonce.
// Must match OAUTH_STATE_COOKIE on the server (see server/_core/oauth.ts).
const OAUTH_STATE_COOKIE = "oauth_state";

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  // CSRF protection (double-submit): a random nonce is embedded in `state`
  // and simultaneously dropped as a short-lived cookie. On callback the server
  // requires the two to match, so an attacker can't forge a login by feeding
  // the victim a `state` value of their choosing.
  const nonce = randomNonce();
  // 10-minute, lax, path-scoped cookie. Not HttpOnly because it's written here
  // in the browser; its only job is to be echoed back for the match check.
  document.cookie =
    `${OAUTH_STATE_COOKIE}=${nonce}; Max-Age=600; Path=/; SameSite=Lax` +
    (window.location.protocol === "https:" ? "; Secure" : "");

  // state = base64( nonce . redirectUri ) — keeps the redirect target the
  // server already relies on, plus the nonce, in one provider-opaque blob.
  const state = btoa(`${nonce}.${redirectUri}`);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
