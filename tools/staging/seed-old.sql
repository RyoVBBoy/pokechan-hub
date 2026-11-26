-- ステージングの D1（gk-links-staging）に、前の版の表と合成の行を入れる（tests/staging-remote.mjs の移しかえの確かめ用）。本番では使わない。
CREATE TABLE users(uid TEXT PRIMARY KEY,handle TEXT UNIQUE COLLATE NOCASE,name TEXT,bio TEXT,created_at INTEGER,updated_at INTEGER,agreed_at INTEGER,banned INTEGER DEFAULT 0);
CREATE TABLE notes(id INTEGER PRIMARY KEY AUTOINCREMENT,uid TEXT NOT NULL,body TEXT,media TEXT,created_at INTEGER,likes INTEGER DEFAULT 0,hidden INTEGER DEFAULT 0,ip TEXT);
INSERT INTO users(uid,handle,name,created_at,banned) VALUES('old','oldone','Old',1,0),('ban','banned1','B',1,1);
INSERT INTO notes(uid,body,created_at,ip) VALUES('old','前の版の投稿',1,''),('ban','停止中の人',2,'');
CREATE TABLE note_links(note_id INTEGER PRIMARY KEY,uid TEXT NOT NULL,url TEXT NOT NULL,host TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',verdict TEXT,verdict_at INTEGER,expires_at INTEGER,created_at INTEGER,updated_at INTEGER);
CREATE TABLE fb_sync(uid TEXT PRIMARY KEY,gen INTEGER NOT NULL DEFAULT 1,done_gen INTEGER NOT NULL DEFAULT 0,owned INTEGER NOT NULL DEFAULT 0,prior INTEGER,intent TEXT,intent_gen INTEGER,lease TEXT,lease_until INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL DEFAULT 0,dead INTEGER NOT NULL DEFAULT 0,last_want TEXT,checked_at INTEGER,created_at INTEGER,updated_at INTEGER,unknown INTEGER NOT NULL DEFAULT 0,unk_intent TEXT,unk_op TEXT);
INSERT INTO fb_sync(uid,gen,done_gen,owned,intent,intent_gen,lease,lease_until,updated_at) VALUES('m1',2,1,1,'disable',2,'oldlease',5,5);
INSERT INTO fb_sync(uid,gen,done_gen,owned,intent,intent_gen,unknown,unk_intent,unk_op,updated_at) VALUES('m2',3,2,1,'disable',3,1,'disable','oldop',6);
INSERT INTO fb_sync(uid,gen,done_gen,checked_at) VALUES('m3',1,1,9999999999999);
CREATE TABLE link_budget(id TEXT PRIMARY KEY,day TEXT NOT NULL DEFAULT '',dn INTEGER NOT NULL DEFAULT 0,month TEXT NOT NULL DEFAULT '',mn INTEGER NOT NULL DEFAULT 0);
INSERT INTO link_budget VALUES('webrisk','2026-11-26',50,'2026-11',1200);
