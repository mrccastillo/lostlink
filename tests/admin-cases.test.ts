import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Module, { createRequire } from "node:module";
import { test } from "node:test";
import { MongoClient, ObjectId } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { AccountAccess } from "../src/lib/auth/policy";

const testRequire = createRequire(import.meta.url);

// The application reads its session from Next's request context. Replace only
// the server boundary modules in this isolated test process.
function substitute(specifier: string, exports: object) {
  const filename = testRequire.resolve(specifier);
  const original = testRequire.cache[filename];
  const replacement = new Module(filename);
  replacement.exports = exports;
  replacement.loaded = true;
  testRequire.cache[filename] = replacement;
  return () => {
    if (original) testRequire.cache[filename] = original;
    else delete testRequire.cache[filename];
  };
}

test("staff queue and case reads", async (t) => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = new MongoClient(replica.getUri());
  t.after(async () => { await client.close(); await replica.stop(); });
  const db = client.db("staff_case_reads");
  const admin = { emailVerified: true, role: "admin" };
  let actor: AccountAccess | null = admin;
  let databaseReads = 0;
  t.after(substitute("server-only", {}));
  t.after(substitute("../src/lib/auth/session", { getCurrentSession: async () => actor && { user: actor } }));
  t.after(substitute("../src/lib/mongodb", { getDomainDatabase: async () => { databaseReads++; return { db }; } }));
  const { readQueue, readCase } = await import("../src/features/admin/cases");

  const createdAt = new Date("2025-03-05T08:00:00Z");
  const found = randomUUID(), lost = randomUUID(), foreignReport = randomUUID(), foreignClaim = randomUUID();
  const base = { organization: "community", createdAt };
  const report = { ...base, title: "Library satchel", type: "found", moderation: "pending" };
  const pendingReports = Array.from({ length: 23 }, () => randomUUID());
  await db.collection<typeof report & { _id: string }>("reports").insertMany([
    ...pendingReports.map(_id => ({ ...report, _id })),
    { ...report, _id: found, moderation: "published" },
    { ...report, _id: lost, moderation: "published", type: "lost" },
    { ...report, _id: foreignReport, organization: "foreign" },
  ]);
  const privateFields = {
    identifyingDetail: "A hidden serial number", circumstances: "A private ownership answer",
    additionalContext: "claimant@example.test", attachments: ["private-proof-file"],
  };
  const claim = { ...base, ...privateFields, reportId: found, claimantId: "claimant", status: "pending" };
  const pending = Array.from({ length: 23 }, () => randomUUID());
  const approved = Array.from({ length: 23 }, () => randomUUID());
  const selected = pending[0];
  const wrongParent = randomUUID();
  await db.collection<typeof claim & { _id: string }>("claims").insertMany([
    ...pending.map(_id => ({ ...claim, _id, claimantId: "member-" + _id })),
    ...approved.map((_id, index) => ({ ...claim, _id, reportId: pendingReports[index], status: "approved" })),
    { ...claim, _id: foreignClaim, organization: "foreign" },
    { ...claim, _id: wrongParent, reportId: foreignReport, status: "rejected" },
  ]);

  await t.test("guests, unverified admins and verified members are denied before a database read", async () => {
    for (const [user, error] of [
      [null, /NEXT_REDIRECT/],
      [{ ...admin, emailVerified: false }, /NEXT_REDIRECT/],
      [{ emailVerified: true, role: "member" }, /NEXT_HTTP_ERROR_FALLBACK;404/],
    ] as const) {
      actor = user;
      for (const queue of ["reports", "claims", "pickups"] as const) {
        await assert.rejects(readQueue(queue, queue === "pickups" ? "approved" : "pending"), error);
        await assert.rejects(readCase(queue, queue === "reports" ? found : selected), error);
      }
    }
    assert.equal(databaseReads, 0);
    actor = admin;
  });

  await t.test("all three queues page tied timestamps in descending ID order within community and state", async () => {
    for (const [queue, state, ids] of [
      ["reports", "pending", pendingReports], ["claims", "pending", pending], ["pickups", "approved", approved],
    ] as const) {
      const first = await readQueue(queue, state);
      assert.equal(first.items.length, 20);
      assert.ok(first.next);
      const second = await readQueue(queue, state, first.next);
      assert.equal(second.next, null);
      assert.deepEqual([...first.items, ...second.items].map(row => row.id), [...ids].sort().reverse());
    }
  });

  await t.test("foreign reports, foreign claims and a local claim with a foreign parent are unavailable", async () => {
    for (const [queue, id] of [["reports", foreignReport], ["claims", foreignClaim], ["claims", wrongParent]] as const)
      await assert.rejects(readCase(queue, id), /NEXT_HTTP_ERROR_FALLBACK;404/);
  });

  await t.test("competing claims are paginated summaries for the same report, excluding the selected claim", async () => {
    const first = await readCase("claims", selected);
    assert.equal(first.claim?.identifyingDetail, privateFields.identifyingDetail);
    assert.equal(first.related.items.length, 20);
    assert.ok(first.related.next);
    const second = await readCase("claims", selected, undefined, first.related.next);
    assert.equal(second.related.next, null);
    const related = [...first.related.items, ...second.related.items];
    assert.deepEqual(related.map(row => row._id), pending.filter(id => id !== selected).sort().reverse());
    for (const row of related) {
      for (const key of Object.keys(privateFields)) assert.equal(Object.hasOwn(row, key), false);
    }
  });

  await t.test("chronological history includes linked lost handoffs and excludes foreign events and private fields", async () => {
    const event = { createdAt, entityId: selected, actorId: "reviewer", reportId: found, claimId: selected,
      action: "claim.approved", from: "pending", to: "approved" };
    const sensitive = { ...privateFields, phone: "+65 5555 0100", signedUrl: "https://example.test/proof?signature=secret",
      reason: "Restricted reviewer notes" };
    const events = Array.from({ length: 22 }, () => ({ ...event, _id: new ObjectId() }));
    const handoff = { ...event, _id: new ObjectId(), linkedLostId: lost, action: "claim.fulfilled", from: "approved", to: "fulfilled" };
    const publication = { _id: new ObjectId(), createdAt: new Date(createdAt.getTime() - 1000),
      entityId: found, actorId: "moderator", action: "report.published", from: "pending", to: "published" };
    const records = [publication, ...events, handoff];
    await db.collection("audit_events").insertMany([
      ...records.toReversed().map(row => ({ ...row, organization: "community", ...sensitive })),
      { ...handoff, _id: new ObjectId(), organization: "foreign" },
      { ...publication, _id: new ObjectId(), organization: "community", entityId: foreignReport },
    ]);
    const first = await readCase("reports", found);
    assert.equal(first.history.items.length, 20);
    assert.ok(first.history.next);
    const second = await readCase("reports", found, first.history.next);
    assert.equal(second.history.next, null);
    assert.deepEqual([...first.history.items, ...second.history.items], records);
    const linked = await readCase("reports", lost);
    assert.deepEqual(linked.history.items, [handoff]);
    const claimCase = await readCase("claims", selected);
    assert.deepEqual(claimCase.history.items, events.slice(0, 20));
  });
});
