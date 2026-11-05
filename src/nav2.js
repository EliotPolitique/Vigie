/* ================= V3.2 — Investissements par enveloppe et Finance du quotidien par compte ================= */
const ENVS=[
 {k:'pea',types:['pea','peapme']},{k:'cto',types:['cto']},{k:'av',types:['av']},{k:'per',types:['per','percol']},{k:'pee',types:['pee']},
 {k:'scpi',types:['scpi','opci']},{k:'crypto',types:['wallet']},{k:'metals',types:['metals']},{k:'crowd',types:['crowd']},{k:'unlisted',types:['unlisted']},
 {k:'livrets',types:['livretA','ldds','lep','livretJeune','pel','cel','term','savingsOther']}
];
const ENV={};ENVS.forEach(e=>ENV[e.k]=e);
function envIc(k){const e=ENV[k];return (TYP[e.types[0]]||{}).ic||'bars'}
function envAccs(k){const e=ENV[k];return e?D().accounts.filter(a=>a.include!==false&&e.types.includes(a.type)):[]}
function envList(){return ENVS.filter(e=>envAccs(e.k).length)}
function envVal(k){return sum(envAccs(k).map(accValue))}
function dailyAccs(){return D().accounts.filter(a=>a.include!==false&&accCls(a)==='cash')}
function curEnv(){const L=envList();return L.some(e=>e.k===S.ui.env)?S.ui.env:(L[0]||{}).k}
function curDacc(){const L=dailyAccs();return L.some(a=>a.id===S.ui.dacc)?S.ui.dacc:''}

/* ---------- vues enregistrées ---------- */
VIEWS.splice(VIEWS.findIndex(v=>v.k==='budget'),0,{k:'daily',g:'pilot',ic:'cash'});
VIEWS.find(v=>v.k==='budget').hide=1;
VIEWS.push({k:'env',g:'pilot',ic:'bars',hide:1});
EXT.V=EXT.V||{};
EXT.V.env=()=>envView();EXT.V.daily=()=>dailyView();
EXT.A.env=v=>{S.ui.env=v;S.ui.invAcc='all';go('env')};
EXT.A.dacc=v=>{S.ui.dacc=v;go('daily')};
EXT.A.navFold=g=>{const o=ST().navOpen=ST().navOpen||{};o[g]=!(o[g]!==false);render()};
const _vt=viewTitle;
viewTitle=function(){const v=S.ui.view;if(v==='env'){const k=curEnv();return k?t('env.'+k):t('nav.invest')}if(v==='daily'){const id=curDacc();const a=id&&D().accounts.find(x=>x.id===id);return a?a.name:t('nav.daily')}return _vt()};

/* sous-menus de la barre latérale */
function navSub(k){
  const v=S.ui.view;const open=ST().navOpen||{};
  if(k==='invest'){const L=envList();if(!L.length)return '';const on=open.inv!==false;
    return `<button class="nvf" data-a="navFold" data-v="inv" aria-expanded="${on}" aria-label="${esc(t('nav.fold'))}">${ico(on?'up':'down')}</button>${on?`<div class="nvs">${L.map(e=>`<button class="nv sub" data-a="env" data-v="${e.k}"${v==='env'&&curEnv()===e.k?' aria-current="page"':''}><i class="dot" style="--c:var(${(CLS[(TYP[e.types[0]]||{}).cls]||CLS.other).c})"></i><span>${esc(t('env.'+e.k))}</span><em>${esc(compactT(envVal(e.k)))}</em></button>`).join('')}</div>`:''}`}
  if(k==='daily'){const L=dailyAccs();const on=open.daily!==false;
    return `<button class="nvf" data-a="navFold" data-v="daily" aria-expanded="${on}" aria-label="${esc(t('nav.fold'))}">${ico(on?'up':'down')}</button>${on?`<div class="nvs"><button class="nv sub" data-a="go" data-v="budget"${v==='budget'?' aria-current="page"':''}><i class="dot" style="--c:var(--accent)"></i><span>${esc(t('nav.budget'))}</span></button>${L.map(a=>`<button class="nv sub" data-a="dacc" data-v="${a.id}"${v==='daily'&&curDacc()===a.id?' aria-current="page"':''}><i class="dot" style="--c:var(--k2)"></i><span>${esc(a.name)}</span><em>${esc(compactT(accValue(a)))}</em></button>`).join('')}</div>`:''}`}
  return '';
}

/* rangée de puces (navigation interne, utile surtout sur mobile) */
function envChips(cur){const L=envList();if(!L.length)return '';
  return `<div class="chips envchips" role="navigation" aria-label="${esc(t('env.nav'))}"><button class="chip" data-a="go" data-v="invest" aria-pressed="${cur==='all'}">${esc(t('env.all'))}</button>${L.map(e=>`<button class="chip" data-a="env" data-v="${e.k}" aria-pressed="${cur===e.k}">${esc(t('env.'+e.k))} <span class="muted">${esc(compactT(envVal(e.k)))}</span></button>`).join('')}</div>`}
function dailyChips(cur){const L=dailyAccs();
  return `<div class="chips envchips" role="navigation" aria-label="${esc(t('nav.daily'))}"><button class="chip" data-a="go" data-v="daily" aria-pressed="${cur==='all'}">${esc(t('dy.all'))}</button><button class="chip" data-a="go" data-v="budget" aria-pressed="${cur==='budget'}">${esc(t('nav.budget'))}</button>${L.map(a=>`<button class="chip" data-a="dacc" data-v="${a.id}" aria-pressed="${cur===a.id}">${esc(a.name)}</button>`).join('')}</div>`}
const _invV=investView;investView=function(){S.ui.envSet=null;return envChips('all')+_invV()};
const _budV=budgetView;budgetView=function(o){return (o&&o.embed?'':dailyChips('budget'))+_budV(o)};

/* ---------- règles d'enveloppe (état du droit au 2 novembre 2026) ---------- */
function envRules(k,accs){
  const R=t('envr.'+k);if(R==='envr.'+k)return '';
  const items=R.split('|');
  let extra='';
  if(k==='pea'){extra=accs.map(a=>{const cap=accCap(a);const paid=accPaid(a);const used=paid!=null?paid:sum(a.holdings.map(h=>hCost(h,a)));const yrs=a.opened?daysBetween(a.opened,today())/365.25:null;const five=a.opened?dAdd(a.opened,Math.round(5*365.25)):null;
    return `<div class="envacc"><div class="hrow" style="justify-content:space-between"><b>${esc(a.name)}</b><span class="muted">${esc(cap===20000?t('env.peaYoung'):t('env.capN',{v:moneyT(cap,0)}))}</span></div>
      <div class="bar" style="margin:8px 0 4px"><i style="width:${(clamp(used/(cap||1),0,1)*100).toFixed(1)}%"></i></div><div class="hrow note" style="justify-content:space-between"><span>${esc(t('env.paid',{v:moneyT(used,0)}))}</span><span>${esc(t('env.room',{v:moneyT(Math.max(0,cap-used),0)}))}</span></div>
      <p class="note" style="margin:6px 0 0">${a.opened?(yrs>=5?esc(t('env.mature',{d:dateT(five)})):esc(t('env.matIn',{d:dateT(five),n:numT(5-yrs,1)}))):esc(t('env.noOpen'))}</p></div>`}).join('')}
  if(k==='av'){extra=accs.map(a=>{const yrs=a.opened?daysBetween(a.opened,today())/365.25:null;const eight=a.opened?dAdd(a.opened,Math.round(8*365.25)):null;return `<div class="envacc"><b>${esc(a.name)}</b><p class="note" style="margin:4px 0 0">${a.opened?(yrs>=8?esc(t('env.mature8',{d:dateT(eight)})):esc(t('env.mat8In',{d:dateT(eight),n:numT(8-yrs,1)}))):esc(t('env.noOpen'))}</p></div>`}).join('')}
  if(k==='livrets'){extra=accs.map(a=>{const ty=TYP[a.type]||{};const rate=(+a.rate)||ST().rates[ty.rate]||0;const v=accValue(a);return `<div class="envacc"><div class="hrow" style="justify-content:space-between"><b>${esc(a.name)}</b><span class="muted">${esc(pctT(rate/100,2))} · ${esc(t('env.intY',{v:moneyT(v*rate/100,2)}))}</span></div>${ty.cap?`<div class="bar" style="margin:8px 0 4px"><i style="width:${(clamp(v/ty.cap,0,1)*100).toFixed(1)}%"></i></div><div class="note">${esc(moneyT(v,0))} / ${esc(moneyT(ty.cap,0))}</div>`:''}</div>`}).join('')}
  return `<div class="card"><div class="ch"><div><h2>${esc(t('env.rulesT'))}</h2><p>${esc(t('env.rulesS'))}</p></div><button class="link" data-a="go" data-v="tax">${esc(t('nav.tax'))}</button></div>${extra}<ul class="rules">${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
}

/* ---------- page d'une enveloppe ---------- */
function envView(){
  const k=curEnv();if(!k)return emptyBlock(t('inv.emptyT'),t('inv.emptyP'),t('inv.addAcc'),'addAccInv');
  const accs=envAccs(k);const val=sum(accs.map(accValue));const tt=totals();
  const perf=accs.map(a=>accPerf(a)).filter(Boolean);
  const hold=accs.filter(a=>(TYP[a.type]||{}).h);const hv=sum(hold.map(a=>sum(a.holdings.map(h=>hVal(h,a))))),hc=sum(hold.map(a=>sum(a.holdings.map(h=>hCost(h,a)))));
  const net=perf.length?sum(perf.map(p=>p.net)):null;const gain=net!=null?val-net:hv-hc;const inc=perf.length?sum(perf.map(p=>p.inc)):null;
  const dca=(typeof dcaDetect==='function'?dcaDetect():[]).filter(x=>accs.some(a=>a.id===x.a.id));
  /* versements mensuels sur 12 mois, à partir du journal d'opérations */
  const ms=rangeMonths(12);const ops=accs.flatMap(a=>iopsOf(a.id));
  const dep=ms.map(m=>sum(ops.filter(o=>o.d.slice(0,7)===m&&o.t==='dep').map(iopNet))-sum(ops.filter(o=>o.d.slice(0,7)===m&&o.t==='wd').map(o=>-iopNet(o))));
  const buys=ms.map(m=>sum(ops.filter(o=>o.d.slice(0,7)===m&&o.t==='buy').map(o=>Math.abs(+o.amt||0)+(+o.fee||0))));
  const hasOps=ops.length>0;
  const head=`${envChips(k)}<div class="kpis k4" style="margin-bottom:16px">${kpi(t('env.value'),money(val,0),t('env.share',{p:pctT(tt.gross?val/tt.gross:0,1)}))}${kpi(t('env.net'),net!=null?money(net,0):'—',net!=null?t('env.netS'):t('env.netNo'))}${kpi(t('env.gain'),`<span class="${cls(gain)}">${moneyS(gain,0)}</span>`,net?`<span class="${cls(gain)}">${pctS(gain/net)}</span>`:(hc?`<span class="${cls(gain)}">${pctS(gain/hc)}</span>`:''))}${kpi(t('env.inc'),inc!=null?money(inc,2):'—',t('env.incS'))}</div>`;
  const accCards=`<div class="card"><div class="ch"><div><h2>${esc(t('env.accs',{n:accs.length}))}</h2></div><button class="btn sec sm" data-a="addAcc" data-v="${ENV[k].types[0]}">${ico('plus')}${esc(t('w.add'))}</button></div><div class="list">${accs.map(a=>{const P=accPerf(a);const ds=dca.filter(x=>x.a.id===a.id);return `<button class="row btnrow" data-a="acc" data-v="${a.id}">${accAvatar(a,true)}<div class="m"><b>${esc(a.name)}</b><span>${esc([typL(a.type),a.inst,ds.length?t('env.dca',{v:moneyT(sum(ds.map(x=>x.plan)),0),d:ds[0].day}):''].filter(Boolean).join(' · '))}</span></div><div class="r"><b>${money(accValue(a),2)}</b>${P?`<span class="${cls(P.total)}">${moneyS(P.total,2)}</span>`:''}</div></button>`}).join('')}</div></div>`;
  const flow=hasOps?`<div class="card"><div class="ch"><div><h2>${esc(t('env.flowT'))}</h2><p>${esc(t('env.flowS'))}</p></div></div>${chart({type:'bars',h:190,groups:ms.map((m,i)=>({label:monthT(m,true),vals:[Math.max(0,dep[i]),buys[i]],title:monthT(m)+' · '+moneyT(dep[i],2)+' / '+moneyT(buys[i],2)})),keys:[{c:'var(--accent)'},{c:'var(--k3)'}],label:t('env.flowT')})}<div class="lgd2"><span><i style="background:var(--accent)"></i>${esc(t('env.dep'))}</span><span><i style="background:var(--k3)"></i>${esc(t('env.buys'))}</span></div>${dca.length?`<p class="note" style="margin-top:10px">${ico('spark')} ${esc(t('env.dcaL',{n:dca.length,v:moneyT(sum(dca.map(x=>x.plan)),0)}))}</p>`:''}</div>`:'';
  let detail='';
  if(hold.length){S.ui.envSet=new Set(accs.map(a=>a.id));try{detail=_invV()}finally{S.ui.envSet=null}}
  const rules=envRules(k,accs);const ids=accs.map(a=>a.id);const hcE=typeof histChartCard==='function'?histChartCard(ids,t('hb.envT')):'';const bcE=typeof benchCard==='function'?benchCard(ids):'';const extra=hcE||bcE?`<div class="grid g2" style="margin-top:16px">${hcE||'<div></div>'}${bcE||'<div></div>'}</div>`:'';
  return head+`<div class="grid g2"><div style="display:flex;flex-direction:column;gap:16px;min-width:0">${accCards}${flow}</div>${rules||'<div></div>'}</div>${extra}${detail?`<div class="sec-t" style="margin-top:22px"><h2>${esc(t('env.detail'))}</h2></div>${detail}`:''}`;
}

/* ---------- Finance du quotidien ---------- */
function balHist(a,days){/* solde reconstitué à rebours depuis le solde actuel et les opérations du compte */
  const txs=D().txs.filter(x=>x.acc===a.id).sort((x,y)=>y.d.localeCompare(x.d));let b=accValue(a);const pts=[];let i=0;
  for(let d=0;d<=days;d++){const day=dAdd(today(),-d);while(i<txs.length&&txs[i].d>day){b-=conv(txs[i].a,a.cur);i++}pts.push({d:day,v:r2(b)})}
  return pts.reverse()}
function dailyView(){
  const id=curDacc();
  if(id){const a=D().accounts.find(x=>x.id===id);return dailyChips(id)+dailyAcc(a)}
  const L=dailyAccs();const tot=sum(L.map(accValue));const ym=today().slice(0,7);
  const g=aggTx(monthTx(ym));const by=L.map(a=>{const l=monthTx(ym).filter(x=>x.acc===a.id);return {a,inn:sum(l.filter(x=>x.a>0&&(CAT[x.c]||{}).kind!=='move').map(x=>x.a)),out:-sum(l.filter(x=>x.a<0&&(CAT[x.c]||{}).kind!=='move').map(x=>x.a)),n:l.length,last:D().txs.filter(x=>x.acc===a.id).sort((x,y)=>y.d.localeCompare(x.d))[0]}});
  /* trésorerie courante sur 90 jours : somme des soldes reconstitués */
  const H=L.map(a=>balHist(a,90));const pts=H.length?H[0].map((p,i)=>({d:p.d,v:sum(H.map(h=>h[i].v))})):[];
  const low=pts.length?pts.reduce((m,p)=>p.v<m.v?p:m,pts[0]):null;
  return dailyChips('all')+`<div class="grid g-21"><div class="card"><div class="eyebrow">${esc(t('dy.tot'))}</div><div class="hero-v">${money(tot,2)}</div><p class="note">${esc(t('dy.totS',{n:L.length}))}</p>
    ${pts.length>1?chart({h:180,series:[{pts,c:'var(--k2)'}],xl:i=>dateT(pts[i].d,'short'),tip:i=>`<b>${esc(moneyT(pts[i].v,2))}</b><br>${esc(dateT(pts[i].d,'long'))}`}):''}${low?`<p class="note">${esc(t('dy.low',{v:moneyT(low.v,2),d:dateT(low.d,'long')}))}</p>`:''}</div>
    <div style="display:flex;flex-direction:column;gap:16px"><div class="kpis k2" style="margin:0">${kpi(t('b.income'),`<span class="good">${money(g.inc,0)}</span>`,monthT(ym))}${kpi(t('b.expense'),money(g.exp,0),monthT(ym))}</div>
    <div class="card"><div class="ch"><div><h2>${esc(t('nav.budget'))}</h2><p>${esc(t('dy.budS'))}</p></div><button class="btn sm" data-a="go" data-v="budget">${esc(t('dy.open'))}</button></div></div></div></div>
    <div class="grid g3" style="margin-top:16px">${by.map(x=>`<button class="card dycard" data-a="dacc" data-v="${x.a.id}">${accAvatar(x.a)}<b>${esc(x.a.name)}</b><span class="muted">${esc(x.a.inst||typL(x.a.type))}</span><div class="dv">${money(accValue(x.a),2)}</div><div class="hrow note" style="gap:12px"><span class="good">+${esc(moneyT(x.inn,0))}</span><span>−${esc(moneyT(x.out,0))}</span><span>${esc(t('dy.ops',{n:x.n}))}</span></div>${x.last?`<span class="note" style="margin-top:4px">${esc(t('dy.last',{l:cleanLabel(x.last.l).slice(0,34),d:dateT(x.last.d,'short')}))}</span>`:''}</button>`).join('')}</div>`;
}
function dailyAcc(a){
  if(!a)return '';const pts=balHist(a,180);const prev=S.ui.bAcc;
  const l30=D().txs.filter(x=>x.acc===a.id&&x.d>=dAdd(today(),-30));const inn=sum(l30.filter(x=>x.a>0).map(x=>x.a)),out=-sum(l30.filter(x=>x.a<0).map(x=>x.a));
  const head=`<div class="grid g-21" style="margin-bottom:16px"><div class="card"><div class="hrow" style="gap:12px">${accAvatar(a)}<div><div class="eyebrow">${esc([typL(a.type),a.inst].filter(Boolean).join(' · '))}</div><div class="hero-v" style="font-size:34px">${money(accValue(a),2)}</div></div><span class="sp"></span><button class="btn sec sm" data-a="acc" data-v="${a.id}">${ico('edit')}${esc(t('dy.details'))}</button></div>
    ${pts.length>1?chart({h:170,series:[{pts,c:'var(--k2)'}],xl:i=>dateT(pts[i].d,'short'),tip:i=>`<b>${esc(moneyT(pts[i].v,2))}</b><br>${esc(dateT(pts[i].d,'long'))}`}):''}<p class="note">${esc(t('dy.histS'))}</p></div>
    <div class="kpis k2" style="margin:0;align-content:start">${kpi(t('dy.in30'),`<span class="good">${money(inn,0)}</span>`)}${kpi(t('dy.out30'),money(out,0))}${kpi(t('dy.net30'),`<span class="${cls(inn-out)}">${moneyS(inn-out,0)}</span>`)}${kpi(t('dy.n30'),String(l30.length))}</div></div>`;
  S.ui.bAcc=a.id;let body='';try{body=_budV({embed:true})}finally{S.ui.bAcc=prev}
  return head+body;
}
