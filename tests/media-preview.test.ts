import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { attachmentPreview } from "../src/lib/media/preview";
import { MediaError } from "../src/lib/media/policy";

const actor = { id: "owner", emailVerified: true };
const id = randomUUID();

test("attachment previews reject invalid access before reading storage", async () => {
  const service = async () => { assert.fail("Must not access storage"); };
  assert.equal((await attachmentPreview(null, id, service)).status, 401);
  assert.equal((await attachmentPreview({ ...actor, emailVerified: false }, id, service)).status, 403);
  assert.equal((await attachmentPreview(actor, "invalid", service)).status, 404);
});

test("attachment previews do not fetch denied, expired, or missing uploads", async () => {
  const response = await attachmentPreview(actor, id, async () => ({
    download: async (requestActor, requestId) => {
      assert.deepEqual(requestActor, actor);
      assert.equal(requestId, id);
      throw new MediaError("This attachment is unavailable.");
    },
  }), async () => { assert.fail("Must not fetch denied media"); });
  assert.equal(response.status, 404);
});

test("attachment previews serve private inline media without exposing signed URLs", async () => {
  const signedUrl = "https://example.test/private?signature=secret";
  const service = async () => ({ download: async () => signedUrl });
  for (const type of ["image/jpeg", "video/mp4"]) {
    const response = await attachmentPreview(actor, id, service, async (url, options) => {
      assert.equal(url, signedUrl);
      assert.equal(options?.cache, "no-store");
      return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": type, "Content-Disposition": "attachment" } });
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), type);
    assert.equal(response.headers.get("Content-Disposition"), "inline");
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(response.headers.get("Location"), null);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([1, 2, 3]));
  }
  for (const upstream of [new Response("provider error", { status: 403 }), new Response("<script>bad</script>", { headers: { "Content-Type": "text/html" } })]) {
    const response = await attachmentPreview(actor, id, service, async () => upstream);
    assert.equal(response.status, 502);
    assert.equal(await response.text(), "");
  }
});
