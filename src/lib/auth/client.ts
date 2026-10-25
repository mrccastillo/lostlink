"use client";

import { createAuthClient } from "better-auth/react";

// Same-origin requests; the server owns the canonical URL and trusted origins.
export const authClient = createAuthClient();
