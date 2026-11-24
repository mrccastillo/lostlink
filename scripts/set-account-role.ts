import { MongoClient } from "mongodb";
import { ADMIN_ROLE } from "../src/lib/auth/policy";
import { isAccountRole, setAccountRole } from "../src/lib/auth/provision-role";

async function main() {
  const [role, email, ...extra] = process.argv.slice(2);
  if (!isAccountRole(role) || !email || !email.includes("@") || extra.length) {
    console.error("Usage: npm run auth:set-role -- <admin|member> <account-email>");
    process.exitCode = 1;
    return;
  }

  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error("Set MONGODB_URI in .env.local before changing account roles.");
    process.exitCode = 1;
    return;
  }

  const databaseName = process.env.MONGODB_DB?.trim() || "lostlink";
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5_000, timeoutMS: 10_000 });
  try {
    if (!await setAccountRole(client.db(databaseName), email, role)) {
      console.error(role === ADMIN_ROLE ? "No verified account matches that email." : "No account matches that email.");
      process.exitCode = 1;
      return;
    }
    console.log(`Account role set to ${role} in ${databaseName}.`);
  } finally {
    await client.close();
  }
}

main().catch(() => {
  console.error("Couldn’t change the account role. Check database configuration and access.");
  process.exitCode = 1;
});
