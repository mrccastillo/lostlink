import { ObjectId, type Db, type MongoClient, type ClientSession } from "mongodb";

type Grant = { _id: string; actorId: string; expiresAt: Date };
async function activate(db: Db, session: ClientSession, email: string, actorId: string) {
  const account = await db.collection("user").findOneAndUpdate({ email, emailVerified: true, role: { $ne: "admin" } },
    { $set: { role: "admin" } }, { session, projection: { _id: 1 } });
  if (!account) return false;
  await db.collection("audit_events").insertOne({ organization: "community", action: "admin.created", actorId,
    entityId: String(account._id), createdAt: new Date() }, { session });
  await db.collection<Grant>("admin_grants").deleteOne({ _id: email }, { session });
  return true;
}

export async function createAdminGrant(db: Db, client: MongoClient, actorId: string, address: string) {
  const email = address.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  return client.withSession(session => session.withTransaction(async () => {
    if (!ObjectId.isValid(actorId) || !await db.collection("user").findOne({ _id: new ObjectId(actorId), role: "admin", emailVerified: true }, { session, projection: { _id: 1 } }))
      return "Verified administrator access is required.";
    if (await activate(db, session, email, actorId)) return "Administrator access granted.";
    if (await db.collection("user").findOne({ email, role: "admin" }, { session, projection: { _id: 1 } })) return "This account already has administrator access.";
    const grants = db.collection<Grant>("admin_grants");
    const current = await grants.findOne({ _id: email }, { session });
    if (current && current.expiresAt > new Date()) return "An active authorization already exists for this email.";
    await grants.updateOne({ _id: email }, { $set: { actorId, expiresAt: new Date(Date.now() + 7 * 86400000) } }, { upsert: true, session });
    await db.collection("audit_events").insertOne({ organization: "community", action: "admin.authorized", actorId, createdAt: new Date() }, { session });
    return "Access authorized for seven days. Ask the recipient to sign up, verify this email and sign in.";
  }));
}

export async function redeemAdminGrant(db: Db, client: MongoClient, email: string) {
  const address = email.toLowerCase();
  const grants = db.collection<Grant>("admin_grants");
  if (!await grants.findOne({ _id: address, expiresAt: { $gt: new Date() } })) return;
  await client.withSession(session => session.withTransaction(async () => {
    const grant = await grants.findOne({ _id: address, expiresAt: { $gt: new Date() } }, { session });
    if (grant) await activate(db, session, address, grant.actorId);
  }));
}
