/* ================= V4.4 — fiches détaillées : une page par compte et par titre =================
   Remplacent les panneaux latéraux (toujours accessibles pour la modification). Retour à l'écran d'origine. */
VIEWS.push({k:'acct',g:'pilot',ic:'wealth',hide:1},{k:'sec',g:'pilot',ic:'invest',hide:1});
EXT.A.acc=v=>{if(!D().accounts.some(a=>a.id===v))return;if(S.ui.view!=='acct'&&S.ui.view!=='sec')S.ui.back=S.ui.view;S.ui.accId=v;S.ui.pgPer=S.ui.pgPer||'1A';go('acct')};
EXT.A.pos=v=>{if(!positions().some(p=>p.key===v))return;if(S.ui.view!=='acct'&&S.ui.view!=='sec')S.ui.back=S.ui.view;S.ui.posKey=v;go('sec')};
EXT.A.pgBack=()=>go(S.ui.back&&S.ui.back!=='acct'&&S.ui.back!=='sec'?S.ui.back:'wealth');
EXT.A.pgPer=v=>{S.ui.pgPer=v;render()};
EXT.A.accDrawer=v=>openOvl({k:'acc',id:v});
{const _vt=viewTitle;viewTitle=function(){const v=S.ui.view;if(v==='acct'){const a=D().accounts.find(x=>x.id===S.ui.accId);return a?a.name:t('nav.wealth')}if(v==='sec'){const p=positions().find(x=>x.key===S.ui.posKey);return p?p.name:t('nav.invest')}return _vt()}}
const PG_PER=[['3M',90],['6M',182],['1A',365],['all',0]];
function perCut(pts){const p=S.ui.pgPer||'1A';const n=(PG_PER.find(x=>x[0]===p)||[0,365])[1];if(!n)return pts;const from=dAdd(today(),-n);const i=pts.findIndex(x=>x.d>=from);return i>0?pts.slice(i-1):pts}
const perSeg=()=>seg('pgPer',PG_PER.map(([k])=>[k,k==='all'?t('per.all'):k]),S.ui.pgPer||'1A',t('a11y.period'));
/* corps du panneau existant, sans son en-tête (le titre et la valeur sont repris dans l'en-tête de la page) */
function drawerBody(html){let s=html.replace(/^\s*<div class="ph">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,'');const i=s.indexOf('<div class="hero-v"');if(i>=0&&i<400){const j=s.indexOf('</div>',i);s=s.slice(0,i)+s.slice(j+6)}return s}
function pgHead(av,eyebrow,name,value,delta,acts){return `<div class="pgnav"><button class="btn ghost sm" data-a="pgBack">${ico('chevl')}${esc(t('pg.back'))}</button></div>
  <div class="pghead">${av}<div class="m"><div class="eyebrow">${esc(eyebrow)}</div><h2>${esc(name)}</h2></div><div class="v"><div class="hero-v">${value}</div>${delta||''}</div>${acts?`<div class="act">${acts}</div>`:''}</div>`}
function deltaPill(pts){if(pts.length<2)return '';const a=pts[0].v,b=pts[pts.length-1].v,c=b-a;const showP=a>0&&a>=Math.abs(b)*0.2;return `<span class="delta ${c>=0?'up':'dn'}">${c>=0?'▲':'▼'} ${moneyS(c,0)}${showP?' · '+pctS(c/a):''}</span><span class="note" style="font-size:11.5px">${esc(t('pg.onPer',{p:(S.ui.pgPer||'1A')==='all'?t('per.all').toLowerCase():S.ui.pgPer||'1A'}))}</span>`}

/* ---------- page compte ---------- */
function acctPage(){const a=D().accounts.find(x=>x.id===S.ui.accId);if(!a)return emptyBlock(t('pg.gone'),'',t('nav.wealth'),'pgBack');
  const ty=TYP[a.type]||{};let pts=[];try{pts=perCut(accHist([a.id],1))}catch(e){}
  const chartC=pts.length>2?`<div class="card"><div class="ch"><div><h2>${esc(t('pg.evo'))}</h2><p>${esc(t('pg.evoS'))}</p></div><div class="act">${perSeg()}</div></div>${chart({h:240,series:[{pts,c:'var(--accent)'}],xl:i=>dateT(pts[i].d,'my'),tip:i=>richTip(pts,i,2),label:a.name})}</div>`:'';
  const body=drawerBody(accDrawer(a.id));
  let side='';
  if(ty.h&&(a.holdings||[]).length){const tot=sum(a.holdings.map(h=>hVal(h,a)))+conv(+a.cash||0,a.cur);const segs=a.holdings.map((h,i)=>({k:h.id,l:h.name,v:hVal(h,a),c:`var(--k${(i%8)+1})`})).filter(s=>s.v>0).sort((x,y)=>y.v-x.v);if(+a.cash>0)segs.push({k:'cash',l:t('f.cash'),v:conv(+a.cash,a.cur),c:'var(--k6)'});
    side+=`<div class="card"><div class="ch"><div><h2>${esc(t('pg.split'))}</h2></div></div>${donut(segs.slice(0,8),esc(compactT(tot)),t('inv.value'),'')}<div class="legend" style="margin-top:14px">${segs.slice(0,8).map(s=>`<div class="lg"><i class="sq" style="--c:${s.c}"></i><span class="n">${esc(s.l)}</span><span class="p">${pctT(s.v/(tot||1))}</span><span class="v">${money(s.v,0)}</span></div>`).join('')}</div></div>`}
  if(ty.cls==='cash'){const L=D().txs.filter(x=>x.acc===a.id);if(L.length){const ms=[5,4,3,2,1,0].map(k=>ymAdd(today().slice(0,7),-k));const rows=ms.map(m=>{const g=aggTx(L.filter(x=>ymOf(x.d)===m));return {m,inc:g.inc,exp:g.exp}});if(rows.some(r=>r.inc||r.exp))
    side+=`<div class="card"><div class="ch"><div><h2>${esc(t('pg.flows'))}</h2><p>${esc(t('pg.flowsS'))}</p></div></div>${chart({type:'bars',h:200,groups:rows.map(r=>({key:r.m,label:monthT(r.m,1),vals:[r.inc,r.exp],title:monthT(r.m)+' · +'+moneyT(r.inc,0)+' / −'+moneyT(r.exp,0)})),keys:[{c:'var(--good)'},{c:'var(--k6)'}],noDim:true,label:t('pg.flows')})}</div>`}}
  const bm=ty.h?benchCompareCard([a.id]):'';
  const nf=ty.cls==='cash'&&typeof negFixFor==='function'?negFixFor(a.id):null;const nfC=nf?`<div class="callout" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">${ico('alert')}<div style="flex:1;min-width:220px"><b>${esc(t('pg.negT',{v:moneyT(nf.min,2),d:dateT(nf.at)}))}</b><br><span class="note">${esc(t('h.negFix',{v:moneyT(-nf.min,2),d:dateT(nf.d)}))} ${esc(t('pg.negP'))}</span></div><button class="btn sm" data-a="hAdj" data-v="${esc(nf.v)}">${esc(t('h.a2.neg'))}</button><button class="btn sec sm" data-a="import" data-v="${a.id}">${esc(t('h.a.neg'))}</button></div>`:'';
  const acts=`${favBtn('a:'+a.id)}<button class="btn sec sm" data-a="editAcc" data-v="${a.id}">${ico('edit')}${esc(t('act.edit'))}</button>`;
  return pgHead(accAvatar(a),[typL(a.type),a.inst].filter(Boolean).join(' · '),a.name,heroMoney(accValue(a)),deltaPill(pts),acts)+
    `<div class="grid g-21 pgrid"><div class="pgmain">${nfC}${chartC}${bm}<div class="card pgbody">${body}</div></div><div class="pgside">${side||''}</div></div>`}
EXT.V.acct=acctPage;

/* ---------- page titre ---------- */
function secPage(){const p=positions().find(x=>x.key===S.ui.posKey);if(!p)return emptyBlock(t('pg.gone'),'',t('nav.invest'),'pgBack');
  const h0=p.lines[0].h,a0=p.lines[0].a;const hs=baseHist(h0);const cur=hs.length?hs[0].cur:p.cur;let pts=perCut(hs.map(x=>({d:x.d,v:x.v})));
  const chartC=pts.length>2?`<div class="card"><div class="ch"><div><h2>${esc(t('pg.px'))}</h2><p>${esc(t('pg.pxS',{c:cur}))}</p></div><div class="act">${perSeg()}</div></div>${chart({h:240,series:[{pts,c:'var(--accent)'}],xl:i=>dateT(pts[i].d,'my'),tip:i=>richTip(pts.map(x=>({...x})),i,2).replace(/€/g,cur==='EUR'?'€':cur),fy:v=>moneyT(v,2,cur),label:p.name})}</div>`:'';
  const body=drawerBody(posDrawer(p.key)).replace(/<div class="sec-t" style="margin-top:20px"><h2>[^<]*<\/h2><span class="note">[^<]*<\/span><\/div><div class="card flat"><div class="chart"[\s\S]*?<\/div><\/div>/,'');
  let fiche='';try{fiche=EXT.holdForm.map(fn=>{try{return fn(a0,h0,{},()=>'')}catch(e){return ''}}).find(s=>s&&s.includes('catf'))||''}catch(e){}
  const rec=typeof receivedList==='function'?receivedList(dAdd(today(),-730),today()).filter(r=>(p.isin&&r.isin===p.isin)||norm(r.name)===norm(p.name)):[];
  const recC=rec.length?`<div class="card"><div class="ch"><div><h2>${esc(t('pg.recv'))}</h2><p>${esc(t('pg.recvS',{v:moneyT(sum(rec.map(r=>r.v)),2)}))}</p></div></div><div class="list">${rec.slice(0,12).map(r=>`<div class="row"><div class="m"><b>${esc(dateT(r.d))}</b><span>${esc(r.acc?r.acc.name:'—')}</span></div><div class="r"><b class="good">+${esc(moneyT(r.v,2))}</b></div></div>`).join('')}</div></div>`:'';
  const pl=p.pl;const acts=`${favBtn('p:'+p.key)}${typeof alertBtn==='function'?alertBtn(p.key):''}`;
  return pgHead(posAvatar(p),[p.ticker,kindL(p.kind),p.isin].filter(Boolean).join(' · '),p.name,heroMoney(p.value),`<span class="delta ${pl>=0?'up':'dn'}">${moneyS(pl,0)} · ${pctS(p.plp)}</span>`,acts)+
    `<div class="grid g-21 pgrid"><div class="pgmain">${chartC}<div class="card pgbody">${body}</div></div><div class="pgside">${fiche?`<div class="card"><div class="form fichewrap">${fiche}</div></div>`:''}${recC}</div></div>`}
EXT.V.sec=secPage;
/* suppression depuis la page : confirmation dans la page puis retour */
EXT.boot.push(()=>{if(typeof A==='undefined'||A.__pg)return;A.__pg=1;const _da=A.delAcc;A.delAcc=v=>{_da(v);if(S.ui.view==='acct'){if(!D().accounts.some(a=>a.id===v))A.pgBack();else render()}}});
