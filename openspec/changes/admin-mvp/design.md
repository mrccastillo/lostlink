## Context

The existing admin overview checks the current session and community. Members already submit reports and ownership claims. Discover currently displays illustrative listings. Report moderation, item availability, and claim status are independent fields.

## Goals / Non-Goals

Deliver staff decisions that members can follow in My Posts and My Claims. Keep role assignment in the existing operator command. Notifications and analytics belong to later work.

## Decisions

- Use server-rendered staff queues with bounded cursor pagination, a timestamp and ID tie-breaker, and indexes matching community, status, and sort order.
- Load case details through explicit projections. Generate a short-lived evidence URL only after checking the current reviewer and the evidence-to-claim relationship. Publish only reviewed, member-visible fields and media.
- Perform decisions through first-party Server Actions. Derive staff identity and community on the server. Include expected prior state and community in every conditional write.
- Commit the report or claim transition, any associated reservation or return, and the append-only audit event in one MongoDB transaction. Use a unique active reservation per item, a unique handoff per approved claim, and an operation identifier to recognize retries.
- Keep decision reasons in restricted case records. Show claimants their own outcome. Expose a chronological, evidence-free history to staff.
- After commit, refresh the affected queues, member status pages, and listing. Recheck visibility and eligibility when loading a case or submitting a claim from an existing link.

## Risks / Trade-offs

Two staff members may decide the same case concurrently. Return the committed outcome for a retry and show the latest case state for a conflicting decision. A hidden report can already have a reservation, so hiding changes visibility independently of cancellation.

## Migration Plan

Apply idempotent index setup before enabling staff writes. Check existing data for conflicting reservations or duplicate handoffs before creating unique constraints. Read existing cases without requiring historical audit entries. Enable moderation and live listings first, then claim decisions and handoffs. If writes must be suspended, preserve committed case records and history.

## Open Questions

Before release, the organization must confirm its pickup location and evidence-retention period.
