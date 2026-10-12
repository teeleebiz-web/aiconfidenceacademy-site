# ACA Phase Two | Journey 1 · Lesson 1.1 — Avatar Preview Production

**Status:** HeyGen video submitted and processing — **not published to Academy website**.
**Preview video ID:** `c5a5d6044d124a41e79608af6a545e99`
**Title:** ACA Phase Two — J1 Lesson 1.1 — Professional AI Judgment and Direction — Instructor Preview
**Script source:** `academy/phase-two-production/J1-L1-1-japanese-instructor-introduction-draft.md` (exact 398-word approved-by-delegation text; unchanged)

## Verified instructor reference

- User-selected instructor is the saved HeyGen look **ACA Japanese Instructor - Seated Landscape**: `eb90c2b7050142ea461979fa0215e161`, group `bcb5ba7369694961b15fd717642a04c3`.
- Approved appearance reference from user's screenshot: Japanese woman seated in a cream suit, library office backdrop; do **not** swap to another presenter.
- Corrected reference production, **Why Learn the Basics of AI? - Seated Landscape Correction**, HeyGen video ID `93be0797afb35b30468a79205012054d`. Its saved scene specifies this exact look and voice **`ac277b338cf64d8b9686784c43c563da`** at pitch 0, speed 1 and volume 1. Do not replace with the avatar's different default voice.
- Public ACA Video Learning Center references `/assets/videos/why-learn-ai-seated/film.m3u8`, duration ~188.68 seconds. It was installed with approved seated landscape presentation October 8, 2026. Its compressed length differs slightly from the HeyGen source, so voice identity is grounded in the corrected HeyGen production's actual scene configuration.
- Reference animation: Avatar IV, medium expressiveness, 16:9 landscape, 1080p; fixed medium-wide shot showing seated upper body, arms/hands, lap and library backdrop, subtle hand gestures, no zoom.

## Submitted settings

- Exact Japanese instructor look `eb90c2b7050142ea461979fa0215e161`
- Voice `ac277b338cf64d8b9686784c43c563da` explicitly selected; never rely on default.
- Avatar IV, expressiveness medium, 16:9, 1080p MP4, color background `#f6f6fc`, fit contain, captions provided as sidecar SRT rather than burned into video.
- Exact script from approved draft, no rewrite or omitted paragraphs.
- Existing accepted motion prompt copied from the reference corrected production.

## Delivery/acceptance

1. HeyGen returned video status **waiting** and video ID as above; inline preview opened with status **processing**.
2. The inline player tracks completion automatically. **No claim of finished, reviewed, playable, caption-verified video yet.**
3. The user will view/listen and may request corrections **before** any website or learner media attachment.
4. After founder acceptance, verify output dimensions/duration/full narration/frame composition/voice/lip sync and file size. Connect through the established ACA media path, preserving the original master curriculum and other lessons unchanged.
5. Keep Lesson 1.1 primary instructional audio and hands-on demonstrations conceptually separate; both should match the accepted instructor voice and complement rather than repeat the avatar orientation.

**No website, database, learner or enrollment changes were made by submitting this render.**

## Staged integration and verification — continuation

- Added an optional instructor-video slot to `PhaseTwoLessonExperience` on the review branch. It is **not connected to any returned video or remote media path yet**.
- The slot is 16:9, 1080p compatible and has an explicit 640px maximum CSS display width, preserving the existing ACA lesson-video scale, with full width responsiveness and automatic height on mobile.
- Video rendering requires all of: `introVideo` supplied, `approvalStatus === 'founder_approved'`, a real HTTPS media URL, and a non-empty reviewed transcript. The current generated preview does not meet the explicit approval gate.
- The separate lesson-audio position changes its caption to “Listen to guided instruction” when an approved avatar orientation is present. Do not reuse the avatar narration as the substantive lesson audio.
- The previously created narrator sample from an unrelated voice is rejected by the owner-review presentation unless it has the exact instructor voice ID and explicit approval status. The files have **not** been deleted.
- Wrote the detailed companion spoken lesson script in `academy/phase-two-production/J1-L1-1-full-guided-audio-script.md` (approximately 1,748 words, source-aligned, with brief pauses and visual cues). No companion narration generated yet.
- Automated tests cover an explicitly approved video, a pending/unapproved video refusing to render, the absence of a video by default, the nonduplicated audio segment, and the exact 640px/16:9 CSS constraints. No Academy-site deployment was triggered by this work.
- Next acceptance gate is **founder viewing and listening to the finished HeyGen preview**. Rendering status was initially “processing”; HeyGen's inline player tracks completion. Do not assume completion, or attach it to a website, without an accepted render.

## Verified checkpoint — October 9, 2026

- Type-check, Vitest, Academy regression tests, and Vite build all passed in GitHub Actions run `38000699050` for commit `6ccc366aaaf892ee3a2c18eee4849ba9184b7bc2`; the final successful GitHub Actions run is `38000699050`.
- **164 tests across 35 files passed**, including stage layout, learner narration separation, strict founder approval gating, absent-video fallback and direct inspection of the production stylesheet.
- The accepted display contract remains a 640px maximum, 16:9 ratio, height auto and responsive 100% width on smaller displays.
- The video playback slot is **staged on the review branch only** and requires a `founder_approved` flag, HTTPS video URL, and reviewed nonempty transcript to render. No URL has been connected yet.
- Separate, full guided narration is written in `J1-L1-1-full-guided-audio-script.md`. This is intended for the same accepted instructor voice and is distinct from the short avatar introduction. Do not generate or publish it without the verified voice and founder review.
- The HeyGen generation widget tracks the preview independently. Successful software tests do not establish that the generated avatar video has completed or passed audiovisual review.
