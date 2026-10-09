# AI Confidence Academy — Phase Two implementation controls

**Status:** founder review only. Do not publish, merge, unlock, or enroll learners without Terrence Lee's explicit approval.

## Curriculum authority

The only current Phase Two curriculum is **ACA_Phase_Two_Six_Week_Curriculum_Master**, Curriculum Version **2.0**, October 4, 2026.

- Six journeys and six lessons per journey (36 lessons), in this order:
  1. AI Strategy and Business Opportunity
  2. Build AI into Business Workflows
  3. Lead People Through AI Adoption
  4. Create and Deliver Business Value
  5. Operate, Measure and Improve
  6. Demonstrate and Execute
- Supporting controls in descending authority: Coverage and Consolidation Audit; Source-to-Lesson Map; ACA Institutional Constitution and founder-approved addenda.
- **The former ten-journey Phase Two curriculum is retired.** It may be consulted only for source provenance or objective coverage, not as an alternative structure. Never resume historical Journey 7 or mix its release rules or workbook format into Phase Two.
- No source material may be silently omitted, combined beyond the current master, or replaced. Raise genuine conflicts for the founder.

## Current draft architecture

- Supabase holds a separate `phase-two-ai-professional-builder` course in **draft** status. Do not repurpose Phase One's published course.
- Six draft journeys and 36 draft lessons carry their source teaching briefs in `lessons.content.phase_two`. The public GitHub repository must **not** contain protected lesson teaching text.
- Each draft currently has one **provisional** media designation: 3 video-led and 3 audio-led lessons per journey (18 of each total). All media paths remain empty until recorded, captioned, verified, and approved.
- The review UI is isolated at `/learn/?review=phase-two` on the **review branch only**; it requires Supabase authentication and the `is_aca_curriculum_owner` check. Data protection depends on the existing Supabase row-level policies, not on query parameters.
- Phase One remains the default learner portal. Do not modify its course, media, sign-in, workbook, enrollment, schedule, or production website just to complete Phase Two preview work.

## Required Phase Two learner behavior — not yet implemented

The curriculum master requires one lesson released **Monday through Saturday** in the selected cohort timezone; approximately 60 minutes core lesson work; an additional two independent hours weekly; a two-hour elapsed **weekday** lesson window beginning on first opening; and **Saturday** access through **Sunday 11:59 pm** in that timezone. New releases continue even when earlier evidence requires correction. Finished work and project evidence must persist outside the lesson player during enrollment. Approved extensions and accessibility accommodations require explicit policies.

**Do not reuse Phase One's sequential-gating SQL as a Phase Two enrollment policy.** Build and test Phase Two-specific release and persistence rules before enrolling anyone. Confirm the cohort timezone, credential rubric/weights, extension administration, and post-course access with the founder before activating them.

## Teaching and quality gates

- This is an **advanced continuation**, not six weeks of Phase One remediated.
- Maintain one continuing bounded business project, with Path A (business/process improvement) and Path B (new product/service) as applications of the same lessons.
- Each lesson has teaching, a worked case, application, an AI request, verification, and an applied completion check. These are **approved source teaching briefs**, not yet recorded 60-minute productions.
- Produce and review screen-based demonstrations where seeing the work matters; audio-led lessons require substantive instruction and accessible written equivalents. Three-and-three is a production allocation for review, not authorization to auto-generate media.
- Preserve ACA navy/blue, cream/ivory, and restrained gold; readable text, transcripts, keyboard and mobile behavior, actual playback tests, and the Academy's human-first review standard.
- Verify six journeys, 36 draft lessons, all six required source sections for every lesson, provisional media positions, absent recorded-media paths, and correct owner-only authorization.
- Publication needs founder acceptance of the learner experience and actual playback, coverage verification against all 175 mapped objectives, release/access tests including Saturday and catch-up, and final human credential review.

**No deletion without explicit confirmation. No publication or merge without founder approval.**

## Implementation record — 2026-10-08

These are completed **draft infrastructure and code** milestones, not activation or publication:

- Six journey/36 lesson drafts remain unpublished in the separately identified Phase Two course.
- A pure Phase Two six-week schedule engine and automated tests cover weekday first-open two-hour windows, late starts, Monday–Saturday release, Saturday-through-Sunday access, DST transitions, and authorized extensions. No release clock or cohort timezone has been selected.
- Supabase additive migrations created six Phase Two-only tables, guarded saving for a single continuing project, immutable saved revisions, weekday session windows, authorized extension records, and course-scoped protected lesson RPCs. These migrations ran successfully; no cohorts, memberships, sessions, extensions or project records were created.
- A metadata-only learner outline RPC and an authenticated lesson-opening RPC are available for later integration. Protected teaching must be delivered through the opening gate, never fetched based on date alone.
- Staged learner UI components render the six journeys, release status, opened teaching, and the continuing project editor. Autosave and version history are backed by the isolated database functions. The learner UI is **not connected to any published route or enrollment yet**.
- The founder review uses approved source teaching briefs, not finished 60-minute recordings. It now displays the separately approved weekday and Saturday teaching rhythms. Media assignments remain provisional.
- Require browser/device, permission, timing, RLS, media-expiry, weekend/catch-up, project-persistence, and human assessment tests before activating the learner course.
- Outstanding explicit policy gates: cohort timezone, release clock, accommodations, extension administration, post-course access, final rubric/weights, review turnaround, and founder sign-off.

Do not report deployed draft database functions or preview components as evidence that the live learner experience has been accepted.
