"""サーバー（Cloudflare Worker）の組み立て： worker/src/ ＋ サイトの計算部分 → worker/dist/worker.js

サイト（src/js）から、選出の計算に使う関数とデータをそのまま取り出して埋め込む。
サイトの計算を直せば、サーバーの計算も自動で同じになる。
使い方: python3 worker/build.py
"""
import json, os, re

W = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(W)
SRC = os.path.join(W, 'src')
order = json.load(open(os.path.join(ROOT, 'src/js/order.json'), encoding='utf-8'))
s = ''.join(open(os.path.join(ROOT, 'src/js', f), encoding='utf-8').read() for f in order)

# 取り込む関数・定数（この順に並べる）
NAMES = ('PICK LEADN FMTDIR stgM natM calcStats mvObj PROT ABSORB PINCH SKIN WSET WSPD ABIMPL ITEMN ITEMT STI nrm rnd wpick '
         'chooseSet buildSet digest MDK mkey WT wtOf MCHG MRECH MSELFKO MFIRST MFAIL MCOND MCOUNT simF varPow fixedDmg hitType '
         'pR chM apM stgV MEGA MEGAP isStone megaOf megasOf itemFor MFL mfl bcalc accOf estHit combos analyze effSpd mkMon').split()
DATA = ['MV', 'LSD', 'ABD', 'MVK', 'ABK', 'ABN']


def stmt_end(i):
    d = 0; q = None; j = i
    while j < len(s):
        c = s[j]
        if q:
            if c == '\\': j += 2; continue
            if c == q: q = None
        elif c in '"\'`': q = c
        elif c in '([{': d += 1
        elif c in ')]}':
            d -= 1
            if d == 0 and c == '}' and s[i:i + 8] == 'function': return j + 1
        elif c == ';' and d == 0: return j + 1
        elif c == '\n' and d == 0 and s[i:i + 8] != 'function': return j
        j += 1
    raise Exception('noend')


def get(name):
    m = re.search(r'(?m)^(?:(?:const |let )?' + re.escape(name) + r'=|function ' + re.escape(name) + r'\()', s)
    if not m:
        m = re.search(r'(?:const |let |;)' + re.escape(name) + r'=', s)
        if not m: raise Exception('サイトに見つかりません: ' + name)
        st = m.start() + (1 if s[m.start()] == ';' else 0)
    else:
        st = m.start()
    t = s[st:stmt_end(st)]
    if not t.startswith(('const', 'let', 'function')): t = 'const ' + t
    return t


def obj(name, pat=None):
    m = re.search(pat or (r'const ' + name + r'=(\{.*?\});\n'), s, re.S)
    if not m: raise Exception('データが見つかりません: ' + name)
    return json.loads(m.group(1))


funcs = '\n'.join(get(n) for n in NAMES)
eng = {k: obj(k) for k in DATA}
eng['MVE'] = obj('MVE', r'MVE=(\{.*?\});')
sp = open(os.path.join(SRC, 'species.txt'), encoding='utf-8').read()
raw, tc = open(os.path.join(SRC, 'chart.txt'), encoding='utf-8').read().split('\n')
code = open(os.path.join(SRC, 'worker_src.js'), encoding='utf-8').read()
cfgp = os.path.join(ROOT, 'config/public.json')
cfg = json.load(open(cfgp, encoding='utf-8')) if os.path.exists(cfgp) else {}
fb_pid = ((cfg.get('firebase') or {}).get('projectId') or '').strip()
if not re.fullmatch(r'[a-z0-9-]{0,40}', fb_pid): raise Exception('config/public.json の projectId の形が正しくありません')
code = (code.replace('__COMMUNITY__', open(os.path.join(SRC, 'auth.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'community.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'social.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'push.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'media.js'), encoding='utf-8').read())
        .replace('__ENGDATA__', json.dumps(eng, ensure_ascii=False, separators=(',', ':')))
        .replace('__ENGFUNCS__', funcs)
        .replace('__FIREBASE_PROJECT_ID__', fb_pid)
        .replace('__SPECIES__', sp.replace('`', '')).replace('__RAW__', raw).replace('__TC__', tc))
os.makedirs(os.path.join(W, 'dist'), exist_ok=True)
open(os.path.join(W, 'dist/worker.js'), 'w', encoding='utf-8').write(code)
# dist の中の .js を ES モジュールとして扱う（テストで読み込むため）
open(os.path.join(W, 'dist/package.json'), 'w').write('{"type":"module"}\n')
print('worker', len(code.encode()) // 1024, 'KB')
