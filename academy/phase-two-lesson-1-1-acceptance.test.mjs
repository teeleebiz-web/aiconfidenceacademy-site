import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const base = resolve(import.meta.dirname, '../assets/videos/phase-two-lesson-1-1');
const read = (file) => readFileSync(resolve(base, file), 'utf8');
const chapters = JSON.parse(read('guided-chapters.json'));
const report = JSON.parse(read('production-report.json'));
const manifest = JSON.parse(read('media-manifest.json'));

test('Lesson 1.1 guided audio and selectable chapters are consistent', () => {
  assert.equal(chapters.chapters.length, 4);
  assert.equal(chapters.duration_seconds, report.guided_audio.duration_seconds);
  assert.ok(existsSync(resolve(base, report.guided_audio.file)));
  assert.ok(chapters.chapters.every((chapter, i) =>
    chapter.title.trim() && chapter.transcript.trim() &&
    chapter.start_seconds >= 0 &&
    (i === 0 || chapter.start_seconds >= chapters.chapters[i-1].start_seconds + chapters.chapters[i-1].duration_seconds - 0.05) &&
    chapter.start_seconds + chapter.duration_seconds <= chapters.duration_seconds + 0.05
  ));
});

test('Lesson 1.1 instructor introduction preserves approved card sequence', () => {
  assert.ok(existsSync(resolve(base, 'ACA-Phase-Two-Lesson-1-1-Introduction.mp4')));
  assert.equal(manifest.start_frame_is_beginning_card, true);
  assert.equal(manifest.last_frame_is_beginning_card, true);
  assert.equal(manifest.max_display_width_px, 640);
});

test('Lesson 1.1 demonstrates the complete fictional evidence sequence with captions', () => {
  assert.deepEqual(report.demonstrations.map((d) => d.key),
    ['01-source', '02-draft', '03-review', '04-correct']);
  for (const demonstration of report.demonstrations) {
    assert.equal(demonstration.fictional_training_example, true);
    assert.ok(demonstration.transcript.trim());
    assert.ok(existsSync(resolve(base, demonstration.file)));
    assert.match(read(demonstration.captions), /^WEBVTT/);
    assert.match(read(demonstration.captions), /-->/);
  }
});

test('Lesson 1.1 runtime bundle exposes all essential learning sections', () => {
  const html = readFileSync(resolve(import.meta.dirname, '../learn/index.html'), 'utf8');
  const entry = html.match(/index-[\w-]+\.js/g)?.at(-1);
  assert.ok(entry, 'Learner page should reference an application bundle');
  const bundle = readFileSync(resolve(import.meta.dirname, '../learn/assets', entry), 'utf8');
  for (const feature of ['p2-guided-chapters','Read the guided instruction transcript',
    'p2-demo-clip-tabs','kind:`captions`','p2-visual-lab',
    'Your first professional AI responsibility map']) {
    assert.ok(bundle.includes(feature), `Learner application missing ${feature}`);
  }
});

// This is a source-level regression suite. Playback, authentication, save/resume,
// lesson access, and founder visual approval require separate integration checks.
