import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { servePublicPreview } from './public-preview.mjs'

async function request(root, route, method = 'GET') {
  const result = { status: null, headers: {}, body: null }
  const response = {
    setHeader(name, value) { result.headers[name] = value },
    writeHead(status, headers = {}) { result.status = status; Object.assign(result.headers, headers) },
    end(body) { result.body = body?.toString() ?? null },
  }
  await servePublicPreview({ method }, response, route, root)
  return result
}

test('review preview serves public pages but refuses learner and API paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aca-review-'))
  try {
    await mkdir(join(root, 'explore'), { recursive: true })
    await mkdir(join(root, 'assets'), { recursive: true })
    await mkdir(join(root, 'academy'), { recursive: true })
    await writeFile(join(root, 'explore/index.html'), '<h1>Explore ACA</h1>')
    await writeFile(join(root, 'assets/explore.css'), 'body { color: navy }')
    await writeFile(join(root, 'academy/secret.html'), 'protected')
    assert.match((await request(root, 'explore/')).body, /Explore ACA/)
    assert.equal((await request(root, 'explore')).status, 200)
    assert.equal((await request(root, 'assets/explore.css')).status, 200)
    assert.equal((await request(root, 'explore/', 'HEAD')).body, null)
    for (const path of ['academy/secret.html', 'learn/', 'api/academy/phase-one', 'assets/../academy/secret.html']) {
      assert.equal((await request(root, path)).status, 404, path)
    }
    assert.equal((await request(root, 'explore/', 'POST')).status, 405)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('curriculum cleanup publishes both phases through one current entry and preserves existing media and assets',async()=>{
 const {readFile}=await import('node:fs/promises')
 const {execFile}=await import('node:child_process')
 const {promisify}=await import('node:util')
 const root=await mkdtemp(join(tmpdir(),'aca-publish-cleanup-'))
 try {
  const built=join(root,'built'), official=join(root,'official')
  await mkdir(join(built,'assets'),{recursive:true})
  await mkdir(join(official,'learn/assets'),{recursive:true})
  await mkdir(join(official,'assets/videos'),{recursive:true})
  const oldHtml='<main id="root"></main><script type="module" crossorigin data-aca-phase-two-official-review-bootstrap="true">if (review) { await import("/learn/assets/review-old.js"); } else { await import("/learn/assets/learner-old.js"); }</script><link rel="stylesheet" crossorigin href="/learn/assets/learner-old.css">'
  await writeFile(join(official,'learn/index.html'),oldHtml)
  await writeFile(join(built,'index.html'),'<script type="module" crossorigin src="/learn/assets/current-new.js"></script><link rel="stylesheet" crossorigin href="/learn/assets/current-new.css">')
  for(const name of ['learner-old.js','review-old.js','learner-old.css'])await writeFile(join(official,'learn/assets',name),'established '+name)
  await writeFile(join(official,'assets/videos/existing.mp4'),'unchanged media')
  for(const name of ['current-new.js','current-new.css'])await writeFile(join(built,'assets',name),'built '+name)
  await promisify(execFile)(process.execPath,['academy/publish-phase-two-review.mjs',built,official,'learner-cleanup'])
  const html=await readFile(join(official,'learn/index.html'),'utf8')
  assert.match(html,/<script type="module" crossorigin src="\/learn\/assets\/current-new.js"><\/script>/)
  assert.match(html,/href="\/learn\/assets\/current-new.css"/)
  assert.doesNotMatch(html,/review-bootstrap/)
  for(const name of ['learner-old.js','review-old.js','learner-old.css'])assert.equal(await readFile(join(official,'learn/assets',name),'utf8'),'established '+name)
  assert.equal(await readFile(join(official,'assets/videos/existing.mp4'),'utf8'),'unchanged media')
 } finally {await rm(root,{recursive:true,force:true})}
})
