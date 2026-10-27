# ACA storage and configuration recovery

Continue from the existing Enrollment and Backend Continuity Mandate. Database
restoration was proved separately on October 18. The temporary recovery project
has been removed. Do not recreate that billed project for these local checks.

## Current boundary

Supabase database backups preserve storage metadata, not file bytes. The October
18 read-only inventory found 68 private objects, 1,650,971,985 bytes, plus one
empty private bucket. The October 26 live manual run copied and recovered all
68 files from R2 with the original hashes verified. Automated software tests use
independent binary fixtures and do not open approved media. See the evidence below.

Vercel lists 16 production configuration entries. Its Secret values are
write-only after saving. Their names and scopes are not recoverable credentials.
Do not weaken their visibility, export them through a website route, rotate them,
or copy production access into a new environment just to complete a backup.

## Encrypted file snapshots

`recovery.mjs` uses the existing Supabase client and Node 22 or later. It lists
private buckets and recursively copies their objects without querying course
tables or writing to Supabase. Each file and the object-name manifest are
encrypted with AES-256-GCM. It checks SHA-256 and byte counts, repeats the source
inventory, and rejects an incomplete or changing snapshot. Output is promoted
only after every encrypted file verifies. A failed operation removes its own
partial directory; it never deletes source objects.

An authorized storage credential must already be available in a private execution
environment as `SUPABASE_SERVICE_ROLE_KEY` with the existing `SUPABASE_URL`.
The project URL is restricted to ACA's existing source project. This does not
grant new access or provision credentials. `ACA_BACKUP_KEY_FILE` must name a
32-byte random encryption key held outside the website repository. Keep that key
in the owner's secure credential recovery location, separately from snapshots.
Losing it makes encrypted snapshots unrecoverable. Do not paste keys in chat.

Run `node operations/recovery.mjs backup aca /private/new-snapshot-directory`.
The destination must not already exist, its parent must exist, and it must be
outside this website repository. Choose an owner-controlled private destination;
the transient build workspace and public GitHub artifacts are not durable backup
storage. This command does not set up automatic transfers or retention.

Run `node operations/recovery.mjs verify /private/snapshot-directory` to decrypt
and hash-check every file without saving plaintext. Run
`node operations/recovery.mjs restore-local /private/snapshot-directory /private/new-restore-directory`
to recover into a new private local directory, including original bucket/path
mapping and private bucket settings. Existing directories are rejected. There is
no production restore, deletion, or public-serving command. The separately invoked
R2 transfer utility below handles the approved off-site destination. A local
binary recovery check does not prove a recovered cloud service,
Storage permissions, or playback on a recipient's device.

Before claiming live file recovery: complete the authorized live snapshot, store
it durably outside production, verify the saved snapshot again, recover into a
new private directory, and check every byte. Then separately approve and verify
any cloud destination, its cost, access restrictions, retention, monitoring, and
credential custody. Never restore over production for a test.

## Service configuration recovery

Use `recovery.env.example` for the entry-point variable names. Keep actual values
out of this repository and out of continuity documents. Restore service
configuration only inside an approved isolated target with outbound email,
payments, and cron schedules disabled. Required dependencies include:

- GitHub: authoritative repository, exact tested revision, locked dependencies,
  existing public Pages deployment, and backend build configuration in
  `vercel.json`. Preserve the test branch independently.
- Vercel: project/team identity, runtime, domains, redirects, production and
  branch-scoped variables. Read-only metadata can verify names and scopes. It
  cannot recover hidden values. Existing deployments are not a secret vault.
- Supabase: separately verified database backup, private file snapshot and bucket
  settings, Auth URL/redirect configuration and mail settings, provider keys,
  permissions, extensions, and any Edge Functions. Recovered database rows do not
  establish that these external settings were recreated.
- Stripe: correct account and live/test distinction, current product and price
  identifiers, signed callback destination and subscribed event types. Preserve
  $129 Founding Student Price and separate $50/$50/$49 installment pricing.
- Resend: verified sender/domain records, restricted send credentials, signed
  delivery callback destination and subscribed event types. A stored callback
  configuration is not proof of delivery.
- DNS: current public and checkout destinations plus verified sender records.
  Do not change production DNS as part of a restoration test.

Re-enter Secrets from the owner's secure records or perform an explicitly
authorized provider rotation. A missing source credential is a recovery gap,
not permission to reset working credentials. Complete a configuration-only
isolation review before enabling any schedule, sending email, charging a payment,
or reconnecting production services.

## Verification

`npm run test:recovery` checks binary round-trip recovery, authenticated
encryption, missing/corrupt files, wrong keys, pagination, changed-source
rejection, partial cleanup, path restrictions, existing-output protection, and
redaction of credentials from metadata inventories. No live service is called.

Official references checked October 18, 2026:

- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/storage/management/download-objects
- https://supabase.com/docs/reference/javascript/storage-from-list
- https://supabase.com/docs/reference/javascript/storage-from-download
- https://vercel.com/docs/environment-variables/sensitive-environment-variables

## Cloudflare R2 approval and transfer

Terrence approved Cloudflare R2 as ACA's separate private backup destination on
October 18, 2026 at 15:47 Manila. Do not request that same provider approval again.
Approval is not proof of account activation, a private bucket, billing settings,
credential custody, an uploaded backup, or scheduled execution. The browser's
Google sign-in returned “Unable to sign in. Try again or use your email and
password.” No R2 bucket, credential, or charge was created through that attempt.
Stop automated retries of that rejected sign-in and use the supported manual
handoff for the account step. Do not reset working credentials to get past it.

`r2-transfer.mjs` uses the pinned AWS S3 SDK with the R2 account endpoint. It sends
only the authenticated snapshot's encrypted files, encrypted path manifest, and
non-secret summary; it never sends the encryption key or unrelated local files.
Each transfer gets a fresh random snapshot prefix. Conditional writes prevent
replacement. Every uploaded object is downloaded and hash-checked before the
completion record is written and checked. A failed or uncertain request does not
become a success. Partial remote objects are retained for owner review, never
automatically deleted. The only error reference is a random snapshot prefix;
provider responses and credentials are not logged.

Download requires the completion record, enforces file/path/size limits, verifies
every encrypted object's SHA-256 and authenticated decryption, and refuses files
outside the authenticated snapshot manifest. Output must be a new private local
directory outside the website repository. Use the base `restore-local` command
after downloading to test recovery of the original file bytes. There is still no
command that overwrites Supabase or serves a backup publicly.

After the owner completes account setup, create a dedicated private bucket such
as `aca-private-backups`. Do not enable an r2.dev address, custom domain, public
access, or browser CORS. Verify those settings in the account before recording
`ACA_R2_PRIVATE_CONFIRMED` as the exact `account-id/bucket`. This explicit operator
confirmation is a prerequisite; it is not an automated check of Cloudflare's
current access settings. Use an Object Read & Write credential scoped only to
that bucket, rather than an account-wide administrator credential. Record the
one-time secret securely and keep the encryption key separately. Follow required
action-time confirmation for creating security-sensitive credentials and any
unapproved billing or terms step; never request secrets in chat.

Private runtime variable names are in `recovery.env.example`. The endpoint is
restricted to Cloudflare's account/jurisdiction R2 hosts. The default maximum
snapshot size is 2 GiB, checked before upload. This per-transfer limit is not a
Cloudflare billing cap or an approval of additional usage. Use Standard storage;
retention, existing account usage, source egress, and execution costs need their
own verification before enabling unattended copies. No schedule, lifecycle
deletion, retention policy, or public endpoint is activated by this code.

Commands in the authorized private environment:

- `node operations/r2-transfer.mjs upload /private/encrypted-snapshot`
- `node operations/r2-transfer.mjs download aca-backups/SNAPSHOT-UUID /private/new-snapshot`
- `node operations/recovery.mjs restore-local /private/new-snapshot /private/new-restore`

The transfer tests use a fake object store with independent binary files. They
prove the transfer protocol's checks, not live R2 authentication or durable file
recovery. Activation still requires a live saved-snapshot download, decryption,
byte comparison, and separate private-setting/credential-custody verification.

R2 references checked October 18, 2026:

- https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
- https://developers.cloudflare.com/r2/api/tokens/
- https://developers.cloudflare.com/r2/api/s3/api/
- https://developers.cloudflare.com/r2/buckets/public-buckets/

## October 25 account setup and manual connection check

Terrence completed Cloudflare sign-in in his own Edge browser and activated R2.
His screenshots confirm the Standard `aca-private-backups` bucket in Western
North America, public access and r2.dev disabled, no custom domain and no CORS
policy. The default seven-day incomplete-multipart abort rule was left unchanged;
it is not a retention rule for completed backups. An initial HeadBucket 500 no
longer occurred when the existing bucket was reopened. No duplicate was created.

The account token is scoped to Object Read & Write for this bucket, active until
November 1, 2026. Terrence reported saving its keys privately. The GitHub settings
screenshot shows `ACA_R2_ACCESS_KEY_ID` and `ACA_R2_SECRET_ACCESS_KEY` as repository
secrets. Their values were not read, printed, or verified by the assistant.
Account activation and secret names do not establish working authentication.

The `ACA private R2 connection check` workflow is manual only, limited to main,
with read-only repository permission and a five-minute timeout. It receives only
those two R2 secrets in its final step, after locked dependency installation and
credential-free tests. Its required `private_destination` input is the exact
verified Cloudflare account ID followed by `/aca-private-backups`; it contains
no access key. Use Actions, select the workflow, choose Run workflow with main,
paste that destination, and select Run workflow. Do not put keys in the input.

`r2-connection-check.mjs` encrypts a new 4 KiB synthetic file, uploads it, checks
readback, downloads into a separate temporary directory, decrypts, restores and
compares every original byte. It calls no Supabase service and receives no live
ACA data or credentials. Its 64 KiB encrypted-snapshot limit is not a billing cap.
The four tiny encrypted test objects remain under `aca-connection-checks/UUID`
for owner review. Its disposable test key is never uploaded or printed and is
not a real backup recovery key. Local temporary files are removed. Nothing
automatically deletes cloud objects, enables public access, or starts a schedule.

Success reports `connectionVerified: true`, `syntheticOnly: true` and
`liveAcaBackup: false`. Failure reports only the stage and safe random reference,
without provider error bodies or credentials. The existing automated recovery
tests and three new connection-check tests pass locally with a fake store. A
live GitHub workflow result is still required before claiming R2 authentication
or the synthetic transfer proved. The actual 68-file ACA snapshot, owner-held
separate encryption key, durable saved-copy recovery, configuration recovery,
retention, scheduling and monitoring remain separate unfinished work.

## October 25 synthetic recovery verified and manual live backup prepared

Owner-triggered run 40190388610 succeeded on main 05541ac at 11:48:51 UTC.
Its final step reports `connectionVerified: true`, `syntheticOnly: true` and
`liveAcaBackup: false`, with 4,096 original and 5,035 encrypted bytes. Encryption,
R2 authentication, upload, readback, saved-copy download, decryption and byte
recovery passed. The retained synthetic reference is
`aca-connection-checks/b2adef81-05a3-4c31-a61a-0529117939f1`. Do not repeat this
completed test as routine continuation. The action-runtime deprecation warning
did not prevent it; working dependencies were preserved.

`manual-backup.mjs` and `ACA manual private Storage backup` prepare the next
manual step. They have not copied a live ACA file. They reuse the existing
encrypted snapshot, transfer and recovery protocol for the fixed ACA project.
Supabase calls only list private buckets, enumerate object metadata and download
bytes; no course table, content inspection, source write, production restore,
payment or email operation is called. Empty sources are rejected. The 2 GiB
source bound is checked before file downloads and again for the encrypted
upload. At least 6.5 GiB temporary private disk is required. Two encrypted copies
and one fresh local restore stay outside the repository. Every original SHA-256
and byte count is verified during recovery; temporary files are then removed.
No snapshot, plaintext or key is saved as a GitHub artifact or cache. Remote
encrypted objects remain, including partial uploads after failure.

The owner must knowingly configure these repository secrets directly in GitHub.
The assistant must not receive or retrieve their values:

- `ACA_BACKUP_KEY_BASE64`: canonical Base64 for 32 cryptographically random bytes.
  Retain this exact value in independent owner recovery records outside R2 and
  GitHub before the first live run. Losing it makes the saved files unrecoverable.
- `ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY`: an authorized existing server credential
  for ACA. A Supabase secret or legacy service-role key gives full server-level
  project access, not a Storage-only restriction. The reviewed job uses it only
  for Storage reads. Authorizing access in this new runtime is a separate owner
  decision. Do not export hidden Vercel values, reset working credentials or
  claim the credential has narrower privileges than it actually does.
- The two R2 bucket-scoped secrets already used by the successful check.

Once source access is authorized and the secrets are saved, open Actions, select
`ACA manual private Storage backup`, choose Run workflow on main, and enter the
verified `account-id/aca-private-backups`. Affirm both explicit inputs: this exact
recovery key is independently retained, and this manual job may read ACA private
Storage and save an encrypted R2 copy. Both default to false. Missing confirmation,
malformed keys, missing credentials, unsafe destination, inadequate disk or an
oversized source stops the run. Only the final step receives secrets, after
locked dependency installation and tests without live credentials.

Run once and inspect the result. Success requires `liveAcaBackup: true`,
`uploadedAndReadbackVerified: true`, `savedCopyDecryptionVerified: true` and
`restoredWithOriginalHashesVerified: true`, nonzero counts and a new
`aca-backups/UUID` reference. Retain the reference with the owner recovery record.
This proves a saved file copy, not a recovered cloud service or device playback.
Failure logs only its stage and safe reference, with no provider body, file path
or secret. The 30-minute workflow is main-only, manually triggered, serialized
and read-only for GitHub. It adds no schedule, cloud deletion, retention policy,
credential rotation or public route. Limits are transfer guards, not billing
caps; source egress and storage/execution usage count against provider allowances.

Official references checked October 25, 2026:

- https://supabase.com/docs/reference/javascript/storage-from-download
- https://supabase.com/docs/guides/getting-started/api-keys
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners

## October 26 configuration failure diagnosis

Run 40258201859 and its second attempt both passed all 36 recovery tests, then
stopped at configuration before source access, with no snapshot reference. All
four secret names are present. The owner confirms using the independently saved
PowerShell recovery key and manually entering it from a screenshot. Do not ask
him to identify the key again or replace it merely because the stage is generic.

The manual runner now emits a finite configuration issue: missing confirmations,
key length, invalid character positions, noncanonical Base64, missing source
credential, invalid private destination, or missing R2 credentials. Diagnostics
contain only a fixed code, numeric lengths, or one-based positions; no key
characters, credential values, file paths or provider bodies. All original key
validation, authorization, transfer and recovery checks remain enforced. The
additional regression checks diagnostic accuracy, redaction and no network
access on rejected configuration. No secret is read back or changed by this fix.

After merging the tested correction, run the existing manual workflow on main
using the same approved destination and retained-key/source-read confirmations.
Inspect the exact configuration issue before requesting a targeted owner action.
A test pass is not a live backup. No source bytes have been protected by either
failed configuration attempt; scheduling and retention remain unchanged.

## October 26 verified manual backup and automatic backup preparation

Main revision `2621b6512f47d32eb5ef0873c164a7819149cacd`, workflow run
`40261532250`, attempt 2, completed at 03:24:14 UTC. It protected 68 files,
1,650,971,985 original bytes and 1,651,002,110 encrypted bytes. Upload readback,
saved-copy decryption and restoration with original hashes all succeeded.
Preserve `aca-backups/71069015-2a6e-4578-bb35-b936ce364e87` independently of
any automatic retention policy. Keep the existing owner-held recovery key.

The new `ACA automatic private Storage backup` workflow proposes daily execution
at 18:17 UTC (01:17 the following day in Bangkok). It shares the manual workflow's
concurrency group and uses the same proven full-copy/recovery path, four existing
GitHub secrets, 2 GiB source/transfer guard and private temporary disk cleanup.
Only main in the authoritative repository can execute it. No snapshot, recovery
key or plaintext is published as a GitHub artifact or cache.

`aca_backup_automation` is service-only and starts **disabled**. Its initial
seven-copy retention policy was approved by Terrence on October 26; deletion starts disabled until release verification.
The workflow exits with `held: not-activated` until the activation setting is
explicitly changed after review. Do not describe a prepared schedule as an
observed scheduled execution. A manual dispatch exercises the runner but does
not prove the scheduler fired. Never enable a preview deployment's cron jobs.

The automatic runner uses the existing source server credential for Storage
reads and backup-only policy/history access. That credential has full project
permissions; the code does not narrow them. It writes safe backup activity to
`aca_automation_runs`, not enrollment, curriculum, payment or learner tables.
A unique index prevents repeating the same GitHub run/attempt. History must
accept the start record before source work and the verified completion record
before any retention. Provider errors and source object paths are never logged.

The existing independent Vercel operations monitor scheduled for 21:00 UTC checks backup
history after the two-hour scheduler allowance, a 45-minute unfinished-run window,
recorded failures/warnings and credential expiration within 72 hours. It uses the
existing trusted-owner lookup and email queue; no mail key is copied to GitHub.
Vercel Hobby may execute within its one-hour scheduling window. This is a daily
monitor, not instant or continuous detection. Email submission
and actual delivery remain distinct evidence. System activity displays backup
run evidence alongside the existing jobs. Disabled policy creates no missing-run
incidents. The existing manual workflow continues to be available separately.

If separately activated, retention keeps the seven most recent verified
**automatic** copies, including the newly recovered replacement. Extra manual
runs of the automatic workflow count as automatic copies. Original manual and
connection-test prefixes are excluded. It removes only encrypted artifacts named
in the old copy's validated completion record, within that copy's exact UUID
prefix. Each completion record remains as a small private tombstone for safe,
idempotent retry after an interrupted deletion or lost database response.
Partial/unverified uploads and unknown prefixes require owner review; retention
does not delete them. The preserved manual baseline is rejected by both the
planner and the object-deletion adapter. A failed backup never prunes; a retention
failure leaves the new verified copy intact and records a warning.

Terrence approved retention of seven verified automatic copies plus the original
manual baseline, and a one-year extension of the existing R2 credential. The saved
token list confirms October 26, 2027, unchanged Object Read & Write permission
and only aca-private-backups. The monitor conservatively uses the start of that
date in Bangkok (2027-10-25T17:00:00Z), since the display omits the exact hour.

Before activation: verify the service-only migration and CI, deploy the reviewed
revision with automation disabled, dispatch the automatic runner under controlled
activation, and verify recovered-copy/history evidence and owner alert delivery.
Then retain activation and observe an actual scheduled execution. Do not reset working credentials or
ask the owner to recreate the recovery key. Current Cloudflare shared-browser
Google sign-in and manual handoff have not established a signed-in dashboard;
the owner's ordinary-browser session is not presently available to the agent.

Usage planning: one current full copy is about 1.65 GB; daily source download is
about 49.5 GB per 30 days, before other source traffic. Seven copies plus the
preserved baseline use about 13.2 GB; temporarily retaining a replacement adds
about 1.65 GB. These are estimates, not billing caps. R2's shared free allowance,
daily-peak storage billing, existing account usage and source egress allowances
must be considered. GitHub may delay/drop a scheduled run or disable a public
repository's schedule after 60 days without activity; the independent monitor
checks for the missing history rather than assuming the timer worked.

Official scheduling and usage references checked October 26, 2026:

- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
- https://developers.cloudflare.com/r2/pricing/
- https://supabase.com/docs/guides/platform/manage-your-usage/egress


## Release and owner-alert verification

The public owner interface is served by GitHub Pages from committed generated
control-center/index.html and learn/assets files. Include the matching production
portal build when publishing a source change to that interface; a Vercel build
does not update GitHub Pages. Retain older hashed assets for existing browser
sessions. The website-only Vercel preview deliberately excludes owner pages,
and backend HTML retains its separate construction-password gate. Do not weaken
either gate to inspect the owner interface. Use the normal public owner sign-in
after the flag-disabled release, then prove the backup before unattended use.

A service-only verification_test operational-alert reason is restricted to
storage-backups. Its subject and body explicitly identify a planned delivery
test and state that no backup failure is reported. Queue one event for the
existing trusted owner, invoke only /api/operations/maintenance through Vercel
Cron Jobs, and verify both the durable email record and provider delivery. Do
not run lesson, newsletter or installment jobs as a backup test. No new mail
credential, public trigger endpoint or learner recipient is added.


## October 27 backup incident recovery

Backup incident state is independent of alert submission/delivery. The service-only
`aca_reconcile_backup_alerts()` RPC resolves missing, stalled, failed, warning and
history-write incidents only after a later completed automatic run proves encrypted
readback, saved-copy decryption, original hashes, nonzero file counts/bytes and a
durable retention outcome. A partial recovery, retention warning, earlier success,
credential-expiry alert or unrelated job cannot close a backup incident. The runner
reconciles after saving final history; the independent owner-alert monitor retries.
A reconciliation failure preserves a verified copy and does not block other owner
alerts; the monitor reports its pending review.

The reconciler keeps the warning and attaches its verified resolution time/run.
One `backup_recovered` message per recovered run and trusted recipient follows
previously submitted warning messages, through the existing daily owner-mail queue.
No new mail key or public trigger is introduced; delivery can occur at the next
monitor invocation. Unattempted, unsent warnings resolved before dispatch are
cancelled. Attempted/uncertain messages keep the existing provider-idempotency and
manual-review safeguards. A new failed backup run has its own alert even on a day
with an earlier recovery; repeated checks for the same run remain deduplicated.

The authenticated Control Center System activity view shows last verified recovery,
actual completion, file count/bytes, open incident count, resolved incident history
and warning/recovery email delivery separately. The daily target remains 01:17
Bangkok (18:17 UTC), with late scheduling disclosed. Existing seven-copy retention
and the protected manual original are unchanged. `aca_backup_status()` is service-only
and returns no recipient addresses. It is read only after existing owner authorization.
The generated portal and owner entry must be committed with the source release.

Run `academy/email/backup-recovery-acceptance.sql` for rollback-only database proof,
then the focused email, runner and owner component tests. Never create a false live
failure or rerun historical recovery merely to test a notification.
