"""Check every post against STYLE.md. Usage: python content/blog/tools/lint_blog.py"""
import os, re, sys

BLOG = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS = os.path.join(BLOG, 'posts')
FIELDS = ['title', 'slug', 'excerpt', 'tags', 'meta_title', 'meta_description', 'feature_image_alt', 'pillar', 'series_order']
SECTIONS = ['## What this means when you run', '## Read further', '## Sources', '## Key takeaways']
HEDGE = re.compile(r'\b(might|perhaps|arguably|it seems|possibly|maybe|probably)\b', re.I)
CONTRAST = re.compile(r"\bnot (just|merely|simply|only)\b|\bmerely\b|\bnot \w+(?: \w+){0,3}, but\b", re.I)

files = sorted(f for f in os.listdir(POSTS) if f.endswith('.md'))
slugs = {re.search(r'^slug: (.+)$', open(os.path.join(POSTS, f), encoding='utf-8').read(), re.M).group(1).strip().strip('"') for f in files}
bad = 0
for f in files:
    s = open(os.path.join(POSTS, f), encoding='utf-8').read()
    fm, body = s.split('\n---\n', 1) if s.startswith('---') else ('', s)
    probs = []
    for k in FIELDS:
        if not re.search(rf'^{k}:', fm, re.M):
            probs.append(f'missing {k}')
    for sec in SECTIONS:
        if sec not in body:
            probs.append(f'missing section {sec!r}')
    if '—' in s:
        probs.append(f'{s.count("—")} em dashes')
    if '<!-- series-nav -->' not in body:
        probs.append('no series-nav marker')
    if 'May this writing benefit all beings.' not in body:
        probs.append('no sign-off')
    for h in re.findall(r'^## (.+)$', body, re.M):
        words = h.split()
        caps = [w for w in words[1:] if w[:1].isupper() and w.lower() in {'the', 'to', 'do', 'you', 'is', 'what', 'how', 'and', 'for', 'of', 'in', 'a', 'it', 'does', 'why', 'when', 'where'}]
        if caps:
            probs.append(f'title-case heading: {h}')
    for m in re.findall(r'\]\(/([a-z0-9-]+)/\)', body):
        if m not in slugs:
            probs.append(f'broken internal link /{m}/')
    nav_free = body.split('## Sources')[0]
    for m in HEDGE.finditer(nav_free):
        line = nav_free[max(0, m.start() - 60):m.end() + 40].replace('\n', ' ')
        if '"' not in line:
            probs.append(f'hedge: …{line}…')
    for m in CONTRAST.finditer(nav_free):
        probs.append(f'contrast: …{nav_free[max(0, m.start() - 40):m.end() + 30]}…'.replace('\n', ' '))
    yt = re.findall(r'https://youtu\.be/[\w-]{11}(\?t=\d+)?', body)
    if any(t == '' for t in yt):
        probs.append('youtu.be link without ?t=')
    kt = body.split('## Key takeaways')[-1].split('***Dr. Thomas Ager***')[0]
    if body.count('## Key takeaways') and len(re.findall(r'^- ', kt, re.M)) != 3:
        probs.append('key takeaways != 3 bullets')
    if probs:
        bad += 1
        print(f'== {f}')
        for p in probs:
            print('   ', p)
print(f'{len(files)} posts, {bad} with issues')
