// Temporary identity for private multiplayer. Supabase Auth (anonymous)
// supplies the signed JWT; this module only validates human-facing input.
// Guest names are cosmetic and NEVER an authorization credential.
export const GUEST_NICK_MIN=2;
export const GUEST_NICK_MAX=24;
export function normalizedGuestNickname(input) {
  const nickname=String(input??"").trim().replace(/\s+/g," ");
  if(nickname.length<GUEST_NICK_MIN||nickname.length>GUEST_NICK_MAX||
    !/^[\p{L}\p{N} ._-]+$/u.test(nickname)){
    throw new Error("Enter a nickname (2–24 letters, numbers, spaces, dots, dashes or underscores).");
  }
  return nickname;
}
export function isTemporaryGuest(user) {
  // Supabase sets is_anonymous=false after a verified identity is linked.
  // Prefer that explicit flag; older Auth payloads may need a provider fallback.
  if(!user)return false;
  if(typeof user.is_anonymous==="boolean")return user.is_anonymous;
  return user.app_metadata?.provider==="anonymous";
}
export function guestAuthMessage(error) {
  const value=String(error?.message||"");
  if(/anonymous.*(disabled|not enabled|signup)|signups? not allowed/i.test(value))
    return "Guest rooms need Anonymous Sign-Ins enabled in Supabase Auth settings. The host can enable it once; no player needs an email.";
  if(/captcha|turnstile/i.test(value))
    return "Guest entry requires the site's CAPTCHA verification. Try again or contact the host.";
  if(/rate limit|too many requests|429/i.test(value))
    return "Guest entry is temporarily rate-limited. Try again later.";
  return value||"Could not start a guest session. Please try again.";
}
