import assert from "node:assert/strict";
import { test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createAdminGrant, redeemAdminGrant } from "../src/lib/auth/admin-grants";

test("admin creation requires current verified staff and verified recipients, and audits each grant once", async () => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = new MongoClient(replica.getUri(), { timeoutMS: 10000 });
  try {
    const db = client.db("isolated_admin_grants");
    const users = db.collection("user");
    const { insertedId: staff } = await users.insertOne({ email: "staff@example.test", emailVerified: true, role: "admin" });
    const { insertedId: member } = await users.insertOne({ email: "member@example.test", emailVerified: true, role: "member" });
    assert.match(await createAdminGrant(db, client, member.toHexString(), "member@example.test"), /required/);
    await Promise.all([1, 2].map(() => createAdminGrant(db, client, staff.toHexString(), "member@example.test")));
    assert.equal((await users.findOne({ _id: member }))?.role, "admin");
    assert.equal(await db.collection("audit_events").countDocuments({ action: "admin.created" }), 1);
    const email = "recipient@example.test";
    await createAdminGrant(db, client, staff.toHexString(), email);
    await users.insertOne({ email, role: "member", emailVerified: false });
    await redeemAdminGrant(db, client, email);
    assert.equal((await users.findOne({ email }))?.role, "member");
    await users.updateOne({ email }, { $set: { emailVerified: true } });
    await redeemAdminGrant(db, client, email);
    assert.equal((await users.findOne({ email }))?.role, "admin");
    assert.equal(await db.collection("admin_grants").countDocuments(), 0);
  } finally { await client.close(); await replica.stop(); }
});
