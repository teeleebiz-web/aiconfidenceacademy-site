import test from 'node:test'
import assert from 'node:assert/strict'
import { mediaMigrationPlan, migratePhaseTwoMedia } from './migrate-phase-two-media.mjs'

test('the actual combined collection exceeds the existing backup limit', () => {
  const plan = mediaMigrationPlan(1729388971)
  assert.equal(plan.files, 525)
  assert.equal(plan.additionalBytes, 1048800956)
  assert.equal(plan.projectedBytes, 2778189927)
  assert.equal(plan.backupLimitBytes, 2147483648)
  assert.equal(plan.capacityReady, false)
})
test('resuming a transfer does not double-count verified destination objects', () => {
  const original = mediaMigrationPlan(1729388971)
  const resumed = mediaMigrationPlan(1729388971 + 1000, 1000)
  assert.equal(resumed.projectedBytes, original.projectedBytes)
})
test('preview is read-only and an upload cannot bypass the deployed backup bound', async () => {
  const client = { storage: { from() { throw new Error('Mutation must not be reached') } } }
  const readInventory = async () => ({ buckets:[{id:'aca-learning-media',public:false}], files:[{bucket:'aca-learning-media',key:'existing',size:1729388971}] })
  const plan = await migratePhaseTwoMedia({ client, readInventory })
  assert.equal(plan.uploaded, 0); assert.equal(plan.activationReady, false)
  await assert.rejects(migratePhaseTwoMedia({ client, readInventory, approved:true }), /enforced backup/)
})
test('a public destination is refused even for a migration plan', async () => {
  await assert.rejects(migratePhaseTwoMedia({ client: {}, readInventory: async () => ({buckets:[{id:'aca-learning-media',public:true}],files:[]}) }), /private media bucket/)
})
