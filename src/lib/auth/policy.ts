import { safeClaimPath } from "@/features/claims/policy";
import { adminQueues } from "@/features/admin/navigation";
import { REPORT_UUID } from "@/features/reports/policy";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const POST_LOGIN_PATH = "/discover";
export const ADMIN_DASHBOARD_PATH = "/admin";
export const MEMBER_ROLE = "member";
export const ADMIN_ROLE = "admin";
export const POST_MODAL_PATH = "/discover?compose=1";
export const POST_ITEM_LOGIN_PATH = `/login?next=${encodeURIComponent(POST_MODAL_PATH)}`;

// Only known application destinations may be used after authentication.
export function safeReturnPath(value: unknown): string {
  if (value === POST_MODAL_PATH || value === "/post") return POST_MODAL_PATH;
  if (value === ADMIN_DASHBOARD_PATH) return ADMIN_DASHBOARD_PATH;
  if (typeof value === "string" && value.startsWith("/admin/")) {
    const [queue, id, ...extra] = value.slice(7).split("/");
    if (adminQueues.some(({ key }) => key === queue) && !extra.length && (id === undefined || REPORT_UUID.test(id))) return value;
  }
  if (value === "/claims") return "/claims";
  if (value === "/my-posts") return "/my-posts";
  if (value === "/help") return "/help";
  return safeClaimPath(value) ?? POST_LOGIN_PATH;
}

export function canPost(user: { emailVerified: boolean }) {
  return user.emailVerified;
}

export type AccountAccess = { emailVerified: boolean; role?: unknown };

export function canAccessAdmin(user: AccountAccess | null | undefined) {
  return user?.emailVerified === true && user.role === ADMIN_ROLE;
}

export function accountHome(user: AccountAccess) {
  return canAccessAdmin(user) ? ADMIN_DASHBOARD_PATH : POST_LOGIN_PATH;
}
