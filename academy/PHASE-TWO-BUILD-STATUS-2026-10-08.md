# AI Confidence Academy — Phase Two build record
**Working branch:** `phase-two-six-journey-owner-review`  
**Pull request:** #36, draft and not authorized for merge  
**Curriculum authority:** Phase Two Six Week Curriculum Master v2.0, October 4, 2026  
**Recorded:** October 8, 2026, founder-review implementation pass

## Controlling structure
The current course is the six-journey, 36-lesson AI Professional and Builder Pathway. Each journey has six guided lessons, Monday–Saturday, with one continuing applied project across the course. A learner may pursue Path A (improve an existing professional process) or Path B (create an offer, product, or service). The retired ten-journey structure is historical only.

## Source-verified database inventory
- One separate Phase Two course, status **draft**.
- Six draft journeys, six lesson drafts per journey, all 36 unpublished.
- All 36 lesson records have teaching, worked case, application, AI request, verification, and applied completion check.
- Each journey carries exactly three provisional video-led and three provisional audio-led lesson designations; 18 of each across the full course.
- Journey overview material is attached to the first lesson of each journey in the protected source.
- No recordings or media paths were installed as part of the curriculum staging.
- Protected learner content is stored in Supabase. Do not commit this teaching content into the public source tree.

## Implemented course infrastructure
1. **Six-week schedule model:** Local Monday–Saturday releases, fixed first-open two-hour weekday windows, Saturday through Sunday 11:59 p.m. cohort-local access, late starts, no invented Sunday lesson, DST ambiguity detection and authorized extensions. No timezone, release hour or cohort start date is selected for real learners.
2. **Database access layer:** Separate Phase Two cohort and membership records, first-open windows, controlled extension records, protected learner outline and lesson-opening RPCs. These are installed as additive schema and are not activated.
3. **Continuing project:** A single Path A/Path B learner project, 11 evidence categories, secure saves, meaningful revision notes, immutable version snapshots and read access limited by enrollment. Draft saves do not award course completion.
4. **Owner review:** Protected sign-in and course-source review alongside a new learner-facing walkthrough of the same authorized draft source. The walkthrough supports journey and lesson navigation, provisional media slots, session pacing, the 11 evidence categories, and a read-only orientation. It creates no enrollment, progress or project records.
5. **Staged learner interface:** Six-journey schedule, timed lesson reader, project workspace, sign-in using existing authentication, and a separate Phase Two-only route. Entry requires a published course and an active matching enrollment, followed by server-side lesson and membership checks. This is implemented on the draft review branch, not activated.
6. **Draft-integrity validator:** Prevents the owner review from claiming curriculum completeness if any journey, lesson, source teaching section, course position, or 3-video/3-audio allocation is missing or inconsistent.

## Required independent verification
- Confirm the full six-journey source coverage and practical teaching impact against the coverage audit and all 175 mapped learner objectives.
- Pilot a cohort timezone and release clock only after founder decision.
- Test authenticated learner permissions, opening and closing at exact deadlines, weekend and extension behavior, saved project revision history, and resumption on multiple devices.
- Connect approved media, captions and transcripts through secure time-limited delivery; validate actual playback and readability.
- Finish teaching production beyond approved brief-level content, conduct representative timed learner tests, and verify the final professional portfolio/credential review.
- Approve the administrative rules for extensions, accommodations, final credential rubric and weights, and post-course availability.
- Obtain explicit founder sign-off before merge, enrollment activation, public routing, or publication.

## Non-negotiable production control
**No deletion, curriculum substitution, merge, deployment to the public course, automatic learner entitlement, enrollment activation, or credential issuance is authorized by this draft.**

## Instructional production checkpoint — October 9, 2026

### Journey 1 · Lesson 1.1: Professional AI judgment and direction
**Status: expanded instructional draft, founder review pending — not published.**

- Reviewed controlling lesson 1.1 brief in Curriculum Master v2.0 and its stated learning outcomes in the Coverage and Consolidation Audit, including demonstrable professional confidence, the human responsibilities of purpose/context/judgment/accountability, five capabilities and two gaps, and the required applied evidence.
- Created an **additive** `phase_two_production` object only in the protected Lesson 1.1 draft record. The original `phase_two` teaching brief and its approved AI request remain intact.
- The production layer supplies four expanded teaching sequences, four worked-case claim/evidence decisions using explicitly fictional report data, five timed project application steps, a six-field human/AI responsibility map, four verification activities and six applied completion criteria.
- Scheduled lesson rhythm: 15 minutes teaching, 10 worked case, 25 application, and 10 evidence review. These are **design estimates**, not validated seat time.
- Media is an **unrecorded provisional audio-led placeholder**. No video, voice, transcript, captions, graded completion, or enrollment activation has been represented as done.
- The founder-only learner walkthrough can show the expanded instructional package when its required fields and status validate; a malformed package is flagged and the source brief remains available. All other lessons continue to render their source briefs until independently developed.
- An independent rendering test covers content hierarchy, evidence table, expanding/collapsing review, absence of submission controls, and fail-closed draft validation. A separate navigation regression test confirms that the next unexpanded lesson remains unchanged.
- **Review gate:** verify actual rendered mobile/desktop reading, learnability and timing with the founder before accepting production or recording audio.

### Next production task
Proceed through **Lesson 1.2 — Find the need and establish the evidence** using the verified October 4 master and the coverage map. Do not invent media or introduce a second project record.

### Journey 1 · Lesson 1.2: Find the need and establish the evidence
**Status: expanded instructional draft, founder review pending — not published.**

- Verified the current Curriculum Master v2.0 teaching brief and source-to-destination objectives for need-first thinking and person-centered audience discovery.
- Created an additive `phase_two_production` layer for only Lesson 1.2: four teaching sequences, a fictional customer-service need investigation, four evidence-versus-assumption comparisons, five timed continuing-project tasks, a six-field Audience-Need evidence reference, four verification activities, and six applied completion requirements.
- Learner work stays in the same continuing opportunity brief: compare three candidate needs, make one provisional choice, prepare five neutral questions, and record evidence that could change the decision.
- The exact approved master AI request is preserved; the original source brief is unchanged.
- The provisional media slot is **video-led**, with the later visual demonstration reserved for an Audience-Need View and side-by-side problem/evidence comparison. No recording or caption asset has been produced.
- The existing expansion renderer supports Lesson 1.2 without a new lesson template, additional workbook, new tab, or extra learning system.
- Draft lesson completion and timing remain subject to owner review and a timed learner pilot.

**Next approved lesson in sequence:** Lesson 1.3 — Select AI roles and define business value.
