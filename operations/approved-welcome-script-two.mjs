import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

export const approvedWelcome = Object.freeze({
  key: 'academy-welcome-script-two-20261122',
  target: 'academy-welcome/ACA_Welcome_to_the_Academy_Film_Web_v01.mp4',
  staging: 'academy-welcome/ACA_Welcome_Script_Two_Approved_20261122.mp4',
  rollback: 'academy-welcome/ACA_Welcome_before_script_two_20261122.mp4',
  previous: 'e484c51eeee4523d3f325bee5115f06bd63d6d2a53ee7934538b1978ac6a2122',
  approved: '350e6cb65f13cdd5c6c1938a6d96af063a74c0c9726b9fe86dceff7d50fafff6',
  bytes: 81887736,
})
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const checked = result => {
  if (result.error) throw new Error('Approved welcome storage operation failed')
  return result.data
}
export function validateApprovedWelcome(task, liveHash) {
  if (task.publication_key !== approvedWelcome.key || task.source_sha256 !== approvedWelcome.approved || task.original_sha256 !== approvedWelcome.previous) throw new Error('Approval fingerprint mismatch')
  if (!['approved', 'publishing', 'failed', 'verified'].includes(task.status)) throw new Error('Publication not approved')
  if (liveHash === approvedWelcome.approved) return 'complete'
  if (task.status === 'verified' || liveHash !== approvedWelcome.previous) throw new Error('Live welcome changed; publication stopped')
  return 'replace'
}
export function verifyApprovedBytes(bytes) {
  if (bytes.length !== approvedWelcome.bytes || hash(bytes) !== approvedWelcome.approved) throw new Error('Reviewed file does not match')
}
export async function publishApprovedScriptTwo(db) {
  const task = checked(await db.from('aca_media_publications').select('*').eq('publication_key', approvedWelcome.key).maybeSingle())
  if (!task) return false
  const bucket = db.storage.from('aca-learning-media')
  const download = async path => Buffer.from(await checked(await bucket.download(path, { cacheNonce: `${Date.now()}-${process.hrtime.bigint()}` }, { cache: 'no-store' })).arrayBuffer())
  const record = async values => checked(await db.from('aca_media_publications').update({ ...values, updated_at: new Date().toISOString() }).eq('publication_key', approvedWelcome.key))
  let live = await download(approvedWelcome.target)
  if (validateApprovedWelcome(task, hash(live)) === 'complete') {
    await record({ status: 'verified', source_url: 'approved-review-upload-complete', output_sha256: approvedWelcome.approved, verified_at: new Date().toISOString() })
    console.log('Exact approved Script Two welcome already installed and verified.')
    return true
  }
  try {
    const files = checked(await bucket.list('academy-welcome', { limit: 100 }))
    if (!files.some(file => file.name === approvedWelcome.rollback.split('/').pop())) checked(await bucket.copy(approvedWelcome.target, approvedWelcome.rollback))
    if (hash(await download(approvedWelcome.rollback)) !== approvedWelcome.previous) throw new Error('Rollback verification failed')
    const stageName = approvedWelcome.staging.split('/').pop()
    let present = files.some(file => file.name === stageName)
    if (!present) {
      const signed = checked(await bucket.createSignedUploadUrl(approvedWelcome.staging, { upsert: false }))
      await record({ status: 'publishing', source_url: signed.signedUrl })
      console.log('Private rollback verified; exact staging upload is ready.')
      for (let attempt = 0; attempt < 60; attempt++) {
        await delay(10000)
        const listing = checked(await bucket.list('academy-welcome', { limit: 100, search: stageName }))
        if (listing.some(file => file.name === stageName)) { present = true; break }
      }
    }
    if (!present) throw new Error('Approved upload has not arrived')
    const bytes = await download(approvedWelcome.staging)
    verifyApprovedBytes(bytes)
    live = await download(approvedWelcome.target)
    if (validateApprovedWelcome(task, hash(live)) === 'replace') {
      const endpoint = 'https://ymmkodlifpxutynpjnxm.storage.supabase.co/storage/v1/upload/resumable'
      const headers = { Authorization: `Bearer ${process.env.ACA_BACKUP_SOURCE_SERVICE_ROLE_KEY}`, 'Tus-Resumable': '1.0.0', 'x-upsert': 'true' }
      const metadata = Object.entries({ bucketName: 'aca-learning-media', objectName: approvedWelcome.target, contentType: 'video/mp4', cacheControl: '0' }).map(([key,value]) => `${key} ${Buffer.from(value).toString('base64')}`).join(',')
      const creation = await fetch(endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000), headers: { ...headers, 'Upload-Length': String(bytes.length), 'Upload-Metadata': metadata } })
      if (creation.status !== 201) throw new Error('Approved upload could not start')
      const upload = new URL(creation.headers.get('location'), endpoint)
      if (upload.origin !== new URL(endpoint).origin || !upload.pathname.startsWith('/storage/v1/upload/resumable/')) throw new Error('Invalid upload destination')
      for (let offset = 0; offset < bytes.length;) {
        const end = Math.min(offset + 6 * 1024 * 1024, bytes.length)
        const response = await fetch(upload, { method: 'PATCH', redirect: 'error', signal: AbortSignal.timeout(60000), headers: { ...headers, 'Content-Type': 'application/offset+octet-stream', 'Upload-Offset': String(offset) }, body: bytes.subarray(offset,end) })
        if (response.status !== 204 || Number(response.headers.get('upload-offset')) !== end) throw new Error('Approved upload interrupted')
        offset = end
      }
    }
    verifyApprovedBytes(await download(approvedWelcome.target))
    await record({ status: 'verified', source_url: 'approved-review-upload-complete', output_sha256: approvedWelcome.approved, verified_at: new Date().toISOString() })
    const cleanup = await bucket.remove([approvedWelcome.staging])
    if (cleanup.error) console.warn('Verified welcome installed; temporary staging cleanup remains pending.')
    console.log(`Approved Script Two welcome installed: ${approvedWelcome.bytes} bytes; SHA-256 ${approvedWelcome.approved}. Previous live film preserved privately.`)
    return true
  } catch (error) {
    await record({ status: 'failed', source_url: 'approved-review-upload-incomplete' })
    throw new Error('Script Two publication stopped; retained rollback remains available.', { cause: error })
  }
}
