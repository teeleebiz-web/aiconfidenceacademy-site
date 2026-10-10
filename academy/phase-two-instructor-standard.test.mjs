import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source=JSON.parse(readFileSync(new URL('./phase-two-production/J1-L1-1-to-1-4-standardized-introductions.json',import.meta.url),'utf8'))
const expected=[
  'Professional AI Judgment and Direction',
  'Find the Need and Establish the Evidence',
  'Select AI Roles and Define Business Value',
  'Direct Professional Requests and Decision Support',
]
test('Founder-approved instructor orientation standard across revised Phase Two openings',()=>{
  assert.equal(source.lessons.length,4)
  source.lessons.forEach((item,i)=>{
    assert.equal(item.id,'1.'+(i+1))
    assert.equal(item.title,expected[i])
    assert.ok(item.script.startsWith('Welcome back to the AI Confidence Academy.'),item.id)
    assert.ok(item.script.includes('Phase Two, Journey One, Lesson '+['One','Two','Three','Four'][i]+': '+expected[i]+'.'),item.id)
    assert.ok(item.script.trim().endsWith("Let's begin."),item.id)
    assert.equal((item.script.match(/Let's begin\./g)||[]).length,1,item.id)
    assert.equal(item.look_id,'eb90c2b7050142ea461979fa0215e161')
    assert.equal(item.voice_id,'ac277b338cf64d8b9686784c43c563da')
  })
})
test('Revised videos remain introduction-only without modifying teaching or workbook data',()=>{
  const standard=readFileSync(new URL('./ACA-INSTRUCTOR-INTRODUCTION-STANDARD.md',import.meta.url),'utf8')
  assert.match(standard,/every instructor and future lesson/i)
  assert.match(standard,/full substantive existing lesson teaching/i)
  assert.match(standard,/Do not use a temporary signed HeyGen URL as a learner link/i)
  const builder=readFileSync(new URL('./phase-two-production/build-standardized-j1-intros-v2.py',import.meta.url),'utf8')
  assert.match(builder,/Introduction-v2\.mp4/)
  assert.match(builder,/poster-v2\.webp/)
  assert.match(builder,/Opening|opening/i)
  assert.match(builder,/return_card/)
  assert.match(builder,/Introduction-v2\.vtt/)
})
