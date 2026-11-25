import "server-only";
import { MongoClient } from "mongodb";
import { readCloudinaryConfig } from "./config";
import { createCloudinaryStorage } from "./cloudinary";
import { createMediaService, ensureMediaIndexesV2 } from "./service";

const runtime = globalThis as typeof globalThis & {
  lostlinkMediaV2?: Promise<ReturnType<typeof createMediaService>>;
};

export function isMediaConfigured() {
  return readCloudinaryConfig(process.env) !== null;
}

export async function getMediaService() {
  const config = readCloudinaryConfig(process.env);
  const uri = process.env.MONGODB_URI?.trim();
  if (!config || !uri) throw new Error("MEDIA_NOT_CONFIGURED");
  if (!runtime.lostlinkMediaV2) {
    runtime.lostlinkMediaV2 = (async () => {
      const client = new MongoClient(uri, {
        maxPoolSize: 5, serverSelectionTimeoutMS: 5_000, timeoutMS: 10_000,
      });
      try {
        await client.connect();
        const db = client.db(process.env.MONGODB_DB?.trim() || "lostlink");
        await ensureMediaIndexesV2(db);
        return createMediaService(db, createCloudinaryStorage(config));
      } catch {
        await client.close();
        runtime.lostlinkMediaV2 = undefined;
        throw new Error("MEDIA_UNAVAILABLE");
      }
    })();
  }
  return runtime.lostlinkMediaV2;
}
