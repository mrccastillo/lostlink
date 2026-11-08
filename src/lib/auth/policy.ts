import { safeClaimPath } from "@/features/claims/policy";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const POST_LOGIN_PATH = "/discover";
export const POST_MODAL_PATH = "/discover?compose=1";
export const POST_ITEM_LOGIN_PATH = `/login?next=${encodeURIComponent(POST_MODAL_PATH)}`;

// Only known application destinations may be used after authentication.
export function safeReturnPath(value: unknown): string {
  if (value === POST_MODAL_PATH || value === "/post") return POST_MODAL_PATH;
  if (value === "/claims") return "/claims";
  if (value === "/my-posts") return "/my-posts";
  return safeClaimPath(value) ?? POST_LOGIN_PATH;
}

export function canPost(user: { emailVerified: boolean }) {
  return user.emailVerified;
}
