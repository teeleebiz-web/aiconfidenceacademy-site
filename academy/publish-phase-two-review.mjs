import { readFile, readdir, copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

// Run from an ACA GitHub Actions workflow after a verified Vite build.
// Publishes *only* a conditional owner-review entry and new hashed assets.
// Existing portal module and CSS are not replaced, deleted or overwritten.
const [built, official] = process.argv.slice(2)
if (!built || !official) throw new Error('Provide the built learn folder and the existing official checkout.')
const builtDir = resolve(built)
const officialDir = resolve(official)
const builtHtml = await readFile(join(builtDir, 'index.html'), 'utf8')
const liveIndex = join(officialDir, 'learn', 'index.html')
const currentHtml = await readFile(liveIndex, 'utf8')

function assetFrom(html, extension) {
  const match = html.match(new RegExp('/learn/assets/[A-Za-z0-9_.-]+\\.' + extension, 'i'))
  if (!match) throw new Error('Cannot identify a verified '+extension+' asset in the site HTML.')
  return match[0]
}
const oldJs = assetFrom(currentHtml, 'js')
const oldCss = assetFrom(currentHtml, 'css')
const newJs = assetFrom(builtHtml, 'js')
const newCss = assetFrom(builtHtml, 'css')
if (oldJs === newJs) throw new Error('The founder-review bundle unexpectedly equals the official learner bundle.')
if (!currentHtml.includes(oldJs) || !currentHtml.includes(oldCss)) throw new Error('Official learner HTML changed unexpectedly.')
if (currentHtml.includes('aca-phase-two-official-review-bootstrap')) {
  throw new Error('A review bootstrap already exists; reconcile before updating.')
}

const scriptPattern = /<script\s+type="module"\s+crossorigin\s+src="\/learn\/assets\/[A-Za-z0-9_.-]+\.js"><\/script>/i
if (!scriptPattern.test(currentHtml)) throw new Error('Official learner script does not match the established pattern.')
const officialAssets=join(officialDir,'learn','assets')
const builtAssets=join(builtDir,'assets')
await mkdir(officialAssets,{recursive:true})
const copied=[]
for (const name of await readdir(builtAssets)) {
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) throw new Error('Unexpected build artifact path: '+name)
  const from=join(builtAssets,name)
  const to=join(officialAssets,name)
  if (!(await stat(from)).isFile()) continue
  try {
    const current=await readFile(to)
    const newer=await readFile(from)
    if (!current.equals(newer)) throw new Error('An existing asset would be overwritten: '+name)
  } catch(error) {
    if (error.code!=='ENOENT') throw error
    await copyFile(from,to)
    copied.push(name)
  }
}
if (!copied.some(name=>newJs.endsWith(name)) || !copied.some(name=>newCss.endsWith(name))) {
  throw new Error('New review assets were not independently materialized.')
}
for (const path of [oldJs,oldCss,newJs,newCss]) {
  await stat(join(officialDir,path.replace(/^\/+/,'')))
}
const bootstrap = [
  '<script type="module" crossorigin data-aca-phase-two-official-review-bootstrap="true">',
  "const review = new URLSearchParams(window.location.search).get('review') === 'phase-two';",
  'if (review) {',
  '  const style=document.createElement("link");',
  '  style.rel="stylesheet";',
  '  style.href='+JSON.stringify(newCss)+';',
  '  document.head.appendChild(style);',
  '  await import('+JSON.stringify(newJs)+');',
  '} else {',
  '  await import('+JSON.stringify(oldJs)+');',
  '}',
  '</script>'
].join('\n')
const finalHtml=currentHtml.replace(scriptPattern,bootstrap)
if (finalHtml===currentHtml || !finalHtml.includes('data-aca-phase-two-official-review-bootstrap')) {
  throw new Error('Failed to preserve the original learner entry with a review-only branch.')
}
if (!finalHtml.includes(oldCss)) throw new Error('Original learner styling was removed.')
await writeFile(liveIndex,finalHtml,'utf8')
console.log(JSON.stringify({
  officialEntry:'/learn/?review=phase-two',
  originalModulePreserved:oldJs,
  originalCssPreserved:oldCss,
  newReviewModule:newJs,
  newReviewStylesheet:newCss,
  assetsAdded:copied,
  reviewedHtmlBytes:Buffer.byteLength(finalHtml)
},null,2))
