import { manualBackup } from './manual-backup.mjs'
// Not a CLI or dispatch endpoint. Only the bounded parent may launch this child.
if (!process.send) process.exitCode = 1
else {
  try {
    const result = await manualBackup()
    process.send(result, () => process.disconnect())
  } catch { process.exitCode = 1; process.disconnect() }
}
