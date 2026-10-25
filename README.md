# lostlink

Next.js App Router application with TypeScript, Tailwind CSS, and ESLint.

## Development

Requires Node.js 20.19 or newer and npm (including the MongoDB driver's runtime requirement).

```sh
npm install
npm run dev
```

Open http://localhost:3000. Edit `src/app/page.tsx` to update the home page.
Global styles and Tailwind are configured in `src/app/globals.css`.
Use `@/*` imports for files inside `src/`.

## Action notifications

A shared Sonner toaster in the root layout shows authentication, sign-out, and attachment success/error feedback across client navigation. Toasts use the app's colors and borders, support keyboard dismissal, respect reduced motion, and expire after eight seconds (timers pause while the notification area is hovered or focused). Signup and successful password reset redirect to login while their toast remains visible. Field validation, service availability, and invalid-link guidance remain inline. Repeated authentication errors reuse one toast rather than stacking. This is transient UI feedback; persisted report/claim notifications remain planned.

## Cloudinary uploads

User-uploaded media uses Cloudinary through server-only credentials. Set these in `.env.local` using the values from your Cloudinary product environment's API Keys page, then restart `npm run dev`:

```dotenv
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

Do not create an unsigned upload preset or expose the API secret with `NEXT_PUBLIC_*`. The SDK uploads bytes from the server using authenticated delivery. Original files and derived assets remain protected; only an authorized owner can request a download link, which expires after 60 seconds. A permanent signed CDN URL is deliberately not returned. Cloudinary must allow authenticated uploads and private downloads in the configured product environment. Use separate product environments for development and production.

Members with verified email can use the private attachment panel at `/post` to upload, download, and remove media. It accepts JPEG/PNG/WebP images up to 5 MB and MP4/WebM videos up to 20 MB, with at most five stored attachments per member. Actual file signatures are checked, images are decoded and re-encoded to strip metadata, and Cloudinary must successfully decode the image or video with nonzero dimensions. SVG, executable content, animated images, and audio-only files are rejected. Upload attempts are limited to five per minute per member. Files use random identifiers; original filenames are not retained.

These are temporary private attachments, expiring after 24 hours, while report, evidence, and avatar workflows remain pending. The shared media storage module is the Cloudinary integration for those future workflows; linking attachments to reports or claims and granting reviewer access are not implemented. Static landing-page illustrations remain local assets.

MongoDB's `media_uploads` collection records ownership, lifecycle, storage location, and expiry before the provider upload starts. Versioned idempotent indexes enforce five slots per owner under concurrency and expire rate-limit counters. Failed uploads and deletions retain a cleanup record. Expired attachments become inaccessible through the app even before physical deletion. Run the cleanup command regularly (for example, hourly in your deployment's scheduler):

```sh
npm run media:cleanup
```

The command reads `.env.local`, deletes at most 100 expired assets per run, and removes database records only after Cloudinary confirms deletion. Rerun for a backlog or after a provider failure. No automatic scheduler is installed. Never TTL-delete `media_uploads` records: Cloudinary deletion must happen first. A crash during an upload can leave a tracked unfinished record until expiry, when cleanup reclaims it. Cleanup touches only this app's recorded expired attachments, never unrelated Cloudinary assets.

The app allows Server Action request bodies up to 21 MB, including multipart overhead, so 20 MB videos can reach validation. Your deployment must also support that request size; a lower platform upload limit needs a separate signed direct-upload and verification workflow. Larger videos and direct browser uploads are outside this integration.

`npm test` validates upload content/limits, ownership isolation, concurrent attachment limits, and cleanup retries against an isolated MongoDB replica set and a fake storage sender. Live Cloudinary delivery requires credentials and is not exercised by automated tests.

## Landing page

The homepage implements the neobrutalist direction with an acid-yellow hero, pinned photography, an interactive example board, recovery steps, and accessible FAQ disclosures. It includes responsive navigation, item-detail dialogs, keyboard focus handling, and reduced-motion support.

Landing components and illustrative content live in `src/features/landing/`; shared dialog and icon components live in `src/components/`. The page uses optimized local images and a self-hosted Space Grotesk font through Next.js.

The board contains explicitly labeled examples, not live organization data. Every post-item link opens `/login?next=%2Fpost`, where users can log in or switch to sign-up. After login, `/post` checks the database session and verified email. The actual report form, private evidence uploads, and claims are still pending.

## Authentication setup

Email/password authentication uses Better Auth with its [MongoDB adapter](https://better-auth.com/docs/adapters/mongo). Accounts, password hashes, verification records, sessions, and rate limits are stored in MongoDB. Use MongoDB Atlas or a replica set; auth operations use transactions.

1. Copy `.env.example` to `.env.local`.
2. Set `MONGODB_URI` and `MONGODB_DB` for your database.
3. Set `BETTER_AUTH_URL` to the exact app origin (`http://localhost:3000` locally, HTTPS in production).
4. Generate `BETTER_AUTH_SECRET` with the command in `.env.example`.
5. Set `RESEND_API_KEY` and `AUTH_EMAIL_FROM` using a verified sender domain for email verification and password recovery.
6. Restart the app after changing environment variables.

If local DNS refuses SRV lookups (`querySrv ECONNREFUSED`), use the same Atlas cluster's standard `mongodb://` connection string with all cluster hosts, TLS enabled, and the original authentication/replica-set options. See [MongoDB connection formats](https://www.mongodb.com/docs/manual/reference/connection-string-formats/). Regenerate a standard connection string if the cluster hosts change, or restore SRV once local DNS works. This workstation currently uses that standard format in the ignored `.env` file.

The app builds and renders without credentials. Until all required variables are valid, account forms are unavailable and auth API requests return a generic HTTP 503; no fake accounts or sessions are created. MongoDB connections are initialized only when needed and reused. Better Auth creates its schema indexes; `src/lib/auth/indexes.ts` adds expiry cleanup and a unique credential-account constraint. The database user needs permission to create collections and indexes.

Routes: `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`, `/post`, and `/api/auth/[...all]`. Verification is required before login. Password reset tokens are single-use and reset revokes existing sessions. Tokens and passwords are never put in local storage. Recovery and verification responses avoid confirming whether an email is registered.

### JWT support

Better Auth's [JWT plugin](https://better-auth.com/docs/plugins/jwt) issues signed, five-minute tokens alongside database sessions. After login, call `authClient.token()` from `@/lib/auth/client` and handle its `{ data, error }` result; `data.token` contains the JWT. The equivalent HTTP endpoint is `GET /api/auth/token` with the existing session cookie. Anonymous, forged, expired, and revoked sessions cannot obtain tokens. Ordinary session reads do not issue JWTs.

Tokens contain only the user ID (`sub`), issuance/expiry times, issuer, and audience. Both issuer and audience equal `BETTER_AUTH_URL`. Public verification keys are available at `GET /api/auth/jwks`. Better Auth automatically stores its signing keys in MongoDB's `jwks` collection on first use, encrypting private keys using `BETTER_AUTH_SECRET`; no additional environment variables or dependencies are required. Preserve that secret across restarts.

JWTs are available for services that need them; app pages continue to authorize through database sessions and current user records. A JWT alone does not grant organization membership or staff permissions. Consumers must verify signatures, expiration, issuer, and audience and enforce their own current access checks. Already-issued JWTs remain valid until expiry after logout or password reset; those actions prevent further issuance through the revoked session. Keep tokens in memory, never URLs or local storage.

Signup accepts any email domain. Email verification grants member access automatically; domain allowlists and staff membership approval have been removed. New accounts always receive the `member` role, and role assignment is never exposed through signup or profile updates. Legacy `membershipStatus` fields are ignored, so existing pending accounts gain access after verification without a database rewrite. This does not create a report or grant an admin role.

Auth endpoints validate origins and use MongoDB-backed rate limiting. In production, ensure your hosting proxy overwrites the client IP headers and prevent direct access that could bypass the proxy. Monitor the safe `AUTH_*` server event codes for service/email delivery failures; never log credentials or emailed links. Email delivery uses Next.js `after` so requests do not wait on the email provider; users can request a fresh verification/reset email if delivery fails.

Run `npm test` for configuration, redirect, verified-member access, and auth lifecycle/security checks. Integration tests launch a disposable local MongoDB replica set and capture emails in memory; they do not use `.env.local` or a real email provider. The first test run may download a MongoDB test binary. Actual Atlas connectivity and live email delivery must be verified once credentials are supplied.

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
