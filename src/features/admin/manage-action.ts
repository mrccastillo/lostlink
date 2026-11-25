"use server";

import { getDomainDatabase } from "@/lib/mongodb";
import { getCurrentSession } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/policy";
import { createAdminGrant } from "@/lib/auth/admin-grants";
import { revalidatePath } from "next/cache";

export async function addAdministrator(_previous: string, form: FormData) {
  const session = await getCurrentSession();
  if (!session || !canAccessAdmin(session.user)) return "Verified administrator access is required.";
  try {
    const { db, client } = await getDomainDatabase();
    const email = form.get("email");
    const result = await createAdminGrant(db, client, session.user.id, typeof email === "string" ? email : "");
    revalidatePath("/admin/admins");
    return result;
  } catch { return "Could not confirm administrator access. Check the list and try again."; }
}
