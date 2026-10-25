import assert from "node:assert/strict";
import { test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import sharp from "sharp";
import { readCloudinaryConfig } from "../src/lib/media/config";
import { prepareMedia } from "../src/lib/media/prepare";
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES, MEDIA_RETENTION_MS } from "../src/lib/media/policy";
import { createMediaService, ensureMediaIndexesV1 } from "../src/lib/media/service";
import type { MediaLocation, MediaStorage } from "../src/lib/media/cloudinary";

async function imageFile() {
  const bytes = await sharp({ create: {
    width: 2, height: 2, channels: 3, background: "red",
  } }).jpeg().withMetadata().toBuffer();
  return new File([new Uint8Array(bytes)], "private-name.jpg", { type: "image/jpeg" });
}

test("Cloudinary configuration fails closed without credentials", () => {
  assert.equal(readCloudinaryConfig({}), null);
  assert.equal(readCloudinaryConfig({ CLOUDINARY_CLOUD_NAME: "https://evil.test" }), null);
  assert.deepEqual(readCloudinaryConfig({
    CLOUDINARY_CLOUD_NAME: "test-cloud", CLOUDINARY_API_KEY: "key", CLOUDINARY_API_SECRET: "secret",
  }), { cloudName: "test-cloud", apiKey: "key", apiSecret: "secret" });
});

test("media validation checks content, size, decoding, and strips image metadata", async () => {
  const original = await imageFile();
  const originalMetadata = await sharp(Buffer.from(await original.arrayBuffer())).metadata();
  assert.ok(originalMetadata.exif);
  const prepared = await prepareMedia(original);
  assert.equal(prepared.resourceType, "image");
  assert.equal(prepared.format, "jpg");
  const metadata = await sharp(prepared.bytes).metadata();
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
  await assert.rejects(prepareMedia(new File(["<svg/>"], "fake.jpg", { type: "image/jpeg" })));
  await assert.rejects(prepareMedia(new File(["<svg/>"], "file.svg", { type: "image/svg+xml" })));
  await assert.rejects(prepareMedia(new File(["MZ-executable"], "file.mp4", { type: "video/mp4" })));
  await assert.rejects(prepareMedia(new File([], "empty.png", { type: "image/png" })));
  await assert.rejects(prepareMedia(new File([new Uint8Array(IMAGE_MAX_BYTES + 1)], "large.jpg", { type: "image/jpeg" })));
  await assert.rejects(prepareMedia(new File([new Uint8Array(VIDEO_MAX_BYTES + 1)], "large.mp4", { type: "video/mp4" })));
  await assert.rejects(prepareMedia(new File([new Uint8Array(await original.arrayBuffer())], "mismatch.png", { type: "image/png" })));
});

test("media ownership, limits, concurrent uploads, and durable cleanup", { timeout: 240_000 }, async (t) => {
  const replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = new MongoClient(replicaSet.getUri());
  try {
    await client.connect();
    const db = client.db("lostlink_media_test");
    await ensureMediaIndexesV1(db);
    await ensureMediaIndexesV1(db);
    const uploads: string[] = [];
    const deletions: string[] = [];
    let failUpload = false;
    let failDelete = false;
    const storage: MediaStorage = {
      async upload(publicId) {
        uploads.push(publicId);
        if (failUpload) throw new Error("private provider error");
      },
      async remove(location) {
        if (failDelete) throw new Error("provider offline");
        deletions.push(location.publicId);
      },
      download: (location: MediaLocation) => `https://example.test/download/${location.publicId}`,
    };
    const service = createMediaService(db, storage);
    // Legacy approval fields must not restrict verified members.
    const actor = { id: "member-a", emailVerified: true, membershipStatus: "pending" };
    const other = { ...actor, id: "member-b" };

    await t.test("unauthorized and unverified actors cannot read or mutate media", async () => {
      for (const invalid of [null, { ...actor, emailVerified: false }]) {
        await assert.rejects(service.upload(invalid, await imageFile()));
        await assert.rejects(service.list(invalid));
        await assert.rejects(service.download(invalid, "anything"));
        await assert.rejects(service.remove(invalid, "anything"));
      }
      assert.equal(uploads.length, 0);
    });

    await t.test("uploads have generated paths and other members cannot access them", async () => {
      await service.upload(actor, await imageFile());
      const [file] = await service.list(actor);
      assert.ok(file);
      assert.deepEqual(Object.keys(file).sort(), ["expiresAt", "id", "kind"]);
      assert.ok(uploads[0].startsWith("lostlink/attachments/"));
      assert.equal(uploads[0].includes("private-name"), false);
      const record = await db.collection("media_uploads").findOne({ ownerId: actor.id });
      assert.equal(record?.expiresAt.getTime() - record?.createdAt.getTime(), MEDIA_RETENTION_MS);
      assert.ok(await service.download(actor, file.id));
      assert.deepEqual(await service.list(other), []);
      await assert.rejects(service.download(other, file.id));
      await assert.rejects(service.remove(other, file.id));
      assert.equal(deletions.length, 0);
      await service.remove(actor, file.id);
      assert.equal(deletions.length, 1);
      assert.deepEqual(await service.list(actor), []);
      await assert.rejects(service.download(actor, file.id));
    });

    await t.test("concurrent requests cannot exceed five reserved attachments", async () => {
      const concurrentActor = { ...actor, id: "concurrent" };
      const file = await imageFile();
      const results = await Promise.allSettled(Array.from({ length: 7 }, () => service.upload(concurrentActor, file)));
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 5);
      assert.equal(await db.collection("media_uploads").countDocuments({ ownerId: concurrentActor.id }), 5);
      assert.equal((await service.list(concurrentActor)).length, 5);
      await assert.rejects(service.upload(concurrentActor, file), /Too many upload attempts/);
    });

    await t.test("provider failures preserve cleanup records and hide attachments", async () => {
      failUpload = true;
      await assert.rejects(service.upload(other, await imageFile()), /Upload failed/);
      failUpload = false;
      assert.deepEqual(await service.list(other), []);
      assert.equal(await db.collection("media_uploads").countDocuments({ ownerId: other.id }), 1);
      failDelete = true;
      await assert.rejects(service.cleanup());
      assert.equal(await db.collection("media_uploads").countDocuments({ ownerId: other.id }), 1);
      failDelete = false;
      assert.equal(await service.cleanup(), 1);
      assert.equal(await service.cleanup(), 0);
    });

    await t.test("expiry denies downloads before the cleanup worker runs", async () => {
      await service.upload(other, await imageFile());
      const [file] = await service.list(other);
      await db.collection("media_uploads").updateOne({ ownerId: other.id }, { $set: { expiresAt: new Date(0) } });
      assert.deepEqual(await service.list(other), []);
      await assert.rejects(service.download(other, file.id));
      assert.equal(await service.cleanup(), 1);
      assert.equal((await service.list({ ...actor, id: "concurrent" })).length, 5);
    });
  } finally {
    await client.close();
    await replicaSet.stop();
  }
});
