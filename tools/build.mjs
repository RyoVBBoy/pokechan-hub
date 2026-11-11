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
/* 文字サイズ（2026/11/11、src/js/71-fontsize.js）：文字の大きさ（font-size と font の大きさ）を「もとの大きさ × var(--fsk, 1)」に書きかえて出す。
   --fsk を変えるだけでサイト全体の文字がいっぺんに変わる（はじめは1なので見た目は同じ）。
   iPhone は16px未満の入力欄を押すと画面が拡大されるので、入力欄（input・textarea・select）の16px以上の大きさは16px未満にしない */
const fsScale = text => text.replace(/([^{}]*)\{([^{}]*)\}/g, (all, sel, body) => {
  const inp = /(^|[\s,>+~(])(input|textarea|select)\b/.test(sel.replace(/\/\*[\s\S]*?\*\//g, ''));
  const sz = px => { const k = `calc(${px}px * var(--fsk, 1))`; return inp && +px >= 16 ? `max(${px}px, ${k})` : k; };
  const b = body
    .replace(/(^|[;\s])font-size:\s*([\d.]+)px/g, (m, a, px) => `${a}font-size:${sz(px)}`)
    .replace(/(^|[;\s])font:([^;}]*?)(^|\s)([\d.]+)px(?=[\s/])/g, (m, a, pre, sp, px) => `${a}font:${pre}${sp}${sz(px)}`);
  return `${sel}{${b}}`;
});
const css = fsScale(fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8'));
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

// 1ファイル版（オフラインで開いて確かめる用）。公開しない（中に大きなスクリプトがあり、下のセキュリティの決まりに合わないため）＝ out/ に置く
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
const single = shell.replace('<link rel="stylesheet" href="__CSS__">', `<style>${css}</style>`).replace('<script src="__JS__"></script>', cfgTag + `<script>${js}</script>`);
fs.writeFileSync(path.join(ROOT, 'out/single.html'), single);

// src/static の中身（通知の受け取り sw.js・ホーム画面用の manifest とアイコン）はそのまま dist に置く
const ST = path.join(SRC, 'static');
if (fs.existsSync(ST)) for (const f of fs.readdirSync(ST)) fs.copyFileSync(path.join(ST, f), path.join(DIST, f));

// _headers（Cloudflare Pages）：キャッシュ＋セキュリティの決まり（2026/11/05 セキュリティ対策）
//   /__/（Firebase のログインの窓口を取り次ぐ所）は Firebase 自身の決まりで動くので、ここの決まりを外す（自分のページの中に埋め込まれるため）
//   CSP＝このページが読み込んでよい場所の一覧。書かれていない場所のスクリプト・通信・埋め込みはブラウザが止める（XSS の被害を小さくする最後の壁）
//   ページの中に直接書いたスクリプトは PC_CONFIG の1つだけで、その中身の指紋（sha256）だけを許す
const sha = s => crypto.createHash('sha256').update(s).digest('base64');
const cfgHash = `'sha256-${sha(cfgTag.replace(/^<script>|<\/script>$/g, ''))}'`;
const API = 'https://pokechan-tap.pokechan.workers.dev';
const CSP = [
  "default-src 'self'",
  `script-src 'self' ${cfgHash} https://www.gstatic.com https://apis.google.com https://cdn.jsdelivr.net 'wasm-unsafe-eval'`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  `img-src 'self' data: blob: ${API}`,
  `connect-src 'self' ${API} https://*.googleapis.com https://www.gstatic.com https://apis.google.com https://championsbattledata.com https://cdn.jsdelivr.net`,
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
  "frame-src 'self' https://pokechan-hub.firebaseapp.com https://accounts.google.com https://apis.google.com",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests'
].join('; ');
const SEC = `  Content-Security-Policy: ${CSP}
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin-allow-popups
  Cross-Origin-Resource-Policy: same-origin
  X-Permitted-Cross-Domain-Policies: none
`;
fs.writeFileSync(path.join(DIST, '_headers'), `/*
${SEC}/__/*
  ! Content-Security-Policy
  ! X-Frame-Options
  ! Cross-Origin-Resource-Policy
  ! Cross-Origin-Opener-Policy
/sw.js
  Cache-Control: public, max-age=0, must-revalidate
/assets/app.*
  Cache-Control: public, max-age=31536000, immutable
/*.html
  Cache-Control: public, max-age=0, must-revalidate
/
  Cache-Control: public, max-age=0, must-revalidate
`);
fs.writeFileSync(path.join(ROOT, 'out/csp.txt'), CSP);
console.log('built', jsName, (js.length / 1024).toFixed(0) + 'KB', cssName, (css.length / 1024).toFixed(0) + 'KB');
