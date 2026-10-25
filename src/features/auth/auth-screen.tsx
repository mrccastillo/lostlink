import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { isAuthConfigured } from "@/lib/auth/server";
import { safeReturnPath } from "@/lib/auth/policy";
import { AuthForm, type AuthMode } from "./auth-form";

type Props = {
  mode: AuthMode;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function AuthContent({ mode, searchParams }: Props) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params.next);
  const session = await getCurrentSession();
  if (session && (mode === "login" || mode === "signup")) redirect(returnTo);
  return (
    <AuthForm
      mode={mode}
      available={isAuthConfigured()}
      returnTo={returnTo}
      token={typeof params.token === "string" ? params.token : undefined}
      verified={params.verified === "1"}
      invalidLink={Boolean(params.error)}
    />
  );
}

export function AuthScreen(props: Props) {
  return (
    <Suspense
      fallback={
        <p className="auth-loading" role="status">
          Opening account access…
        </p>
      }
    >
      <AuthContent {...props} />
    </Suspense>
  );
}
