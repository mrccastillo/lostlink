## 

## 

## **Group 4**

## **Phase 1: IT Startup Concept, Project Scope, and SMART Goals**

# **LostLink**

Project Management  
(Prof. Desiderata B. Cayabyab)

**Members:**  
Castillo, Marc Lowel Jaime  
Derecho, Jimson Aldrich G.  
Hipolito, Brandon Boyd  
Monasaprang, Anirah M.  
Nabong, Anika Janine S.  
Omela, Jinrikisha H.

1. **Project Overview**  
   Lost-and-found processes in schools, offices, and organizations are often unorganized and scattered across group chats, social media posts, announcements, and physical locations. People who lose their belongings may not know where to report them, while those who find items may have difficulty reaching their rightful owners.   
   This lack of a centralized system makes it difficult to search for lost items, match lost and found reports, verify ownership, and communicate with the people involved. As a result, many lost belongings remain unclaimed even when they have already been found.   
   LostLink aims to address this problem by providing a centralized digital platform where users can report, search, match, verify, and track lost and found items. This creates a more organized, efficient, and secure process for recovering belongings and returning them to their rightful owners.  
     
2. **Goals/Objectives**

   1. **Goal 1: Centralized reporting and search functionality**  
- Constructing a centralized reporting and search system where users can post lost and found items with photos, as well as search using filters such as item category, location, and date, ensuring complete test accuracy before the project's release.


  2. **Goal 2: Possible Match System**  
- Develop a Possible Match System that compares lost and found item details, locations, and dates to identify potential matches with at least 80% accuracy by the end of the project development period. 


  3. **Goal 3: Security & Ownership Verification**  
- Implement a secure ownership verification feature that requires claimants to provide matching identifying details, such as unique serial numbers, hidden item features, or specific questions, ensuring every claim is reviewed and approved by administrators prior to item handoff to prevent unauthorized claims. 


  4. **Goal 4: Admin Dashboard & Return Tracking**  
- Develop & configure the secure admin dashboard for authorized staff to manage all system activities, alongside the return tracking system for recording successful item returns, to be completed one month before project deployment.


  5. **Goal 5: Deployment**  
- Integrate all core features, authentication roles, and database records into a fully functional web or mobile application deployment and pass 100% of end-to-end system tests with all specified app features within 10 weeks of project kickoff to deliver the complete, production-ready IT startup product required for the semester.

## Implementation specification

The sections below incorporate the supplied feature screenshots and refine their technical tasks. The original project overview, team details, and goals above are preserved. The Next.js scaffold, public neobrutalist landing page, and MongoDB/Better Auth account flows are implemented. Better Auth also issues optional five-minute JWTs with minimal identity claims and public JWKS verification keys; application authorization continues to use database sessions and current user records. Auth awaits environment credentials for live operation; report submission for review is implemented; the admin MVP covers report publication, private claim review, reservation, and physical handoff. Member editing and withdrawal remain planned. The landing page uses explicitly labeled illustrative reports. MongoDB replaces the earlier Supabase/PostgreSQL recommendation at the user's direction.

### Product scope and roles

Build a responsive web application for one school, office, or organization initially. Use a single organization boundary for all reports, claims, and users. Supporting multiple organizations is future work.

| Role | Access |
| --- | --- |
| Visitor | Landing page, sign-in, and public FAQ. |
| Member | Browse organization reports, submit and manage own reports, submit claims on found items, view own claim outcomes, and view own notifications and history. |
| Administrator | Moderate reports, review claims and private evidence, approve or reject claims, record physical returns, and review audit history within the organization. |

Require verified email before submitting reports or claims. User-requested scope change: signup is open to any email domain, and verification grants member access automatically in the single community. Email-domain allowlists and staff membership approval are removed. Members cannot assign their own role. The first administrator is provisioned through trusted setup. Verified administrators can browse the account directory and community audit log, promote verified accounts, and authorize new administrators by email. Pending authorizations expire after seven days.

### Recommended technical architecture

| Concern | Decision |
| --- | --- |
| Application | Keep the existing Next.js App Router, TypeScript, Tailwind CSS, npm, and ESLint setup. |
| Backend | Use Next.js Server Actions for first-party form mutations and Server Components for initial reads. Use Route Handlers when an HTTP endpoint is needed, such as an email webhook. A separate CRUD API service is unnecessary for the initial web app. |
| Database | MongoDB Atlas or a replica set, with versioned index/document validation changes, explicit reference checks, unique indexes, and transactions. Enforce access in server operations. |
| Authentication | Better Auth with the MongoDB adapter, email/password login, verified email, database sessions, recovery emails, and server-side verification/role/ownership checks. |
| Validation | Shared Zod schemas for form input, with authoritative validation on the server. Use native forms and React form state initially; add a form library only if the workflow needs it. |
| File storage | Cloudinary for all user-uploaded images and videos, using authenticated delivery. Store object paths in MongoDB and authorize every download or short-lived signed URL. The private temporary attachment workflow is implemented; report attachment transfer is implemented; private claim evidence transfer is implemented; reviewers access private case attachments through short-lived links. Avatar integration remains pending. |
| Search | MongoDB indexes for category, location, date, type, and status filters; evaluate MongoDB text indexes or Atlas Search when search is implemented. Index public report fields only. |
| Notifications | Database-backed in-app notifications first. Add transactional notification emails through Brevo and an outbox worker with retry handling in Phase 2. |
| Testing | Unit tests for matching and validation; integration tests for database authorization and state changes; Playwright for important user journeys. |
| Deployment | One Next.js deployment with MongoDB Atlas and Brevo for account emails. Keep preview and production data separate and keep server secrets out of browser bundles. |

Server Actions are remotely callable entry points, so every mutation must check authentication, authorization, and input rather than depending on hidden buttons or route redirects. See the [Next.js mutation guide](https://nextjs.org/docs/app/getting-started/mutating-data) and [authentication guide](https://nextjs.org/docs/app/guides/authentication).

Authentication follows the [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next) and [MongoDB adapter](https://better-auth.com/docs/adapters/mongo). New users receive the member role and gain member access after verifying their email; no domain restriction or staff approval is required. Existing pending membership fields are ignored. MongoDB has no PostgreSQL row-level security, so protected reads and writes must enforce the single-community boundary, verified email, role, and ownership in server code. Private file access must apply the same restrictions when storage is implemented.

### Foundation required before Phase 1

Navigation behavior: the landing page is for signed-out visitors. Default login and visits to `/` route verified administrators to `/admin` and members to `/discover`. Posting links on the landing page go directly to login. After sign-in, post-item login links return to `/discover?compose=1` with the shared posting modal open. The `/post` route is removed. Workspace pages, including `/help`, require a verified session. Successful sign-out returns to login.

The administrator overview is implemented with server-side session, verified-email, and role checks. It shows pending report and claim counts and the latest pending reports, scoped to the single community. A trusted operator assigns or revokes administrator access through the account-role setup command. The remaining administrative workflows are specified below.

- Add authentication, verified email, organization membership, member and administrator roles, and account recovery.
- Create shared navigation, accessible form controls, validation feedback, loading states, empty states, and error handling.
- Establish local environment configuration, database migrations, seed data, and a separate test environment. Production must never fall back to sample data.
- Define the organization, allowed email domains or invitation process, item categories, campus or building locations, and the staff handoff location before launch.

### Phase 1: Best Bets — core release

| ID | Feature | Revised technical tasks | Acceptance criteria |
| --- | --- | --- | --- |
| 2.1 | Report Lost & Found Items | Design report, photo, category, location, and private-detail tables; implement authorized create/read/update/archive actions; build lost/found forms and detail pages; integrate image uploads. | A verified member can submit a lost or found report, upload up to five valid images, edit their active report, and archive it. Other members see only approved public fields. Invalid input and unauthorized edits are rejected on the server. |
| 2.2 | Ownership Verification | Design claims, private verification questions, claimant answers, and evidence records; build the claim workflow; implement private uploads and review states. | A member can claim an active found item belonging to another reporter. Claimants see only their own claims and evidence. Administrators can review answers and evidence. Pending or approved duplicates from the same claimant for the same item are prevented. |
| 2.3 | Admin Dashboard | Enforce role and organization checks; build report moderation and a claim review queue; implement approval/rejection transactions and audit records. | A member cannot call administrative actions directly. A reviewer can approve or reject a pending claim with a recorded reason and actor. Concurrent approvals cannot reserve the same item for two people. |
| Core goal | Possible Match System | Compare active lost/found reports using public descriptions, category, approximate location, and compatible dates. Return ranked candidates with understandable match reasons. | Matching suggests candidates and never approves ownership. Evaluate top-five recall on a labeled dataset: at least 80% of eligible lost reports with a known matching found report must include that match in their first five results. Record dataset size and excluded cases. |
| Core goal | Return Tracking | Add an approved-claim handoff workflow and a return event with staff identity, timestamp, and notes. | Approval reserves the found item; only a recorded physical handoff marks it returned. A return can be recorded once. Linked lost reports close only when the relationship is confirmed. |

Public reports must not expose serial numbers, ownership answers, proof documents, phone numbers, email addresses, or details intended to distinguish the true owner. Store private verification details separately from public report content. Administrators review evidence; the app must not automatically approve a claim based on a text match.

#### Admin MVP specification

**Release goal.** A verified administrator can take a real found-item report from submission through publication, ownership review, and physical return. The existing dashboard provides counts and a recent-report list. The workflows below are required for release.

| Delivery order | Staff workflow | Acceptance criteria |
| --- | --- | --- |
| 1. Report moderation | From the dashboard, open the full pending-report queue, page through it, and inspect a report with its attachments. Preview the fields and media members would see. Publish a suitable report or hide it with a reason. | Publishing makes the real report visible in the signed-in Discover board. Hiding removes it from listings and blocks new claims, including through a direct link. The reporter sees the review status in My Posts. Private identifiers and contact details stay out of the published view. |
| 2. Claim review | Open a pending claim, inspect the found report, the claimant’s answers and private evidence, and any competing claims on the same item. Record a decision and reason. | Approval requires a pending claim on a published, open item and reserves it for that claimant. Rejection leaves the item’s lifecycle unchanged. The claimant sees the outcome in My Claims. Other claimants and the finder cannot read the proof. |
| 3. Pickup and cancellation | Open the reserved-item queue and identify the approved claimant. After staff confirm the physical handoff, record it. If pickup falls through before handoff, cancel the reservation with a reason. | Handoff creates one return record with the staff actor, claimant reference, and time, fulfills the claim, and marks the item returned in one transaction. Cancellation changes the approved claim to cancelled and reopens the item. At confirmed handoff, a finder response automatically closes its original open lost post when the claimant owns it. Other lost posts require explicit staff confirmation and the same ownership check. |
| 4. Case history | From each report or claim, inspect a chronological history of moderation, decisions, cancellations, and returns. | Each successful change appends an event in the same transaction. Events identify the actor, time, affected records, and transition. Store decision reasons on restricted records. Keep proof, contact details, and signed links out of audit payloads. |

**Requirements across all four workflows**

- Recheck the verified session, current admin role, and community on every protected read and write, including requests for short-lived evidence links. Members can read their own outcomes through the existing member pages.
- Recheck the current record state when staff confirm a decision. If another reviewer acted first, show the latest status and explain why the action is unavailable. Concurrent approvals must produce at most one reservation. A repeated confirmation must produce one decision, return record, and corresponding audit event per action.
- Give queues stable pagination, loading and empty states, and a retry action after a recoverable error. Make decisions keyboard-accessible, identify the item and claimant at confirmation, and preserve entered reasons after a failed save.

**Release test.** Using isolated accounts, have one member submit a found report, an admin publish it, and a second member find it in Discover and submit private proof. Have staff approve the claim, confirm the item stays reserved until pickup, then record the handoff. Verify the claimant’s status and the case history after each step. Repeat with rejection, cancellation, two reviewers approving competing claims, a duplicate handoff, and unauthorized or cross-community access to a case and its evidence.

**MVP boundary.** Build audit recording alongside each mutation. Use My Posts and My Claims for member status updates in this release. Proactive notifications, analytics, and a role-management UI can follow. Before launch, the organization must name the handoff location and set the retention period for private evidence.

Upload rules: allow JPEG, PNG, and WebP images up to 5 MB each; validate actual file content as well as declared type; reject SVG and executable content; generate randomized object names; strip metadata before distributing report photos; and clean up abandoned uploads. Evidence access is limited to the claimant and authorized reviewers. Reporter access to an item does not grant access to a claimant's proof documents.

User-requested scope addition: Cloudinary also supports MP4 and WebM videos up to 20 MB each. The implemented temporary attachment panel accepts at most five combined images/videos per verified member, checks actual file signatures and provider decoding, and keeps them private to their owner. Still images are re-encoded without metadata; animated images and audio-only media are rejected. Temporary attachments expire after 24 hours; an operator must schedule the idempotent cleanup command to delete expired provider assets. Report attachment limits and evidence-review permissions must be enforced when the corresponding workflows are implemented. Adding video does not implement claims or report submission.

### Phase 2: Low-Hanging Fruits

Verified members browse published community reports on Discover and can claim an eligible found item. The landing page uses illustrative examples. Members submit reports with up to five attachments and see the moderation result in My Posts. Publication and hiding are staff actions.

Discover's **My matches** tab ranks other members' published, open found reports for each of the signed-in member's open lost reports under review or published. The on-demand baseline considers the 250 closest compatible found dates per lost report, from the loss date through 30 days later, and ranks up to five suggestions by title, description, location, category, and date proximity. Explanations use generic labels. Claims follow the existing staff review process. The labeled top-five recall evaluation remains pending.

| ID | Feature | Revised technical tasks | Acceptance criteria |
| --- | --- | --- | --- |
| 3.1 | Notification Alerts & Email Updates | Add persisted read/unread notifications for claim decisions, handoff events, and match suggestions. Add transactional email through an outbox with deduplication, retries, and delivery logging. | A committed status change creates one logical notification per recipient. Email failure does not roll back a claim decision. Retried delivery does not create duplicate in-app notifications. Email contains a secure link rather than private evidence or answers. |
| 3.2 | Search Filters | Add URL-based keyword, category, location, date-range, lost/found, and status filters; use database indexes, stable sorting, and server pagination. | Filters survive refresh and shared links. Reset clears all filters. Search covers public fields only and returns only authorized reports. Basic browsing and category filters are available in Phase 1. |
| 3.3 | FAQ / Help Section | Write organization-specific guidance for reporting, claiming, verification, and collection; implement searchable help content and accessible disclosure controls. | Help is usable by keyboard and on mobile. Do not invent collection locations, office hours, or support contacts; obtain these from the organization. |
| 3.4 | Report History | Build the member profile activity log from report events, claim events, and return records. | A member can review their own submissions, claim outcomes, and return history with timestamps. History does not expose other users' private claims or administrative notes. |

The final report-history task is partially cut off in the screenshot; its scope here follows the visible "User profile activity log" text.

### Phase 3: Scope not supplied

No Phase 3 screenshot was provided. Keep this phase unassigned until additional requirements are supplied. Matching and return tracking remain core requirements because they already appear in the original PRD.

### Phase 4: Low Priority

| ID | Feature | Revised technical tasks | Acceptance criteria |
| --- | --- | --- | --- |
| 5.1 | User Profile Customization | Add display name, avatar upload, and plain-text biography with length limits. Reuse validated image upload handling. | A member can edit only their own profile. Changes cannot alter roles or verified account identity. Profile biographies cannot inject HTML. |
| 5.2 | Language Translation | Extract interface strings into locale dictionaries; add locale routing and a language selector when target languages are confirmed. | Selected language persists, unsupported locales fall back predictably, and dates use locale formatting. User-authored report text is not automatically translated in this scope. |

### Data model and lifecycle

| Entity | Purpose and important constraints |
| --- | --- |
| organizations / memberships | Organization identity, user membership, and member/admin role. Privilege changes are restricted to trusted administrators. |
| profiles | Auth user reference, display name, optional avatar path and biography. |
| categories / locations | Organization-managed values used by reports and search filters. |
| reports | Organization, reporter, lost/found type, public title and description, category, location, occurrence date, moderation state, lifecycle state, and timestamps. |
| report_private_details | Hidden identifiers and verification prompts, readable by the reporter and authorized reviewers only. |
| report_photos | Report reference, private storage path, display order, and upload metadata. |
| claims / claim_evidence | Claimant, found report, private answers, evidence paths, decision, reviewer, decision reason, and timestamps. |
| report_matches | Optional stored candidate pair, score, score version, and dismissed/confirmed state. Matching can initially be computed on demand. |
| return_events | Unique approved claim reference, staff actor, handoff timestamp, and notes. |
| notifications / email_outbox | Recipient, event key, read state, delivery attempts, and delivery status. Enforce unique deduplication keys. |
| audit_events | Append-only actor, organization, action, entity, and timestamp. Do not duplicate proof documents or private answers into logs. |

- Report lifecycle: `open → reserved → returned`; `open → archived` for withdrawn reports. Releasing a reservation requires an audited administrator action.
- Keep report moderation separate: `pending`, `published`, or `hidden`. Members browse published reports; reporters can see their own pending submissions.
- Claim lifecycle: `pending → approved / rejected / withdrawn`; `approved → fulfilled / cancelled`. Cancelling a reservation requires an authorized action. Fulfillment and the return record commit together.
- Use a database transaction and an enforced uniqueness constraint to allow at most one active approved or fulfilled claim per found report. Keep returned items closed to new claims.
- Use UTC timestamps and explicit display time zones. Validate future occurrence dates and invalid date ranges.
- Prefer archive/withdraw operations over destructive deletion of records referenced by claims or returns. Decide evidence retention duration with the organization before launch and automate cleanup accordingly.

### Release validation and schedule

The original "complete test accuracy" wording is interpreted as passing all agreed release acceptance tests. It does not imply that tests prove the absence of defects. The matching metric is the defined top-five recall target above, rather than an undefined general accuracy percentage.

| Target | Deliverable |
| --- | --- |
| Weeks 1–2 | Confirm organization policy and acceptance tests; complete authentication, database schema, authorization policies, and application foundation. |
| Weeks 3–4 | Deliver reports, uploads, browsing, and private claim submission. |
| Weeks 5–6 | Complete administration, ownership review, matching baseline, and return tracking. This targets core completion approximately one month before deployment. |
| Weeks 7–8 | Add Phase 2 improvements, evaluate matching, and conduct user acceptance testing. Defer optional features if core acceptance tests are not passing. |
| Weeks 9–10 | Resolve defects, verify access controls and deployment configuration, rehearse data recovery, and deploy the accepted core release. |
| After core acceptance | Schedule Phase 4 according to remaining time and confirmed language requirements. |

Required release checks include a complete report-to-claim-to-handoff journey; rejected, withdrawn, and cancelled claims; cross-account and cross-organization access denial; forbidden role changes; concurrent approvals; invalid uploads; private evidence URL authorization; notification retry behavior when email is enabled; keyboard navigation; and mobile forms. All agreed core acceptance tests must pass before release.

### Decisions still needed from the organization

Confirm the organization name, administrator accounts, collection process and location, proof-document retention duration, supported languages, email sender domain, hosting ownership, and the labeled matching evaluation dataset. These do not prevent local UI development, but production integrations and organization-specific content depend on them.

Implemented report submission: the server derives member identity and the single community boundary, validates fields, rejects future dates in Singapore time, and rate limits to five reports per member per hour. A MongoDB transaction stores a pending/open report, moves ready/unexpired owner-only uploads into private report media without temporary expiry, and writes an audit event. Form idempotency keys prevent duplicate reports. Discover displays a report after staff publish it.

Implemented ownership verification entry: found-item dialogs link to `/claims/[reportId]`; `/claims` lists the verified member?s latest 50 requests. Example items use a local-only preview and cannot create real claims or collect proof uploads. Real claims require a verified session, published/open found report in the community, and a different reporter. The form collects a unique identifying detail and last-possession circumstances, optional context, up to five owner-only proof images/videos, and an ownership confirmation. A transaction records pending status, moves evidence into private claim storage, and writes a proof-free audit event. Database uniqueness and request IDs prevent duplicate active claims; rate limiting allows five successful claims per hour. Submission never reserves the item. Only claimant-specific status projections are exposed; finders receive no answers or evidence. Staff review, decision, and pickup workflows are specified above. Claim withdrawal, notifications, and automated evidence retention remain pending.

Implemented member report list: `/my-posts` requires a verified session and shows the actor?s reports in the single community, including pending/hidden states. Lost/found URL filters and stable timestamp/ID pagination return up to 20 reports per page. Ownership and community filters apply server-side; returned fields exclude storage locations and claims/evidence. Members can expand their report descriptions and see moderation, lifecycle, occurrence/submission dates, and attachment counts. My Posts cards show the first available report photo to the verified owner, including while the report awaits review. Report editing and withdrawal remain pending.

Staff publication makes the report and all of its submitted attachments visible to verified community members in one decision. Staff review the text and attachments before confirming publication.

Verified members can respond to any published, open lost post with a linked found report, including a description, location, date, and optional media. Staff review the found report before it appears in Discover and in finder responses linked from the owner's lost post in My Posts. Owners can claim an eligible response through the ownership verification workflow.

Staff can follow a finder response back to its original lost post during review. Publishing the response creates a dismissible workspace notice for the original poster when another member submitted it. The responses page displays the lifecycle of both posts.
