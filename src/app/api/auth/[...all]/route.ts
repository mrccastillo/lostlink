import { getAuth } from "@/lib/auth/server";

async function handleAuth(request: Request) {
  try {
    const auth = await getAuth();
    if (auth) {
      const response = await auth.handler(request);
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
  } catch {
    console.error("AUTH_REQUEST_UNAVAILABLE");
  }
  return Response.json(
    {
      code: "AUTH_UNAVAILABLE",
      message:
        "Account access is temporarily unavailable. Please try again later.",
    },
    {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    },
  );
}

export const GET = handleAuth;
export const POST = handleAuth;
