import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { applyAdminDecision, ensureDecisionIndexesV1 } from "../src/features/admin/decisions";
import { createReportService, ensureReportSchemaV1 } from "../src/lib/reports/service";
import { createClaimService, ensureClaimSchemaV1 } from "../src/lib/claims/service";

const admin = { id: "reviewer", role: "admin", emailVerified: true };
const member = { id: "claimant", role: "member", emailVerified: true };
const reason = "Reviewed confidential proof at private@example.com";
let replica: MongoMemoryReplSet;
let client: MongoClient;

before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  client = await new MongoClient(replica.getUri()).connect();
});
after(async () => {
  await client?.close();
  await replica?.stop();
});

function decision(action: string, entityId: string, expected: string, extra: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ action, entityId, expected, requestId: randomUUID(), reason, ...extra }))
    form.set(key, value);
  return form;
}

async function fixture() {
  const db = client.db(randomUUID());
  await ensureReportSchemaV1(db);
  await ensureClaimSchemaV1(db);
  await ensureDecisionIndexesV1(db);
  const reports = createReportService(db, client);
  const claims = createClaimService(db, client);
  const item = (type: "found" | "lost" = "found", ownerId = "finder", attachments: string[] = []) =>
    reports.submit({ id: ownerId, emailVerified: true }, { requestId: randomUUID(), type, title: "Canvas bag",
      description: "Small green bag", location: "Library", category: "Bags & accessories", occurredOn: "2020-01-01", attachments });
  const submit = (reportId: string, id = member.id) => claims.submit({ ...member, id }, {
    requestId: randomUUID(), reportId, identifyingDetail: "Secret embroidered initials", circumstances: "Last held on the bus",
    additionalContext: "", attachments: [], confirmed: true,
  });
  const run = (form: FormData, actor = admin) => applyAdminDecision(db, client, actor, form);
  const published = async () => {
    const id = await item();
    await run(decision("publish", id, "pending"));
    return id;
  };
  const rows = db.collection<{ _id: string; lifecycle: string; approvedMedia?: string[]; reservedClaimId?: string; title: string }>("reports");
  const audit = db.collection("audit_events");
  const returns = db.collection("return_events");
  return { db, item, published, submit, run, rows, reports, claims, audit, returns };
}

test("publish uses original text and all report media; hiding removes eligibility and updates My Posts", async () => {
  const { db, item, run, rows, submit, claims, reports, audit } = await fixture();
  const media = [randomUUID(), randomUUID()];
  await db.command({ insert: "media_uploads", documents: media.map(_id => ({ _id, ownerId: "finder", status: "ready",
    expiresAt: new Date(Date.now() + 60_000), publicId: "private/" + _id, resourceType: "image", format: "png" })) });
  const id = await item("found", "finder", media);
  const form = decision("publish", id, "pending", { title: "Forged text", approvedMedia: randomUUID(), reason: "" });
  await assert.rejects(run(form), /attachment/);
  form.delete("approvedMedia");
  await Promise.all([run(form), run(form)]);
  const report = await rows.findOne({ _id: id });
  assert.deepEqual(report?.approvedMedia, media);
  assert.equal(report?.title, "Canvas bag");
  assert.equal((await claims.load(member, id))?.item.available, true);
  form.set("reason", "Different decision reason");
  await assert.rejects(run(form), /already used/);
  await assert.rejects(run(decision("hide", id, "pending")), /published/);
  await assert.rejects(run(decision("hide", id, "published", { reason: " " })), /reason/);
  await run(decision("hide", id, "published"));
  assert.equal((await reports.listOwn({ ...member, id: "finder" })).items[0].moderation, "hidden");
  assert.equal(await claims.load(member, id), null);
  await assert.rejects(submit(id), /unavailable/);
  await run(decision("hide", await item(), "pending"));
  assert.equal(await audit.countDocuments({ action: "report.published" }), 1);
});

test("publication verifies attachment ownership before making the report visible", async () => {
  const { db, item, run, rows } = await fixture();
  const media = randomUUID();
  await db.command({ insert: "media_uploads", documents: [{ _id: media, ownerId: "finder", status: "ready",
    expiresAt: new Date(Date.now() + 60_000), publicId: "private/report", resourceType: "image", format: "png" }] });
  const source = await item("found", "finder", [media]);
  const target = await item();
  await assert.rejects(run(decision("publish", target, "pending", { approvedMedia: media })), /attachment/);
  await db.collection("report_media").updateOne({ reportId: source }, { $set: { ownerId: "another-owner" } });
  await assert.rejects(run(decision("publish", source, "pending")), /attachment/);
  await run(decision("publish", target, "pending"));
  assert.deepEqual((await rows.findOne({ _id: target }))?.approvedMedia, []);
});

test("a request ID reused concurrently for different cases commits only the winning confirmation", async () => {
  const { item, run, audit } = await fixture();
  const first = await item(), second = await item();
  const requestId = randomUUID();
  const forms = [first, second].map(id => decision("publish", id, "pending", { requestId }));
  const results = await Promise.allSettled(forms.map(form => run(form)));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.match(results.find(result => result.status === "rejected")?.reason.message, /already used/);
  assert.equal(await audit.countDocuments({ requestId }), 1);
  await run(forms[results[0].status === "fulfilled" ? 0 : 1]);
  assert.equal(await audit.countDocuments({ requestId }), 1);
});

test("competing approvals reserve once; rejection and hiding preserve the reservation; cancellation releases it", async () => {
  const { published, submit, run, rows, claims, audit, returns } = await fixture();
  const id = await published(), first = await submit(id), second = await submit(id, "other");
  const results = await Promise.allSettled([run(decision("approve", first, "pending")),
    run(decision("approve", second, "pending"), { ...admin, id: "second-reviewer" })]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.match(results.find(r => r.status === "rejected")?.reason.message, /reserved/);
  const winner = results[0].status === "fulfilled" ? first : second;
  const pending = winner === first ? second : first;
  assert.equal((await rows.findOne({ _id: id }))?.reservedClaimId, winner);
  await run(decision("reject", pending, "pending"));
  assert.equal((await claims.list({ ...member, id: pending === first ? member.id : "other" }))[0].status, "rejected");
  await run(decision("hide", id, "published"));
  assert.equal((await rows.findOne({ _id: id }))?.lifecycle, "reserved");
  const cancel = decision("cancel", winner, "approved");
  await run(cancel);
  await run(cancel);
  assert.equal((await rows.findOne({ _id: id }))?.lifecycle, "open");
  assert.equal((await rows.findOne({ _id: id }))?.reservedClaimId, undefined);
  assert.equal((await claims.list({ ...member, id: winner === first ? member.id : "other" }))[0].status, "cancelled");
  assert.equal(await returns.countDocuments(), 0);
  for (const action of ["claim.approved", "claim.rejected", "claim.cancelled"])
    assert.equal(await audit.countDocuments({ action }), 1);
});

test("handoff checks both confirmations, linkage and legacy reservations, and commits one private-data-free event on replay", async () => {
  const { published, item, submit, run, rows, claims, audit, returns } = await fixture();
  const id = await published(), claimId = await submit(id);
  const approval = decision("approve", claimId, "pending");
  await run(approval);
  const lost = await item("lost", member.id), unrelated = await item("lost");
  const handoff = decision("handoff", claimId, "approved", { linkedLostId: unrelated });
  await assert.rejects(run(handoff), /physical handoff/);
  handoff.set("handoffConfirmed", "yes");
  await assert.rejects(run(handoff), /Confirm the linked/);
  handoff.set("linkedConfirmed", "yes");
  await assert.rejects(run(handoff), /unavailable for this claimant/);
  assert.equal((await claims.list(member))[0].status, "approved");
  assert.equal((await rows.findOne({ _id: id }))?.lifecycle, "reserved");
  handoff.set("linkedLostId", lost);
  await rows.updateOne({ _id: id }, { $set: { reservedClaimId: randomUUID() } });
  await assert.rejects(run(handoff), /reserved/);
  await rows.updateOne({ _id: id }, { $unset: { reservedClaimId: "" } });
  await Promise.all([run(handoff), run(handoff)]);
  await run(approval);
  await assert.rejects(run(handoff, { ...admin, id: "another-admin" }), /already used/);
  await assert.rejects(run(decision("cancel", claimId, "approved")), /fulfilled/);
  assert.equal((await claims.list(member))[0].status, "fulfilled");
  for (const returned of [id, lost]) assert.equal((await rows.findOne({ _id: returned }))?.lifecycle, "returned");
  assert.equal((await rows.findOne({ _id: unrelated }))?.lifecycle, "open");
  const pickups = await returns.find().toArray();
  assert.equal(pickups.length, 1);
  assert.equal(pickups[0].actorId, admin.id);
  assert.equal(pickups[0].claimantId, member.id);
  assert.ok(pickups[0].createdAt instanceof Date);
  const events = await audit.find({ reportId: id }).sort({ createdAt: 1, _id: 1 }).toArray();
  assert.deepEqual(events.map(e => [e.action, e.from, e.to]), [
    ["report.published", "pending", "published"], ["claim.approved", "pending", "approved"], ["claim.fulfilled", "approved", "fulfilled"],
  ]);
  assert.equal(events[2].linkedLostId, lost);
  assert.equal(events[2].claimId, claimId);
  assert.equal(events[2].actorId, admin.id);
  assert.doesNotMatch(JSON.stringify(events), /private@example|Secret embroidered|Last held|private\/|reason/i);
});

test("handoff racing cancellation commits exactly one complete outcome", async () => {
  const { published, submit, run, rows, claims, audit, returns } = await fixture();
  const id = await published(), claimId = await submit(id);
  await run(decision("approve", claimId, "pending"));
  const results = await Promise.allSettled(["handoff", "cancel"].map(action => run(decision(action, claimId, "approved", { handoffConfirmed: "yes" }))));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const handedOff = results[0].status === "fulfilled";
  const status = handedOff ? "fulfilled" : "cancelled";
  assert.equal((await claims.list(member))[0].status, status);
  assert.equal((await rows.findOne({ _id: id }))?.lifecycle, handedOff ? "returned" : "open");
  assert.equal(await returns.countDocuments(), Number(handedOff));
  assert.equal(await audit.countDocuments({ from: "approved" }), 1);
  assert.match(results.find(r => r.status === "rejected")?.reason.message, new RegExp(status));
});

test("unauthorized actors, foreign cases, and hidden items reject decisions", async () => {
  const { db, item, published, submit, run, audit } = await fixture();
  const form = decision("publish", await item(), "pending", { role: "admin", actorId: admin.id });
  for (const actor of [null, member, { ...admin, emailVerified: false }])
    await assert.rejects(applyAdminDecision(db, client, actor, form), /administrator/);
  const foreign = randomUUID();
  await db.command({ insert: "reports", documents: [{ _id: foreign, organization: "elsewhere", moderation: "pending" }], bypassDocumentValidation: true });
  await assert.rejects(run(decision("publish", foreign, "pending")), /unavailable/);
  const found = await published(), pending = await submit(found);
  await run(decision("hide", found, "published"));
  await assert.rejects(run(decision("approve", pending, "pending")), /hidden/);
  await db.command({ update: "claims", updates: [{ q: { _id: pending }, u: { $set: { organization: "elsewhere" } } }], bypassDocumentValidation: true });
  await assert.rejects(run(decision("reject", pending, "pending")), /unavailable/);
  assert.equal(await audit.countDocuments({ claimId: pending }), 0);
});

test("audit failure rolls back return, claim, report and receipt; original confirmation can retry", async () => {
  const { db, published, submit, run, rows, claims, audit, returns } = await fixture();
  const id = await published(), claimId = await submit(id);
  await run(decision("approve", claimId, "pending"));
  const form = decision("handoff", claimId, "approved", { handoffConfirmed: "yes" });
  await db.command({ collMod: "audit_events", validator: { action: { $ne: "claim.fulfilled" } } });
  await assert.rejects(run(form), /validation/i);
  assert.equal((await rows.findOne({ _id: id }))?.lifecycle, "reserved");
  assert.equal((await claims.list(member))[0].status, "approved");
  assert.equal(await db.collection<{ _id: string }>("decision_requests").countDocuments({ _id: String(form.get("requestId")) }), 0);
  assert.equal(await returns.countDocuments(), 0);
  assert.equal(await audit.countDocuments({ action: "claim.fulfilled" }), 0);
  await db.command({ collMod: "audit_events", validator: {} });
  await run(form);
  assert.equal((await claims.list(member))[0].status, "fulfilled");
});

test("duplicate reservation key without a receipt returns scoped state and preserves pending claim", async () => {
  const { published, submit, run, rows, claims, audit } = await fixture();
  const id = await published(), first = await submit(id), second = await submit(id, "second-member");
  await run(decision("approve", first, "pending"));
  // Simulate a legacy item whose approved claim already holds the unique slot.
  await rows.updateOne({ _id: id }, { $set: { lifecycle: "open" } });
  await assert.rejects(run(decision("approve", second, "pending")), /already recorded.*pending.*open/);
  assert.equal((await claims.list({ ...member, id: "second-member" }))[0].status, "pending");
  assert.equal(await audit.countDocuments({ claimId: second }), 0);
});

for (const ownsOriginal of [true, false]) {
  test("finder response publication and handoff when claimant owns original: " + ownsOriginal, async () => {
    const { item, reports, run, submit, returns } = await fixture();
    const owner = { ...member, id: "lost-owner" };
    const lostId = await item("lost", owner.id);
    await run(decision("publish", lostId, "pending"));
    const id = await reports.submit(member, { requestId: randomUUID(), type: "found", title: "Canvas bag",
      description: "Found a green bag", location: "Library", category: "Bags & accessories", occurredOn: "2020-01-01", attachments: [] }, lostId);
    assert.deepEqual(await reports.finderAlerts(owner), []);
    await run(decision("publish", id, "pending"));
    assert.deepEqual(await reports.finderAlerts(member), []);
    await reports.dismissFinderAlert(member, id);
    assert.deepEqual(await reports.finderAlerts(owner), [{ id, lostId, title: "Canvas bag" }]);
    await reports.dismissFinderAlert(owner, id);
    assert.deepEqual(await reports.finderAlerts(owner), []);
    const claimId = await submit(id, ownsOriginal ? owner.id : "another-claimant");
    await run(decision("approve", claimId, "pending"));
    assert.equal((await reports.responses(owner, lostId))?.lifecycle, "open");
    const handoff = decision("handoff", claimId, "approved", { handoffConfirmed: "yes" });
    await run(handoff);
    await run(handoff);
    const result = await reports.responses(owner, lostId);
    assert.equal(result?.lifecycle, ownsOriginal ? "returned" : "open");
    assert.equal(result?.rows[0].lifecycle, "returned");
    assert.equal((await returns.findOne({ claimId }))?.linkedLostId, ownsOriginal ? lostId : undefined);
    assert.equal(await returns.countDocuments({ claimId }), 1);
  });
}
