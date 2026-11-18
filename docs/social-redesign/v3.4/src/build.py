"""V3.4 プレイヤーカードの見本を1つのファイルにまとめる。
使い方（リポジトリの一番上で）: python3 docs/social-redesign/v3.4/src/build.py
src/static/logo.png（サイトのロゴ）を埋め込み、docs/social-redesign/v3.4/index.html を作る。"""
import base64, pathlib

here = pathlib.Path(__file__).resolve().parent
root = here.parents[3]
logo = base64.b64encode((root / 'src/static/logo.png').read_bytes()).decode()
html = (here / 'card.template.html').read_text(encoding='utf-8').replace('__LOGO__', 'data:image/png;base64,' + logo)
(here.parent / 'index.html').write_text(html, encoding='utf-8')
print('wrote', here.parent / 'index.html', len(html), 'bytes')
