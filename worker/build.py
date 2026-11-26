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
NAMES = ('PICK LEADN FMTDIR stgM natM calcStats mvObj PROT ABSORB PINCH SKIN WSET WSPD ABIMPL ITEMN ITEMT RES_BERRY STI nrm rnd wpick '
         'LF_BIND LF_CHOICE_OK LF_KEY lfId lfAtk lfDrain lfReq liveFit chooseSet buildSet digest MDK mkey WT wtOf MCHG MRECH MSELFKO MFIRST MFAIL MCOND MCOUNT simF varPow fixedDmg hitType '
         'pR chM apM stgV disgLoss mhCount bhits hitDist dmgRolls koInfo MEGA MEGAP isStone megaOf megasOf itemFor MFL mfl bcalc accOf wxPair withWx estHit0 estHit combos analyze effSpd BATTLE_FORM mkMon').split()
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
import hashlib, sys
sys.path.insert(0, W)
import ai_ledger
eng = {k: obj(k) for k in DATA}
eng['MVE'] = obj('MVE', r'MVE=(\{.*?\});')
# 技の名前（変化技も入れた全部の技。MV は攻撃技だけ）：対戦の振り返りで相手が使った「まもる」等も番号にするため
eng['MVN'] = {k: v[0] for k, v in obj('MD').items()}
sp = open(os.path.join(SRC, 'species.txt'), encoding='utf-8').read()
raw, tc = open(os.path.join(SRC, 'chart.txt'), encoding='utf-8').read().split('\n')

# ---- Game Kid/s AI（Stage A）：根拠台帳・計算のリビジョン・計算で名前で特別扱いされるもの ----
_tcd = json.loads(tc.replace("'", '"'))
_nd = json.load(open(os.path.join(W, 'ai-field-sources.json'), encoding='utf-8'))['_names_date']
ledger = ai_ledger.build(s, {**eng, 'MD': obj('MD')}, _tcd, _nd)
# 計算に使う species.txt の種族値・タイプが、台帳（サイトの RAWDATA）と同じか
_spx = {int(l.split(',')[0]): l.split(',') for l in sp.strip().split('\n')}
_chk = 0
for r in ledger['recs']:
    if r['kind'] != 'species' or r['field'] not in ('types', 'stats'): continue
    row = _spx.get(int(r['entityId'][3:]))
    if row is None:
        if int(r['entityId'][3:]) < 10000: raise Exception('AI台帳: species.txt にありません ' + r['entityId'])
        continue   # メガの姿は species.txt ではなく MEGAP（サイトと同じもの）を計算に使う
    v = [_tcd[c] for c in row[2]] if r['field'] == 'types' else [int(x) for x in row[3:9]]
    if v != r['typedValue']: raise Exception('AI台帳: species.txt とサイトのデータが違います ' + r['evidenceId'])
    _chk += 1
CALC_FN = ('mkMon bcalc bhits hitDist mhCount varPow fixedDmg hitType dmgRolls koInfo ABSORB PINCH SKIN WSET WSPD ABIMPL BATTLE_FORM MCHG MRECH MSELFKO MFIRST MFAIL MCOND MCOUNT disgLoss stgV apM chM pR').split()
calc_src = '\n'.join(get(n) for n in CALC_FN)
engine_rev = 'e' + hashlib.sha256(calc_src.encode()).hexdigest()[:12]
special = sorted(set(re.findall(r"['\"]([a-z][a-z0-9-]{2,30})['\"]", calc_src)) | set(re.findall(r"(?<![\w'\"-])([a-z][a-z0-9-]{2,30})(?=\s*:)", calc_src)))
_ai = open(os.path.join(SRC, 'ai.js'), encoding='utf-8').read()
# B1：確かめたレギュレーションの記録（公式の資料のアドレス・期間・形式）。形が違えば組み立てを止める
_rs = json.load(open(os.path.join(W, 'ai-rulesets.json'), encoding='utf-8'))
_OFF = ('pokemonchampions.jp', 'pokemonchampions.com', 'pokemon.co.jp', 'pokemon.com', 'nintendo.co.jp', 'nintendo.com', 'pokemon-home.com')
if not isinstance(_rs, list): raise Exception('AI: ai-rulesets.json は配列')
for r in _rs:
    for k in ('id', 'game', 'formats', 'from', 'officialUrl', 'checkedAt'):
        if k not in r: raise Exception('AI: ruleset に ' + k + ' がありません: ' + json.dumps(r, ensure_ascii=False))
    h = re.match(r'^https://([^/]+)/', r['officialUrl'])
    if not h or not any(h.group(1) == d or h.group(1).endswith('.' + d) for d in _OFF): raise Exception('AI: ruleset の officialUrl が公式のアドレスではありません: ' + r['officialUrl'])
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', r['from']) or (r.get('to') and not re.match(r'^\d{4}-\d{2}-\d{2}$', r['to'])): raise Exception('AI: ruleset の期間の形が違います')
    if not r['formats'] or any(f not in ('single', 'double') for f in r['formats']): raise Exception('AI: ruleset の形式が違います')
_ai = open(os.path.join(SRC, 'ai_fair.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'ai_b1.js'), encoding='utf-8').read().replace('__AI_RULESETS__', json.dumps(_rs, ensure_ascii=False, separators=(',', ':'))) + '\n' + _ai
_ok = re.search(r'AI_CALC_ABILITY_OK=new Set\(\[(.*?)\]\)', _ai, re.S).group(1)
_okk = re.findall(r"'([a-z-]+)'", _ok)
_bad = [k for k in _okk if k in special or k not in eng['ABN']]
if _bad: raise Exception('AI: 計算に影響する／存在しない特性が許可表にあります: ' + ' '.join(_bad))
_ai = (_ai.replace('__AI_LEDGER__', json.dumps(ai_ledger.compact(ledger), ensure_ascii=False, separators=(',', ':')))
       .replace('__AI_ENGINE_REV__', engine_rev).replace('__AI_CALC_SPECIAL__', json.dumps(special)))
code = open(os.path.join(SRC, 'worker_src.js'), encoding='utf-8').read()
cfgp = os.path.join(ROOT, 'config/public.json')
cfg = json.load(open(cfgp, encoding='utf-8')) if os.path.exists(cfgp) else {}
fb_pid = ((cfg.get('firebase') or {}).get('projectId') or '').strip()
if not re.fullmatch(r'[a-z0-9-]{0,40}', fb_pid): raise Exception('config/public.json の projectId の形が正しくありません')
code = (code.replace('__COMMUNITY__', open(os.path.join(SRC, 'auth.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'community.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'social.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'dm.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'push.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'media.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'ladder.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'collect.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'replay.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'usage.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'hits.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'news.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'contact.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'rankbot.js'), encoding='utf-8').read() + '\n' + open(os.path.join(SRC, 'tips.js'), encoding='utf-8').read() + '\n' + _ai)
        .replace('__ENGDATA__', json.dumps(eng, ensure_ascii=False, separators=(',', ':')))
        .replace('__ENGFUNCS__', funcs)
        .replace('__FIREBASE_PROJECT_ID__', fb_pid)
        .replace('__SPECIES__', sp.replace('`', '')).replace('__RAW__', raw).replace('__TC__', tc))
os.makedirs(os.path.join(W, 'dist'), exist_ok=True)
open(os.path.join(W, 'dist/worker.js'), 'w', encoding='utf-8').write(code)
# テスト用：同じ中身に、AI の内部の関数を取り出す口を付けたもの（公開しない）
open(os.path.join(W, 'dist/worker_test.js'), 'w', encoding='utf-8').write(code + '\nexport const __ai={aiLedger,aiLedgerFrom,aiMakeAdapter,aiNorm,aiRoles,aiFindEntities,aiCalc,aiCalcCheck,aiUsage,aiCheckPlan,aiVerify,aiCompose,aiReserve,aiFinish,aiSettle,aiPurge,aiForgetUser,aiHmac,aiDay,aiMonth,aiResets,aiCfg,AI_ADAPTERS,AI_PROVIDERS,MockProvider,aiComposeB1,aiPublicTeams,aiFairPlay,aiFpNext,ladderInit,ladderSig,MDK,MVN,megaOf,isStone,aiRuleset,AI_RULESETS,OpenAIProvider,aiOpenAICall,aiRedact,aiConvLoad,aiConvSave,aiHalt,aiHalted,aiBreaker,aiProviderFor,aiB1Constraints,aiTeamStyles,aiReserveMore,aiCost,aiPrice,AI_LIMITS,AI_OPENAI_URL,AI_PROMPT_VERSION,AI_ENGINE_REV,AI_CALC_SPECIAL,AI_CALC_ABILITY_OK,byNo,mkMon,dmgRolls,koInfo};\n')
open(os.path.join(W, 'dist/ai_meta.json'), 'w', encoding='utf-8').write(json.dumps({'dataRevision': ledger['dataRevision'], 'engineRevision': engine_rev, 'records': len(ledger['recs']), 'entities': len(ledger['ents']), 'special': len(special), 'specialList': special}, ensure_ascii=False))
print('AI ledger', len(ledger['recs']), 'records', ledger['dataRevision'], engine_rev)
# dist の中の .js を ES モジュールとして扱う（テストで読み込むため）
open(os.path.join(W, 'dist/package.json'), 'w').write('{"type":"module"}\n')
print('worker', len(code.encode()) // 1024, 'KB')
