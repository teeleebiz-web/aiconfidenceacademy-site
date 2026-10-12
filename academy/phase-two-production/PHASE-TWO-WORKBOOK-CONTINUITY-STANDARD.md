# ACA Phase Two — Workbook Continuity Standard
**Founder-approved October 9, 2026 · Curriculum Master v2.0**

Phase Two preserves the Phase One workbook benefit while keeping a single continuing professional Project Record. The two resources are complementary, not duplicate assignments.

- One digital study workbook per journey, with six lesson sections. Every finished lesson must include substantive workbook teaching, worked example, copyable AI request, exercises, evidence checks, and personal notes.
- The lesson's **Open Workbook** control and the workbook's **Back to Lesson** control navigate in the same browser tab. Going to the workbook never starts a new lesson window or extends the existing one. Returning to a closed lesson remains blocked.
- **My Workbooks** stays accessible to authorized enrolled learners after the individual lesson window closes. Previously released workbook sections can be reopened, studied, edited and printed.
- A future workbook section is not made available merely because its button is visible. The PostgreSQL security-definer read/save functions release content only after the actual approved cohort-local lesson release time, course and membership authorization, and published journey/lesson checks; no future content is returned in the JSON response.
- The workbook saves answers independently using the tested Phase One WorkbookStore and revision checks; project evidence remains in the separate Phase Two continuing Project Record.
- **Print / Save PDF** includes the entire selected released section with the learner's answers; **Download study copy** exports only previously released sections and notes as an editable offline text document. Never host unreleased paid-study files at public predictable URLs.
- The owner may view produced sections through protected owner review without active Phase Two enrollment; owner preview must not simulate saved learner work.
- The initial Journey One workbook contains completed Lesson 1.1 and 1.2 study sections. Lessons 1.3–1.6 remain unavailable until separately produced, tested, added to the workbook definition, and released by cohort clock. The same applies to later journeys.
- Before accepting each new Phase Two lesson, check: corresponding workbook section exists; lesson ↔ workbook navigation; phone and desktop readability; autosave, revision conflict and restore; print and offline study; prior released material available after teaching window; future section denied by server; normal Phase One access unaffected.

**Implementation:** `portal/src/phaseTwo/PhaseTwoWorkbook.tsx`, `academy/workbook/store.ts`, `supabase/migrations/20261010023000_phase_two_released_workbooks.sql`. This standard is subordinate to the founder-approved six-week curriculum master and later explicit founder decisions.
