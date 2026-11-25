"""Game Kid/s AI（Stage A）の根拠台帳を、サイトのデータ（src/js）から作って検査する。

worker/build.py から呼ぶ。台帳は項目ごとの根拠レコード（evidenceId・scope・entityId・field・typedValue・
sourceType・sourceRef・checkedAt・validFrom・validTo・status）。出典の段階は 17-sources.js の SRC と
VERIFIED_BAKED（組み込み済みの確認結果）だけから決める。ブラウザーの localStorage（pcverify）による昇格は使わない。
検査：スキーマ・ID の重複・出典の参照切れ・値の型・SRC との食い違い。どれかが合わなければ組み立てを止める。
"""
import hashlib, json, re

GAME = 'pokechamp'
SOURCE_TYPES = ('official', 'ingame', 'external_match', 'external_single', 'site_calc', 'site_aggregate', 'site_estimate')
STATUSES = ('active', 'unverified', 'conflict', 'expired')
LV_TO_TYPE = {'official': 'official', 'ingame': 'ingame', 'multi': 'external_match', 'single': 'external_single', 'unverified': 'external_single'}
FIELDS = {
    'species': {'name': str, 'name_en': str, 'types': list, 'stats': list, 'abilities': list, 'learnset': list, 'megas': list, 'mega_of': int, 'mega_stone': str},
    'move': {'name': str, 'name_en': str, 'type': str, 'power': int, 'accuracy': int, 'category': str, 'priority': int, 'hits': list},
    'ability': {'name': str, 'name_en': str},
    'rule': {'sp_cap': dict, 'stat_formula': dict, 'level': int},
    'ruleset': {'period': dict},
}
ALLOWED_LINK = re.compile(r'^https://(pokeapi\.co|github\.com/smogon|championsbattledata\.com)(/|$)')


def _src_manifest(s):
    """17-sources.js の SRC から、出典ごとの段階・日付・リンクを読む"""
    m = re.search(r'const SRC=\{(.*?)\n\};', s, re.S)
    if not m: raise Exception('AI台帳: SRC が見つかりません')
    out = {}
    for blk in re.finditer(r"\n (\w+):\{name:'([^']*)',lv:'(\w+)',date:'([^']*)'(.*?)note:", m.group(1), re.S):
        sid, name, lv, date, rest = blk.groups()
        sm = re.search(r'src:\[(.*)\]', rest, re.S)
        links = re.findall(r"\['([^']*)',(?:'([^']*)'|null)\]", sm.group(1) if sm else '')
        out[sid] = {'id': sid, 'name': name, 'lv': lv, 'date': date.replace('/', '-') or None,
                    'refs': [{'name': n, 'url': u or None} for n, u in links]}
    for need in ('stats', 'learn', 'movedata', 'typechart', 'formula', 'regulation', 'calc'):
        if need not in out: raise Exception('AI台帳: SRC.' + need + ' を読めません')
    for v in out.values():
        if v['lv'] not in LV_TO_TYPE: raise Exception('AI台帳: 知らない確認段階 ' + v['lv'])
        for r in v['refs']:
            if r['url'] and not ALLOWED_LINK.match(r['url']): raise Exception('AI台帳: 許可していないリンク ' + r['url'])
    return out


def _baked(s):
    m = re.search(r'const VERIFIED_BAKED=(\{[^;\n]*\});', s)
    if not m: raise Exception('AI台帳: VERIFIED_BAKED が見つかりません')
    t = re.sub(r"([{,])(\w+):", r'\1"\2":', m.group(1)).replace("'", '"')
    return {int(k): v for k, v in json.loads(t).items()}


def build(s, eng, tc):
    src = _src_manifest(s)
    baked = _baked(s)
    raw = re.search(r'const RAWDATA=`(.*?)`', s, re.S).group(1).strip().split('\n')
    megap = re.search(r'const MEGAP=`(.*?)`', s, re.S).group(1).strip().split('\n')
    est = re.search(r'const LS_EST=new Set\(\[([^\]]*)\]\)', s).group(1)
    ls_est = {int(x) for x in re.findall(r'\d+', est)}
    names = json.loads(re.search(r'const NAMES=(\{.*?\});\n', s, re.S).group(1))['en']
    MV, LSD, ABD, ABN, MD = eng['MV'], eng['LSD'], eng['ABD'], eng['ABN'], eng['MD']
    recs, ents = [], {}

    def add(kind, ent, field, val, sid, st_type=None, checked=None, status='active', scope=None):
        S = src[sid]
        r = {'evidenceId': ent + '#' + field, 'scope': scope or {'gameId': GAME, 'rulesetId': None, 'format': 'formatIndependent'},
             'entityId': ent, 'field': field, 'typedValue': val, 'sourceType': st_type or LV_TO_TYPE[S['lv']],
             'sourceRef': 'src:' + sid, 'checkedAt': checked or S['date'], 'validFrom': checked or S['date'], 'validTo': None,
             'status': 'unverified' if S['lv'] == 'unverified' and status == 'active' else status, 'kind': kind}
        recs.append(r)

    def ent(kind, eid, label, aliases, extra=None):
        ents[eid] = {'kind': kind, 'id': eid, 'label': label, 'aliases': sorted({a for a in aliases if a}), **(extra or {})}

    for l in raw:
        a = l.split(','); no = int(a[0]); eid = 'sp:%d' % no
        types = [tc[c] for c in a[2]]; stats = [int(x) for x in a[3:9]]
        base = re.sub(r'（.*$', '', a[1])
        en = names['p'].get(str(no))
        ent('species', eid, a[1], [a[1], en], {'base': base, 'no': no})
        add('species', eid, 'name', a[1], 'learn')
        if en: add('species', eid, 'name_en', en, 'learn')
        b = baked.get(no, {})
        ok_t, ok_s = b.get('t') == 1, b.get('s') == 1
        bad_t, bad_s = b.get('t') == 0, b.get('s') == 0
        add('species', eid, 'types', types, 'stats', 'ingame' if ok_t else None, b.get('d') if ok_t else None, 'conflict' if bad_t else 'active')
        add('species', eid, 'stats', stats, 'stats', 'ingame' if ok_s else None, b.get('d') if ok_s else None, 'conflict' if bad_s else 'active')
        ab = ABD.get(str(no)) or []
        add('species', eid, 'abilities', [[k, int(h)] for k, h in ab], 'learn')
        ls = LSD.get(str(no))
        if ls: add('species', eid, 'learnset', sorted(int(x) for x in ls[1]), 'learn', 'site_estimate' if no in ls_est else None)
    for l in megap:
        a = l.split(','); no = int(a[0]); eid = 'sp:%d' % no
        types = [tc[c] for c in a[2]]; stats = [int(x) for x in a[3:9]]
        ent('species', eid, a[1], [a[1], names['p'].get(str(no))], {'base': a[1], 'no': no, 'mega': True, 'megaOf': int(a[10])})
        add('species', eid, 'name', a[1], 'learn')
        add('species', eid, 'types', types, 'stats')
        add('species', eid, 'stats', stats, 'stats')
        add('species', eid, 'abilities', [[a[11], 0]], 'learn')
        add('species', eid, 'mega_of', int(a[10]), 'learn')
        add('species', eid, 'mega_stone', a[9], 'learn')
    megs = {}
    for l in megap:
        a = l.split(','); megs.setdefault(int(a[10]), []).append(int(a[0]))
    for base, lst in megs.items():
        if 'sp:%d' % base in ents: add('species', 'sp:%d' % base, 'megas', sorted(lst), 'learn')
    for k, d in MD.items():
        mid = int(k); eid = 'mv:%d' % mid; en = names['m'].get(k)
        ent('move', eid, d[0], [d[0], en], {'no': mid})
        add('move', eid, 'name', d[0], 'movedata')
        if en: add('move', eid, 'name_en', en, 'movedata')
        v = MV.get(k)
        if v:
            add('move', eid, 'type', v[1], 'movedata')
            if (v[2] or 0) > 0: add('move', eid, 'power', int(v[2]), 'movedata')
            if v[3] and v[3] > 0: add('move', eid, 'accuracy', int(v[3]), 'movedata')
            add('move', eid, 'category', '物理' if v[4] == 0 else '特殊', 'movedata')
            add('move', eid, 'priority', int(v[5]), 'movedata')
            add('move', eid, 'hits', [int(v[7] or 1), int(v[8] or 1)], 'movedata')
    for k, n in ABN.items():
        eid = 'ab:' + k
        ent('ability', eid, n, [n, names['a'].get(k)], {'key': k})
        add('ability', eid, 'name', n, 'learn')
    ent('rule', 'rule:stats', '能力ポイント・実数値', ['能力ポイント', 'ap', 'sp', '努力値'])
    add('rule', 'rule:stats', 'sp_cap', {'total': 66, 'per': 32}, 'formula')
    add('rule', 'rule:stats', 'stat_formula', {'hp': '種族値+ポイント+75', 'other': '(種族値+ポイント+20)×性格補正（1.1倍・0.9倍、切り捨て）'}, 'formula')
    add('rule', 'rule:stats', 'level', 50, 'formula')
    ent('ruleset', 'rs:M-C', 'レギュレーション M-C', ['M-C', 'mc'])
    add('ruleset', 'rs:M-C', 'period', {'from': '2026-09-09', 'to': None}, 'regulation',
        scope={'gameId': GAME, 'rulesetId': 'M-C', 'format': 'formatIndependent'})
    check(recs, ents, src)
    body = json.dumps({'recs': recs, 'ents': ents, 'src': src}, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    rev = 'd' + hashlib.sha256(body.encode()).hexdigest()[:12]
    return {'recs': recs, 'ents': ents, 'src': src, 'dataRevision': rev,
            'manifest': {'gameId': GAME, 'rulesets': [{'id': 'M-C', 'validFrom': '2026-09-09', 'validTo': None, 'status': 'unverified', 'sourceRef': 'src:regulation'}],
                         'patches': [], 'patchStatus': 'unverified', 'current': 'M-C'}}


def check(recs, ents, src):
    seen = set()
    for r in recs:
        for k in ('evidenceId', 'scope', 'entityId', 'field', 'typedValue', 'sourceType', 'sourceRef', 'checkedAt', 'validFrom', 'validTo', 'status'):
            if k not in r: raise Exception('AI台帳: 項目がありません %s %s' % (k, r.get('evidenceId')))
        if r['evidenceId'] in seen: raise Exception('AI台帳: ID が重複 ' + r['evidenceId'])
        seen.add(r['evidenceId'])
        if r['entityId'] not in ents: raise Exception('AI台帳: 参照切れ（対象） ' + r['evidenceId'])
        if r['sourceRef'][4:] not in src: raise Exception('AI台帳: 参照切れ（出典） ' + r['evidenceId'])
        if r['sourceType'] not in SOURCE_TYPES or r['status'] not in STATUSES: raise Exception('AI台帳: 種別が不正 ' + r['evidenceId'])
        sc = r['scope']
        if sc.get('gameId') != GAME or sc.get('format') not in ('formatIndependent', 'single', 'double'): raise Exception('AI台帳: スコープが不正 ' + r['evidenceId'])
        typ = FIELDS[r['kind']].get(r['field'])
        if typ is None or not isinstance(r['typedValue'], typ) or (typ is int and isinstance(r['typedValue'], bool)):
            raise Exception('AI台帳: 値の型が不正 ' + r['evidenceId'])
        if not r['checkedAt'] or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', r['checkedAt']): raise Exception('AI台帳: 確認日がありません ' + r['evidenceId'])
    for e in ents.values():
        if not e['aliases']: raise Exception('AI台帳: 名前がありません ' + e['id'])
    for r in recs:
        if r['field'] in ('learnset',):
            for m in r['typedValue']:
                if 'mv:%d' % m not in ents: raise Exception('AI台帳: 参照切れ（技） %s %d' % (r['evidenceId'], m))
        if r['field'] == 'megas':
            for m in r['typedValue']:
                if 'sp:%d' % m not in ents: raise Exception('AI台帳: 参照切れ（メガ） ' + r['evidenceId'])
        if r['field'] == 'abilities':
            for k, _ in r['typedValue']:
                if 'ab:' + k not in ents: raise Exception('AI台帳: 参照切れ（特性） %s %s' % (r['evidenceId'], k))


def compact(L):
    """Worker に埋め込む小さい形。展開は ai.js の aiLedgerLoad（同じ項目に戻す）"""
    st = list(SOURCE_TYPES); ss = list(STATUSES)
    rows = []
    for r in L['recs']:
        rows.append([r['entityId'], r['field'], r['typedValue'], st.index(r['sourceType']), r['sourceRef'][4:], r['checkedAt'],
                     ss.index(r['status']), r['scope']['rulesetId'] or 0, r['kind']])
    ents = {k: [v['kind'], v['label'], v['aliases'], {x: y for x, y in v.items() if x not in ('kind', 'id', 'label', 'aliases')}] for k, v in L['ents'].items()}
    return {'st': st, 'ss': ss, 'r': rows, 'e': ents, 'src': L['src'], 'rev': L['dataRevision'], 'man': L['manifest']}
