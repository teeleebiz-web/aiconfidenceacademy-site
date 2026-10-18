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
storage. This command does not set up automatic transfers or retention. No new
paid storage provider or service has been selected by this change.

Run `node operations/recovery.mjs verify /private/snapshot-directory` to decrypt
and hash-check every file without saving plaintext. Run
`node operations/recovery.mjs restore-local /private/snapshot-directory /private/new-restore-directory`
to recover into a new private local directory, including original bucket/path
mapping and private bucket settings. Existing directories are rejected. There is
deliberately no cloud upload, production restore, deletion, or public-serving
command. A local binary recovery check does not prove a recovered cloud service,
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
