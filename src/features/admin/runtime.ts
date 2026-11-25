import "server-only";
import { getCurrentSession } from "@/lib/auth/session";
import { getDomainDatabase } from "@/lib/mongodb";
import { ensureAdminOverviewIndexesV3, readAdminOverview } from "./overview";

let indexSetup: Promise<void> | undefined;

export async function getAdminDatabase() {
  const { db } = await getDomainDatabase();
  indexSetup ??= ensureAdminOverviewIndexesV3(db).catch((error: unknown) => {
    indexSetup = undefined;
    throw error;
  });
  await indexSetup;
  return db;
}

export async function getAdminDashboard() {
  const session = await getCurrentSession();
  if (!session) return { status: "guest" } as const;
  if (!session.user.emailVerified) return { status: "unverified" } as const;

  const overview = await readAdminOverview(session.user, getAdminDatabase);
  if (!overview) return { status: "denied" } as const;

  return { status: "authorized", overview } as const;
}
