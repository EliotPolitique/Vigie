/* ================= V5.1 — réinitialiser un compte (journal, opérations, positions) =================
   Pour chaque compte : vider ce qu'il contient avant de tout réimporter (CSV Trade Republic, relevés), sans toucher aux autres comptes.
   Sécurités : copie d'annulation dans la base (doc undo-<id>), sauvegarde Drive si disponible, synchronisation de la feuille mise en pause. */
function rsLinked(a){const g=gsyCfg();return Object.entries(g.map||{}).filter(([k,v])=>v===a.id&&/^(pea|cto|liv:)/.test(k)).length>0||(a.src==='gsheet')}
function rsCounts(a){return {tx:D().txs.filter(x=>x.acc===a.id).length,io:(D().iops||[]).filter(o=>o.acc===a.id).length,h:(a.holdings||[]).length}}
EXT.A.accReset=id=>openOvl({k:'accReset',id,opt:null});
EXT.ovl.accReset=o=>{const a=D().accounts.find(x=>x.id===o.id);if(!a)return {html:''};const ty=TYP[a.type]||{};const N=rsCounts(a);const link=rsLinked(a);
  if(!o.opt)o.opt={ops:true,hold:!!ty.h,bal:false,pause:link};const O=o.opt;
  const ck=(k,lab,hint,dis)=>`<label class="row" style="cursor:pointer;align-items:flex-start${dis?';opacity:.5':''}"><input type="checkbox" data-f="rsOpt" data-v="${k}" ${O[k]?'checked':''} ${dis?'disabled':''} style="margin-top:3px"><div class="m"><b style="font-weight:500;white-space:normal">${esc(lab)}</b>${hint?`<span style="white-space:normal">${esc(hint)}</span>`:''}</div></label>`;
  const confirm=S.ui.confirm==='accReset';
  return {html:`<div class="ph"><div><div class="eyebrow">${esc(a.name)}</div><h2>${esc(t('rs.h'))}</h2></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  <p class="note" style="margin:0 0 12px">${esc(t('rs.intro'))}</p>
  <div class="list">
    ${ck('ops',t('rs.ops'),t(ty.h?'rs.opsH.inv':'rs.opsH.bank',{n:ty.h?N.io+N.tx:N.tx}),false)}
    ${ty.h?ck('hold',t('rs.hold'),t('rs.holdH',{n:N.h}),false):''}
    ${ck('bal',t(ty.h?'rs.cash':'rs.bal'),t('rs.balH',{v:moneyT(ty.h?(+a.cash||0):(+a.balance||0),2)}),false)}
    ${link?ck('pause',t('rs.pause'),t('rs.pauseH'),false):''}
  </div>
  <div class="demo-band" style="margin:14px 0 0">${ico('shield')}<div>${esc(t('rs.safe'))}</div></div>
  <div class="pfoot"><span class="sp"></span><button class="btn ghost" data-a="close">${esc(t('act.cancel'))}</button><button class="btn ${confirm?'danger':''}" data-a="rsGo" data-v="${a.id}" ${!O.ops&&!O.hold&&!O.bal?'disabled':''}>${ico('trash')}${esc(t(confirm?'rs.confirm':'rs.go'))}</button></div>`}};
EXT.field.rsOpt=(el)=>{const o=S.ui.ovl;if(!o||!o.opt)return;o.opt[el.dataset.v]=!!el.checked;S.ui.confirm=null;renderOvl()};
EXT.A.rsGo=async id=>{const a=D().accounts.find(x=>x.id===id);const o=S.ui.ovl;if(!a||!o||!o.opt)return;
  if(S.ui.confirm!=='accReset'){S.ui.confirm='accReset';renderOvl();return}S.ui.confirm=null;const O=o.opt;
  /* copie d'annulation (dans ta base Vigie) */
  const snap={at:new Date().toISOString(),acc:JSON.parse(JSON.stringify(a)),txs:D().txs.filter(x=>x.acc===id),iops:(D().iops||[]).filter(x=>x.acc===id),opt:O};
  let undoOk=false;if(!S.demo&&STORE.mode==='cloud'&&STORE.db){try{await STORE.db.doc(P('undo-'+id)).set(snap);undoOk=true}catch(e){try{w7Log(e,'reset-undo')}catch(x){}}}else{W8U[id]=snap;undoOk=true}
  if(!undoOk){toast(t('rs.noUndo'),true);return}
  try{if(typeof w6Backup==='function'&&S.cap.mcp&&!S.demo)w6Backup(false)}catch(e){}
  if(O.ops){D().txs=D().txs.filter(x=>x.acc!==id);D().iops=(D().iops||[]).filter(x=>x.acc!==id)}
  if(O.hold&&(TYP[a.type]||{}).h)a.holdings=[];
  if(O.bal){if((TYP[a.type]||{}).h)a.cash=0;else a.balance=0}
  if(O.pause)a.gsPause=today();
  a.resetAt=today();a.updatedAt=today();W8U[id]=snap;
  try{HB.key=''}catch(e){}save();closeOvl();render();toast(t('rs.done',{a:a.name}))};
const W8U={};
async function rsUndoGet(id){if(W8U[id])return W8U[id];if(S.demo||!STORE.db)return null;try{const s=await STORE.db.doc(P('undo-'+id)).get();if(s.exists){W8U[id]=s.data();return W8U[id]}}catch(e){}W8U[id]=false;return null}
EXT.A.rsUndo=async id=>{if(S.ui.confirm!=='rsUndo'){S.ui.confirm='rsUndo';renderOvl();render();return}S.ui.confirm=null;
  const U=await rsUndoGet(id);const a=D().accounts.find(x=>x.id===id);if(!U||!a){toast(t('rs.undoNone'),true);return}
  D().txs=D().txs.filter(x=>x.acc!==id).concat(U.txs||[]);D().iops=(D().iops||[]).filter(x=>x.acc!==id).concat(U.iops||[]);
  const keep={id:a.id};Object.keys(a).forEach(k=>delete a[k]);Object.assign(a,U.acc,keep);delete a.gsPause;delete a.resetAt;
  W8U[id]=false;try{if(STORE.db&&!S.demo)await STORE.db.doc(P('undo-'+id)).delete()}catch(e){}try{HB.key=''}catch(e){}save();renderOvl();render();toast(t('rs.undone'))};
EXT.A.rsResume=id=>{const a=D().accounts.find(x=>x.id===id);if(!a)return;delete a.gsPause;save();renderOvl();render();toast(t('rs.resumed'));if(typeof gsySync==='function')setTimeout(()=>gsySync(true),600)};
EXT.accDrawer.push(a=>{const ty=TYP[a.type]||{};if(ty.cls==='realestate'||ty.loan)return '';
  if(W8U[a.id]===undefined)rsUndoGet(a.id).then(u=>{if(u&&S.ui.ovl&&S.ui.ovl.k==='acc'&&S.ui.ovl.id===a.id)renderOvl()});const U=W8U[a.id];
  const pause=a.gsPause?`<div class="demo-band" style="margin:0 0 12px">${ico('sheet')}<div><b>${esc(t('rs.paused'))}</b> ${esc(t('rs.pausedS',{d:dateT(a.gsPause,'short')}))}</div><button class="btn sm" data-a="rsResume" data-v="${a.id}">${esc(t('rs.resume'))}</button></div>`:'';
  const undo=U?`<div class="row" style="flex-wrap:wrap"><div class="m"><b style="font-weight:500">${esc(t('rs.undoT',{d:dateT(String(U.at).slice(0,10),'short')}))}</b><span>${esc(t('rs.undoS'))}</span></div><button class="btn ${S.ui.confirm==='rsUndo'?'danger':'sec'} sm" data-a="rsUndo" data-v="${a.id}">${ico('refresh')}${esc(t(S.ui.confirm==='rsUndo'?'rs.undoConfirm':'rs.undo'))}</button></div>`:'';
  return `${pause}<div class="card flat" style="margin:0 0 16px"><div class="ch" style="margin-bottom:4px"><div><h2>${esc(t('rs.h'))}</h2><p>${esc(t(ty.h?'rs.sub.inv':'rs.sub.bank'))}</p></div><button class="btn ghost sm" data-a="accReset" data-v="${a.id}">${ico('trash')}${esc(t('rs.open'))}</button></div>${undo}</div>`});
/* la synchronisation des feuilles ignore les comptes en pause */
{const _o=gsyOrdersApply;gsyOrdersApply=function(a){if(a&&a.gsPause)return;return _o.apply(this,arguments)}}
{const _p=gsyPosApply;gsyPosApply=function(src,a){if(a&&a.gsPause)return;return _p.apply(this,arguments)}}
{const _l=gsyLivApply;gsyLivApply=function(R,rep){const g=gsyCfg();const rows=(R&&R.rows||[]).filter(r=>{const k=gsyK(r.l);const type=LIV_T[k];const id=g.map['liv:'+k];const a=(id&&D().accounts.find(x=>x.id===id))||(type&&D().accounts.find(x=>x.type===type&&x.include!==false));return !(a&&a.gsPause)});return _l.call(this,Object.assign({},R,{rows}),rep)}}
{const _d=gsyDebtApply;gsyDebtApply=function(R,rep){const g=gsyCfg();const paused=new Set(D().accounts.filter(a=>a.gsPause).map(a=>a.id));if(!paused.size)return _d.apply(this,arguments);
  const saved={};Object.entries(g.map).forEach(([k,v])=>{if(paused.has(v)&&/^debt:/.test(k)){saved[k]=v;delete g.map[k]}});try{return _d.apply(this,arguments)}finally{Object.assign(g.map,saved)}}}
/* l'écriture vers la feuille (automatisation n° 2) ignore aussi un compte en pause */
{const _sm=w7SheetMissing;w7SheetMissing=async function(src){const a=gsyInvAcc(src);if(a&&a.gsPause)return null;return _sm.apply(this,arguments)}}
/* ---------- identité des lignes conservée après une réinitialisation ----------
   Les positions recréées depuis un CSV perdent leur code Google et leur symbole : sans eux, plus de cours en direct
   (la ligne restait figée au prix du premier achat importé). On garde la fiche de chaque ligne et on la rend aux lignes recréées. */
const RS_META=['name','gsym','ticker','kind','region','sector','div','months','ter','cur','logo'];
function rsMetaOf(hs){const m={};(hs||[]).forEach(h=>{const k=(h.isin||'').toUpperCase()||('n:'+norm(h.name||''));if(!k||k==='n:')return;const o={};RS_META.forEach(f=>{if(h[f]!=null&&h[f]!=='')o[f]=h[f]});if(+h.price>0){o.price=+h.price;o.liveAt=h.liveAt||'';o.liveSrc=h.liveSrc||''}m[k]=o});return m}
function rsHeal(a,meta){if(!a||!meta)return 0;let n=0;
  (a.holdings||[]).forEach(h=>{const M=meta[(h.isin||'').toUpperCase()]||meta['n:'+norm(h.name||'')];if(!M)return;let ch=false;
    ['gsym','ticker'].forEach(f=>{if(!h[f]&&M[f]){h[f]=M[f];ch=true}});
    if(M.name&&h.src==='ops'&&h.name!==M.name){h.name=M.name;ch=true}
    ['kind','region','sector','div','months','ter','logo'].forEach(f=>{if(M[f]!=null&&(h[f]==null||h[f]===''||(Array.isArray(h[f])&&!h[f].length)||(f==='div'&&!(+h[f]>0))))h[f]=M[f]});
    const hd=String(h.liveAt||h.pxd||'').slice(0,10),md=String(M.liveAt||'').slice(0,10);if(M.price>0&&md&&md>hd){h.price=M.price;h.liveAt=M.liveAt;if(M.liveSrc)h.liveSrc=M.liveSrc;ch=true}
    if(ch)n++});return n}
/* à la réinitialisation : la fiche des lignes est gardée sur le compte */
{const _go=EXT.A.rsGo;EXT.A.rsGo=async id=>{const a=D().accounts.find(x=>x.id===id);if(a&&S.ui.confirm==='accReset'&&(a.holdings||[]).length){a.holdMeta=Object.assign({},a.holdMeta||{},rsMetaOf(a.holdings))}return _go(id)}}
/* après chaque recalcul des positions (import CSV) */
{const _rh=recalcHoldings;recalcHoldings=function(a){const r=_rh.apply(this,arguments);try{if(a&&a.holdMeta)rsHeal(a,a.holdMeta)}catch(e){}return r}}
/* au démarrage : répare les comptes déjà réinitialisés (fiches reprises de la copie d'annulation) puis relance les cours */
EXT.boot.push(d=>{setTimeout(async()=>{if(S.data!==d||S.demo)return;let n=0;
  for(const a of d.accounts){if(!(TYP[a.type]||{}).h)continue;let meta=a.holdMeta;
    if(!meta&&a.resetAt){const U=await rsUndoGet(a.id);if(U&&U.acc){meta=a.holdMeta=rsMetaOf(U.acc.holdings)}}
    if(meta)n+=rsHeal(a,meta)}
  if(n){save();try{applyBase()}catch(e){}try{if(typeof syncLive==='function')syncLive()}catch(e){}render()}},3500)});
