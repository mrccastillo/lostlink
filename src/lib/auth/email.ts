import "server-only";
import type { AuthConfig } from "./config";

export type AuthEmail = { to: string; subject: string; text: string };
export type SendAuthEmail = (email: AuthEmail) => Promise<void>;

export function createEmailSender(config: AuthConfig): SendAuthEmail {
  return async (email) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.emailApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.emailFrom,
        to: [email.to],
        subject: email.subject,
        text: email.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    // Provider responses can contain recipient data: do not expose or log them.
    if (!response.ok)
      throw new Error("Authentication email could not be sent.");
  };
}
