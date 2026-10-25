"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Couldn’t sign out. Please try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Couldn’t reach account services. Please try again.");
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
      <p className="auth-error" role="alert">
        {error}
      </p>
    </div>
  );
}
