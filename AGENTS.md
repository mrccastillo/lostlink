<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LostLink engineering guidelines

These instructions apply throughout the repository. Preserve the generated Next.js block above. Read this file and any more specific directory instructions before making changes.

## Project context

- Read `PRD.md` for scope, roles, feature acceptance criteria, and privacy requirements. Keep implementation and documentation consistent; identify material scope changes explicitly.
- The installed stack is Next.js App Router, React, TypeScript, Tailwind CSS, and ESLint. Use npm and maintain `package-lock.json`.
- MongoDB and Better Auth are the selected database and authentication stack. Resend handles verification and recovery emails. Credentials belong in `.env.local`; `.env.example` documents required names. Tests use an isolated MongoDB replica set and a captured email sender. Check `package.json` and the code before assuming other integrations exist.
- Prefer the smallest complete solution that satisfies the requirement. Avoid speculative abstractions, extra services, unrelated refactors, and dependencies without a concrete need.
- Inspect nearby code and installed framework documentation before selecting an API. Use official documentation for guidance that is absent locally; do not guess version-sensitive behavior.

## Core design principles

Apply these principles to reduce the cost of understanding, testing, and changing the code. Use judgment rather than introducing patterns solely to satisfy an acronym.

- **DRY (Don't Repeat Yourself):** Give each business rule, validation schema, status definition, and permission policy one authoritative application-level definition. Share it across callers instead of copying logic. Similar-looking code with different responsibilities may remain separate until a stable shared concept emerges. Database constraints and row-level security remain necessary independent enforcement; do not remove them as "duplication."
- **KISS (Keep It Simple):** Prefer straightforward control flow, explicit data transformations, and framework conventions. Choose a small function or component before adding a generic engine, class hierarchy, or configuration language.
- **YAGNI (You Aren't Gonna Need It):** Build for current acceptance criteria. Do not add speculative plugin systems, multi-tenant infrastructure, queues, or alternative-provider abstractions without a current requirement. Implement durability and isolation already required by the PRD when the corresponding feature is built.
- **Separation of concerns:** Keep rendering, input validation, authorization, domain decisions, persistence, and external side effects distinct. A claim review component should present a decision; the server workflow must enforce and persist it.
- **Single responsibility:** Give each module one cohesive responsibility and a clear reason to change. Split a module when unrelated concerns evolve independently, rather than enforcing arbitrary function or file length limits.
- **Open/closed principle:** Extend established behavior through small composable functions or explicit strategies when variation is real. Do not continually modify unrelated callers or introduce extension points for hypothetical requirements.
- **Liskov substitution:** Implementations sharing a contract must preserve its promised behavior, error semantics, and security guarantees. A test storage adapter must not suggest that production access checks are optional.
- **Interface segregation:** Define focused props, function parameters, and adapter contracts that expose only what consumers need. Avoid oversized service objects, boolean-heavy component APIs, and passing entire database records to UI components.
- **Dependency inversion:** Keep domain rules independent of framework request objects and vendor SDKs. Pass narrow dependencies at useful boundaries, such as time or notification delivery, when needed for testing or actual provider variation. Do not introduce a dependency-injection container by default.
- **Composition over inheritance:** Combine functions, components, and focused hooks rather than extending base classes or building deep component hierarchies. Hooks should encapsulate reusable client behavior, not hide server business rules.
- **High cohesion, low coupling:** Keep related behavior together, expose small module boundaries, and avoid reaching through another feature's internals. A change to email delivery should not require changes to claim eligibility rules.
- **Single source of truth for state:** Store canonical state once and derive display values. Avoid copying props, query results, or computed values into React state unless independent editing or synchronization is required.
- **Explicit contracts and safe defaults:** Represent valid states and expected failures in types and runtime checks. Reject unauthorized or invalid operations before side effects, and make optional behavior explicit rather than relying on hidden global state.
- **Pragmatic refactoring:** Improve structure in small, behavior-preserving steps near the work being done. Prefer a little temporary repetition to an abstraction that couples unrelated workflows; consolidate when the shared responsibility becomes clear.

## Architecture and code organization

- Keep route pages, layouts, loading states, error boundaries, and route handlers under `src/app`. Keep route files focused on composition.
- Place shared UI in `src/components`, feature-specific behavior in `src/features/<feature>`, and shared infrastructure in `src/lib` when these boundaries are needed. Do not create empty directories or layers in advance.
- Use Server Components by default. Add `"use client"` only where browser APIs, state, or interactions require it, and keep the client boundary small.
- Use Server Actions for first-party form mutations. Add Route Handlers for HTTP integrations or consumers that actually need an endpoint. Share domain logic rather than having server code call its own HTTP API.
- Separate database access, authorization, and business rules from presentation. Use `server-only` boundaries for modules containing credentials or privileged operations.
- Use the `@/*` import alias for shared source modules. Avoid circular dependencies and unnecessary barrel exports.
- Model report, claim, moderation, and return states explicitly. Keep permitted transitions in a shared domain layer and enforce them in the database where necessary.

## TypeScript and maintainability

- Keep strict TypeScript checks enabled. Prefer precise types and discriminated unions over `any`, unchecked casts, or non-null assertions.
- Treat request input, environment variables, uploaded files, and external responses as untrusted data. Validate them at runtime; TypeScript types alone do not validate input.
- Reuse domain schemas and inferred types where practical. Do not duplicate validation rules across forms and server operations.
- Write small, cohesive functions and components with descriptive names. Extract shared behavior when there is a real second use or a clear domain boundary.
- Handle expected failures explicitly and return useful, safe messages. Do not swallow errors, use blanket lint suppressions, or silently substitute demo data for failed production requests.
- Add comments for non-obvious decisions and invariants rather than narrating straightforward code. Remove dead code and unused imports in the area being changed.

## Authentication, authorization, and privacy

- Verify authentication, organization membership, record ownership, and required role at every server read or mutation that handles protected data. Navigation guards and hidden buttons do not authorize an operation.
- Derive actor identity and privileges from a verified server session and trusted records. Never accept a client-supplied user ID, organization ID, or role as proof of permission.
- MongoDB does not provide PostgreSQL-style row-level security. Enforce organization, ownership, verified email, and membership checks in every protected server operation. Roles and membership status must never be accepted from account creation or profile update input. Test authorization using ordinary member sessions.
- Keep server secrets out of client imports, `NEXT_PUBLIC_*` variables, logs, source control, and error responses. Document required variable names using placeholders and allow a safe example file through `.gitignore` if one is added.
- Return explicit public data projections. Keep serial numbers, hidden identifiers, verification answers, proof documents, and contact details out of public reports, search indexes, matching explanations, analytics, and logs.
- Authorize private file access before issuing short-lived signed URLs. Validate file content, size, and type; use generated storage paths and clean up abandoned uploads. Follow the upload limits in `PRD.md`.
- Do not cache user-specific or organization-restricted responses in shared caches without a verified isolation strategy. Review cache keys and invalidation whenever authorization or data visibility changes.
- Add rate limits to abuse-prone operations such as sign-in, reporting, claims, and uploads when those operations are implemented. Authenticate external webhooks and make processing idempotent.

## Database integrity and side effects

- Make schema and index changes through versioned, idempotent setup code. Use MongoDB unique indexes, document validation, explicit reference checks, and transactions to enforce invariants. Use Atlas or a replica set for transactions; do not assume MongoDB has relational foreign keys.
- Use parameterized queries or typed query builders. Allowlist sort and filter fields instead of interpolating user input into queries.
- Use transactions for claim decisions, item reservations, returns, and their audit events. Protect against concurrent approvals and repeated submissions with database constraints and idempotency where appropriate.
- Claim approval reserves an item; only a recorded physical handoff marks it returned. Suggested matches never prove ownership or authorize a claim.
- Preserve audit history and prefer archive or withdrawal for records referenced by claims and returns. Keep private evidence out of audit payloads.
- Send external notifications after the domain transaction commits, using a durable outbox when email is implemented. Handle retries and duplicate events without duplicating domain actions.
- Use UTC timestamps, explicit display time zones, bounded result sets, stable pagination, and indexes aligned with actual queries. Avoid N+1 reads and unbounded file or record retrieval.

## Interface quality and accessibility

- Build responsive interfaces using semantic HTML, labeled controls, visible focus states, keyboard access, adequate contrast, and meaningful image descriptions.
- Include loading, empty, success, validation, unauthorized, and failure states for each workflow. Preserve valid form input after recoverable failures.
- Prevent accidental duplicate submissions and clearly communicate pending operations. Important mutations must also remain safe if duplicate requests reach the server.
- Keep searchable filters in URL parameters where appropriate. Do not expose private values in URLs.
- Use Tailwind and existing components consistently. Avoid adding a component library or broad client-side state framework for a small isolated interaction.
- Use supported Next.js image and font facilities where appropriate. Optimize assets and client JavaScript based on measured needs.

## Verification

- Run checks appropriate to the change. For application or configuration changes, run `npm run lint`, `npm run typecheck`, and `npm run build`; investigate failures before reporting completion.
- Documentation-only edits need content, link, and diff review rather than an application build.
- Add meaningful regression tests for changed business rules, security boundaries, and bug fixes. Favor behavior and failure cases over tests that repeat implementation details or brittle visual snapshots.
- When test tooling is added, cover matching and validation with unit tests; authorization, database constraints, and transactions with integration tests; and report-to-claim-to-return flows with end-to-end tests.
- Include unauthorized access, cross-user and cross-organization isolation, concurrent approvals, invalid uploads, and duplicate events in the relevant tests. Test against isolated data and never mutate production records during verification.
- Do not invent successful checks. Report exactly what ran, the outcome, and any checks blocked by unavailable credentials, services, or tooling.

## Change delivery

- Review the working tree before editing and preserve existing user changes. Keep changes scoped and do not overwrite unrelated files.
- Keep dependency updates intentional, include the lockfile, and review compatibility before changing versions. Do not use broad automatic dependency fixes without understanding the resulting changes.
- Update setup instructions, environment examples, migrations, and acceptance criteria when behavior or operational requirements change.
- Review the final diff for accidental secrets, generated output, debug code, unrelated edits, and misleading documentation. Do not commit dependency directories or build artifacts.
- Never reset user work, rewrite shared history, run destructive production migrations, or deploy without authorization. Respect authorization already given in the conversation and proceed autonomously with routine reversible work.
- In the handoff, summarize what changed, how it was verified, and any remaining limitations. Clearly distinguish implemented behavior from proposed work.
