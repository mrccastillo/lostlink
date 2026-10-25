export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const POST_LOGIN_PATH = "/post";
export const POST_ITEM_LOGIN_PATH = "/login?next=%2Fpost";

// Only known application destinations may be used after authentication.
export function safeReturnPath(value: unknown): string {
  return value === "/" ? "/" : POST_LOGIN_PATH;
}

export function canPost(user: { emailVerified: boolean }) {
  return user.emailVerified;
}
