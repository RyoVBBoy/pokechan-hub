// プレイヤーカード（#/u/ID）の見本の人（テストとレビュー用だけ。本番のデータではない）。
// /api/u/:handle の返事と同じ形。見せてよい範囲はサーバーが決めた結果として書く（見られない人には games:{}・results:[]）。
const D=(y,m)=>new Date(y,m-1,15).getTime();
const R=(season,fmt,rank,source,rate=null)=>({season,game:'pokechamp',fmt,rank,rate,source,verified:source==='verified'});
const base={bio:'',av:null,followers:0,following:0,notes:0,followed:false,follows_me:false,requested:false,private:false,locked:false,me:false,partner:null,showcase:null,results:[],games:{}};
/* created＝ゲームカードを作った（サーバーの games.pokechamp.created） */
/* card＝見ている人がカードを見られる（アイコンの輪）。created が false ならどちらも出さない */
const G=(u,extra={})=>{const g={created:true,partner:u.partner,showcase:u.showcase,results:u.results,...extra};return{...u,...(g.created?{card:true}:{}),games:{pokechamp:g}}};
const VR=[R('S6','single',8,'verified'),R('S5','double',46,'verified'),R('S4','single',120,'verified'),R('S3','single',512,'verified')];
const SR=[R('S6','double',230,'self'),R('S2','single',34,'self')];
const SC={n:'ガブサーフ対面',t:[445,1000,149,730,59,823]};
export const PCARD_USERS={
  /* 公開アカウント・確認済み＋自己申告・相棒・看板パーティ（訪問者として見る） */
  ren:G({...base,handle:'ren',name:'レン',bio:'シングル中心。サイクルより対面が好きです。#構築紹介 をよく書きます。',created_at:D(2025,12),
    notes:128,followers:342,following:96,follows_me:true,partner:445,showcase:SC,results:[...VR,...SR]}),
  /* 非公開アカウント・フォローしていない人が見る（サーバーは自己紹介・ゲーム・戦績を送らない） */
  kagi:{...base,handle:'kagi',name:'カギ',created_at:D(2026,2),notes:40,followers:12,following:20,private:true,locked:true},
  /* 本人（非公開アカウント・ゲームは「公開」だがアカウントが非公開なのでフォロワーのみ） */
  minato:G({...base,handle:'minato',name:'ミナト',bio:'ダブルもやります。',created_at:D(2025,11),notes:12,followers:30,following:41,private:true,me:true,
    partner:887,showcase:SC,results:[R('S6','single',57,'verified'),R('S5','single',310,'self')]},{vis:'public',eff:'followers',capped:true}),
  /* 確認済みだけ（レートだけの行も） */
  akari:G({...base,handle:'akari',name:'アカリ',bio:'S6 最終1桁。',created_at:D(2025,10),notes:64,followers:980,following:12,partner:1000,
    results:[R('S6','single',3,'verified'),R('S5','single',null,'verified',2054)]}),
  /* 自己申告だけ */
  sora:G({...base,handle:'sora',name:'ソラ',bio:'はじめてのシーズンです',created_at:D(2026,9),notes:5,followers:4,following:9,partner:149,results:[R('S6','single',820,'self')]}),
  /* ゲームのプロフィールなし（訪問者には何も出さない） */
  riku:G({...base,handle:'riku',name:'リク',bio:'見る専です。',created_at:D(2026,1),notes:2,followers:3,following:15},{created:false}),
  /* 戦績はあるが、ゲームカードは作っていない（戦績だけではカードにしない） */
  kenta:G({...base,handle:'kenta',name:'ケンタ',bio:'ランクバトルを少し。',created_at:D(2026,5),notes:6,followers:11,following:10,
    results:[R('S6','single',95,'verified'),R('S5','single',400,'self')]},{created:false}),
  /* 戦績なしでゲームカードを作った人（相棒と看板パーティだけ） */
  yui:G({...base,handle:'yui',name:'ユイ',bio:'のんびり遊んでいます。イーブイ系が好き。',created_at:D(2026,6),notes:20,followers:18,following:22,partner:730,showcase:{n:'お気に入り',t:[730,59,823,149,445,1000]}}),
  /* ゲームカードはあるが「自分だけ」（訪問者にはサーバーが games を空にする＝何も出さない） */
  nao:{...base,handle:'nao',name:'ナオ',bio:'カードは非公開にしています。',created_at:D(2026,3),notes:9,followers:7,following:8},
  /* 写真のアイコンがあり、ゲームカードはない人（アイコンを押すと画像を見る画面） */
  mio:{...base,handle:'mio',name:'ミオ',av:'0123456789abcdef0123456789abcdef',created_at:D(2026,4),notes:3,followers:5,following:5},
  /* はじめたばかりの本人（何も登録していない） */
  hajime:G({...base,handle:'hajime',name:'ハジメ',created_at:D(2026,11),me:true},{created:false,vis:'inherit',eff:'public',capped:false})
};
export const PCARD_NOTES=h=>{const u=PCARD_USERS[h];if(!u||u.locked||!u.notes)return[];
  return [{id:9001,body:'S6 は最終1桁でした。ガブリアスとサーフゴーで前に出る形がいちばん安定しました。',created_at:Date.now()-2*36e5,likes:12,replies:3,reposts:1,user:{handle:u.handle,name:u.name,av:null,...(u.card?{card:true}:{})}},
    {id:9002,body:'アシレーヌの持ち物、まだ迷っています。',created_at:Date.now()-26*36e5,likes:4,replies:0,reposts:0,user:{handle:u.handle,name:u.name,av:null,...(u.card?{card:true}:{})}}]};
