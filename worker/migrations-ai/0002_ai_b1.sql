-- Game Kid/s AI Stage B1：会話の状態・呼び出しごとの使用量・自動停止。0001 のあとに当てる。
-- 会話の状態（認証した人・ゲーム・形式・版に結びつく短い構造化の状態。生の会話は持たない）。30分・6ターンまで
CREATE TABLE IF NOT EXISTS ai_conv(
  id TEXT PRIMARY KEY,               -- 推測できない番号（c＋32桁の16進）
  uid_h TEXT NOT NULL,
  game TEXT NOT NULL,
  fmt TEXT,
  ruleset TEXT,
  data_rev TEXT NOT NULL,
  state TEXT NOT NULL,               -- {constraints, candidates:[id], intent} だけ（質問文は入れない）
  turns INTEGER NOT NULL DEFAULT 0 CHECK(turns>=0 AND turns<=6),
  last_rid TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_conv_user ON ai_conv(uid_h);
CREATE INDEX IF NOT EXISTS ai_conv_exp ON ai_conv(expires_at);
-- 呼び出しごとの記録（提供元に実際に送った回数・トークン・費用・時間。質問文・答えの本文は持たない）
ALTER TABLE ai_requests ADD COLUMN calls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_requests ADD COLUMN usage_in INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_requests ADD COLUMN usage_out INTEGER NOT NULL DEFAULT 0;
-- over_micro：予約を超えた分（切り捨てずに残し、停止する）
ALTER TABLE ai_requests ADD COLUMN over_micro INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ai_requests ADD COLUMN latency_ms INTEGER;
ALTER TABLE ai_requests ADD COLUMN prompt_ver TEXT;
-- 自動停止（異常・費用の急増）。k='halt' に止める理由と期限
CREATE TABLE IF NOT EXISTS ai_halt(k TEXT PRIMARY KEY, reason TEXT NOT NULL, until INTEGER NOT NULL, at INTEGER NOT NULL);
UPDATE ai_meta SET v='2' WHERE k='schema';
