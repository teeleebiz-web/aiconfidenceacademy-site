# ACA storage and configuration recovery

Continue from the existing Enrollment and Backend Continuity Mandate. Database
restoration was proved separately on October 18. The temporary recovery project
has been removed. Do not recreate that billed project for these local checks.

## Current boundary

Supabase database backups preserve storage metadata, not file bytes. The October
18 read-only inventory found 68 private objects, 1,650,971,985 bytes, plus one
empty private bucket. This utility has not yet copied those live objects. Its
automated tests use independent binary fixtures and do not open approved media.
There is no scheduled off-site backup or demonstrated live-file recovery yet.

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
