import type { Db } from "mongodb";

// Better Auth creates its schema indexes (including unique email and session
// token indexes). Add only app-specific retention and credential constraints.
export async function ensureAuthIndexes(db: Db) {
  await Promise.all([
    db
      .collection("session")
      .createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: "auth_session_expiry" },
      ),
    db
      .collection("account")
      .createIndex(
        { providerId: 1, accountId: 1 },
        { unique: true, name: "auth_account_provider_unique" },
      ),
    db
      .collection("verification")
      .createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: "auth_verification_expiry" },
      ),
  ]);
}
