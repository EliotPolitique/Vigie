/* ================= V4.4 — Synthèse en tableau de bord =================
   Variations jour / mois / année en tête, encart « À surveiller » qui rassemble ce qui demande une action,
   mouvements du jour et depuis l'achat, prochains dividendes tirés du catalogue, disposition par défaut resserrée. */
function nwAt(date){const h=D().history;let r=null;for(const x of h){if(x.d<=date)r=x;else break}return r?r.nw:(h[0]?h[0].nw:null)}
function varChips(){const n=totals().net;const td=today();const P=[['d',null],['m',td.slice(0,7)+'-01'],['ytd',td.slice(0,4)+'-01-01'],['y',dAdd(td,-365)]];
  const out=P.map(([k,from])=>{let chg,pct;if(k==='d'){const nd=nwDay();if(!nd)return '';chg=nd.chg;pct=nd.pct}else{const b=nwAt(dAdd(from,-1));if(b==null)return '';chg=n-b;pct=b?chg/Math.abs(b):0}
    return `<div class="vch"><em>${esc(t('dh.v.'+k))}</em><b class="${cls(chg)}">${moneyS(chg,0)}</b><i class="${cls(chg)}">${pctS(pct,1)}</i></div>`}).filter(Boolean);
  return out.length?`<div class="vchips">${out.join('')}</div>`:''}
{const _hp=homeParts;homeParts=function(){const P=_hp();const ch=varChips();if(ch)P.hero=P.hero.replace('<div class="hover-read"',ch+'<div class="hover-read"');return P}}

/* ---------- À surveiller ---------- */
function watchItems(){const L=[];const add=(lvl,ic,l,s,act,v,prio)=>L.push({lvl,ic,l,s,act,v,prio});const td=today();
  try{healthChecks().filter(c=>c.lvl!=='info').forEach(c=>{const it=c.items[0]||{};add(c.lvl,c.k==='save'?'alert':'shield',t('h.k.'+c.k,{n:c.n}),t('h.d.'+c.k),c.k==='save'?'saveInfo':c.k==='fin'?'finOpen':'go',c.k==='save'||c.k==='fin'?'':'recon',c.lvl==='bad'?10:7)})}catch(e){}
  try{const F=forecast(45);if(F.firstNeg)add('bad','cash',t('dh.w.neg',{d:dateT(F.firstNeg.d,'short')}),t('dh.w.negS',{v:moneyT(F.low.v,0)}),'go','daily',9)}catch(e){}
  try{const ym=td.slice(0,7);const mg=aggTx(monthTx(ym));const bud=D().budgets||{};Object.keys(bud).filter(k=>bud[k]>0&&(mg.cat[k]||0)>bud[k]).forEach(k=>add('warn','alert',t('dh.w.bud',{c:catL(k)}),t('dh.w.budS',{s:moneyT(mg.cat[k],0),b:moneyT(bud[k],0)}),'go','budget',6))}catch(e){}
  try{D().accounts.filter(a=>a.type==='pea'&&a.include!==false).forEach(a=>{const cap=accCap(a),paid=accPaid(a);if(cap&&paid!=null&&paid/cap>=0.85)add(paid>=cap?'warn':'info','savings',t('dh.w.cap',{a:a.name,p:pctT(paid/cap,0)}),t('dh.w.capS',{v:moneyT(Math.max(0,cap-paid),0)}),'acc',a.id,5)})}catch(e){}
  try{D().accounts.filter(a=>a.fwarn).forEach(a=>add('warn','refresh',t('sg.accWarn',{a:a.name,w:t('fin.w.'+a.fwarn)}),'','finOpen','',8))}catch(e){}
  try{const ev=divCalendar(14);if(ev.length){const tot=sum(ev.map(e=>e.amt));add('good','coins',t('dh.w.div',{n:ev.length,v:moneyT(tot,2)}),ev.slice(0,3).map(e=>e.name.split(' ').slice(0,3).join(' ')+' · '+dateT(e.d,'short')).join(' · '),'go','income',3)}}catch(e){}
  try{const sg=signals().filter(s=>s.kind==='alert'&&!L.some(x=>x.l===s.text));sg.slice(0,2).forEach(s=>add('warn','alert',s.text,'',s.act,s.v,4))}catch(e){}
  return L.sort((a,b)=>b.prio-a.prio)}
function watchWidget(){const L=watchItems();
  const col={bad:'--bad',warn:'--warn',info:'--k1',good:'--good'};
  return wCard(t('dh.w.t'),L.length?t('dh.w.s',{n:L.length}):t('dh.w.s0'),L.length?`<div class="list watch">${L.slice(0,6).map(x=>`<button class="row btnrow" data-a="${x.act}" data-v="${esc(x.v||'')}"><span class="av sm" style="--c:var(${col[x.lvl]})">${ico(x.ic)}</span><div class="m"><b>${esc(x.l)}</b>${x.s?`<span>${esc(x.s)}</span>`:''}</div><div class="r">${ico('chev')}</div></button>`).join('')}</div>`:`<div class="wempty">${ico('check')}<p>${esc(t('dh.w.none'))}</p></div>`)}

/* ---------- Mouvements : du jour / depuis l'achat ---------- */
function moversWidget(){const pos=positions();const hasDay=pos.some(p=>{const x=posDay(p);return x.known&&Math.abs(x.chg)>0.004});const tab=S.ui.mvTab||(hasDay?'day':'since');let up=[],dn=[];
  if(tab==='day'){const L=pos.map(p=>({p,...posDay(p)})).filter(x=>x.known&&Math.abs(x.chg)>0.004);up=L.filter(x=>x.pct>0).sort((a,b)=>b.pct-a.pct).slice(0,3);dn=L.filter(x=>x.pct<0).sort((a,b)=>a.pct-b.pct).slice(0,3);
    up=up.map(x=>({p:x.p,a:x.chg,r:x.pct}));dn=dn.map(x=>({p:x.p,a:x.chg,r:x.pct}))}
  else{const L=sinceRows().filter(x=>x.p.cost>0);up=L.filter(x=>x.gp>0).sort((a,b)=>b.gp-a.gp).slice(0,3).map(x=>({p:x.p,a:x.gain,r:x.gp}));dn=L.filter(x=>x.gp<=0).sort((a,b)=>a.gp-b.gp).slice(0,3).map(x=>({p:x.p,a:x.gain,r:x.gp}))}
  const col=(title,L)=>`<div><div class="eyebrow" style="margin-bottom:4px">${esc(title)}</div><div class="list">${L.map(x=>posMini(x.p,`<b class="${cls(x.r)}">${pctS(x.r,tab==='day'?2:1)}</b><span class="${cls(x.a)}">${moneyS(x.a,tab==='day'?2:0)}</span>`)).join('')||`<p class="note">—</p>`}</div></div>`;
  return `<div class="card"><div class="ch"><div><h2>${esc(t('dh.mv.t'))}</h2><p>${esc(t('dh.mv.s.'+tab))}</p></div><div class="act">${seg('mvTab',[['day',t('dh.mv.day')],['since',t('dh.mv.since')]],tab,t('dh.mv.t'))}</div></div>
    <div class="grid g2 keep" style="gap:18px">${col(t('dh.mv.up'),up)}${col(t('dh.mv.dn'),dn)}</div>${tab==='day'&&!up.length&&!dn.length?`<p class="note" style="margin-top:6px">${esc(t('w.today.noPos'))}</p>`:''}</div>`}
EXT.A.mvTab=v=>{S.ui.mvTab=v;render()};
WIDGETS.alerts={s:'s',r:()=>watchWidget()};
WIDGETS.movers2={s:'m',r:()=>moversWidget()};
/* disposition par défaut : l'essentiel en haut, le reste plus bas ou désactivé */
W_DEFAULT.splice(0,W_DEFAULT.length,'alloc','kpis','today','alerts','divNext','movers2','passive','perfTrue','budget','goals','recent','signals','health','favorites');
EXT.boot.push(d=>{const s=d.settings||{};if(Array.isArray(s.widgets)&&!s.dash2){['alerts','movers2'].forEach((k,i)=>{if(!s.widgets.some(x=>x.k===k)){const j=s.widgets.findIndex(x=>x.k===(i?'divNext':'today'));s.widgets.splice(j>=0?j+1:2,0,{k,on:true})}});s.widgets.forEach(x=>{if(x.k==='best'||x.k==='worst')x.on=false})}s.dash2=1});
