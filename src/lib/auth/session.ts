import "server-only";
import { headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
import { getAuth } from "./server";

export async function getCurrentSession() {
  const requestHeaders = await headers();
  if (!getSessionCookie(requestHeaders, { cookiePrefix: "lostlink" }))
    return null;
  try {
    const auth = await getAuth();
    if (!auth) return null;
    return await auth.api.getSession({ headers: requestHeaders });
  } catch {
    console.error("AUTH_SESSION_UNAVAILABLE");
    return null;
  }
}
