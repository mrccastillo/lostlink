"use client";

import { useActionState } from "react";
import { addAdministrator } from "./manage-action";

export function CreateAdminForm() {
  const [message, action, pending] = useActionState(addAdministrator, "");
  return <form action={action} className="staff-create">
    <h2>Create an administrator</h2>
    <p>Verified accounts receive access immediately. A new recipient has seven days to sign up and verify their email.</p>
    <label>Email address <input name="email" type="email" maxLength={254} required /></label>
    <button className="button button-yellow" disabled={pending}>{pending ? "Saving?" : "Create admin"}</button>
    <p role="status">{message}</p>
  </form>;
}
