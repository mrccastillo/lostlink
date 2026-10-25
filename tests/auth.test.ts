import assert from "node:assert/strict";
import { test } from "node:test";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { readAuthConfig, type AuthConfig } from "../src/lib/auth/config";
import {
  canPost,
  initialMembership,
  safeReturnPath,
} from "../src/lib/auth/policy";
import { ensureAuthIndexes } from "../src/lib/auth/indexes";
import { createAuth } from "../src/lib/auth/create-auth";

test("configuration fails closed and redirects stay on known application routes", () => {
  assert.equal(readAuthConfig({}), null);
  const env = {
    MONGODB_URI: "mongodb://127.0.0.1:27017",
    BETTER_AUTH_SECRET: "x".repeat(48),
    BETTER_AUTH_URL: "http://localhost:3000",
    RESEND_API_KEY: "test-only",
    AUTH_EMAIL_FROM: "LostLink <auth@example.test>",
  };
  assert.ok(readAuthConfig(env));
  assert.equal(readAuthConfig({ ...env, BETTER_AUTH_SECRET: "short" }), null);
  assert.equal(
    readAuthConfig({ ...env, BETTER_AUTH_URL: "http://public.example" }),
    null,
  );
  assert.equal(
    readAuthConfig({ ...env, BETTER_AUTH_URL: "https://example.test/path" }),
    null,
  );
  for (const path of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "javascript:alert(1)",
    "/login",
    undefined,
    ["/"],
  ])
    assert.equal(safeReturnPath(path), "/post");
  assert.equal(safeReturnPath("/"), "/");
  assert.equal(
    initialMembership("member@school.edu", ["school.edu"]),
    "approved",
  );
  assert.equal(
    initialMembership("member@school.edu.evil.test", ["school.edu"]),
    "pending",
  );
  assert.equal(
    canPost({ emailVerified: false, membershipStatus: "approved" }),
    false,
  );
  assert.equal(
    canPost({ emailVerified: true, membershipStatus: "pending" }),
    false,
  );
});

test(
  "MongoDB auth lifecycle and security boundaries",
  { timeout: 240_000 },
  async (t) => {
    const replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
    });
    const client = new MongoClient(replicaSet.getUri());
    try {
      await client.connect();
      const db = client.db("lostlink_auth_test");
      await ensureAuthIndexes(db);
      const config: AuthConfig = {
        mongoUri: replicaSet.getUri(),
        databaseName: db.databaseName,
        secret: "isolated-test-secret-with-more-than-32-characters",
        baseURL: "http://localhost:3000",
        emailApiKey: "test-only",
        emailFrom: "auth@example.test",
        allowedEmailDomains: ["school.test"],
      };
      const emails: { to: string; subject: string; text: string }[] = [];
      const auth = createAuth({
        db,
        client,
        config,
        sendEmail: async (email) => {
          emails.push(email);
        },
      });
      let requestId = 0;
      function request(
        path: string,
        body?: Record<string, unknown>,
        options: { cookie?: string; origin?: string; ip?: string } = {},
      ) {
        return auth.handler(
          new Request(`${config.baseURL}/api/auth${path}`, {
            method: body ? "POST" : "GET",
            headers: {
              "Content-Type": "application/json",
              Origin: options.origin ?? config.baseURL,
              "x-forwarded-for": options.ip ?? `192.0.2.${++requestId}`,
              ...(options.cookie ? { Cookie: options.cookie } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          }),
        );
      }
      const password = "a-long-test-password-123";
      let cookie = "";
      const email = "member@school.test";

      await t.test(
        "signup stores a password hash and cannot self-assign privileges",
        async () => {
          const response = await request("/sign-up/email", {
            name: "Test Member",
            email,
            password,
            role: "admin",
            membershipStatus: "approved",
            emailVerified: true,
            callbackURL: "/login",
          });
          assert.equal(response.status, 200, await response.text());
          const user = await db.collection("user").findOne({ email });
          assert.equal(user?.role, "member");
          assert.equal(user?.emailVerified, false);
          assert.equal(user?.membershipStatus, "approved");
          const account = await db
            .collection("account")
            .findOne({ userId: user?._id });
          assert.ok(account?.password && account.password !== password);
          assert.equal(emails.length, 1);
          const login = await request("/sign-in/email", { email, password });
          assert.equal(login.status, 403);
          const weak = await request("/sign-up/email", {
            name: "Other Member",
            email: "weak@school.test",
            password: "short",
          });
          assert.equal(weak.status, 400);
          const invalidName = await request("/sign-up/email", {
            name: " ",
            email: "invalid@school.test",
            password,
          });
          assert.equal(invalidName.status, 400);
          assert.equal(
            await db
              .collection("user")
              .countDocuments({ email: "invalid@school.test" }),
            0,
          );
        },
      );

      await t.test(
        "email verification enables login and issues an HTTP-only session",
        async () => {
          const verificationURL = emails[0].text.match(/https?:\/\/\S+/)?.[0];
          assert.ok(verificationURL);
          const verified = await auth.handler(new Request(verificationURL));
          assert.ok([200, 302].includes(verified.status));
          const response = await request("/sign-in/email", { email, password });
          assert.equal(response.status, 200, await response.text());
          const cookies = response.headers.getSetCookie();
          assert.ok(cookies.some((value) => /httponly/i.test(value)));
          assert.ok(cookies.some((value) => /samesite=lax/i.test(value)));
          cookie = cookies.map((value) => value.split(";")[0]).join("; ");
          const session = await request("/get-session", undefined, { cookie });
          const data = await session.json();
          assert.equal(data.user.email, email);
          assert.equal(data.user.emailVerified, true);
          assert.equal(canPost(data.user), true);
          const forged = await request("/get-session", undefined, {
            cookie: "lostlink.session_token=forged",
          });
          assert.equal(await forged.json(), null);
        },
      );

      await t.test(
        "pending membership, duplicate signup, updates, and foreign origins stay restricted",
        async () => {
          const pendingEmail = "outside@other.test";
          assert.equal(
            (
              await request("/sign-up/email", {
                name: "Other Member",
                email: pendingEmail,
                password,
                role: "admin",
                membershipStatus: "approved",
              })
            ).status,
            200,
          );
          const pending = await db
            .collection("user")
            .findOne({ email: pendingEmail });
          assert.equal(pending?.membershipStatus, "pending");
          assert.equal(pending?.role, "member");
          await request("/sign-up/email", {
            name: "Duplicate",
            email: email.toUpperCase(),
            password,
          });
          assert.equal(
            await db.collection("user").countDocuments({ email }),
            1,
          );
          await request(
            "/update-user",
            { name: "Updated Member", role: "admin", emailVerified: false },
            { cookie },
          );
          assert.equal(
            (await db.collection("user").findOne({ email }))?.role,
            "member",
          );
          const foreign = await request(
            "/sign-in/email",
            { email, password },
            { origin: "https://evil.test" },
          );
          assert.equal(foreign.status, 403);
        },
      );

      await t.test(
        "password recovery is single-use and revokes old sessions",
        async () => {
          const known = await request("/request-password-reset", {
            email,
            redirectTo: "/reset-password",
          });
          const unknown = await request("/request-password-reset", {
            email: "nobody@school.test",
            redirectTo: "/reset-password",
          });
          assert.equal(known.status, unknown.status);
          assert.deepEqual(await known.json(), await unknown.json());
          const resetEmail = emails.findLast((message) =>
            message.subject.includes("Reset"),
          );
          const resetURL = resetEmail?.text.match(/https?:\/\/\S+/)?.[0];
          assert.ok(resetURL);
          const redirectResponse = await auth.handler(new Request(resetURL));
          const location = redirectResponse.headers.get("location");
          assert.ok(location);
          const token = new URL(location, config.baseURL).searchParams.get(
            "token",
          );
          assert.ok(token);
          const newPassword = "a-new-long-password-456";
          assert.equal(
            (await request("/reset-password", { token, newPassword })).status,
            200,
          );
          assert.equal(
            (await request("/reset-password", { token, newPassword })).status,
            400,
          );
          assert.equal(
            await (await request("/get-session", undefined, { cookie })).json(),
            null,
          );
          assert.equal(
            (await request("/sign-in/email", { email, password })).status,
            401,
          );
          const login = await request("/sign-in/email", {
            email,
            password: newPassword,
          });
          assert.equal(login.status, 200);
          cookie = login.headers
            .getSetCookie()
            .map((value) => value.split(";")[0])
            .join("; ");
          assert.equal(
            (await request("/sign-out", {}, { cookie })).status,
            200,
          );
          assert.equal(
            await (await request("/get-session", undefined, { cookie })).json(),
            null,
          );
        },
      );

      await t.test("repeated login attempts are rate limited", async () => {
        let response: Response | undefined;
        for (let attempt = 0; attempt < 6; attempt++)
          response = await request(
            "/sign-in/email",
            { email, password: "wrong-password" },
            { ip: "198.51.100.20" },
          );
        assert.equal(response?.status, 429);
      });
    } finally {
      await client.close();
      await replicaSet.stop();
    }
  },
);
