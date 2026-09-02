# AI Confidence Academy learner portal

This repository is the single source of truth for both the public ACA website and
the secure learner portal.

## Production architecture

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
approved rows are visible to ordinary learners. An owner account with
`app_metadata.academy_role = owner` may review the complete working build under
additional read-only RLS policies; this review mode does not save lesson progress
or learner artifacts.

Before enabling owner review in production:

1. apply the owner-review RLS migration;
2. assign the owner role through trusted administration, never user metadata;
3. require the owner to sign out and sign back in so the refreshed JWT contains
   the authorization claim;
4. verify that an ordinary authenticated learner still sees published material
   only; and
5. verify the complete owner view on desktop and mobile before any curriculum
   status changes.
