import "server-only";
import type { AuthConfig } from "./config";

export type AuthEmail = { to: string; subject: string; text: string };
export type SendAuthEmail = (email: AuthEmail) => Promise<void>;

export function createEmailSender(config: AuthConfig): SendAuthEmail {
  return async (email) => {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": config.emailApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "LostLink", email: config.emailSenderAddress },
        to: [{ email: email.to }],
        subject: email.subject,
        textContent: email.text,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    // Provider responses can contain recipient data: do not expose or log them.
    if (!response.ok)
      throw new Error("Authentication email could not be sent.");
  };
}
