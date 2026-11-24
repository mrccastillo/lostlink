## ADDED Requirements

### Requirement: Admin workspace navigation and dashboard cards

The shared workspace sidebar SHALL show verified administrators an Administration section on desktop and in mobile navigation. It SHALL link to the dashboard and, as each workflow ships, report moderation, claim review, and reserved-item pickup. Case history SHALL be accessible from the relevant case. The current destination SHALL be identified visually and programmatically.

#### Scenario: Administrator moves between workspaces

- **WHEN** an administrator opens Discover or an admin queue
- **THEN** both member workspace links and implemented admin destinations are available through the same navigation.

#### Scenario: Member opens the workspace

- **WHEN** a member views desktop or mobile navigation
- **THEN** only member destinations appear and direct requests to staff pages still require administrator access.

#### Scenario: Administrator checks pending work

- **WHEN** the dashboard loads
- **THEN** separate responsive cards show live pending report and claim counts, including zero. Recent pending reports show only title, type, and submission date when rows exist. Queue cards open the corresponding report, claim, or pickup queue. The dashboard also shows the number of completed returns and links recent staff decisions to their cases. Activity summaries exclude decision reasons, claimant details, and private proof.

### Requirement: Staff access and private evidence

The system SHALL require a verified administrator in the case community for every staff read, decision, and evidence download.

#### Scenario: Reviewer opens evidence

- **WHEN** an authorized reviewer requests an attachment belonging to the selected claim
- **THEN** the system issues a short-lived private download URL.

#### Scenario: Unauthorized direct request

- **WHEN** a guest, member, or administrator outside the case community requests a staff action or evidence URL
- **THEN** the system denies access without disclosing case data, issuing a URL, or changing the case.

### Requirement: Report moderation and publication

Staff SHALL be able to open a pending report, inspect attachments, preview member-visible content, and publish or hide it. Hiding SHALL require a reason.

#### Scenario: Staff publishes a report

- **WHEN** staff publish a pending report
- **THEN** verified members can find its approved fields and media in Discover, the reporter sees its published status in My Posts, and private identifiers, contact details, and ownership answers are excluded.

#### Scenario: Staff hides a listing

- **WHEN** staff hide a published report with a reason
- **THEN** it disappears from Discover, new claims are refused even through saved links, and the reporter can see the hidden status.

### Requirement: Ownership decisions and reservations

Staff SHALL be able to inspect competing claims, review private proof, and approve or reject a pending claim with a reason. Approval SHALL require a published, open found item.

#### Scenario: Competing approvals

- **WHEN** two reviewers concurrently approve different pending claims on the same item
- **THEN** exactly one claim is approved, the item is reserved for that claimant, and the other reviewer sees the current state. The item remains awaiting handoff.

#### Scenario: Rejected claim

- **WHEN** staff reject a pending claim with a reason
- **THEN** My Claims shows the claimant the rejected outcome and the item retains its previous lifecycle state.

### Requirement: Physical return and cancellation

The system SHALL allow staff to fulfill an approved claim only after confirming physical handoff to the reserved claimant, or cancel its reservation with a reason before handoff.

#### Scenario: Pickup confirmed

- **WHEN** staff confirm physical handoff for the approved claim
- **THEN** one transaction records the staff actor, claimant reference, and pickup time, fulfills the claim, and marks the item returned. A linked lost report closes only when staff confirm the relationship.

#### Scenario: Pickup cancelled

- **WHEN** staff cancel an active reservation before handoff
- **THEN** the claim becomes cancelled, the item reopens, and the claimant sees the updated status.

### Requirement: Accountable and repeatable decisions

Each successful transition SHALL append a restricted audit event in the same transaction. Staff SHALL be able to view case history chronologically.

#### Scenario: Review case history

- **WHEN** staff inspect the history of a returned item
- **THEN** events show actor, time, affected records, and transitions from publication through handoff. Proof files, answers, contact details, and signed links are excluded.

#### Scenario: Retried or conflicting handoff

- **WHEN** a handoff request is repeated or races with cancellation
- **THEN** only one transition commits from the reserved state. A retry produces no duplicate return or audit entry, and a conflicting action reports the latest state.

### Requirement: Work queues and recovery

The dashboard SHALL provide bounded, stably paginated report, claim, and pickup queues with keyboard-accessible actions, loading indicators, empty states, and recoverable error feedback.

#### Scenario: Staff work beyond the overview

- **WHEN** pending cases exceed the dashboard preview
- **THEN** staff can reach every pending case through its queue, including cases with identical submission timestamps.

#### Scenario: Decision fails before commit

- **WHEN** a save fails while a reviewer confirms a decision
- **THEN** the case and audit history retain their prior state, the entered reason is preserved, and the reviewer can retry. Claim and pickup confirmations identify the item and claimant.
