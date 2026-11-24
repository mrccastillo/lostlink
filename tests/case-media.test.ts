import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { caseMediaDownload } from "../src/lib/media/case-download";
import type { AccountAccess } from "../src/lib/auth/policy";

test("case media redirects only for an authorized viewer and a matching permanent attachment", async () => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = new MongoClient(replica.getUri());
  try {
    const db = client.db("case_media_test");
    const member = { emailVerified: true, role: "member" };
    const admin = { emailVerified: true, role: "admin" };
    const reportId = randomUUID(), claimId = randomUUID(), photo = randomUUID(), proof = randomUUID();
    const reports = db.collection<{ _id: string; ownerId: string; organization: string; moderation: string; attachments: string[]; approvedMedia?: string[] }>("reports");
    const claims = db.collection<{ _id: string; claimantId: string; organization: string; attachments: string[] }>("claims");
    await reports.insertOne({ _id: reportId, ownerId: "finder", organization: "community", moderation: "published", attachments: [photo] });
    await claims.insertOne({ _id: claimId, claimantId: "claimant", organization: "community", attachments: [proof] });
    const photos = db.collection<{ _id: string; ownerId: string; reportId: string; publicId: string; resourceType: string; format: string }>("report_media");
    const evidence = db.collection<{ _id: string; ownerId: string; claimId: string; publicId: string; resourceType: string; format: string }>("claim_evidence");
    await photos.insertOne({ _id: photo, ownerId: "finder", reportId, publicId: "photo", resourceType: "image", format: "png" });
    await evidence.insertOne({ _id: proof, ownerId: "claimant", claimId, publicId: "proof", resourceType: "video", format: "mp4" });

    async function check(actor: AccountAccess | null, kind: string, entityId: string, mediaId: string, expected: number) {
      const signed: string[] = [];
      const response = await caseMediaDownload(actor, { kind, entityId, mediaId }, async () => ({ db }), (location) => {
        signed.push(location.publicId);
        return "https://storage.example/signed";
      });
      assert.equal(response.status, expected);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.headers.get("location"), expected === 307 ? "https://storage.example/signed" : null);
      assert.deepEqual(signed, expected === 307 ? [kind === "claim" ? "proof" : "photo"] : []);
    }

    await check(admin, "report", reportId, photo, 307);
    await check(admin, "claim", claimId, proof, 307);
    await check(member, "report", reportId, photo, 403);
    await check(member, "claim", claimId, proof, 403);
    await check({ ...admin, emailVerified: false }, "claim", claimId, proof, 403);
    await check(member, "published", reportId, photo, 404);
    await reports.updateOne({ _id: reportId }, { $set: { approvedMedia: [photo, proof] } });
    await check(member, "published", reportId, photo, 307);
    await check(member, "published", reportId, proof, 404);
    await check(null, "published", reportId, photo, 401);
    await check({ ...member, emailVerified: false }, "published", reportId, photo, 403);
    await check(admin, "other", reportId, photo, 404);
    await check(admin, "report", "invalid", photo, 404);
    await reports.updateOne({ _id: reportId }, { $set: { moderation: "hidden" } });
    await check(member, "published", reportId, photo, 404);
    await photos.updateOne({ _id: photo }, { $set: { ownerId: "someone-else" } });
    await check(admin, "report", reportId, photo, 404);
    await evidence.updateOne({ _id: proof }, { $set: { claimId: randomUUID() } });
    await check(admin, "claim", claimId, proof, 404);
    await evidence.updateOne({ _id: proof }, { $set: { claimId, ownerId: "finder" } });
    await check(admin, "claim", claimId, proof, 404);
    await evidence.updateOne({ _id: proof }, { $set: { ownerId: "claimant" } });
    await photos.updateOne({ _id: photo }, { $set: { ownerId: "finder" } });
    await claims.updateOne({ _id: claimId }, { $set: { organization: "other" } });
    await reports.updateOne({ _id: reportId }, { $set: { organization: "other", moderation: "published" } });
    await check(admin, "claim", claimId, proof, 404);
    await check(admin, "report", reportId, photo, 404);
    await check(member, "published", reportId, photo, 404);
  } finally {
    await client.close();
    await replica.stop();
  }
});
