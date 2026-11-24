import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
import { getAuth } from "./server";

export const getCurrentSession = cache(async () => {
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
});
