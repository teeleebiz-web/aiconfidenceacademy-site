import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const data = JSON.parse(await readFile(new URL('./public-hub.json', import.meta.url), 'utf8'))
const source = await readFile('library/index.html', 'utf8')
const shell = /^([\s\S]*?<main>)[\s\S]*?(<\/main>[\s\S]*)$/.exec(source)
if (!shell) throw new Error('The Academy public site shell was not found')
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const articleBySlug = new Map(data.articles.map(item => [item.slug, item]))
const bookBySlug = new Map(data.books.map(item => [item.slug, item]))
const topicBySlug = new Map(data.topics.map(item => [item.slug, item]))
const unique = values => new Set(values).size === values.length
const validSlug = value => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
for (const collection of [data.topics, data.articles, data.books, data.updates]) {
  if (!unique(collection.map(item => item.slug)) || collection.some(item => !validSlug(item.slug))) throw new Error('Content slugs must be unique and URL safe')
}
for (const item of data.articles) {
  if (!bookBySlug.has(item.book) || !topicBySlug.has(item.topic) || !articleBySlug.has(item.next)) throw new Error(`Broken article reference: ${item.slug}`)
}
for (const item of data.topics) {
  if (!bookBySlug.has(item.book) || item.articles.some(slug => !articleBySlug.has(slug))) throw new Error(`Broken topic reference: ${item.slug}`)
}
for (const item of data.books) {
  if (item.topics.some(slug => !topicBySlug.has(slug))) throw new Error(`Broken book reference: ${item.slug}`)
}
for (const item of data.updates) {
  if (!bookBySlug.has(item.book) || !topicBySlug.has(item.topic) || !item.sources.length || item.sources.some(source => !source.url.startsWith('https://'))) throw new Error(`Broken update source or reference: ${item.slug}`)
}
const reviewed = value => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00Z`))
const articleLink = item => `/explore/${item.slug}/`
const bookLink = item => `/library/${item.slug}/`
const articleCard = item => `<article class="hub-card"><p class="hub-meta">${esc(item.kind)} · ${esc(item.minutes)} min read</p><h3><a href="${articleLink(item)}">${esc(item.title)}</a></h3><p>${esc(item.summary)}</p><a class="hub-text-link" href="${articleLink(item)}">Read ${item.kind === 'Quick answer' ? 'the answer' : 'the reflection'} →</a></article>`
const bookCover = (item, large = false) => item.coverImage ? `<img class="book-cover-image" src="${esc(item.coverImage)}" alt="${esc(item.title)} book cover" width="320" height="480" loading="lazy"/>` : `<div class="book-cover ${large ? 'large ' : ''}${esc(item.cover)}" aria-hidden="true"><small>AI Confidence Academy</small><strong>${esc(item.title)}</strong><span>Digital Edition</span></div>`
const bookCard = item => `<article class="hub-book">${bookCover(item)}<div><p class="hub-meta">${esc(item.type)}</p><h3><a href="${bookLink(item)}">${esc(item.title)}</a></h3><p>${esc(item.description)}</p><p class="hub-availability">${esc(item.digital)} · ${esc(item.audio)}</p><a class="hub-text-link" href="${bookLink(item)}">Explore the book →</a></div></article>`

// Keep the bookstore shelf and detail pages on the same editorial source.
const shelfCard = item => `<article class="shelf-card"><a class="shelf-cover-link" href="${bookLink(item)}" aria-label="View details for ${esc(item.title)}">${bookCover(item)}</a><p class="section-kicker">${esc(item.type)}</p><h2><a href="${bookLink(item)}">${esc(item.title)}</a></h2><p class="shelf-subtitle">${esc(item.subtitle || '')}</p><p class="shelf-author">${esc(item.author)}</p><a class="shelf-details" href="${bookLink(item)}">View book details →</a></article>`
await writeFile('library/index.html', source
  .replace(/<span>\d+ books in the collection<\/span>/, `<span>${data.books.length} books in the collection</span>`)
  .replace(/(<section class="book-shelf section-pad" aria-label="ACA book collection">)[\s\S]*?(<\/section>)/, `$1${data.books.map(shelfCard).join('')}$2`))

async function page(file, title, description, body) {
  let html = shell[1] + body + shell[2]
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)} | AI Confidence Academy</title>`)
    .replace(/<meta name="description" content="[^"]*"\/>/, `<meta name="description" content="${esc(description)}"/>`)
    .replace('</head>', '<link rel="stylesheet" href="/assets/explore.css"/></head>')
    .replace('<a href="/library" class="active">', '<a href="/library" class="">')
    .replace('<a href="/explore" class="">', '<a href="/explore" class="active">')
  if (file.startsWith('library/')) html = html.replace('<a href="/explore" class="active">', '<a href="/explore" class="">').replace('<a href="/library" class="">', '<a href="/library" class="active">')
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, html)
}

const quick = data.articles.filter(item => item.kind === 'Quick answer')
const deep = data.articles.filter(item => item.kind === 'Deeper thought')
await page('explore/index.html', 'Explore AI with clarity', 'Quick AI answers, deeper reflections, and related ACA books in one place.', `
<section class="page-hero hub-hero"><div><p class="eyebrow">Explore ACA</p><h1>A place to think, learn, and keep going.</h1><p>Start with a short answer. Stay for a deeper thought. Follow the subject into a book or the guided Academy when you are ready.</p><a class="button button-gold" href="#quick-answers">Find a starting point</a></div><img src="/aca-official-seal.png" alt="AI Confidence Academy seal" width="215" height="215"/></section>
<section class="hub-intro section-pad compact"><p class="section-kicker">Choose your path</p><h2>What would help you today?</h2><div class="hub-topic-grid">${data.topics.map(item => `<a class="hub-topic" href="#${esc(item.slug)}"><span>${esc(item.name)}</span><p>${esc(item.description)}</p><b>Explore this subject →</b></a>`).join('')}</div></section>
<section class="hub-section section-pad" id="quick-answers"><p class="section-kicker">A few minutes to learn</p><h2>Quick answers about AI</h2><p class="hub-lead">Plain-language explanations you can use before you decide where to go deeper.</p><div class="hub-grid">${quick.map(articleCard).join('')}</div></section>
<section class="hub-section hub-cream section-pad" id="deeper-thoughts"><p class="section-kicker">Take a longer look</p><h2>Deeper thoughts</h2><p class="hub-lead">Ideas about human judgment, participation, and the kind of confidence worth building.</p><div class="hub-grid">${deep.map(articleCard).join('')}</div></section>
<section class="hub-section section-pad" id="topics"><p class="section-kicker">Follow an idea</p><h2>From one thought to the next resource</h2>${data.topics.map(item => `<article class="hub-path" id="${esc(item.slug)}"><div><p class="hub-meta">${esc(item.name)}</p><h3>${esc(item.description)}</h3></div><div><p>Begin with <a href="${articleLink(articleBySlug.get(item.articles[0]))}">${esc(articleBySlug.get(item.articles[0]).title)}</a>.</p><p>Go deeper with <a href="${articleLink(articleBySlug.get(item.articles[1]))}">${esc(articleBySlug.get(item.articles[1]).title)}</a>.</p><p>Continue into <a href="${bookLink(bookBySlug.get(item.book))}">${esc(bookBySlug.get(item.book).title)}</a>.</p></div></article>`).join('')}</section>
<section class="hub-section hub-cream section-pad" id="books"><p class="section-kicker">The books are the invitation</p><h2>Explore the books and forthcoming audio editions</h2><p class="hub-lead">Explore what each ACA book is for. Digital and audiobook releases will appear with clear availability and access details when ready.</p><div class="hub-book-grid">${data.books.map(bookCard).join('')}</div><a class="button button-outline" href="/library/">View the full book shelf</a></section>
<section class="hub-section section-pad" id="expressions"><p class="section-kicker">Words we return to</p><h2>ACA expressions</h2><div class="hub-expression-grid"><a href="/explore/ai-assists-humans-verify/"><strong>AI assists. Humans verify.</strong><span>Read how to put that into practice →</span></a><a href="/explore/confidence-is-a-practice/"><strong>People come first. AI is the tool. Confidence is the product.</strong><span>Explore what confidence means →</span></a></div></section>
<section class="hub-section hub-update section-pad" id="field-notes"><p class="section-kicker">ACA field notes</p><h2>Information you can return to</h2><p>Each note carries a publication date, a review date, and sources. New findings can be added in editions while earlier addresses stay available.</p><div class="hub-grid">${data.updates.map(item => `<article class="hub-card"><p class="hub-meta">Note ${esc(item.number)} · Reviewed ${esc(reviewed(item.reviewed))}</p><h3><a href="/explore/updates/${esc(item.slug)}/">${esc(item.title)}</a></h3><p>${esc(item.summary)}</p><a class="hub-text-link" href="/explore/updates/${esc(item.slug)}/">Read the field note →</a></article>`).join('')}</div><p class="hub-meta">Edition ${esc(data.edition)} · Reviewed ${esc(reviewed(data.reviewed))}</p><a class="button button-outline" href="/enroll/?interest=updates#interest-list">Get ACA updates</a></section>`)

for (const item of data.articles) {
  const book = bookBySlug.get(item.book)
  const next = articleBySlug.get(item.next)
  await page(`explore/${item.slug}/index.html`, item.title, item.summary, `
<article class="hub-article section-pad"><a class="hub-back" href="/explore/">← Explore ACA</a><p class="section-kicker">${esc(item.kind)} · ${esc(topicBySlug.get(item.topic).name)}</p><h1>${esc(item.title)}</h1><p class="hub-deck">${esc(item.summary)}</p><p class="hub-meta">${esc(item.minutes)} min read · Reviewed ${esc(reviewed(item.reviewed))}</p><div class="hub-prose">${item.sections.map(section => `<section><h2>${esc(section.heading)}</h2>${section.paragraphs.map(text => `<p>${esc(text)}</p>`).join('')}</section>`).join('')}</div><div class="hub-related"><p class="section-kicker">Keep going</p><h2>Follow the idea</h2><p>Read next: <a href="${articleLink(next)}">${esc(next.title)}</a></p><p>Explore the related book: <a href="${bookLink(book)}">${esc(book.title)}</a></p><p>For guided practice, <a href="/programs/">see the Academy pathway</a>.</p></div></article>`)
}

for (const item of data.updates) {
  const book = bookBySlug.get(item.book)
  await page(`explore/updates/${item.slug}/index.html`, item.title, item.summary, `
<article class="hub-article section-pad"><a class="hub-back" href="/explore/#field-notes">← ACA field notes</a><p class="section-kicker">Field note ${esc(item.number)} · ${esc(topicBySlug.get(item.topic).name)}</p><h1>${esc(item.title)}</h1><p class="hub-deck">${esc(item.summary)}</p><p class="hub-meta">Published ${esc(reviewed(item.published))} · Reviewed ${esc(reviewed(item.reviewed))}</p><div class="hub-prose"><section><h2>What the source says</h2><p>${esc(item.finding)}</p></section><section><h2>A practice to try</h2><p>${esc(item.practice)}</p></section><section><h2>What we will keep watching</h2><p>${esc(item.watch)}</p></section><section><h2>Sources</h2><ul class="hub-sources">${item.sources.map(source => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.label)} ↗</a></li>`).join('')}</ul></section></div><div class="hub-related"><p class="section-kicker">Continue the subject</p><p>Read <a href="/explore/ai-assists-humans-verify/">AI assists, humans verify</a> and explore <a href="${bookLink(book)}">${esc(book.title)}</a>.</p></div></article>`)
}

for (const item of data.books) {
  const related = data.articles.filter(article => article.book === item.slug)
  await page(`library/${item.slug}/index.html`, item.title, `${item.description} Explore formats, related reading, and availability.`, `
<article class="hub-article hub-book-detail section-pad"><a class="hub-back" href="/library/">← Books &amp; Resources</a><div class="hub-book-detail-grid">${bookCover(item, true)}<div><p class="section-kicker">${esc(item.type)}</p><h1>${esc(item.title)}</h1><p class="book-detail-subtitle">${esc(item.subtitle || '')}</p><p class="hub-meta">By ${esc(item.author || 'Terrence Lee')} · AI Confidence Academy</p><p class="hub-deck">${esc(item.description)}</p><h2>Edition details</h2><dl class="hub-formats"><div><dt>Digital edition</dt><dd>${esc(item.digital)}</dd></div><div><dt>Audiobook</dt><dd>${esc(item.audio)}</dd></div></dl><p>Release and purchase links will be shown here when the edition is ready. No payment or download is available from this preview.</p><a class="button button-outline" href="/library/">Return to the book collection</a></div></div><div class="hub-related"><p class="section-kicker">Begin with an idea</p><h2>Related reading</h2>${related.map(article => `<p><a href="${articleLink(article)}">${esc(article.title)}</a> · ${esc(article.kind)}</p>`).join('')}<p><a href="/explore/">Browse all topics →</a></p></div></article>`)
}

console.log(`Built Explore hub, ${data.articles.length} articles, ${data.updates.length} field notes, and ${data.books.length} book pages`)
