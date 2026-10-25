"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { toast } from "@/components/toasts";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function signOut() {
    if (pending) return;
    setPending(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        toast.error("Couldn’t sign out. Please try again.");
        return;
      }
      toast.success("You’re signed out.");
      router.replace("/");
      router.refresh();
    } catch {
      toast.error("Couldn’t reach account services. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <button
        className="button button-yellow"
        onClick={signOut}
        disabled={pending}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
