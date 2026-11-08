import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { validateClaim, type ClaimInput } from "../src/features/claims/policy";
import { createClaimService, ensureClaimSchemaV1 } from "../src/lib/claims/service";
import { ensureReportSchemaV1 } from "../src/lib/reports/service";

const member = { id: "claimant-one", emailVerified: true };
function input(reportId = randomUUID()): ClaimInput { return { requestId: randomUUID(), reportId, identifyingDetail: "There is a small blue sticker underneath the left ear cup.", circumstances: "I last had it in the student commons on Monday afternoon.", additionalContext: "", confirmed: true, attachments: [] }; }
test("claim validation rejects examples, missing confirmation, invalid proof, and oversized answers", () => {
  assert.ok(validateClaim(input()));
  for (const changes of [{ reportId: "headphones" }, { identifyingDetail: "short" }, { circumstances: "" }, { confirmed: false }, { additionalContext: "x".repeat(1501) }]) assert.throws(() => validateClaim({ ...input(), ...changes }));
  const id = randomUUID();
  assert.throws(() => validateClaim({ ...input(), attachments: [id, id] }));
});
test("claims isolate proof and enforce eligibility, atomic evidence transfer, and duplicate protection", { timeout: 120_000 }, async () => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = new MongoClient(replica.getUri());
  try {
    await client.connect(); const db = client.db("isolated_claim_test");
    await ensureReportSchemaV1(db); await ensureClaimSchemaV1(db); await ensureClaimSchemaV1(db);
    const service = createClaimService(db, client);
    const reports = db.collection<{ _id: string; ownerId: string; organization: string; type: string; moderation: string; lifecycle: string; title: string; category: string; location: string; occurredOn: string; description: string; attachments: string[]; createdAt: Date }>("reports");
    async function item(changes = {}) {
      const _id = randomUUID();
      await reports.insertOne({ _id, ownerId: "finder", organization: "community", type: "found", moderation: "published", lifecycle: "open", title: "Headphones", category: "Electronics", location: "Library", occurredOn: "2026-01-01", description: "Black over-ear headphones.", attachments: [], createdAt: new Date(), ...changes }); return _id;
    }
    const reportId = await item();
    await assert.rejects(service.load(null, reportId));
    await assert.rejects(service.submit({ ...member, emailVerified: false }, input(reportId)));
    await assert.rejects(service.submit(null, input(reportId)));
    for (const changes of [{ ownerId: member.id }, { moderation: "pending" }, { moderation: "hidden" }, { type: "lost" }, { lifecycle: "reserved" }, { lifecycle: "returned" }]) await assert.rejects(service.submit(member, input(await item(changes))));
    // Simulate legacy/cross-community data without weakening production validation.
    const foreign = randomUUID();
    await db.command({ insert: "reports", documents: [{ _id: foreign, ownerId: "foreign-finder", organization: "other-community", type: "found", moderation: "published", lifecycle: "open", title: "Foreign item" }], bypassDocumentValidation: true });
    assert.equal(await service.load(member, foreign), null);
    await assert.rejects(service.submit(member, input(foreign)));
    const files = db.collection<{ _id: string; ownerId: string; status: string; expiresAt: Date; publicId: string; resourceType: string; format: string }>("media_uploads");
    const proof = randomUUID();
    await files.insertOne({ _id: proof, ownerId: member.id, status: "ready", expiresAt: new Date(Date.now() + 60_000), publicId: "isolated/claim-proof", resourceType: "image", format: "png" });
    await assert.rejects(service.submit({ id: "other-member", emailVerified: true }, { ...input(reportId), attachments: [proof] }));
    assert.equal(await db.collection("claims").countDocuments(), 0);
    const claim = { ...input(reportId), attachments: [proof] };
    const submitted = await Promise.all([service.submit(member, claim), service.submit(member, { ...claim, requestId: randomUUID() })]);
    assert.equal(submitted[0], submitted[1]);
    assert.equal(await db.collection("claims").countDocuments(), 1);
    assert.equal(await db.collection("audit_events").countDocuments(), 1);
    assert.equal(await files.countDocuments(), 0);
    const evidence = await db.collection("claim_evidence").findOne({ claimId: submitted[0] });
    assert.equal(evidence?.ownerId, member.id); assert.equal(evidence?.expiresAt, undefined);
    const saved = await db.collection("claims").findOne({ claimantId: member.id });
    assert.equal(saved?.status, "pending");
    assert.equal((await reports.findOne({ _id: reportId }))?.lifecycle, "open");
    const ownView = await service.load(member, reportId);
    assert.equal(ownView?.claim?.id, submitted[0]);
    assert.ok(!JSON.stringify(ownView).includes("sticker"));
    assert.equal((await service.load({ id: "other-member", emailVerified: true }, reportId))?.claim, null);
    assert.equal(await service.load({ id: "finder", emailVerified: true }, reportId), null);
    assert.deepEqual(await service.list({ id: "finder", emailVerified: true }), []);
    const audit = await db.collection("audit_events").findOne({ action: "claim.submitted" });
    assert.ok(!JSON.stringify(audit).includes("sticker"));
    for (let n = 0; n < 4; n++) await service.submit(member, input(await item()));
    await assert.rejects(service.submit(member, input(await item())), /five claims/);
    assert.equal((await service.list(member)).length, 5);
    const expired = randomUUID();
    await files.insertOne({ _id: expired, ownerId: "new-member", status: "ready", expiresAt: new Date(Date.now() - 1), publicId: "isolated/expired-proof", resourceType: "image", format: "png" });
    await assert.rejects(service.submit({ id: "new-member", emailVerified: true }, { ...input(reportId), attachments: [expired] }));
    assert.equal(await db.collection("claims").countDocuments(), 5);
  } finally { await client.close(); await replica.stop(); }
});
