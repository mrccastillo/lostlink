# lostlink

Next.js App Router application with TypeScript, Tailwind CSS, and ESLint.

## Development

Requires Node.js 20.9 or newer and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Edit `src/app/page.tsx` to update the home page.
Global styles and Tailwind are configured in `src/app/globals.css`.
Use `@/*` imports for files inside `src/`.

## Landing page

The homepage implements the neobrutalist direction with an acid-yellow hero, pinned photography, an interactive example board, recovery steps, and accessible FAQ disclosures. It includes responsive navigation, item-detail dialogs, keyboard focus handling, and reduced-motion support.

Landing components and illustrative content live in `src/features/landing/`; shared dialog and icon components live in `src/components/`. The page uses optimized local images and a self-hosted Space Grotesk font through Next.js.

The board contains explicitly labeled examples, not live organization data. Every post-item link opens `/login?next=%2Fpost`, where users can log in or switch to sign-up. After login, `/post` checks the database session, verified email, and membership status. The actual report form, private evidence uploads, and claims are still pending.

## Authentication setup

Email/password authentication uses Better Auth with its [MongoDB adapter](https://better-auth.com/docs/adapters/mongo). Accounts, password hashes, verification records, sessions, and rate limits are stored in MongoDB. Use MongoDB Atlas or a replica set; auth operations use transactions.

1. Copy `.env.example` to `.env.local`.
2. Set `MONGODB_URI` and `MONGODB_DB` for your database.
3. Set `BETTER_AUTH_URL` to the exact app origin (`http://localhost:3000` locally, HTTPS in production).
4. Generate `BETTER_AUTH_SECRET` with the command in `.env.example`.
5. Set `RESEND_API_KEY` and `AUTH_EMAIL_FROM` using a verified sender domain for email verification and password recovery.
6. Optionally set `AUTH_ALLOWED_EMAIL_DOMAINS` to comma-separated organization email domains. With no allowed domains, all accounts need staff approval. These domains are compared exactly, not by suffix.
7. Restart the app after changing environment variables.

The app builds and renders without credentials. Until all required variables are valid, account forms are unavailable and auth API requests return a generic HTTP 503; no fake accounts or sessions are created. MongoDB connections are initialized only when needed and reused. Better Auth creates its schema indexes; `src/lib/auth/indexes.ts` adds expiry cleanup and a unique credential-account constraint. The database user needs permission to create collections and indexes.

Routes: `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`, `/post`, and `/api/auth/[...all]`. Verification is required before login. Password reset tokens are single-use and reset revokes existing sessions. Tokens and passwords are never put in local storage. Recovery and verification responses avoid confirming whether an email is registered.

New accounts always receive the `member` role. Approved-domain accounts still need email verification. Other accounts remain `pending` until a trusted administrator updates `user.membershipStatus` to `approved` through an authorized staff process; a staff management UI is not implemented yet. Role assignment is never exposed through public signup or profile-update input. Membership approval does not create a report or grant an admin role.

Auth endpoints validate origins and use MongoDB-backed rate limiting. In production, ensure your hosting proxy overwrites the client IP headers and prevent direct access that could bypass the proxy. Monitor the safe `AUTH_*` server event codes for service/email delivery failures; never log credentials or emailed links. Email delivery uses Next.js `after` so requests do not wait on the email provider; users can request a fresh verification/reset email if delivery fails.

Run `npm test` for configuration, redirect, membership, and auth lifecycle/security checks. Integration tests launch a disposable local MongoDB replica set and capture emails in memory; they do not use `.env.local` or a real email provider. The first test run may download a MongoDB test binary. Actual Atlas connectivity and live email delivery must be verified once credentials are supplied.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
npm test
```

Run `npm start` after building to serve the production app.

## Design previews

Two responsive HTML concepts live in `public/designs/`:

- [Modern minimalist](public/designs/modern.html): ivory and forest green, editorial typography, and restrained motion.
- [Neobrutalist](public/designs/neobrutalist.html): acid yellow, oversized type, heavy rules, and offset shadows.

Open either HTML file directly in a browser, keeping `interactions.js` and the `assets/` folder alongside it. With `npm run dev`, visit `/designs/modern.html` or `/designs/neobrutalist.html`. Each page links to the other option.

Both include searchable sample reports, lost/found filters, item details, a report preview dialog, keyboard navigation, and reduced-motion support. These remain static design references: no authentication, uploads, persistence, or backend submissions are connected. The main Next.js route implements the neobrutalist landing page separately.

Photos are stored locally from Unsplash: [backpack](https://images.unsplash.com/photo-1553062407-98eeb64c6a62), [headphones](https://images.unsplash.com/photo-1546435770-a3e426bf472b), and [camera](https://images.unsplash.com/photo-1516035069371-29a1b244cc32). Google Fonts supplies DM Sans and Space Grotesk; system fonts provide an offline fallback.
