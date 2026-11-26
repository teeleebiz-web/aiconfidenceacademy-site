import { readFile, writeFile, mkdir } from 'node:fs/promises';

const title = 'What Working with AI Has Taught Me';
const subtitle = 'A reflection on AI’s possibilities, its failures, and why human judgment must remain at the center.';
const destination = '/explore/what-working-with-ai-has-taught-me/';
const media = '/assets/founder-reflection';
const escape = text => text.replace(/[&<>"']/g, value => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[value]));
const script = await readFile(new URL('./founder-reflection.txt', import.meta.url), 'utf8');
const transcript = script.trim().split(/\n\s*\n/).map(p => `<p>${escape(p)}</p>`).join('');
const mark = (name, html) => `<!-- founder-reflection:${name}:start -->${html}<!-- founder-reflection:${name}:end -->`;
const remove = (html, name) => html.replace(new RegExp(`<!-- founder-reflection:${name}:start -->[\\s\\S]*?<!-- founder-reflection:${name}:end -->`, 'g'), '');
const feature = (level = 3) => `<article class="founder-feature topic-video-card" aria-labelledby="founder-reflection-title"><header><p class="section-kicker" id="founder-reflection-title" role="heading" aria-level="${level}">A Founder’s Perspective</p><p class="founder-deck">${subtitle}</p></header><div class="founder-film"><video id="founder-reflection-video" data-aca-caption-player controls playsinline preload="metadata" width="1920" height="1080" poster="${media}/opening.webp" data-hls="${media}/film.m3u8" aria-label="${title}"><source src="${media}/film.m3u8" type="application/vnd.apple.mpegurl"/><track kind="captions" src="${media}/captions-en.vtt" srclang="en" label="English"/>Your browser does not support video playback.</video><button class="founder-start" type="button" aria-label="Play ${title}" hidden><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 11 38 24 18 37Z" fill="currentColor"/></svg></button></div><p class="topic-video-error" role="status" hidden>The video could not load. Please refresh to try again, or read the reflection below.</p><div class="founder-follow"><a href="/library/when-ai-says-it-is-done/">Explore the book behind this reflection <span aria-hidden="true">→</span></a></div><details class="founder-transcript"><summary>Read the reflection</summary><div>${transcript}</div></details></article>`;
const invitation = `<a class="founder-invitation" href="${destination}"><img src="${media}/opening.webp" width="1672" height="941" alt="" loading="lazy"/><div><p class="section-kicker">A Founder’s Perspective</p><h2>${title}</h2><p>${subtitle}</p><span>Watch or read the reflection <span aria-hidden="true">→</span></span></div></a>`;
function styles(html) {
  if (!html.includes('/assets/founder-reflection.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/assets/founder-reflection.css?v=2"/></head>');
  return html.replace(/\/assets\/founder-reflection\.css(?:\?[^"\s]*)?/g, '/assets/founder-reflection.css?v=2');
}
function playerAssets(html) {
  html = styles(html);
  if (!html.includes('/assets/caption-controls.css')) html = html.replace('</head>', '<link rel="stylesheet" href="/assets/caption-controls.css?v=2"/></head>');
  for (const [src, type] of [['/assets/vendor/hls-1.7.3.light.min.js','defer'],['/assets/topic-videos-reset.js?v=3','defer'],['/assets/caption-controls.js?v=2','type="module"'],['/assets/founder-reflection.js?v=1','defer']]) {
    if (!html.includes(src.split('?')[0])) html = html.replace('</body>', `<script src="${src}" ${type}></script></body>`);
  }
  return html;
}
async function update(file, name, anchor, insertion) {
  let html = remove(await readFile(file, 'utf8'), name);
  if (!html.includes(anchor)) throw Error(`Missing founder feature anchor: ${file}`);
  html = html.replace(anchor, insertion(mark(name, name === 'feature' ? feature() : `<section class="section-pad compact">${invitation}</section>`)));
  await writeFile(file, name === 'feature' ? playerAssets(html) : styles(html));
}
const lead = '<p class="hub-lead">Ideas about human judgment, participation, and the kind of confidence worth building.</p>';
await update('explore/index.html', 'feature', lead, html => lead + html);
// Keep the founder-approved section swap when the editorial hub is rebuilt.
let explore = await readFile('explore/index.html', 'utf8');
const intro = /<section class="hub-intro\b[^>]*>[\s\S]*?<\/section>/.exec(explore);
const deeper = /<section\b[^>]*\bid="deeper-thoughts"[^>]*>[\s\S]*?<\/section>/.exec(explore);
if (!intro || !deeper) throw Error('Missing Explore section for the approved swap');
if (intro.index < deeper.index) {
  explore = explore.slice(0, intro.index) + deeper[0]
    + explore.slice(intro.index + intro[0].length, deeper.index) + intro[0]
    + explore.slice(deeper.index + deeper[0].length);
  await writeFile('explore/index.html', explore);
}
await update('reflections/index.html', 'invitation', '<section class="reflection-list', html => `${html}<section class="reflection-list`);
let videos = remove(await readFile('videos/index.html', 'utf8'), 'video-link');
videos = videos.replace('<h3>Founder Conversations</h3>', '<h3>Founder Conversations</h3>' + mark('video-link', `<p><a href="${destination}">${title} →</a></p>`));
await writeFile('videos/index.html', videos);
let book = remove(await readFile('library/when-ai-says-it-is-done/index.html', 'utf8'), 'book-link');
book = book.replace('<h2>Related reading</h2>', '<h2>Related reading</h2>' + mark('book-link', `<p><a href="${destination}">Watch or read the reflection: ${title} →</a></p>`));
await writeFile('library/when-ai-says-it-is-done/index.html', book);

const source = await readFile('explore/index.html', 'utf8');
let page = source.replace(/<main(?:\s[^>]*)?>[\s\S]*?<\/main>/, `<main><section class="founder-page section-pad"><a class="founder-back" href="/explore/">← Explore AI</a>${feature(1)}</section></main>`);
page = page.replace(/<title>[\s\S]*?<\/title>/, `<title>${title} | AI Confidence Academy</title>`).replace(/<meta name="description" content="[^"]*"\s*\/?\s*>/, `<meta name="description" content="${subtitle}"/>`);
await mkdir(`.${destination}`, { recursive: true });
await writeFile(`.${destination}index.html`, page);
