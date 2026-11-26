/* ===================== 起動（すべての部品を読み込んだあとで最初の画面を出す） ===================== */
/* 起動が終わった合図（テストが「端末に保存したものを読み終え、最初の画面を出した」ことを待つため。画面には出ない） */
Promise.resolve(route()).catch(()=>{}).then(()=>{try{window.__APP_READY=true}catch(e){}});
/* 上位構築のデータ（57-topteams.js）を、最初の画面を出したあとで読んでおく */
setTimeout(()=>{if(location.protocol!=='file:')topLoad().catch(()=>{})},2500);
