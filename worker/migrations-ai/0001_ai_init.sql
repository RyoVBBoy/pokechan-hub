-- Game Kid/s AI（Stage A）専用データベース AI_DB の初期化。主DB（DB）とは別のD1に適用する。
-- 適用例（承認後のみ）: wrangler d1 migrations apply <AI_DBの名前> --local
-- 時刻はミリ秒、費用は整数のマイクロUSD。個人の識別子は AI 用の鍵で HMAC した uid_h だけを持つ。
CREATE TABLE IF NOT EXISTS ai_meta(k TEXT PRIMARY KEY, v TEXT NOT NULL);
INSERT OR IGNORE INTO ai_meta(k,v) VALUES('schema','1');

-- 1件の受付＝会員枠・同時枠・費用の予約をまとめた1行（uid_h, rid）。
-- state: reserved（予約）→ sent（提供元へ送る直前に記録）→ done（完了） / released（送る前に解放） / expired（送信後に期限切れ・費用は保持）
CREATE TABLE IF NOT EXISTS ai_requests(
  uid_h TEXT NOT NULL,
  rid TEXT NOT NULL,
  in_h TEXT NOT NULL,              -- 正規化した入力の鍵付きハッシュ（24時間後に空にする）
  plan TEXT NOT NULL CHECK(plan IN('free','paid_test')),
  day TEXT NOT NULL,               -- JST の日付 YYYY-MM-DD
  month TEXT NOT NULL,             -- JST の月 YYYY-MM
  state TEXT NOT NULL CHECK(state IN('reserved','sent','done','released','expired')),
  consumed INTEGER NOT NULL DEFAULT 0 CHECK(consumed IN(0,1)),
  max_micro INTEGER NOT NULL CHECK(max_micro>=0),
  cost_micro INTEGER NOT NULL CHECK(cost_micro>=0),
  cost_final INTEGER NOT NULL DEFAULT 0 CHECK(cost_final IN(0,1)),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  price_id TEXT NOT NULL,
  status TEXT,
  reason TEXT,
  resp TEXT,                       -- 同じ受付IDの再送に返す回答（質問文は含めない。24時間後に空にする）
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(uid_h,rid),
  CHECK(cost_micro<=max_micro),
  CHECK(consumed=0 OR state='done')
);
CREATE INDEX IF NOT EXISTS ai_req_month ON ai_requests(month);
CREATE INDEX IF NOT EXISTS ai_req_user ON ai_requests(uid_h,month,day);
CREATE INDEX IF NOT EXISTS ai_req_state ON ai_requests(state,updated_at);

-- 状態は決まった向きにしか進めない（完了したものを予約に戻す等を止める）
CREATE TRIGGER IF NOT EXISTS ai_req_transition BEFORE UPDATE OF state ON ai_requests
WHEN NOT (OLD.state=NEW.state
  OR (OLD.state='reserved' AND NEW.state IN('sent','released'))
  OR (OLD.state='sent' AND NEW.state IN('done','expired')))
BEGIN SELECT RAISE(ABORT,'ai_bad_transition'); END;
-- 確定した費用は増やさない（精算で減らすだけ）
CREATE TRIGGER IF NOT EXISTS ai_req_cost BEFORE UPDATE OF cost_micro ON ai_requests
WHEN OLD.state IN('done','expired') AND NEW.cost_micro>OLD.cost_micro
BEGIN SELECT RAISE(ABORT,'ai_cost_increase'); END;

-- 短時間の頻度制限（会員・IP・全体）。k は秘密鍵付きハッシュ、24時間以内に消す
CREATE TABLE IF NOT EXISTS ai_rate(k TEXT NOT NULL, win INTEGER NOT NULL, n INTEGER NOT NULL, exp INTEGER NOT NULL, PRIMARY KEY(k,win));
CREATE INDEX IF NOT EXISTS ai_rate_exp ON ai_rate(exp);

-- 会員の削除・90日の期限削除のあとも残す、匿名の月ごとの費用
CREATE TABLE IF NOT EXISTS ai_cost_archive(month TEXT PRIMARY KEY, micro INTEGER NOT NULL DEFAULT 0 CHECK(micro>=0));

-- 有料テスト権限（サーバーが管理。ブラウザーからは付けられない）
CREATE TABLE IF NOT EXISTS ai_entitlements(uid_h TEXT PRIMARY KEY, plan TEXT NOT NULL CHECK(plan IN('paid_test')), valid_to INTEGER, updated_at INTEGER NOT NULL);

-- 提供元の単価（マイクロUSD／100万トークン）と有効期間。Stage A は模擬アダプターのテスト値だけ
CREATE TABLE IF NOT EXISTS ai_prices(id TEXT PRIMARY KEY, provider TEXT NOT NULL, model TEXT NOT NULL,
  in_per_m INTEGER NOT NULL CHECK(in_per_m>=0), out_per_m INTEGER NOT NULL CHECK(out_per_m>=0),
  valid_from INTEGER NOT NULL, valid_to INTEGER);
INSERT OR IGNORE INTO ai_prices(id,provider,model,in_per_m,out_per_m,valid_from,valid_to)
  VALUES('mock-test-1','mock','mock-plan-1',100000,500000,0,NULL);
