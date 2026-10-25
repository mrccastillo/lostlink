export type AuthConfig = {
  mongoUri: string;
  databaseName: string;
  secret: string;
  baseURL: string;
  emailApiKey: string;
  emailFrom: string;
  allowedEmailDomains: string[];
};

type Environment = Record<string, string | undefined>;

// Return no configuration rather than starting auth with an insecure default.
// This module reads no environment variables itself and is safe to unit test.
export function readAuthConfig(env: Environment): AuthConfig | null {
  const mongoUri = env.MONGODB_URI?.trim();
  const databaseName = env.MONGODB_DB?.trim() || "lostlink";
  const secret = env.BETTER_AUTH_SECRET;
  const baseURL = env.BETTER_AUTH_URL?.trim();
  const emailApiKey = env.RESEND_API_KEY?.trim();
  const emailFrom = env.AUTH_EMAIL_FROM?.trim();

  if (
    !mongoUri ||
    !/^mongodb(?:\+srv)?:\/\//.test(mongoUri) ||
    !secret ||
    secret.length < 32 ||
    !baseURL ||
    !emailApiKey ||
    !emailFrom
  )
    return null;

  try {
    const url = new URL(baseURL);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/"
    )
      return null;
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
      return null;
    return {
      mongoUri,
      databaseName,
      secret,
      baseURL: url.origin,
      emailApiKey,
      emailFrom,
      allowedEmailDomains: (env.AUTH_ALLOWED_EMAIL_DOMAINS ?? "")
        .split(",")
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    };
  } catch {
    return null;
  }
}
