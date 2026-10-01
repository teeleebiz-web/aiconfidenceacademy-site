# ACA public content and audiobook build

## What this branch delivers

The public site gains `/explore/`, five readable articles, one sourced field note, three topic paths, and a dedicated page for each of the three catalog books. A short answer can lead to a deeper thought, a relevant book, or the guided program. All book formats remain clearly labeled as previews or planned. This branch does not create a purchase or download link.

`content/public-hub.json` is the current editorial source. `content/build-public-hub.mjs` validates links and creates stable HTML pages during `npm run build:site`. Changes can be released in editions while earlier addresses remain intact. The page displays its reviewed date, not an automatic claim that an old article is current. The protected course content stays in the private curriculum system.

## Editorial backend to build next

The first edition is file based so the experience can be reviewed without database credentials or Stripe. The production content service can later replace the JSON source without changing public URLs. Proposed records:

| Record | Required information | Publication rule |
| --- | --- | --- |
| `public_entries` | Stable slug, type, title, summary, topic, body, reading time, editor, status, published and reviewed times | Only approved, published revisions appear publicly. Drafts stay private. |
| `entry_revisions` | Entry ID, revision number, changed fields, change reason, editor, verified at | Preserve a visible correction trail for time-sensitive reporting. |
| `entry_sources` | Entry ID, source title, URL, publisher, access date, supported claim | Required for external or changing factual claims. |
| `topics` and `entry_links` | Topic label, description, ordered article and book relationships | A single content relationship drives related links and topic pages. |
| `book_editions` | Book ID, format, release status, approved description, availability URL, publication date | Preview, available, retired, and unavailable states are explicit. |
| `audio_assets` | Edition ID, private object key, duration, chapters, transcript key, accessibility status | Store audio files and transcripts outside the public repository. |
| `purchase_entitlements` | Buyer identity, edition ID, order or grant ID, access state, granted and revoked times | A successful payment or approved grant controls private access. |
| `fulfillment_events` | Unique external event ID, edition ID, buyer, outcome, processed time | Makes webhook processing repeatable without duplicate grants. |

The public reading service should cache published entries, expose publication and review dates, and render corrections as additions to the revision history. Draft editing remains authenticated and separate from public reading. A recurring report is published only after its facts and sources are reviewed; scheduling alone must never turn an unverified draft into a public update.

## Audiobook release path

1. Prepare an approved book edition, finished audio files, chapters, cover, and transcript. Record format, duration, rights, and release state.
2. Store master and delivery audio in a private bucket. Public pages show approved covers, excerpts only if authorized, format information, and a clear availability state.
3. Attach a Stripe price or approved free grant to the exact edition when payment setup is available. The backend verifies the webhook and records the external event ID once before granting an entitlement. A redirect to a success page does not grant access by itself.
4. A signed-in buyer opens the book in a private library. The server checks the buyer's entitlement for that edition, then provides a short-lived signed URL or authenticated stream for the appropriate file. The service role key never reaches the browser. Access, refund, and support events should be auditable.
5. Check a real test purchase, repeated webhook delivery, another user's denied access, expired links, refunds, mobile playback, download behavior, and transcript access before calling an edition ready for sale.

The existing Academy already uses Supabase for learner identity and protected media. Keep book/audio purchases as a separate entitlement from course enrollment, even when the same account owns both. This allows a free release, a digital book, an audiobook, or a bundle to be represented without implying that a course purchase includes every title.

## Next build order

1. Review the new public pathways, titles, and wording on desktop and mobile. Add real cover art and approved book descriptions when available.
2. Create the editorial tables, owner publishing controls, and revision log with row-level security. Migrate the first edition from the JSON file after comparing rendered pages.
3. Prepare one audiobook edition and a private test asset. Implement entitlement checks and delivery using an approved free test grant first.
4. Add Stripe checkout only after the account review and the required keys are available. Test the full purchase and refund path before enabling a sale.

The site can grow in small, reviewed installments throughout these steps. The domain and existing site can stay in place.
