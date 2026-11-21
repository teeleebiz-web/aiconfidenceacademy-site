import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

// Captured from the approved source exports at main 71510cf before transport changes.
const approvedHashes = {
  "original:1.2": "a0200a0c8be1de676aa6b7fbd55be38ef79f381b6bc7a29b408852ebb6696895",
  "original:1.3": "11b421f8e0fb34e772d149f4aaed0d2dfbfa844f393897e7f27438c5c27fd95b",
  "original:1.4": "0be37b38b248063c732463fc82f2b7b1db1a41f1589187ea06cf80b6a0065694",
  "original:1.5": "763d2e2bc2995565ba62917121bdee9250b92ef3db77656b581959848bf65b9c",
  "original:1.6": "20ef54ae78261e794b4d1f71f6002c34dfbf89dc38751c0598f1b9982f907147",
  "original:2.1": "9a7658acf07f60de306985ce9b3e6342f857eaa29ee2b1ee2543d48fc02a8615",
  "original:2.2": "51a667358ea3b78053e36755dfb477e3c99b8a8f6674df24f18501b812b40396",
  "original:2.3": "8841e718f2f2285ff7db980645ad3d006a164741b479e225cb16177bc98d428a",
  "original:2.4": "887fcb26e08ddf4c380fe262c2fe13c4acd4bf86c7362ad814fbfef098b57880",
  "original:2.5": "a809369112ea9e3194e542e07fc3a9d98533408a99d85ddaafa29e5a6f4d952f",
  "original:2.6": "5e5f9acfd25b1c8559a9b01ea32dfc3709220e387fb0f269c209658b47bd3bdc",
  "revised:1.1": "3cae343fc7b5f285467053c43419888173ac0a3a4d282ac4b12e8e131f015d72",
  "revised:1.2": "b2993ae8245e9e4b256649dc42838fc0acc46c1874a6e9a9b841a0013a44a6c8",
  "revised:1.3": "f9d3c0068f41f21f099393ce26fc5fb4d9cc8c5bab9b34a5213d0d7f43795412",
  "revised:1.4": "ab138cf1cf440ea5410d39aea7f1f3ab7eb2391f62b643291c49dfaf6107e09d"
}
test('all 15 introduction texts retain their exact pre-migration bytes', async () => {
  const catalog = JSON.parse(await readFile(new URL('./phase-two-introductions.json', import.meta.url), 'utf8'))
  const actual = {}
  for (const [kind, items] of Object.entries(catalog)) for (const [page, text] of Object.entries(items)) {
    actual[kind + ':' + page] = createHash('sha256').update(text).digest('hex')
  }
  assert.deepEqual(actual, approvedHashes)
})
