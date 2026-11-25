import type { Db } from "mongodb";
import { ADMIN_ROLE, MEMBER_ROLE } from "./policy";

export function isAccountRole(value: unknown): value is typeof ADMIN_ROLE | typeof MEMBER_ROLE {
  return value === ADMIN_ROLE || value === MEMBER_ROLE;
}

export async function setAccountRole(db: Db, email: string, role: typeof ADMIN_ROLE | typeof MEMBER_ROLE) {
  const result = await db.collection("user").updateOne(
    {
      email: email.trim().toLowerCase(),
      ...(role === ADMIN_ROLE ? { emailVerified: true } : {}),
    },
    { $set: { role } },
  );
  return result.matchedCount === 1;
}
