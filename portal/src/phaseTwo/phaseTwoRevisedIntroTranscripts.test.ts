import { expect, it } from 'vitest'
import { phaseTwoRevisedIntroTranscripts } from './phaseTwoRevisedIntroTranscripts'

it('opens Lessons 1.1–1.4 with phase, journey, spoken lesson number/title, and closes introductions with Let’s begin',()=>{
  const titles=[
    'Professional AI Judgment and Direction',
    'Find the Need and Establish the Evidence',
    'Select AI Roles and Define Business Value',
    'Direct Professional Requests and Decision Support',
  ]
  for(const [i,title] of titles.entries()){
    const lesson='1.'+(i+1)
    const s=phaseTwoRevisedIntroTranscripts[lesson]
    expect(s).toMatch(/^Welcome back to the AI Confidence Academy\./)
    expect(s).toContain('Phase Two, Journey One, Lesson '+['One','Two','Three','Four'][i]+': '+title+'.')
    expect(s.trim().endsWith("Let's begin.")).toBe(true)
    expect((s.match(/Let's begin\./g)||[]).length).toBe(1)
  }
})
