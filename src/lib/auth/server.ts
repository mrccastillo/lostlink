import "server-only";
import { MongoClient } from "mongodb";
import { after } from "next/server";
import { readAuthConfig } from "./config";
import { createAuth, type LostLinkAuth } from "./create-auth";
import { createEmailSender } from "./email";
import { ensureAuthIndexes } from "./indexes";

const runtime = globalThis as typeof globalThis & {
  lostlinkAuth?: Promise<LostLinkAuth>;
};

export function isAuthConfigured() {
  return readAuthConfig(process.env) !== null;
}

export async function getAuth(): Promise<LostLinkAuth | null> {
  const config = readAuthConfig(process.env);
  if (!config) return null;

  if (!runtime.lostlinkAuth) {
    const client = new MongoClient(config.mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5_000,
      timeoutMS: 10_000,
    });
    runtime.lostlinkAuth = (async () => {
      try {
        await client.connect();
        const db = client.db(config.databaseName);
        await ensureAuthIndexes(db);
        return createAuth({
          db,
          client,
          config,
          sendEmail: createEmailSender(config),
          backgroundTask: (promise) =>
            after(async () => {
              try {
                await promise;
              } catch {
                console.error("AUTH_BACKGROUND_TASK_FAILED");
              }
            }),
        });
      } catch {
        await client.close();
        runtime.lostlinkAuth = undefined;
        throw new Error("Authentication service unavailable.");
      }
    })();
  }
  return runtime.lostlinkAuth;
}
