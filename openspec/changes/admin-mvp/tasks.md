## 1. Authorization and persistence

- [x] 1.1 Reuse the verified-admin policy on every staff read, mutation, and evidence download. Test direct requests from guests, members, and admins outside the case community.
- [x] 1.2 Add versioned indexes and constraints for queues, exclusive reservations, unique returns, and retry handling. Introduce transactional audit recording with the first mutation.

## 2. Moderation and publication

- [x] 2.0 Add each shipped queue to the role-gated Administration sidebar and connect dashboard cards to their queues. Verify active states and desktop and mobile navigation with admin and member sessions.

- [x] 2.1 Link the dashboard to paginated queues and case details. Add loading, empty, conflict, and recoverable error states.
- [x] 2.2 Implement report preview, publish, and hide with a reason. Connect Discover to published records and My Posts to moderation outcomes.
- [x] 2.3 Test private-field exclusion and direct-link claim denial after hiding.

## 3. Ownership review

- [x] 3.1 Show claim answers, authorized evidence, and competing claims for the item.
- [x] 3.2 Implement approve and reject with a reason, exclusive reservation, and claimant status updates. Test competing approvals and repeated submissions.

## 4. Pickup and case history

- [x] 4.1 Build the reserved-item queue, handoff confirmation, and audited cancellation. Test duplicate handoff, cancellation versus handoff, and confirmed lost-report linkage.
- [x] 4.2 Show chronological case history. Check events for private data and verify that failed transactions leave no partial changes.

## 5. Release verification

- [x] 5.1 Exercise report submission, publication, live discovery, private claim, approval, pickup, and member-visible completion with isolated accounts.
- [x] 5.2 Verify denial and retry paths, keyboard and mobile operation, and preservation of reasons after failed saves. Run lint, type checking, build, and relevant integration and browser tests.
- [ ] 5.3 Confirm pickup location and evidence-retention policy with the organization.
