"use server";

import { revalidatePath } from "next/cache";
import { canAccessAdmin } from "@/lib/auth/policy";
import { getCurrentSession } from "@/lib/auth/session";
import { getDomainDatabase } from "@/lib/mongodb";
import { applyAdminDecision, DecisionError, ensureDecisionIndexesV1 } from "./decisions";

let setup: Promise<void> | undefined;

export async function decideCase(previous: { ok: boolean; message: string }, form: FormData) {
  const session = await getCurrentSession();
  if (!session || !canAccessAdmin(session.user))
    return { ok: false, message: "Verified administrator access is required." };
  try {
    const { db, client } = await getDomainDatabase();
    setup ??= ensureDecisionIndexesV1(db).catch((error: unknown) => {
      setup = undefined;
      throw error;
    });
    await setup;
    await applyAdminDecision(db, client, session.user, form);
  } catch (error) {
    return { ok: false, message: error instanceof DecisionError ? error.message : "Could not confirm the decision. Please retry." };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/[queue]", "layout");
  revalidatePath("/discover");
  revalidatePath("/my-posts");
  revalidatePath("/claims");
  revalidatePath("/claims/[reportId]", "page");
  return { ok: true, message: "Decision recorded." };
}
