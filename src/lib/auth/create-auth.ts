import { betterAuth } from "better-auth/minimal";
import { APIError } from "better-auth/api";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import type { Db, MongoClient } from "mongodb";
import type { AuthConfig } from "./config";
import type { SendAuthEmail } from "./email";
import {
  initialMembership,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "./policy";

type Dependencies = {
  db: Db;
  client: MongoClient;
  config: AuthConfig;
  sendEmail: SendAuthEmail;
  backgroundTask?: (promise: Promise<unknown>) => void;
};

// Credentials enter through the server-only runtime. Dependency injection here
// lets security tests use an isolated replica set and a captured email sender.
export function createAuth({
  db,
  client,
  config,
  sendEmail,
  backgroundTask,
}: Dependencies) {
  return betterAuth({
    appName: "LostLink",
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: [config.baseURL],
    database: mongodbAdapter(db, { client }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Reset your LostLink password",
          text: `Reset your password using this link:\n${url}\n\nIf you did not request this, ignore this email.`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Verify your LostLink email",
          text: `Welcome to LostLink. Verify your email using this link:\n${url}\n\nThis link expires in one hour.`,
        });
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    user: {
      additionalFields: {
        role: {
          type: ["member", "admin"],
          required: true,
          defaultValue: "member",
          input: false,
        },
        membershipStatus: {
          type: ["pending", "approved"],
          required: true,
          defaultValue: "pending",
          input: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const name = user.name.trim();
            if (name.length < 2 || name.length > 80)
              throw new APIError("BAD_REQUEST", {
                message: "Enter a name between 2 and 80 characters.",
              });
            return {
              data: {
                ...user,
                name,
                role: "member",
                membershipStatus: initialMembership(
                  user.email,
                  config.allowedEmailDomains,
                ),
              },
            };
          },
        },
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/request-password-reset": { window: 60, max: 3 },
        "/send-verification-email": { window: 60, max: 3 },
      },
    },
    advanced: {
      cookiePrefix: "lostlink",
      useSecureCookies: config.baseURL.startsWith("https:"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      ...(backgroundTask
        ? { backgroundTasks: { handler: backgroundTask } }
        : {}),
    },
    // The API boundary logs a safe event code; never print request credentials,
    // verification URLs, database URIs, or provider responses from the library.
    logger: { disabled: true },
  });
}

export type LostLinkAuth = ReturnType<typeof createAuth>;
