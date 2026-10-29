// サイトの組み立て：src/ → dist/
//   - JS（src/js を order.json の順につなげる）と CSS を、中身に応じた名前（ハッシュ付き）で dist/assets/ に出す
//   - ファイル名が変わるので、ブラウザは古いキャッシュを使わず、変わっていないファイルは長く使い回せる
// 使い方: node tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);

const order = JSON.parse(fs.readFileSync(path.join(SRC, 'js/order.json'), 'utf8'));
const js = order.map(f => fs.readFileSync(path.join(SRC, 'js', f), 'utf8')).join('');
const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
const shell = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
// 公開してよい設定（Firebase のウェブ用の値など）を window.PC_CONFIG としてページに入れる
const cfgFile = path.join(ROOT, 'config/public.json');
const cfg = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, 'utf8')) : {};
const fb = cfg.firebase || {};
const pub = { firebase: fb.apiKey ? { apiKey: fb.apiKey, authDomain: fb.authDomain, projectId: fb.projectId, appId: fb.appId } : null, apple: !!cfg.apple };
const cfgTag = `<script>window.PC_CONFIG=${JSON.stringify(pub).replace(/</g, '\\u003c')};</script>`;

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
const jsName = `assets/app.${hash(js)}.js`, cssName = `assets/app.${hash(css)}.css`;
fs.writeFileSync(path.join(DIST, jsName), js);
fs.writeFileSync(path.join(DIST, cssName), css);
if (!shell.includes('__JS__') || !shell.includes('__CSS__')) throw new Error('src/index.html に __JS__ / __CSS__ がありません');
fs.writeFileSync(path.join(DIST, 'index.html'), shell.replace('<script src="__JS__"></script>', cfgTag + `<script src="${jsName}"></script>`).replace('__CSS__', cssName));

// 1ファイル版（オフラインで開いて確かめる用・従来の champions-hub.html と同じ形）
const single = shell.replace('<link rel="stylesheet" href="__CSS__">', `<style>${css}</style>`).replace('<script src="__JS__"></script>', cfgTag + `<script>${js}</script>`);
fs.writeFileSync(path.join(DIST, 'single.html'), single);

// _headers（Cloudflare Pages）：ハッシュ付きファイルは長くキャッシュ、HTMLは毎回確認
fs.writeFileSync(path.join(DIST, '_headers'), `/assets/app.*
  Cache-Control: public, max-age=31536000, immutable
/*.html
  Cache-Control: public, max-age=0, must-revalidate
/
  Cache-Control: public, max-age=0, must-revalidate
`);
console.log('built', jsName, (js.length / 1024).toFixed(0) + 'KB', cssName, (css.length / 1024).toFixed(0) + 'KB');
