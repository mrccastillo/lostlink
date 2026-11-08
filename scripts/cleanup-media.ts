import { MongoClient } from "mongodb";
import { readCloudinaryConfig } from "../src/lib/media/config";
import { createCloudinaryStorage } from "../src/lib/media/cloudinary";
import { createMediaService, ensureMediaIndexesV1 } from "../src/lib/media/service";

async function main() {
  const config = readCloudinaryConfig(process.env);
  const uri = process.env.MONGODB_URI?.trim();
  if (!config || !uri) throw new Error("MEDIA_NOT_CONFIGURED");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5_000 });
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB?.trim() || "lostlink");
    await ensureMediaIndexesV1(db);
    const removed = await createMediaService(db, createCloudinaryStorage(config)).cleanup();
    console.log(`Removed ${removed} expired attachments (maximum 100 per run).`);
  } finally {
    await client.close();
  }
}

main().catch(() => {
  console.error("MEDIA_CLEANUP_FAILED: Check storage/database configuration and retry.");
  process.exitCode = 1;
});
