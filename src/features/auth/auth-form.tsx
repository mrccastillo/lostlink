"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "@/components/toasts";
import { ArrowUpRight } from "@/components/icons";
import { authClient } from "@/lib/auth/client";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/policy";

export type AuthMode = "login" | "signup" | "forgot" | "reset" | "verify";

const copy = {
  login: {
    heading: "Welcome back.",
    description: "Log in to reconnect with your community.",
    action: "Log in",
  },
  signup: {
    heading: "Good people. Start here.",
    description: "Create your account to get things back where they belong.",
    action: "Create account",
  },
  forgot: {
    heading: "Let’s get you back in.",
    description: "We’ll send a password reset link to your email.",
    action: "Send reset link",
  },
  reset: {
    heading: "A fresh start.",
    description: "Choose a new password for your LostLink account.",
    action: "Reset password",
  },
  verify: {
    heading: "One last connection.",
    description: "Request a fresh link to verify your email address.",
    action: "Send verification link",
  },
} as const;

type Props = {
  mode: AuthMode;
  available: boolean;
  returnTo: string;
  token?: string;
  verified?: boolean;
  invalidLink?: boolean;
};

function errorMessage(
  error: { status?: number; code?: string },
  mode: AuthMode,
) {
  if (error.status === 503)
    return "Account access is temporarily unavailable. Please try again later.";
  if (error.status === 429)
    return "Too many attempts. Please wait a minute before trying again.";
  if (error.code === "EMAIL_NOT_VERIFIED")
    return "Verify your email before logging in. You can request another link below.";
  if (mode === "login")
    return "We couldn’t log you in. Check your email and password and try again.";
  if (mode === "reset")
    return "This reset link may have expired or already been used. Request a new one below.";
  return "We couldn’t complete that request. Please try again shortly.";
}

export function AuthForm({
  mode,
  available,
  returnTo,
  token,
  verified,
  invalidLink,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const showEmail = mode !== "reset";
  const showPasswordField = ["login", "signup", "reset"].includes(mode);
  const newPassword = mode === "signup" || mode === "reset";
  const query = `?next=${encodeURIComponent(returnTo)}`;
  const verificationCallback = `/login${query}&verified=1`;
  const invalidReset = mode === "reset" && (!token || invalidLink);
  const blocked = !available || invalidReset;

  useEffect(() => {
    if (verified && !invalidLink)
      toast.success("Your email is verified. You can now log in.", {
        id: "email-verified",
      });
  }, [verified, invalidLink]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || blocked) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const email = String(values.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(values.get("password") ?? "");
    const name = String(values.get("name") ?? "").trim();
    setError("");
    toast.dismiss("auth-error");
    if (mode === "signup" && (name.length < 2 || name.length > 80)) {
      setError("Enter a name between 2 and 80 characters.");
      return;
    }
    if (newPassword && password !== values.get("confirmPassword")) {
      setError("Your passwords don’t match.");
      return;
    }
    setPending(true);
    try {
      let result;
      if (mode === "login") {
        result = await authClient.signIn.email({ email, password });
      } else if (mode === "signup") {
        result = await authClient.signUp.email({
          name,
          email,
          password,
          callbackURL: verificationCallback,
        });
      } else if (mode === "forgot") {
        result = await authClient.requestPasswordReset({
          email,
          redirectTo: "/reset-password",
        });
      } else if (mode === "reset") {
        result = await authClient.resetPassword({
          newPassword: password,
          token: token ?? "",
        });
      } else {
        result = await authClient.sendVerificationEmail({
          email,
          callbackURL: verificationCallback,
        });
      }
      if (result.error) {
        toast.error(errorMessage(result.error, mode), { id: "auth-error" });
        return;
      }
      form.reset();
      setShowPassword(false);
      if (mode === "login") {
        toast.success("You’re logged in.");
        router.replace(returnTo);
        router.refresh();
      } else if (mode === "signup") {
        toast.success("If your account needs verification, check your inbox for a link.");
        router.replace(`/login${query}`);
      } else if (mode === "reset") {
        toast.success(
          "Your password has been updated. Log in with your new password.",
        );
        router.replace(`/login${query}`);
      } else if (mode === "forgot") {
        toast.success(
          "If an account matches that email, a reset link is on its way. Check your inbox and spam folder.",
        );
      } else {
        toast.success(
          "If your account needs verification, a new link is on its way. Check your inbox and spam folder.",
        );
      }
    } catch {
      toast.error(
        "We couldn’t reach account services. Check your connection and try again.",
        { id: "auth-error" },
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-panel">
      {(mode === "login" || mode === "signup") && (
        <nav className="auth-tabs" aria-label="Account access">
          <Link
            href={`/login${query}`}
            aria-current={mode === "login" ? "page" : undefined}
          >
            Log in
          </Link>
          <Link
            href={`/signup${query}`}
            aria-current={mode === "signup" ? "page" : undefined}
          >
            Sign up
          </Link>
        </nav>
      )}
      <p className="eyebrow">Your community. Your connection.</p>
      <h1>{copy[mode].heading}</h1>
      <p className="auth-description">{copy[mode].description}</p>
      {!available && (
        <p className="auth-notice" role="status">
          Account access is temporarily unavailable. Please try again later.
        </p>
      )}
      {invalidLink && (
        <p className="auth-notice" role="alert">
          This link is invalid or has expired. Request a fresh link below.
        </p>
      )}
      {mode === "reset" && !token && !invalidLink && (
        <p className="auth-notice">
          Open the link in your password reset email to continue.
        </p>
      )}
      <form onSubmit={submit} aria-busy={pending}>
        <fieldset disabled={pending || invalidReset}>
          {mode === "signup" && (
            <label className="auth-field">
              Your name
              <input
                name="name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={80}
                placeholder="Your full name"
              />
            </label>
          )}
          {showEmail && (
            <label className="auth-field">
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                maxLength={254}
                placeholder="you@example.com"
              />
            </label>
          )}
          {showPasswordField && (
            <div className="auth-field">
              <label htmlFor="password">
                {mode === "reset" ? "New password" : "Password"}
              </label>
              <div className="password-input">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    newPassword ? "new-password" : "current-password"
                  }
                  required
                  minLength={newPassword ? PASSWORD_MIN_LENGTH : 1}
                  maxLength={PASSWORD_MAX_LENGTH}
                  aria-describedby={newPassword ? "password-hint" : undefined}
                />
                <button
                  type="button"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {newPassword && (
                <p id="password-hint" className="field-hint">
                  Use at least {PASSWORD_MIN_LENGTH} characters. A few
                  memorable words work well.
                </p>
              )}
            </div>
          )}
          {newPassword && (
            <label className="auth-field">
              Confirm password
              <input
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
              />
            </label>
          )}
          <p className="auth-error" role="alert">
            {error}
          </p>
          <button
            type="submit"
            className="button button-yellow auth-submit"
            disabled={blocked}
          >
            {pending ? "Please wait…" : copy[mode].action}
            <ArrowUpRight />
          </button>
        </fieldset>
      </form>
      <div className="auth-help">
        {mode === "login" && (
          <>
            <Link href="/forgot-password">Forgot your password?</Link>
            <Link href={`/verify-email${query}`}>
              Resend verification email
            </Link>
          </>
        )}
        {mode === "signup" && (
          <p>
            Verify your email to start using your account.
          </p>
        )}
        {mode === "reset" && (
          <Link href="/forgot-password">Request a new reset link</Link>
        )}
        {!["login", "signup"].includes(mode) && (
          <Link href={`/login${query}`}>Back to log in</Link>
        )}
      </div>
    </div>
  );
}
