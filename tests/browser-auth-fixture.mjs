import { setAccountRole } from "../src/lib/auth/provision-role.ts";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { createAuth } from "../src/lib/auth/create-auth.ts";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

export async function startAuthenticatedBrowserApp(context, port) {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = new MongoClient(replica.getUri());
  context.after(async () => {
    try { await client.close(); } finally { await replica.stop(); }
  });
  await client.connect();
  const baseURL = `http://localhost:${port}`;
  const config = { mongoUri: replica.getUri(), databaseName: 'isolated_preview_test', secret: randomBytes(32).toString('base64'), baseURL, emailApiKey: 'test-only', emailSenderAddress: 'auth@example.test' };
  const db = client.db(config.databaseName);
  const emails = new Map();
  const auth = createAuth({ db, client, config, sendEmail: async ({ to, text }) => { emails.set(to, text); } });
  const request = (path, body) => auth.handler(new Request(baseURL + '/api/auth' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: baseURL }, body: JSON.stringify(body) }));
  async function createMember(name, email) {
    const credentials = { email, password: randomBytes(24).toString('hex') };
    assert.equal((await request('/sign-up/email', { ...credentials, name })).status, 200);
    const verificationURL = emails.get(email)?.match(/https?:\/\/\S+/)?.[0];
    assert.ok(verificationURL, 'Expected a verification email for the isolated member');
    emails.delete(email);
    await auth.handler(new Request(verificationURL));
    const login = await request('/sign-in/email', credentials);
    assert.equal(login.status, 200);
    const cookies = login.headers.getSetCookie().map(value => {
      const pair = value.split(';', 1)[0];
      const separator = pair.indexOf('=');
      return { name: pair.slice(0, separator), value: pair.slice(separator + 1), url: baseURL, httpOnly: true };
    });
    return { credentials, cookies };
  }
  const { credentials, cookies } = await createMember('Preview Member', 'preview@example.test');
  const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { windowsHide: true, stdio: 'ignore', env: { ...process.env, MONGODB_URI: config.mongoUri, MONGODB_DB: config.databaseName, BETTER_AUTH_SECRET: config.secret, BETTER_AUTH_URL: baseURL, BREVO_API_KEY: config.emailApiKey, BREVO_SENDER_EMAIL: config.emailSenderAddress, CLOUDINARY_CLOUD_NAME: 'isolated-test', CLOUDINARY_API_KEY: 'test-only', CLOUDINARY_API_SECRET: 'test-only' } });
  context.after(() => { app.kill(); });
  for (let n = 0; n < 60; n++) {
    try {
      if ((await fetch(baseURL + '/login')).ok) return {
        baseURL, cookies, credentials, createMember, db,
        grantAdmin: () => setAccountRole(db, credentials.email, "admin"),
      };
    } catch {}
    await delay(200);
  }
  assert.fail('Isolated LostLink server did not start');
}

export async function seedPublishedReports({ db, createMember }) {
  const { credentials } = await createMember('Report Author', 'reporter@example.test');
  const owner = await db.collection('user').findOne({ email: credentials.email });
  const common = { ownerId: String(owner._id), organization: 'community', moderation: 'published', lifecycle: 'open',
    category: 'Electronics', occurredOn: '2025-04-10', attachments: [], approvedMedia: [], createdAt: new Date() };
  const found = { ...common, _id: randomUUID(), type: 'found', title: 'Over-ear headphones', location: 'Library',
    description: 'Headphones found near the library entrance.' };
  const lost = { ...common, _id: randomUUID(), type: 'lost', title: 'Compact camera', location: 'Cafeteria',
    description: 'A compact camera lost near the cafeteria.' };
  await db.collection('reports').insertMany([found, lost]);
  return { found, lost };
}
