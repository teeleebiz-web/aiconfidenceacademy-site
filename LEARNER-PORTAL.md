# AI Confidence Academy learner portal

This repository is the single source of truth for both the public ACA website and
the secure learner portal.

## Production architecture

The official learner entry is https://aiconfidenceacademy.org/learn/.
It is part of this website, not a separate preview project. Introduction records
are loaded from Supabase when the signed-in portal loads. Opening an introduction
requests temporary media and caption URLs from the private `aca-learning-media`
bucket. Updating those database paths does not require rebuilding the portal;
an already-open portal must reload to receive the updated records. Changes to
the player or other presentation code require a tested production build.

Do not infer successful authenticated playback from a saved database row or a
successful website build. Verify the owner experience and learner permissions
before reporting the integration complete.

- Public website: static pages published by GitHub Pages at the repository root.
- Learner portal source: `portal/`.
- Learner portal production build: `learn/`, served at `/learn/`.
- Authentication, enrollment, curriculum, progress, and learner artifacts: the
  existing AI Confidence Academy Supabase project.
- Authoritative curriculum packages: ACA's protected curriculum source and the
  private database. Curriculum text and answer keys are never committed here.
- Confirmation and operational email: Resend through server-side ACA functions.
- Digital books and protected downloads: private Supabase Storage buckets; never
  committed to this public repository.

The browser receives only the Supabase publishable key. Service-role and Resend
credentials remain server-side.

## ACA visual identity

Portal and curriculum surfaces must extend the established ACA website palette:

- Navy: `#102D4F`
- Soft navy: `#1C4267`
- Ink blue: `#18324A`
- Cream/tan: `#F8F3E9`
- Ivory/white: `#FFFDF9`
- Gold: `#B48632`
- Light gold: `#D4B36B`
- Mist blue-gray: `#EEF2F4`

Dark green and rust are not ACA brand colors and must not be introduced into
learner-facing or curriculum production work. Red is reserved only for genuine
error messaging.

## Local validation

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

The development preview opens the learner portal. The production build writes the
same tested source to `learn/` for GitHub Pages.

## Release boundary

Do not merge the learner portal into `main` until:

1. the branch checks pass;
2. the sign-in redirect URL is approved in Supabase Auth;
3. a controlled ACA learner account and enrollment are provisioned;
4. Lesson 1.1 is exercised in the browser and its progress is verified in the
   database;
5. Terrence approves the learner-facing preview.

The Phase One database now contains all six journeys and all 36 lessons. Only
approved rows are visible to ordinary learners. A server-controlled reviewer
allowlist in the private database grants the ACA owner access to the complete
working build under additional read-only RLS policies; this review mode does not
save lesson progress or learner artifacts.

## Integrated Phase One owner review

The protected owner-review experience is assembled as one connected course:

- 6 journeys and 36 guided sessions;
- 45–60 minutes of core learning per session, with optional continuation kept
  outside the core estimate;
- teaching, guided practice, reflection, verification, and a completion gate in
  every session;
- previous/next navigation across lesson and journey boundaries;
- a visible session map and consistent transition into the next lesson; and
- read-only owner review with no progress or artifact writes.

Each Journey welcome has two independent protected media positions:

1. a short founder or avatar video featuring Terrence; and
2. a companion audio overview voiced by Knowledge.

Until final recordings are attached, branded production placeholders remain in
those positions. Founder and companion transcripts are stored with the protected
curriculum records, displayed independently, and ready to support captions. The
public repository contains the presentation code and schema history, but not the
protected curriculum scripts or media.

Before enabling owner review in production:

1. apply the owner-review RLS migration;
2. add the owner to the private reviewer allowlist through trusted administration;
3. verify the portal recognizes that server-controlled authorization;
4. verify that an ordinary authenticated learner still sees published material
   only; and
5. verify the complete owner view on desktop and mobile before any curriculum
   status changes.
