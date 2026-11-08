import "server-only";
import { getDomainDatabase } from "@/lib/mongodb";
import { createReportService, ensureReportSchemaV1 } from "./service";

const runtime = globalThis as typeof globalThis & { lostlinkReportSetupV2?: Promise<void> };
export async function getReportService() {
  const { db, client } = await getDomainDatabase();
  runtime.lostlinkReportSetupV2 ??= ensureReportSchemaV1(db).catch((error: unknown) => { runtime.lostlinkReportSetupV2 = undefined; throw error; });
  await runtime.lostlinkReportSetupV2;
  return createReportService(db, client);
}
