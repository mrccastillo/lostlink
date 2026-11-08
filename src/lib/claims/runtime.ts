import "server-only";
import { getDomainDatabase } from "@/lib/mongodb";
import { createClaimService, ensureClaimSchemaV1 } from "./service";
const runtime = globalThis as typeof globalThis & { lostlinkClaims?: Promise<ReturnType<typeof createClaimService>> };
export async function getClaimService() {
  if (!runtime.lostlinkClaims) runtime.lostlinkClaims = (async () => {
    const { db, client } = await getDomainDatabase();
    await ensureClaimSchemaV1(db);
    return createClaimService(db, client);
  })().catch((error: unknown) => { runtime.lostlinkClaims = undefined; throw error; });
  return runtime.lostlinkClaims;
}
