"""ポケモン・技・特性・持ち物・性格・タイプの外国語の正式名を、PokeAPI の公開データ（CSV）から取り出して
src/js/02-names.js を作る。サイトで使っているものだけを入れる（ファイルを小さくするため）。

使い方:
  1) https://github.com/PokeAPI/pokeapi/tree/master/data/v2/csv から次の CSV を1つのフォルダに入れる
     pokemon_species_names pokemon_form_names pokemon_forms pokemon move_names ability_names abilities
     item_names items nature_names natures type_names
  2) python3 tools/gen-names.py <CSVのフォルダ>
言語を足すときは LANGS に足す（PokeAPI の言語番号：9=英語, 3=韓国語, 4=中国語繁体字, 12=中国語簡体字）。
公式の名前が PokeAPI にないもの（チャンピオンズで新しく出たメガシンカなど）は、組み合わせて作り、最後に一覧を出す。
"""
import csv, json, os, re, sys

LANGS = {'en': 9}
JA = (1, 11)  # ja-Hrkt, ja
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, 'src/js/02-data.js'), encoding='utf-8').read()
D = sys.argv[1]


def rows(name):
    with open(os.path.join(D, name + '.csv'), encoding='utf-8') as f:
        return list(csv.DictReader(f))


def block(name):
    m = re.search(r'const ' + name + r'=`(.*?)`', src, re.S)
    return [l.split(',') for l in m.group(1).strip().split('\n')]


def obj(name):
    return json.loads(re.search(r'const ' + name + r'=(\{.*?\});', src).group(1))


# サイトで使っているもの
mons = {int(a[0]): a[1] for a in block('RAWDATA') + block('SPX')}
megas = {int(a[0]): (a[1], int(a[10])) for a in block('MEGAP')}
moves = {int(k): v[0] for k, v in obj('MVX').items()}
abil = set(obj('ABJ').values())
items = set(obj('ITJ').values())
nats = re.findall(r"\['([^']+)',-?\d+,-?\d+\]", open(os.path.join(ROOT, 'src/js/10-editor.js'), encoding='utf-8').read())
types = re.search(r"const TC=(\{.*?\});", open(os.path.join(ROOT, 'src/js/01-types.js'), encoding='utf-8').read()).group(1)
types = re.findall(r":'([^']+)'", types)

poke = {int(r['id']): r for r in rows('pokemon')}
forms = rows('pokemon_forms')
fnames = rows('pokemon_form_names')
spn = rows('pokemon_species_names')
key = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
out, missing = {}, []
for lang, lid in LANGS.items():
    sp = {int(r['pokemon_species_id']): r['name'] for r in spn if int(r['local_language_id']) == lid}
    fn = {int(r['pokemon_form_id']): r['pokemon_name'] or '' for r in fnames if int(r['local_language_id']) == lid}
    def mon(no):
        p = poke.get(no)
        if not p: return None
        base = sp.get(int(p['species_id']))
        if no < 10000: return base
        f = next((x for x in forms if int(x['pokemon_id']) == no and x['is_default'] == '1'), None)
        return (f and fn.get(int(f['id']))) or None
    P = {}
    for no, ja in mons.items():
        n = mon(no)
        if not n:
            missing.append(f'{lang} ポケモン {no} {ja}'); continue
        P[no] = n
    for no, (ja, base) in megas.items():
        n = mon(no)
        if not n:  # チャンピオンズの新しいメガシンカ：Mega ＋ 元の名前（＋末尾の X/Y/Z）
            b = mon(base) or P.get(base)
            suf = re.search(r'([XYZ])$', ja)
            n = f'Mega {b}' + (f' {suf.group(1)}' if suf else '') if lang == 'en' and b else None
            missing.append(f'{lang} メガ {no} {ja} → {n}（組み立て）')
        if n: P[no] = n
    mn = {int(r['move_id']): r['name'] for r in rows('move_names') if int(r['local_language_id']) == lid}
    M = {i: mn[i] for i in moves if i in mn}
    missing += [f'{lang} 技 {i} {moves[i]}' for i in moves if i not in mn]
    aid = {r['identifier']: int(r['id']) for r in rows('abilities')}
    an = {int(r['ability_id']): r['name'] for r in rows('ability_names') if int(r['local_language_id']) == lid}
    A = {a: an[aid[a]] for a in abil if a in aid and aid[a] in an}
    missing += [f'{lang} 特性 {a}' for a in abil if a not in A]
    iid = {key(r['identifier']): int(r['id']) for r in rows('items')}
    inm = {int(r['item_id']): r['name'] for r in rows('item_names') if int(r['local_language_id']) == lid}
    It = {i: inm[iid[key(i)]] for i in items if key(i) in iid and iid[key(i)] in inm}
    missing += [f'{lang} 持ち物 {i}' for i in items if i not in It]
    nn = rows('nature_names')
    nja = {r['name']: int(r['nature_id']) for r in nn if int(r['local_language_id']) in JA}
    nl = {int(r['nature_id']): r['name'] for r in nn if int(r['local_language_id']) == lid}
    N = {j: nl[nja[j]] for j in nats if j in nja and nja[j] in nl}
    tn = rows('type_names')
    tja = {r['name']: int(r['type_id']) for r in tn if int(r['local_language_id']) in JA}
    tl = {int(r['type_id']): r['name'] for r in tn if int(r['local_language_id']) == lid}
    T = {j: tl[tja[j]] for j in types if j in tja and tja[j] in tl}
    missing += [f'{lang} タイプ {j}' for j in types if j not in T]
    out[lang] = {'p': P, 'm': M, 'a': A, 'i': It, 'n': N, 't': T}

js = ('/* ===================== 外国語の正式名（tools/gen-names.py で自動作成。手で直さない） =====================\n'
      '   出典：PokeAPI の公開データ。p=ポケモン（番号）, m=技（番号）, a=特性, i=持ち物, n=性格（日本語名から）, t=タイプ（日本語名から） */\n'
      'const NAMES=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(ROOT, 'src/js/02-names.js'), 'w', encoding='utf-8').write(js)
print('names', {l: {k: len(v) for k, v in d.items()} for l, d in out.items()}, len(js.encode()) // 1024, 'KB')
for m in missing: print('  ', m)
