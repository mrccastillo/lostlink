import { REPORT_UUID } from "@/features/reports/policy";
import { MEDIA_ACCEPT, MediaError } from "./policy";

type Actor = { id: string; emailVerified: boolean };
type Service = { download: (actor: Actor, id: string) => Promise<string> };
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function attachmentPreview(
  actor: Actor | null,
  id: string,
  service: () => Promise<Service>,
  fetchMedia: typeof fetch = fetch,
) {
  if (!actor) return new Response(null, { status: 401, headers });
  if (!actor.emailVerified) return new Response(null, { status: 403, headers });
  if (!REPORT_UUID.test(id)) return new Response(null, { status: 404, headers });
  try {
    // download verifies ownership, ready status, and expiry before signing.
    const url = await (await service()).download(actor, id);
    const media = await fetchMedia(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const type = media.headers.get("Content-Type")?.split(";", 1)[0].trim();
    if (!media.ok || !type || !MEDIA_ACCEPT.split(",").includes(type)) {
      await media.body?.cancel();
      return new Response(null, { status: 502, headers });
    }
    // Proxy the content so signed provider URLs never enter the form or browser cache.
    return new Response(media.body, { headers: { ...headers, "Content-Type": type, "Content-Disposition": "inline" } });
  } catch (error) {
    if (error instanceof MediaError) return new Response(null, { status: 404, headers });
    console.error("MEDIA_PREVIEW_UNAVAILABLE");
    return new Response(null, { status: 503, headers });
  }
}
