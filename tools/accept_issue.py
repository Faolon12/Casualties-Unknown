#!/usr/bin/env python3
"""Turns an approved "Share a resource" issue into resources/<id>/ (meta.json + picture + zip).
Run by .github/workflows/accept-resource.yml when you add the "approved" label to the issue.
Everything in the issue is treated as untrusted: only GitHub-hosted attachments are downloaded,
pictures must really be pictures, and zips may only hold art, sounds and settings."""
import json, os, re, sys, io, gzip, base64, zipfile, datetime, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.environ.get('REPO', '')
NUM = os.environ.get('ISSUE_NUMBER', '')
TOKEN = os.environ.get('GITHUB_TOKEN', '')
API = 'https://api.github.com/repos/' + REPO

ALLOWED = {'.png', '.json', '.wav', '.ogg', '.mp3', '.txt', '.md'}
MAX_ZIP = 25 * 1024 * 1024
MAX_UNZIPPED = 120 * 1024 * 1024
MAX_PIC = 8 * 1024 * 1024
TYPE_MAP = [('rig', 'rig'), ('add-on', 'addon'), ('gear', 'gear'), ('sprite', 'sprite'), ('props', 'props'), ('other', 'other')]
ATTACH = re.compile(r'https://(?:github\.com/user-attachments/(?:assets|files)/[\w./%-]+|user-images\.githubusercontent\.com/[\w./%-]+|private-user-images\.githubusercontent\.com/[\w./%?=&-]+)')

class Refuse(Exception):
    pass

def api(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': 'Bearer ' + TOKEN, 'Accept': 'application/vnd.github+json', 'User-Agent': 'luna-hub'})
    with urllib.request.urlopen(req, timeout=30) as r:
        t = r.read()
        return json.loads(t) if t else None

def download(url, limit):
    req = urllib.request.Request(url, headers={'User-Agent': 'luna-hub', 'Accept': '*/*'})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read(limit + 1)
    if len(data) > limit:
        raise Refuse(f'the file is bigger than {limit // 1048576} MB')
    return data

def sections(body):
    out, cur = {}, None
    for line in (body or '').replace('\r\n', '\n').split('\n'):
        m = re.match(r'^###\s+(.+?)\s*$', line)
        if m:
            cur = m.group(1).strip().lower(); out[cur] = []
        elif cur is not None:
            out[cur].append(line)
    return {k: '\n'.join(v).strip() for k, v in out.items()}

def field(sec, *starts):
    for k, v in sec.items():
        if any(k.startswith(s) for s in starts):
            return '' if v == '_No response_' else v
    return ''

def clean(s, n):
    s = re.sub(r'[\x00-\x08\x0b-\x1f\x7f]', '', s or '').strip()
    return s[:n]

def pic_ext(b):
    if b[:8] == b'\x89PNG\r\n\x1a\n': return '.png'
    if b[:3] == b'\xff\xd8\xff': return '.jpg'
    if b[:6] in (b'GIF87a', b'GIF89a'): return '.gif'
    if b[:4] == b'RIFF' and b[8:12] == b'WEBP': return '.webp'
    return None

def check_zip(b):
    if not zipfile.is_zipfile(io.BytesIO(b)):
        raise Refuse('the file is not a zip')
    z = zipfile.ZipFile(io.BytesIO(b))
    infos = z.infolist()
    if len(infos) > 2000:
        raise Refuse('the zip has too many files')
    total, bad = 0, []
    for i in infos:
        n = i.filename
        if n.startswith(('/', '\\')) or '..' in n.replace('\\', '/').split('/') or ':' in n:
            raise Refuse(f'the zip has an unsafe path: {n}')
        if (i.external_attr >> 16) & 0o170000 == 0o120000:
            raise Refuse(f'the zip has a link in it: {n}')
        if n.endswith('/'):
            continue
        ext = os.path.splitext(n)[1].lower()
        if ext not in ALLOWED:
            bad.append(n)
        total += i.file_size
    if bad:
        raise Refuse('the zip has files that are not allowed (only ' + ', '.join(sorted(ALLOWED)) + '): ' + ', '.join(bad[:8]) + (' …' if len(bad) > 8 else ''))
    if total > MAX_UNZIPPED:
        raise Refuse('the zip is too big once unpacked')
    bad = z.testzip()
    if bad:
        raise Refuse(f'the zip is damaged ({bad})')

def slugify(s):
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    return (s or 'resource')[:40].strip('-')

def stream_setup(code):
    """Reads a Stream Interaction share code (LUNA1: + base64(gzip(json))), wipes anything personal again,
    and returns (clean code, summary for the hub)."""
    m = re.search(r'LUNA1:[A-Za-z0-9+/=\s]+', code or '')
    code = re.sub(r'\s+', '', m.group(0)) if m else ''
    if not code.startswith('LUNA1:'):
        raise Refuse('the share code must start with LUNA1:')
    try:
        raw = gzip.decompress(base64.b64decode(code[6:], validate=True))
        if len(raw) > 2 * 1024 * 1024:
            raise Refuse('the share code is too big')
        st = json.loads(raw.decode('utf-8'))
    except Refuse:
        raise
    except Exception:
        raise Refuse("the share code couldn't be read (copy it again from the game: Presets → Copy my setup as a code)")
    if not isinstance(st, dict) or not isinstance(st.get('actions'), list):
        raise Refuse("that code isn't a Stream Interaction setup")
    # never publish logins, keys or the channel, even if an old version left them in
    st['channel'] = ''; st['clientId'] = ''
    yt = st.get('youtube') if isinstance(st.get('youtube'), dict) else {}
    yt.update({'apiKey': '', 'liveTarget': '', 'enabled': False}); st['youtube'] = yt
    for a in st['actions']:
        if isinstance(a, dict): a['rewardId'] = ''
    clean = 'LUNA1:' + base64.b64encode(gzip.compress(json.dumps(st, separators=(',', ':')).encode('utf-8'))).decode('ascii')
    acts = []
    for a in st['actions'][:80]:
        if not isinstance(a, dict) or not a.get('enabled', True):
            continue
        how = []
        if a.get('chatEnabled') and a.get('chatCommand'): how.append('chat ' + clean_text(a.get('chatCommand'), 30))
        if a.get('pointsEnabled'): how.append(str(int(a.get('pointsCost') or 0)) + ' points')
        if a.get('bitsEnabled'): how.append(str(int(a.get('bitsCost') or 0)) + ' bits')
        if a.get('powerUpEnabled') and a.get('powerUpTitle'): how.append('power-up')
        acts.append({'name': clean_text(a.get('name') or a.get('type') or '?', 50), 'type': clean_text(str(a.get('type', '')), 30), 'how': how})
    evs = []
    for e in (st.get('events') or [])[:20]:
        if isinstance(e, dict) and e.get('enabled'):
            evs.append(clean_text(str(e.get('kind', '')), 20))
    hype = st.get('hype') if isinstance(st.get('hype'), dict) else {}
    chaos = st.get('chaos') if isinstance(st.get('chaos'), dict) else {}
    summary = {'actions': acts, 'events': evs, 'hype': bool(hype.get('enabled')), 'chaos': bool(chaos.get('enabled'))}
    return clean, summary

def clean_text(s, n):
    return clean(str(s), n)

def main():
    issue = api('GET', '/issues/' + NUM)
    sec = sections(issue.get('body'))
    if field(sec, 'share code'):
        return main_stream(issue, sec)
    name = clean(field(sec, 'name'), 60)
    if not name:
        raise Refuse('the Name is empty')
    tsel = field(sec, 'type').lower()
    rtype = next((v for k, v in TYPE_MAP if tsel.startswith(k)), 'other')
    author = clean(field(sec, 'your name'), 40) or issue['user']['login']
    desc = clean(field(sec, 'description'), 2000)
    tags = [clean(t, 24) for t in field(sec, 'tags').split(',') if t.strip()][:10]
    pics = ATTACH.findall(field(sec, 'picture'))
    files = ATTACH.findall(field(sec, 'file'))
    if not pics:
        raise Refuse('no picture was attached (drag it into the Picture box)')
    if not files:
        raise Refuse('no zip was attached (drag it into the File box)')
    pic = download(pics[0], MAX_PIC)
    pext = pic_ext(pic)
    if not pext:
        raise Refuse('the picture is not a PNG, JPG, GIF or WEBP')
    zb = download(files[0], MAX_ZIP)
    check_zip(zb)

    rid = slugify(name) + '-' + NUM
    folder = os.path.join(ROOT, 'resources', rid)
    os.makedirs(folder, exist_ok=True)
    for f in os.listdir(folder):  # re-approving replaces the old upload
        os.remove(os.path.join(folder, f))
    zname = slugify(name) + '.zip'
    open(os.path.join(folder, 'preview' + pext), 'wb').write(pic)
    open(os.path.join(folder, zname), 'wb').write(zb)
    meta = {'id': rid, 'name': name, 'type': rtype, 'author': author, 'description': desc, 'tags': tags,
            'preview': 'preview' + pext, 'file': zname, 'size': len(zb), 'issue': int(NUM),
            'added': datetime.date.today().isoformat()}
    json.dump(meta, open(os.path.join(folder, 'meta.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    out = os.environ.get('GITHUB_OUTPUT')
    if out:
        with open(out, 'a') as f:
            f.write(f'id={rid}\n')
    print('accepted', rid)

def main_stream(issue, sec):
    name = clean(field(sec, 'name'), 60)
    if not name:
        raise Refuse('the Name is empty')
    code, summary = stream_setup(field(sec, 'share code'))
    rid = slugify(name) + '-' + NUM
    folder = os.path.join(ROOT, 'resources', rid)
    os.makedirs(folder, exist_ok=True)
    for f in os.listdir(folder):
        os.remove(os.path.join(folder, f))
    meta = {'id': rid, 'name': name, 'type': 'stream', 'author': clean(field(sec, 'your name'), 40) or issue['user']['login'],
            'description': clean(field(sec, 'description'), 2000), 'tags': [clean(t, 24) for t in field(sec, 'tags').split(',') if t.strip()][:10],
            'code': code, 'summary': summary, 'issue': int(NUM), 'added': datetime.date.today().isoformat(), 'needs': 'Luna Stream Interaction 0.2'}
    json.dump(meta, open(os.path.join(folder, 'meta.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    out = os.environ.get('GITHUB_OUTPUT')
    if out:
        with open(out, 'a') as f:
            f.write(f'id={rid}\n')
    print('accepted stream setup', rid)

if __name__ == '__main__':
    try:
        main()
    except (Refuse, urllib.error.URLError) as e:
        msg = str(e)
        print('REFUSED:', msg)
        try:
            api('POST', f'/issues/{NUM}/comments', {'body': f"Couldn't add this yet: **{msg}**.\n\nEdit the post to fix it, then a maintainer will approve it again."})
            api('DELETE', f'/issues/{NUM}/labels/approved')
            api('POST', f'/issues/{NUM}/labels', {'labels': ['needs-changes']})
        except Exception as e2:
            print('could not comment:', e2)
        sys.exit(1)
