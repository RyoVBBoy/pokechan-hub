/* ===================== 文字サイズ（アクセシビリティ、2026/11/11 依頼主「X と同じ文字サイズのスライダー」） =====================
   設定とプライバシー（65-settings.js）の「文字サイズ」のページ：上に見本の投稿、下に4段階のスライダー（X と同じ）。動かすとその場で全体の文字が変わる。
   しくみ：tools/build.mjs の fsScale が styles.css の文字の大きさ（font-size・font の大きさ）を「もとの大きさ × var(--fsk, 1)」に書きかえて出すので、
   :root の --fsk を変えるだけで全部の画面の文字がいっぺんに変わる（読み直さない）。入力欄の16px以上は16px未満にしない（iPhone の拡大を防ぐ）。保存は localStorage pcfs2（0〜3、はじめは1＝標準＝X のはじめと同じ大きさ）。 */
/* 2026/11/11 依頼主の X の4段階のスクリーンショットで同じ文の幅を測った比（2段目＝X のはじめ＝当サイトの標準を1）：0.933・1・1.067・1.124。X は文字だけ大きくなり、ボタンの絵・アイコンは変わらない */
const FS_STEPS=[[.933,'小さい'],[1,'標準'],[1.067,'大きい'],[1.124,'とても大きい']];
const FS_DEF=1;
/* 保存は pcfs2（0〜3）。前の5段階（pcfs 0〜4）を選んでいた人は近い段階に移す */
function fsGet(){let v=FS_DEF;try{let s=localStorage.getItem('pcfs2');
  if(s===null){const o=localStorage.getItem('pcfs');if(o!==null&&/^[0-4]$/.test(o)){s=String([0,0,1,2,3][+o]);localStorage.setItem('pcfs2',s)}}
  if(s!==null&&/^[0-3]$/.test(s))v=+s}catch(e){}return v}
function fsApply(i){
  i=Math.max(0,Math.min(FS_STEPS.length-1,i|0));
  document.documentElement.style.setProperty('--fsk',String(FS_STEPS[i][0]));
  document.documentElement.dataset.fs=i;
}
function fsSet(i){try{localStorage.setItem('pcfs2',String(i))}catch(e){}fsApply(i)}
/* 起動時：標準以外なら合わせる */
if(fsGet()!==FS_DEF)fsApply(fsGet());

/* 設定の画面のページ（SM_PAGES は 65-settings.js） */
SM_VAL.fs=()=>FS_STEPS[fsGet()][1];
SM_PAGES.fs={ic:I.textsize||(I.textsize='<path d="M3.5 18.5 8 6.5l4.5 12M5.2 14.2h5.6"/><path d="M13.5 18.5l3.5-9 3.5 9M14.8 15.5h4.4"/>'),t:()=>'文字サイズ',body:()=>{
  const v=fsGet(),now=Date.now();
  const sample={id:0,user:{handle:'gamekids',name:'Game Kid/s'},body:'文字の大きさは、このように変わります。スライダーを左右に動かして、読みやすい大きさを選んでください。 #GameKids',created_at:now-6e4,likes:12,replies:3,reposts:2,liked:false,reposted:false,saved:false,mine:false};
  return `<div class="fs-prev" inert aria-hidden="true">${twHtml(sample)}</div>
    <div class="fs-box"><div class="fs-row"><span class="fs-a fs-a1" aria-hidden="true">Aa</span>
      <div class="fs-track"><input type="range" id="fs-r" min="0" max="${FS_STEPS.length-1}" step="1" value="${v}" aria-label="文字サイズ" aria-valuetext="${FS_STEPS[v][1]}">
        <div class="fs-dots" aria-hidden="true">${FS_STEPS.map((_,i)=>`<i class="${i<=v?'on':''}"></i>`).join('')}</div></div>
      <span class="fs-a fs-a2" aria-hidden="true">Aa</span></div>
      <p class="fs-cur" id="fs-cur">${FS_STEPS[v][1]}</p></div>
    <p class="dr-note">この端末だけに保存され、サイト全体の文字の大きさがすぐに変わります。</p>`}};
/* スライダーを動かしたら、その場で全体に反映（読み直さない） */
document.addEventListener('input',e=>{const r=e.target;if(!r||r.id!=='fs-r')return;
  const i=+r.value;fsSet(i);r.setAttribute('aria-valuetext',FS_STEPS[i][1]);
  const c=document.getElementById('fs-cur');if(c)c.textContent=FS_STEPS[i][1];
  r.parentElement.querySelectorAll('.fs-dots i').forEach((d,j)=>d.classList.toggle('on',j<=i));
  const vv=document.getElementById('sm-v-fs');if(vv)vv.textContent=FS_STEPS[i][1]});
