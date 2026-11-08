import "server-only";
import { MongoClient } from "mongodb";

const runtime = globalThis as typeof globalThis & { lostlinkDomainDatabase?: Promise<{ client: MongoClient; db: ReturnType<MongoClient["db"]> }> };
export async function getDomainDatabase() {
  if (!runtime.lostlinkDomainDatabase) {
    runtime.lostlinkDomainDatabase = (async () => {
      const uri = process.env.MONGODB_URI;
      if (!uri) throw new Error("DATABASE_NOT_CONFIGURED");
      const client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 5_000, timeoutMS: 10_000 });
      try { await client.connect(); return { client, db: client.db(process.env.MONGODB_DB?.trim() || "lostlink") }; }
      catch (error) { await client.close(); throw error; }
    })().catch((error: unknown) => { runtime.lostlinkDomainDatabase = undefined; throw error; });
  }
  return runtime.lostlinkDomainDatabase;
}
