#!/usr/bin/env python3
"""Builds data/resources.json from every resources/<id>/meta.json. Run from the repo root.
GitHub runs this for you on every push; you can also run it yourself: python tools/build_index.py"""
import json, os, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'resources')
TYPES = json.load(open(os.path.join(ROOT, 'data', 'types.json'), encoding='utf-8'))
KEYS = ('id', 'name', 'type', 'official', 'author', 'description', 'tags', 'preview', 'file', 'size', 'added', 'issue', 'needs', 'code', 'summary')

def main():
    out, problems = [], []
    for d in sorted(os.listdir(RES)) if os.path.isdir(RES) else []:
        folder = os.path.join(RES, d)
        mp = os.path.join(folder, 'meta.json')
        if not os.path.isfile(mp):
            continue
        try:
            m = json.load(open(mp, encoding='utf-8'))
        except Exception as e:
            problems.append(f'{d}: meta.json is not valid JSON ({e})'); continue
        if m.get('hidden'):
            continue  # taken down
        m['id'] = d  # the folder name is the id
        if not m.get('name'): problems.append(f'{d}: no name'); continue
        if m.get('type') not in TYPES: problems.append(f'{d}: unknown type {m.get("type")!r} (use one of {", ".join(TYPES)})'); m['type'] = 'other'
        for k in ('preview', 'file'):
            if m.get(k) and not os.path.isfile(os.path.join(folder, m[k])):
                problems.append(f'{d}: {k} file {m[k]!r} is missing'); m[k] = ''
        if m.get('file') and not m.get('size'):
            m['size'] = os.path.getsize(os.path.join(folder, m['file']))
        if isinstance(m.get('tags'), str):
            m['tags'] = [t.strip() for t in m['tags'].split(',') if t.strip()]
        out.append({k: m[k] for k in KEYS if m.get(k) not in (None, '', [])})
    data = {'generated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'resources': out}
    os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
    with open(os.path.join(ROOT, 'data', 'resources.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(f'{len(out)} resources')
    for p in problems:
        print('WARNING:', p)

if __name__ == '__main__':
    main()
