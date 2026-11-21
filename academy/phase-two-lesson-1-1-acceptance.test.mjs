import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const base = resolve(import.meta.dirname, '../assets/videos/phase-two-lesson-1-1');
const read = (file) => readFileSync(resolve(base, file), 'utf8');
const chapters = JSON.parse(read('guided-chapters.json'));
const report = JSON.parse(read('production-report.json'));
const manifest = JSON.parse(read('media-manifest.json'));

function publishedPhaseTwoBundle() {
  const html = readFileSync(resolve(import.meta.dirname, '../learn/index.html'), 'utf8');
  const legacy = html.match(/if \(review\) \{[\s\S]*?index-[\w-]+\.js/)?.[0]?.match(/index-[\w-]+\.js/)?.[0];
  if (legacy) return readFileSync(resolve(import.meta.dirname, '../learn/assets', legacy), 'utf8');
  const bootstrapName = html.match(/src="\/learn\/assets\/([^\"]+\.js)"/)?.[1];
  assert.ok(bootstrapName, 'Learner page should reference its built bootstrap');
  const bootstrap = readFileSync(resolve(import.meta.dirname, '../learn/assets', bootstrapName), 'utf8');
  assert.ok(bootstrap.includes('phase-two'), 'Keep the established Phase Two review route');
  const build = JSON.parse(readFileSync(resolve(import.meta.dirname, '../learn/.vite/manifest.json'), 'utf8'));
  const phaseTwoEntry = build['src/phaseTwoMain.tsx'];
  assert.ok(phaseTwoEntry?.file?.startsWith('assets/phaseTwoMain-'), 'Manifest must identify the maintained Phase Two application');
  assert.ok(bootstrap.includes(phaseTwoEntry.file.slice('assets/'.length)), 'Bootstrap must load the current Phase Two build');
  assert.ok(phaseTwoEntry.css?.length > 0, 'Phase Two must include its styles');
  for (const file of phaseTwoEntry.css) assert.ok(existsSync(resolve(import.meta.dirname, '../learn', file)), 'Current Phase Two styling must exist');
  return readFileSync(resolve(import.meta.dirname, '../learn', phaseTwoEntry.file), 'utf8');
}

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

test('Selecting a demonstration starts its video immediately without losing replay controls', () => {
  const bundle = publishedPhaseTwoBundle();
  assert.match(bundle, /[\w$]+\.play\(\)\.catch\(\(\)=>\{\}\)/, 'Tab selection should request playback');
  assert.match(bundle, /([\w$]+)\.src=[\w$]+\[[\w$]+\]\.url,\1\.load\(\),\1\.play\(\)\.catch/, 'Tab selection should load and play the chosen clip using the same player');
  assert.match(bundle, /preload:`auto`,src:[\w$]+\.url/, 'React must retain the selected clip when signed URLs renew');
  assert.match(bundle, /ref:[\w$]+,crossOrigin:`anonymous`,controls:!0/, 'Keep controls, a stable player, and cross-origin captions');
  assert.ok(bundle.includes('p2-demo-caption-strip'), 'Keep captions below the video');
});

test('Lesson 1.1 runtime bundle exposes all essential learning sections', () => {
  const bundle = publishedPhaseTwoBundle();
  for (const feature of ['p2-guided-chapters','Read the guided instruction transcript',
    'p2-demo-clip-tabs','kind:`captions`','p2-visual-lab',
    'Your first professional AI responsibility map', 'p2-demo-caption-strip', 'kind:`metadata`', 'p2-practice-ai', 'Copy prompt', 'p2-practice-prompt']) {
    assert.ok(bundle.includes(feature), `Learner application missing ${feature}`);
  }
});

// This is a source-level regression suite. Playback, authentication, save/resume,
// lesson access, and founder visual approval require separate integration checks.
