// Blog — the Beat 6:50 Ghost series inside the app. Reads content/blog/ghost-import.json
// (the same file Ghost imports), lists the posts by pillar, and sets each post in the
// Blog Template (css/blog-template.css, scoped .bt) on Aero glass (css/blog-aero.css).
// Links between posts stay inside the app; every post also links to its Ghost URL.
import { h, fill } from '../lib/util.js';

export const title = 'Blog';

let cache = null;
async function load() {
  if (cache) return cache;
  const r = await fetch('content/blog/ghost-import.json');
  const d = (await r.json()).db[0].data;
  const tags = Object.fromEntries(d.tags.map(t => [t.id, t]));
  const author = Object.fromEntries(d.users.map(u => [u.id, u.name]));
  const byPost = {};
  for (const pt of d.posts_tags.sort((a, b) => a.sort_order - b.sort_order)) (byPost[pt.post_id] ||= []).push(tags[pt.tag_id]);
  const posts = d.posts.map((p, i) => {
    const pub = (byPost[p.id] || []).filter(t => t && t.visibility === 'public');
    const words = p.html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    return { ...p, n: i, tags: pub, pillar: pub.find(t => t.description && t.slug !== 'beat-650') || pub.find(t => t.slug === 'beat-650') || pub[0], author: author[p.author_id] || 'Dr. Thomas Ager', mins: Math.max(1, Math.round(words / 230)) };
  });
  const pillars = [];
  for (const p of posts) { const t = p.pillar; if (t && !pillars.find(x => x.id === t.id)) pillars.push(t); }
  cache = { posts, pillars, bySlug: Object.fromEntries(posts.map(p => [p.slug, p])) };
  return cache;
}

// Post HTML links to /slug/ (Ghost's own paths). Inside the app they open the post here.
function localise(html, bySlug) {
  return html.replace(/href="\/([a-z0-9-]+)\/?(#[^"]*)?"/g, (m, slug) => bySlug[slug] ? `href="#/blog/${slug}"` : m)
    .replace(/href="https:\/\/drthomasager\.com\/([a-z0-9-]+)\/?"/g, (m, slug) => bySlug[slug] ? `href="#/blog/${slug}"` : m)
    .replace(/<a href="http/g, '<a target="_blank" rel="noopener" href="http');
}

export async function mount(root, { rest }) {
  const holder = h('div', {}, h('p', { class: 'note' }, 'Loading the series…'));
  root.append(holder);
  let data;
  try { data = await load(); } catch (e) { fill(holder, h('div', { class: 'card' }, h('h2', {}, 'The blog could not load'), h('p', { class: 'note' }, String(e)))); return; }
  const slug = rest[0];
  if (slug && data.bySlug[slug]) return post(holder, data, data.bySlug[slug]);
  list(holder, data);
}

function list(holder, { posts, pillars }) {
  const hub = posts.find(p => p.featured) || posts[0];
  fill(holder,
    h('div', { class: 'pagehead' }, h('div', {}, h('h1', {}, 'Beat 6:50'),
      h('p', {}, `The blog series by Dr. Thomas Ager on beating TexasPete's 6:50 Scorned Wilderness record: ${posts.length} posts in ${pillars.length} pillars, set in the Blog Template. The same posts are drafts on Ghost.`))),
    h('a', { class: 'callout st-cta', href: `#/blog/${hub.slug}` }, h('b', {}, 'Start with the hub: '), hub.title, ' ›'),
    h('div', { class: 'blog-list', style: { display: 'grid', gap: '14px' } }, pillars.map(t => h('section', { class: 'card' },
      h('h2', {}, t.name),
      t.description ? h('p', { class: 'note' }, t.description) : null,
      h('div', { class: 'grid' }, posts.filter(p => p.pillar === t).map(p => h('a', { class: 'post drill', href: `#/blog/${p.slug}` },
        h('b', {}, p.title), h('span', {}, `${p.mins} min read`))))))));
}

function post(holder, { posts, bySlug }, p) {
  const prev = posts[p.n - 1], next = posts[p.n + 1];
  const art = h('article', { class: 'bt' });
  art.innerHTML = localise(p.html, bySlug);
  const date = new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  fill(holder,
    h('div', { class: 'row', style: { marginBottom: '12px' } }, h('a', { class: 'btn sm', href: '#/blog' }, '‹ All posts')),
    h('section', { class: 'card blog-window', 'data-read-main': '' },
      h('div', { class: 'bt' },
        h('p', { class: 'kicker' }, p.pillar ? p.pillar.name : 'Beat 6:50'),
        h('h1', {}, p.title),
        p.custom_excerpt ? h('p', { class: 'lede' }, p.custom_excerpt) : null,
        h('div', { class: 'byline' }, h('span', { class: 'who' }, p.author), h('span', { class: 'dot' }), h('span', {}, date), h('span', { class: 'dot' }), h('span', {}, `${p.mins} min read`),
          p.canonical_url ? [h('span', { class: 'dot' }), h('a', { href: p.canonical_url, target: '_blank', rel: 'noopener' }, 'On Ghost ↗')] : null)),
      art),
    h('nav', { class: 'blog-nav' },
      prev ? h('a', { class: 'btn', href: `#/blog/${prev.slug}` }, '‹ ', prev.title) : h('span'),
      next ? h('a', { class: 'btn pri', href: `#/blog/${next.slug}` }, next.title, ' ›') : h('span')));
}
