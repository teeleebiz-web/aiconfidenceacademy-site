import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const spec=JSON.parse(readFileSync(new URL('./phase-two-production/J1-L1-2-lesson-spec.json', import.meta.url),'utf8'));
const script=readFileSync(new URL('./phase-two-production/J1-L1-2-instructional-master.md', import.meta.url),'utf8');
test('Lesson 1.2 uses the authoritative six-journey curriculum',()=>{
  assert.match(spec.curriculum,/Six-Week Curriculum Master v2\.0/);
  assert.equal(spec.lesson,'1.2');
  assert.equal(spec.title,'Find the Need and Establish the Evidence');
  assert.equal(spec.predecessor,'1.1');
  assert.equal(spec.successor,'1.3');
});
test('Learner returns to their own AI model and continuing project',()=>{
  assert.equal(spec.applied_work.carry_forward_project,true);
  assert.equal(spec.applied_work.candidate_count,3);
  assert.equal(spec.applied_work.neutral_question_count,5);
  assert.equal(spec.applied_work.save_method,'append_to_existing_project_record');
  assert.ok(spec.applied_work.ai_workflow.some(s=>s.includes('phone')));
  assert.ok(spec.applied_work.ai_workflow.some(s=>s.includes('brings analysis back')));
  assert.equal(spec.applied_work.no_fake_save,true);
});
test('The case is clearly fictional, with uncertainty and five neutral questions',()=>{
  assert.equal(spec.presentation.demonstrations.length,4);
  assert.ok(spec.presentation.demonstrations.every(d=>d.example_is_fictional));
  for(const phrase of ['FICTIONAL TRAINING EXAMPLE','hypothesis','reported experience','not a diagnosis','provisional']) assert.ok(script.toLowerCase().includes(phrase.toLowerCase()),phrase);
  assert.match(script,/five example neutral questions/i);
});
test('Instructor and captions follow the approved Lesson 1.1 production standard',()=>{
  assert.equal(spec.instructor.voice_id,'ac277b338cf64d8b9686784c43c563da');
  assert.equal(spec.instructor.max_width_px,640);
  assert.equal(spec.presentation.caption_placement,'separate_strip_below_video');
  assert.equal(spec.presentation.tab_video_behavior,'play_selected_video_on_explicit_tab_click');
  assert.equal(spec.presentation.transcripts,true);
});
test('No false claim of recorded media or live learner integration',()=>{
  assert.equal(spec.status,'instructional-production-source-not-live');
  assert.match(script,/Not yet recorded or deployed/);
});
