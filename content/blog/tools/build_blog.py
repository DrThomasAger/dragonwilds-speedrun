r"""Build the Beat 6:50 blog series: inject prev/next nav, write INDEX.md and ghost-import.json.

Usage: python content/blog/tools/build_blog.py
Needs the `markdown` and `pyyaml` packages. Keep everything on D: (never C:):
  set TEMP/TMP/PIP_CACHE_DIR to D:\claude-temp\blog-build\..., then
  pip install --target D:\claude-temp\blog-build\pylib markdown pyyaml
  PYTHONPATH=D:\claude-temp\blog-build\pylib PYTHONDONTWRITEBYTECODE=1 python content/blog/tools/build_blog.py
Reads content/blog/posts/NN-*.md (YAML front matter + Markdown body).
"""
import json, re, sys, os, hashlib, datetime

import yaml, markdown

BLOG = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS = os.path.join(BLOG, 'posts')
SITE = 'https://drthomasager.com'
AUTHOR = {'name': 'Dr. Thomas Ager', 'slug': 'thomas', 'email': 'hanjoyoutaku@gmail.com'}
PILLARS = [
    ('beat-650', 'Beat 6:50', 'Start here: the complete series on beating the 6:50 Scorned Wilderness raid world record in RuneScape: Dragonwilds.'),
    ('get-raid-ready', 'Get Raid-Ready', 'Every level, spell, item, quest and setting the raid route needs, and how to get each one.'),
    ('the-route', 'The Route, Split By Split', 'The 1.0.1.2 Scorned Wilderness route in the order you play it, every skip credited to its finder.'),
    ('movement-tech', 'Movement Tech', 'Zoops, dive cancels, infinite double jumps and Surge dashes, defined and taught step by step.'),
    ('practice', 'Practice & Consistency', 'Practice loops and reset habits that turn a skip you landed once into a skip you land every time.'),
    ('data-and-the-record', 'Data & The Record', 'Frame-measured splits, sums of best and target paces for the Scorned Wilderness record.'),
    ('patch-watch', 'Patch Watch', 'What every Dragonwilds patch did to the raid route, quoted from Jagex, plus the speedrun.com rules.'),
]
PILLAR_NAME = {s: n for s, n, _ in PILLARS}
FM = re.compile(r'^---\n(.*?)\n---\n(.*)$', re.S)
NAV = re.compile(r'<!-- series-nav -->.*?<!-- /series-nav -->', re.S)
PLACEHOLDER = re.compile(r'\{\{update when[^}]*\}\}')


def oid(s):  # 24-hex Ghost-style object id, stable per input
    return hashlib.md5(s.encode()).hexdigest()[:24]


def load():
    out = []
    for fn in sorted(os.listdir(POSTS)):
        if not fn.endswith('.md'):
            continue
        p = os.path.join(POSTS, fn)
        raw = open(p, encoding='utf-8').read().replace('\r\n', '\n')
        m = FM.match(raw)
        if not m:
            raise SystemExit(f'no front matter: {fn}')
        fm = yaml.safe_load(m.group(1))
        out.append({'file': p, 'fn': fn, 'fm': fm, 'body': m.group(2)})
    out.sort(key=lambda x: x['fm']['series_order'])
    return out


def nav_block(prev, nxt, hub):
    parts = []
    if prev:
        parts.append(f"**← Previous:** [{prev['fm']['title']}](/{prev['fm']['slug']}/)")
    if nxt:
        parts.append(f"**Next →** [{nxt['fm']['title']}](/{nxt['fm']['slug']}/)")
    parts.append(f"**Series index:** [{hub['fm']['title']}](/{hub['fm']['slug']}/)")
    return '<!-- series-nav -->\n' + '\n\n'.join(parts) + '\n<!-- /series-nav -->'


def dump_fm(fm):
    order = ['title', 'slug', 'excerpt', 'tags', 'author', 'meta_title', 'meta_description',
             'feature_image_alt', 'canonical', 'pillar', 'series_order', 'prev', 'next', 'status']
    keys = order + [k for k in fm if k not in order]
    return yaml.safe_dump({k: fm[k] for k in keys if k in fm}, sort_keys=False, allow_unicode=True, width=1000).strip()


def main():
    posts = load()
    hub = posts[0]
    for i, p in enumerate(posts):
        prev = posts[i - 1] if i else None
        nxt = posts[i + 1] if i + 1 < len(posts) else None
        fm = p['fm']
        fm['prev'] = f"/{prev['fm']['slug']}/" if prev else None
        fm['next'] = f"/{nxt['fm']['slug']}/" if nxt else None
        fm['canonical'] = f"{SITE}/{fm['slug']}/"
        fm['author'] = AUTHOR['name']
        ph = PLACEHOLDER.findall(p['body'])
        fm['status'] = 'draft: waiting on data' if ph else 'draft: ready to publish'
        p['placeholders'] = ph
        block = nav_block(prev, nxt, hub)
        body = p['body']
        body = NAV.sub(lambda _: block, body) if NAV.search(body) else body.rstrip() + '\n\n---\n\n' + block + '\n'
        p['body'] = body
        with open(p['file'], 'w', encoding='utf-8', newline='\n') as f:
            f.write('---\n' + dump_fm(fm) + '\n---\n' + body)

    # ---- ghost-import.json (Ghost 5 JSON import; posts as html, imported as drafts)
    now = datetime.datetime(2026, 11, 3, 9, 0, 0)
    tags, tag_ids = [], {}

    def tag(slug, name, desc=''):
        if slug in tag_ids:
            return tag_ids[slug]
        t = {'id': oid('tag:' + slug), 'name': name, 'slug': slug, 'description': desc or None, 'visibility': 'internal' if name.startswith('#') else 'public'}
        tags.append(t); tag_ids[slug] = t['id']; return t['id']

    tag('hash-beat-650', '#beat-650', 'Internal: Beat 6:50 series')
    for s, n, d in PILLARS:
        tag(s, n, d)
    user = {'id': oid('user:thomas'), 'name': AUTHOR['name'], 'slug': AUTHOR['slug'], 'email': AUTHOR['email']}
    gposts, posts_tags, posts_authors, posts_meta = [], [], [], []
    md = markdown.Markdown(extensions=['tables', 'fenced_code', 'sane_lists'])
    for i, p in enumerate(posts):
        fm = p['fm']
        body = p['body'].replace('<!-- series-nav -->', '').replace('<!-- /series-nav -->', '')
        html = md.reset().convert(body)
        pid = oid('post:' + fm['slug'])
        ts = (now + datetime.timedelta(minutes=i)).strftime('%Y-%m-%dT%H:%M:%S.000Z')
        gposts.append({
            'id': pid, 'title': fm['title'], 'slug': fm['slug'], 'html': html,
            'feature_image': None, 'featured': i == 0, 'type': 'post', 'status': 'draft', 'visibility': 'public',
            'custom_excerpt': fm['excerpt'], 'canonical_url': fm['canonical'],
            'meta_title': fm['meta_title'], 'meta_description': fm['meta_description'],
            'og_title': fm['meta_title'], 'og_description': fm['meta_description'],
            'twitter_title': fm['meta_title'], 'twitter_description': fm['meta_description'],
            'feature_image_alt': fm['feature_image_alt'],
            'created_at': ts, 'updated_at': ts, 'published_at': None, 'author_id': user['id'],
        })
        posts_meta.append({'id': oid('meta:' + fm['slug']), 'post_id': pid, 'meta_title': fm['meta_title'],
                           'meta_description': fm['meta_description'], 'og_title': fm['meta_title'],
                           'og_description': fm['meta_description'], 'twitter_title': fm['meta_title'],
                           'twitter_description': fm['meta_description'], 'feature_image_alt': fm['feature_image_alt']})
        posts_authors.append({'id': oid('pa:' + fm['slug']), 'post_id': pid, 'author_id': user['id'], 'sort_order': 0})
        for k, t in enumerate(fm['tags']):
            if t == '#beat-650':
                slug, name = 'hash-beat-650', '#beat-650'
            elif t in PILLAR_NAME:
                slug, name = t, PILLAR_NAME[t]
            else:
                slug, name = re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-'), t
            tid = tag(slug, name)
            posts_tags.append({'id': oid(f'pt:{fm["slug"]}:{slug}'), 'post_id': pid, 'tag_id': tid, 'sort_order': k})
    ghost = {'db': [{'meta': {'exported_on': int(now.timestamp() * 1000), 'version': '5.0.0'},
                     'data': {'posts': gposts, 'tags': tags, 'posts_tags': posts_tags, 'users': [user],
                              'posts_authors': posts_authors, 'posts_meta': posts_meta}}]}
    with open(os.path.join(BLOG, 'ghost-import.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(ghost, f, ensure_ascii=False, indent=1)

    # ---- INDEX.md
    total = len(posts)
    lines = ['# Beat 6:50: Series Index', '',
             f'**{total} posts**: one series hub plus {len(PILLARS) - 1} pillars. Author: Dr. Thomas Ager. '
             'Reading order runs top to bottom. "waiting on data" marks a post that holds a `{{update when …}}` placeholder. '
             'Every post imports into Ghost as a draft from `ghost-import.json`. '
             'Rebuild prev/next links, this index and the import with `python content/blog/tools/build_blog.py`.', '']
    for s, n, _ in PILLARS:
        group = [p for p in posts if p['fm']['pillar'] == s]
        if not group:
            continue
        lines += [f'## {n} ({len(group)} post{"s" if len(group) > 1 else ""})', '',
                  '| # | Title | Slug | Status | Waiting on |', '|---|---|---|---|---|']
        for p in group:
            fm = p['fm']
            phs = '<br>'.join(x[2:-2] for x in p['placeholders']) or '—'
            lines.append(f"| {fm['series_order']:02d} | [{fm['title']}](posts/{p['fn']}) | `/{fm['slug']}/` | {fm['status']} | {phs} |")
        lines.append('')
    with open(os.path.join(BLOG, 'INDEX.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))
    print(f'{total} posts; {sum(len(p["placeholders"]) for p in posts)} placeholders')
    for p in posts:
        print(f"{p['fm']['series_order']:02d} {p['fm']['pillar']:22s} {p['fm']['slug']}  ph={len(p['placeholders'])}")


main()
