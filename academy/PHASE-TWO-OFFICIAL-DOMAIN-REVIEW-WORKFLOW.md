# Phase Two — Official-domain review delivery (controlling workflow)

**Founder direction:** Use the Academy's proven official-site workflow for all instructional review. Do not give the founder an unverified `*.vercel.app` branch preview URL.

## Verified current hosting and access evidence — October 9, 2026

- The repository `teeleebiz-web/aiconfidenceacademy-site` is configured for **GitHub Pages** (`has_pages=true`); the root `CNAME` file reads `aiconfidenceacademy.org`.
- `LEARNER-PORTAL.md` explicitly specifies the official learner entry as **https://aiconfidenceacademy.org/learn/** and production compiled learner assets as `learn/`.
- `portal/vite.config.ts` builds to `../learn`, with base `/learn/`; `learn/index.html` references versioned assets in `/learn/assets/`.
- Independently retrieved **https://aiconfidenceacademy.org/enroll/?interest=updates#interest-list** successfully, and its rendered page contains the published ACA enrollment content and interest-list section. Its host is the official domain, not an arbitrary deployment subdomain.
- The actual official site's `enroll/index.html` includes `id="interest-list"`, and `site.js` reads `URLSearchParams(window.location.search).get('interest')` while scrolling to the `#interest-list` anchor. Thus the user-supplied link is a **same-site deep link into a real published static page**, not a Vercel build-preview link or a separate hosted review service.
- Independently retrieved **https://aiconfidenceacademy.org/learn/** successfully. It renders the established ACA learner sign-in.
- Independently retrieved **https://aiconfidenceacademy.org/learn/?review=phase-two**. **As of this check, it still renders the ordinary ACA learner sign-in; this is NOT evidence the Phase Two founder review UI has been deployed to the official site.**
- The separate Vercel project `aiconfidenceacademy-site` has `ssoProtection.enabled=true` for `all_except_custom_domains`. A branch deployment can be `READY` and still be inaccessible to the founder. Stop treating Vercel `READY` as a usable review link.
- The Supabase private ACA curriculum reviewer allowlist contains **one** authorized reviewer, but credentials and the authenticated owner session have not been tested by the assistant.
- The Phase Two course, journeys, and all 36 lessons are still draft; two currently have additive founder-review expanded instructional content. No publication or status change is part of this delivery investigation.

## Correct Phase Two review workflow — repeat the established Academy process

1. **Source and quality:** Develop instructional drafts using Curriculum Master Version 2.0 and its controlling audit. Keep private curriculum text in Supabase. Verify all lesson content, media designations, access restrictions and navigation without inventing lesson completion.
2. **Isolated code changes:** Prepare only the necessary owner-review presentation code in a protected GitHub review branch. Keep the learning access gates and Supabase owner-only authorization. Do not copy private scripts or credential secrets into public GitHub assets.
3. **Exact code review:** Run type-check, automated tests and site build. Validate the scope and diff. Do not ship unrelated features or make enrollment active.
4. **Founder approval before affecting official Pages:** Explicitly confirm publishing *only the protected review presentation* through the official-domain GitHub Pages workflow. Never silently merge the whole Phase Two working PR.
5. **GitHub Pages artifact:** After approval, produce, verify and publish the built `learn/` files that the official custom-domain site actually serves. Committing only source changes under `portal/` is **not enough** when `learn/` is tracked as static output. Preserve the root `CNAME` and all other pages. No new hosting service, unrelated site path, or separate Vercel URL.
6. **Founder sign-in:** Use **https://aiconfidenceacademy.org/learn/** with the founder's existing authorized Academy login. For owner-only Phase Two review, the review mode can be addressed under this **same official-origin learner route**, e.g. `/learn/?review=phase-two`, *only after the corresponding verified code and static assets are installed and reviewed*. A query parameter is not itself access control; RLS, authentication and the owner allowlist enforce access.
7. **Live browser acceptance:** Independently load the exact official-domain URL in a real browser, check HTTP/site load, no platform SSO or redirect to a third-party provider, usable sign-in, mobile/desktop rendering and source access. Then test authorized-owner and unauthorized-learner behavior. If a reviewer login cannot be exercised without the founder, report that honestly and request the founder's confirmation, rather than claiming end-to-end success.
8. **Review outcome:** Report the exact official link, validated build hash, visual and authorization test results, and remaining user-side steps. Do not say a lesson is 'viewable' based only on a successful build, a Supabase row, or Vercel deployment status.

**No official-site publication, course activation, deletion, or curriculum change is authorized solely by this runbook.**

## Two crucial distinctions

- The supplied `/enroll/?interest=updates#interest-list` link proves the **official domain and GitHub Pages file-delivery pattern**, not authenticated Phase Two lesson access. Its query string and hash select the interest section; it is not a private curriculum preview.
- The GitHub branch review currently serves a protected Phase Two interface on Vercel deployments with platform SSO. To make it accessible using the proven route, it must be released through the official website's existing compiled Pages assets after founder authorization, then verified in-browser. Do not solve the problem by supplying another branch deployment host.

**Founder acceptance gate:** obtain permission before publishing a protected review UI to the official Academy domain. Approval of a draft's instructional text does not equal approval to enroll learners or publish lessons.
