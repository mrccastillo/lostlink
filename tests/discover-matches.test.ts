import assert from "node:assert/strict";
import { test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { listMatches } from "../src/features/discover/match-service";
import { rankMatches } from "../src/features/discover/matching";

const lost = {
  title: "Café headphones",
  description: "Silver over-ear headphones with foldable ear cups.",
  location: "Library, second floor",
  occurredOn: "2026-01-10",
  category: "Electronics",
};

test("matching ranks similar reports by their text, place, category, and compatible dates", () => {
  const found = { ...lost, title: "Cafe headphones", _id: "same-day" };
  const matches = rankMatches(lost, [
    { ...found, _id: "later", occurredOn: "2026-01-18" },
    { ...found, _id: "different-place", location: "Sports hall" },
    { ...found, _id: "wrong-category", category: "Other" },
    { ...found, _id: "before-loss", occurredOn: "2026-01-09" },
    { ...found, _id: "outside-window", occurredOn: "2026-02-10" },
    { ...found, _id: "unrelated", title: "Laptop", description: "A keyboard and charging cable." },
    { ...found, _id: "visible-in-description", title: "Headset", description: "Cafe headphones." },
    found,
  ]);
  assert.deepEqual(matches.map(entry => entry.item._id), [
    "same-day", "later", "wrong-category", "different-place", "visible-in-description",
  ]);
  assert.deepEqual(matches[0].reasons, [
    "Similar title", "Similar description", "Similar location", "Same category", "Found on the same day",
  ]);
  assert.ok(matches[4].reasons.includes("Similar description"));
  const tied = ["f", "e", "d", "c", "b", "a"].map(_id => ({ ...found, _id }));
  assert.deepEqual(rankMatches(lost, tied).map(({ item }) => item._id), ["a", "b", "c", "d", "e"]);
});

test("matching reads only the viewer's open lost reports and other members' eligible found reports", { timeout: 120_000 }, async () => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = new MongoClient(replica.getUri());
  try {
    await client.connect();
    const db = client.db("isolated_discover_matches");
    const actor = { id: "member-one", emailVerified: true };
    await assert.rejects(listMatches(db, null, 1), /Verified membership required/);
    await assert.rejects(listMatches(db, { ...actor, emailVerified: false }, 1), /Verified membership required/);
    const own = {
      ...lost, type: "lost", ownerId: actor.id, organization: "community",
      moderation: "pending", lifecycle: "open", createdAt: new Date("2026-01-10"),
    };
    const candidate = { ...own, type: "found", ownerId: "member-two", moderation: "published" };
    await db.collection<{ _id: string } & Record<string, unknown>>("reports").insertMany([
      { ...own, _id: "own-lost" },
      { ...own, _id: "own-published", moderation: "published", occurredOn: "2025-10-01" },
      { ...own, _id: "own-hidden", moderation: "hidden" },
      { ...own, _id: "own-returned", lifecycle: "returned" },
      { ...own, _id: "foreign-lost", organization: "another-community" },
      { ...own, _id: "other-lost", ownerId: "member-two" },
      { ...candidate, _id: "eligible", occurredOn: "2026-02-09", privateEvidence: "Private evidence", attachments: ["private-file"] },
      { ...candidate, _id: "own-found", ownerId: actor.id },
      { ...candidate, _id: "foreign-found", organization: "another-community" },
      { ...candidate, _id: "pending-found", moderation: "pending" },
      { ...candidate, _id: "hidden-found", moderation: "hidden" },
      { ...candidate, _id: "reserved-found", lifecycle: "reserved" },
      { ...candidate, _id: "returned-found", lifecycle: "returned" },
      { ...candidate, _id: "before-loss", occurredOn: "2026-01-09" },
      { ...candidate, _id: "outside-window", occurredOn: "2026-02-10" },
    ]);
    const result = await listMatches(db, actor, 1);
    assert.deepEqual(result.groups.map(group => group.id).sort(), ["own-lost", "own-published"]);
    const ownGroup = result.groups.find(group => group.id === "own-lost");
    assert.ok(ownGroup);
    assert.equal(Object.hasOwn(ownGroup, "description"), false);
    assert.deepEqual(ownGroup.matches.map(({ item }) => item._id), ["eligible"]);
    const found = ownGroup.matches[0].item;
    assert.equal(found.canClaim, true);
    for (const field of ["ownerId", "organization", "privateEvidence", "attachments"]) {
      assert.equal(Object.hasOwn(found, field), false);
    }
    assert.deepEqual(result.groups.find(group => group.id === "own-published")?.matches, []);
    assert.deepEqual(await listMatches(db, { id: "member-three", emailVerified: true }, 1), { groups: [], page: 1, pages: 1 });

    await db.collection<{ _id: string } & Record<string, unknown>>("reports").insertMany(
      Array.from({ length: 5 }, (_, index) => ({ ...own, _id: `newer-${index}`, createdAt: new Date("2026-01-11") })),
    );
    const firstPage = await listMatches(db, actor, 1);
    const lastPage = await listMatches(db, actor, 100);
    assert.equal(firstPage.pages, 2);
    assert.deepEqual(firstPage.groups.map(group => group.id), ["newer-4", "newer-3", "newer-2", "newer-1", "newer-0"]);
    assert.equal(lastPage.page, 2);
    assert.deepEqual(lastPage.groups.map(group => group.id), ["own-published", "own-lost"]);
  } finally {
    await client.close();
    await replica.stop();
  }
});
