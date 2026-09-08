# Player replacement candidate

Terrence explicitly authorized trying a different player after the unresolved
playback failure. This branch is a review candidate, not a verified restoration.

## Changes

- Uses the official Plyr 3.8.4 player for lesson video/audio and journey welcome
  media. The player, CSS, and icons are bundled locally, with the upstream license.
- Keeps the existing media URLs and approved recordings. There are no database,
  server, access-control, curriculum, route, or navigation changes.
- Preserves the 640 px maximum video stage and uses the Academy colors.
- Provides the play control immediately without another open/watch gate.
- Starts unmuted with autoplay off; does not inherit Plyr settings from browser
  local storage. Learners can adjust volume and mute after playback begins.
- Disposes the old instance when its source changes. Handles media errors with
  a plain message and an explicit retry; no automatic retry loop.
- Requests anonymous CORS for captioned media so existing text tracks can load.
  Uncaptioned recordings do not add a crossorigin attribute.

## Verification

- Production build passed with `npm run build:academy`.
- Ten focused tests passed across AcademyMedia, LessonView, and
  JourneyIntroductionView. These cover immediate source availability, no duplicate
  audio/video, source replacement, disposal, captions, and explicit error retry.
- jsdom reports its unimplemented media load method. These tests do not decode
  recordings or establish audible playback.
- Type checking reports the pre-existing `GettingStarted.test.tsx` line 9
  `ByRoleOptions.exact` error. The replacement introduced no remaining type errors.
- Authenticated website playback and rendered appearance remain unverified because
  this environment cannot open the protected Academy URL. Do not claim otherwise.

## What this can and cannot establish

Plyr is an alternative control implementation that still uses browser HTML media
decoding. It does not independently fix unavailable storage responses or damaged
recordings. Therefore a successful build is not evidence that the reported failure
is repaired. Keep production unchanged until the candidate plays actual approved
recordings successfully, including sound, time progression, seek, and lesson changes.

The fixed Getting Started walkthrough is outside this replacement's scope. It
retains its existing component and recording.

Reference: https://github.com/sampotts/plyr/blob/master/README.md
