"use client";

import { createAuthClient } from "better-auth/react";
import { jwtClient } from "better-auth/client/plugins";

// Same-origin requests; the server owns the canonical URL and trusted origins.
export const authClient = createAuthClient({ plugins: [jwtClient()] });
