import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const publicationKey = 'academy-welcome-november-avatar-20261117'
const target = 'academy-welcome/ACA_Welcome_to_the_Academy_Film_Web_v01.mp4'
const backup = 'academy-welcome/ACA_Welcome_to_the_Academy_Film_Web_v01_before_november_avatar.mp4'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
function checked(result) {
  if (result.error) throw new Error(`Private media operation failed (${Number(result.error.statusCode) || 0})`)
  return result.data
}
export function liveWelcomeState(liveHash, originalHash, renderedHash) {
  if (![liveHash, originalHash, renderedHash].every(value => /^[a-f0-9]{64}$/.test(value))) throw new Error('Invalid welcome fingerprint')
  if (liveHash === renderedHash) return 'rendered'
  if (liveHash === originalHash) return 'original'
  throw new Error('Live welcome differs from both approved fingerprints')
}

export async function main() {
const db = createClient('https://ymmkodlifpxutynpjnxm.supabase.co', process.env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const task = checked(await db.from('aca_media_publications').select('*').eq('publication_key', publicationKey).single())
const bucket = db.storage.from('aca-learning-media')
const download = async path => Buffer.from(await checked(await bucket.download(path, { cacheNonce: `${Date.now()}-${process.hrtime.bigint()}` }, { cache: 'no-store' })).arrayBuffer())
const live = await download(target)
if (task.status === 'verified') {
  if (hash(live) !== task.output_sha256) throw new Error('Published welcome changed after verification')
  console.log('Approved welcome already published and verified.')
  return
}
if (!['approved', 'failed', 'publishing'].includes(task.status)) throw new Error('Welcome publication is not authorized')
// A completed upload can precede a failed readback. Rebuild only from the
// fingerprinted original, then accept recovery only for the exact rendered bytes.
const original = hash(live) === task.original_sha256 ? live : await download(backup)
if (hash(original) !== task.original_sha256) throw new Error('Welcome source differs from the approved original')
const url = new URL(task.source_url)
if (url.protocol !== 'https:' || url.hostname !== 'files2.heygen.ai' || url.username || url.password) {
  throw new Error('Unexpected approved media source')
}
const directory = await mkdtemp(join(tmpdir(), 'aca-welcome-'))
let stage = 'prepare'
try {
  checked(await db.from('aca_media_publications').update({ status: 'publishing', updated_at: new Date().toISOString() }).eq('publication_key', publicationKey))
  const oldFile = join(directory, 'original.mp4')
  const segmentFile = join(directory, 'approved-segment.mp4')
  const outputFile = join(directory, 'welcome.mp4')
  await writeFile(oldFile, original)
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(180000) })
  if (!response.ok || Number(response.headers.get('content-length')) > 400 * 1024 * 1024) throw new Error('Approved segment unavailable')
  await pipeline(Readable.fromWeb(response.body), createWriteStream(segmentFile))
  if (hash(await readFile(segmentFile)) !== task.source_sha256) throw new Error('Approved segment fingerprint mismatch')
  const metadata = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_format', '-of', 'json', segmentFile], { encoding: 'utf8' }))
  if (Math.abs(Number(metadata.format.duration) - 283.8) > 0.04) throw new Error('Approved segment timing mismatch')
  const graph = '[0:v]trim=end_frame=88,setsar=1280/1281,settb=1/25,setpts=N[card];' +
    '[1:v]scale=854:480:flags=lanczos,setsar=1280/1281,settb=1/25,setpts=N[founder];' +
    '[0:v]trim=start_frame=7183,setsar=1280/1281,settb=1/25,setpts=N[rest];' +
    '[card][founder][rest]concat=n=3:v=1:a=0[v]'
  execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-xerror', '-i', oldFile, '-i', segmentFile,
    '-filter_complex_threads', '2', '-filter_complex', graph, '-map', '[v]', '-map', '0:a:0',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-threads', '4', '-pix_fmt', 'yuv420p',
    '-c:a', 'copy', '-movflags', '+faststart', outputFile], { timeout: 600000 })
  const audioHash = file => execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a', '-c:a', 'copy', '-f', 'hash', '-hash', 'sha256', '-'], { encoding: 'utf8' }).trim()
  if (audioHash(oldFile) !== audioHash(outputFile)) throw new Error('Original narration was not preserved')
  execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-xerror', '-i', outputFile, '-f', 'null', '-'], { timeout: 180000 })
  const bytes = await readFile(outputFile)
  if (bytes.length > 200 * 1024 * 1024) throw new Error('Rendered welcome exceeds the existing storage limit')
  console.log(`Rendered welcome verified: ${bytes.length} bytes.`)
  stage = 'rollback-copy'
  const previousBackup = await bucket.download(backup, { cacheNonce: String(Date.now()) }, { cache: 'no-store' })
  if (previousBackup.error) checked(await bucket.upload(backup, original, { contentType: 'video/mp4', upsert: false }))
  else if (hash(Buffer.from(await previousBackup.data.arrayBuffer())) !== task.original_sha256) throw new Error('Existing rollback copy does not match')
  // Unknown live content is never overwritten. A prior completed upload can be
  // verified without uploading again, even when its first readback was stale.
  const state = liveWelcomeState(hash(await download(target)), task.original_sha256, hash(bytes))
  checked(await db.from('aca_media_publications').update({ output_sha256: hash(bytes), updated_at: new Date().toISOString() }).eq('publication_key', publicationKey))
  if (state === 'original') {
  stage = 'replace-approved-target'
  // The existing standard endpoint rejects bodies above its request limit.
  // TUS transfers the same verified file in fixed 6 MiB chunks; no re-encoding.
  const endpoint = 'https://ymmkodlifpxutynpjnxm.storage.supabase.co/storage/v1/upload/resumable'
  const headers = { Authorization: `Bearer ${process.env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY}`, 'Tus-Resumable': '1.0.0', 'x-upsert': 'true' }
  const uploadMetadata = Object.entries({ bucketName: 'aca-learning-media', objectName: target, contentType: 'video/mp4', cacheControl: '0' })
    .map(([key,value]) => `${key} ${Buffer.from(value).toString('base64')}`).join(',')
  const creation = await fetch(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
    headers: { ...headers, 'Upload-Length': String(bytes.length), 'Upload-Metadata': uploadMetadata } })
  if (creation.status !== 201) throw new Error(`Private media operation failed (${creation.status})`)
  const upload = new URL(creation.headers.get('location'), endpoint)
  if (upload.origin !== new URL(endpoint).origin || !upload.pathname.startsWith('/storage/v1/upload/resumable/')) throw new Error('Invalid resumable upload destination')
  for (let offset = 0; offset < bytes.length;) {
    const end = Math.min(offset + 6 * 1024 * 1024, bytes.length)
    const chunk = await fetch(upload, { method: 'PATCH', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { ...headers, 'Content-Type': 'application/offset+octet-stream', 'Upload-Offset': String(offset) }, body: bytes.subarray(offset,end) })
    if (chunk.status !== 204 || Number(chunk.headers.get('upload-offset')) !== end) throw new Error(`Private media operation failed (${chunk.status})`)
    offset = end
  }
  }
  stage = 'readback'
  const downloaded = await download(target)
  if (hash(downloaded) !== hash(bytes)) throw new Error('Welcome upload readback mismatch')
  checked(await db.from('aca_media_publications').update({ status: 'verified', output_sha256: hash(bytes), verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('publication_key', publicationKey))
  console.log('Founder-approved welcome replacement uploaded and hash-verified. Original narration and rollback copy preserved.')
} catch (error) {
  await db.from('aca_media_publications').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('publication_key', publicationKey)
  console.error(`Publication stage: ${stage}; ${/^Private media operation failed \(\d+\)$/.test(error.message) ? error.message : 'render or verification failed'}`)
  throw new Error('Approved welcome verification stopped; original rollback copy remains protected.')
} finally {
  await rm(directory, { recursive: true, force: true })
}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
