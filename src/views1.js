/* ================= coque ================= */
const VIEWS=[
 {k:'home',g:'pilot',ic:'home'},{k:'wealth',g:'pilot',ic:'wealth'},{k:'invest',g:'pilot',ic:'invest'},{k:'budget',g:'pilot',ic:'budget'},{k:'live',g:'pilot',ic:'pulse'},
 {k:'perf',g:'ana',ic:'bars'},{k:'flux',g:'ana',ic:'swap'},{k:'proj',g:'ana',ic:'spark'},{k:'signals',g:'ana',ic:'alert'},
 {k:'income',g:'plan',ic:'income'},{k:'goals',g:'plan',ic:'goals'},{k:'sim',g:'plan',ic:'sim'},{k:'tax',g:'plan',ic:'tax'},
 {k:'recon',g:'data',ic:'shield'},{k:'method',g:'data',ic:'book'},
 {k:'copilot',g:'ai',ic:'copilot'},{k:'prefs',g:'sys',ic:'prefs'}
];
const MOBILE_NAV=['home','wealth','budget','invest'];
function shellHTML(){
  const v=S.ui.view,tt=totals();const nv=(v==='acct'||v==='sec')?(S.ui.back||'wealth'):({trading:'invest',target:'invest',review:'budget'})[v]||v;
  const nav=g=>VIEWS.filter(x=>x.g===g&&!x.hide&&!uiHidden(x.k)).map(x=>`<div class="nvg"><button class="nv" data-a="go" data-v="${x.k}"${nv===x.k?' aria-current="page"':''} title="${esc(t('nav.'+x.k))}">${ico(x.ic)}<span>${esc(t('nav.'+x.k))}</span>${x.k==='copilot'?`<i class="tag">${({fr:'IA',en:'AI',es:'IA',de:'KI'})[lang()]||'IA'}</i>`:''}</button>${typeof navSub==='function'?navSub(x.k):''}</div>`).join('');
  return `<div class="shell${priv()?' priv':''}">
  <aside class="side" aria-label="${esc(t('a11y.nav'))}">
    <div class="brand"><span class="mark">${MARK}</span><div><b>${APP.name}</b><small>${esc(t('brand.tag'))}</small></div></div>
    <nav class="nav"><h6>${esc(t('navg.pilot'))}</h6>${nav('pilot')}${(h=>h?`<h6>${esc(t('navg.ana'))}</h6>`+h:'')(nav('ana'))}${(h=>h?`<h6>${esc(t('navg.plan'))}</h6>`+h:'')(nav('plan'))}${(h=>h?`<h6>${esc(t('navg.data'))}</h6>`+h:'')(nav('data'))}${(h=>h?`<h6>${esc(t('navg.ai'))}</h6>`+h:'')(nav('ai'))}</nav>
    <div class="side-foot">
      <div class="nwmini"><div class="l">${esc(t('k.net'))}</div><div class="v">${money(tt.net,0)}</div></div>
      <nav class="nav">${nav('sys')}</nav>
    </div>
  </aside>
  <div class="main">
    <header class="top" id="top">
      <span class="mark mbrand">${MARK}</span>
      <h1>${esc(viewTitle())}</h1>${t('q.'+v)!=='q.'+v?`<span class="vq hide-m">${esc(t('q.'+v))}</span>`:''}<span class="sp"></span>
      <button class="search hide-m" data-a="cmd" aria-label="${esc(t('top.search'))}">${ico('search')}<span>${esc(t('top.search'))}</span><kbd>⌘K</kbd></button>
      <button class="ib" data-a="cmd" style="display:none" id="msearch" aria-label="${esc(t('top.search'))}">${ico('search')}</button>
      ${saveChip()}${finChip()}
      ${bellBtn()}
      <button class="ib" data-a="privacy" aria-pressed="${priv()}" aria-label="${esc(t('top.privacy'))}" title="${esc(t('top.privacy'))}">${ico(priv()?'eyeoff':'eye')}</button>
      <button class="btn" data-a="quick" aria-haspopup="menu">${ico('plus')}<span class="hide-m">${esc(t('top.add'))}</span></button>
    </header>
    <main class="content" id="content">${S.demo?demoBand():''}${viewHTML()}</main>
  </div></div>
  <nav class="bnav" aria-label="${esc(t('a11y.nav'))}">${MOBILE_NAV.map(k=>{const x=VIEWS.find(y=>y.k===k);return `<button class="bn" data-a="go" data-v="${k}"${nv===k?' aria-current="page"':''}>${ico(x.ic)}<span>${esc(t('navs.'+k))}</span></button>`}).join('')}<button class="bn" data-a="more"${MOBILE_NAV.includes(nv)?'':' aria-current="page"'}>${ico('more')}<span>${esc(t('navs.more'))}</span></button></nav>`;
}
function viewTitle(){const v=S.ui.view;if(v==='home'){const n=ST().name;const h=new Date().getHours();return n?t(h<5||h>=18?'home.hiEve':'home.hi',{n}):t('nav.home')}return t('nav.'+v)}
function demoBand(){return `<div class="demo-band" role="status">${ico('info')}<div><b>${esc(t('demo.t'))}</b> ${esc(t('demo.s'))}</div><span class="sp"></span><button class="btn sm" data-a="exitDemo">${esc(t(S.real&&S.real.accounts.length?'demo.back':'demo.create'))}</button></div>`}
function viewHTML(){
  const v=S.ui.view;
  try{
    switch(v){
      case 'home':return homeView();case 'wealth':return wealthView();case 'invest':return investView();case 'budget':return budgetView();
      case 'income':return incomeView();case 'goals':return goalsView();case 'sim':return simView();case 'tax':return taxView();
      case 'live':return liveView();case 'perf':return perfView();case 'flux':return fluxView();case 'proj':return projView();case 'signals':return signalsView();case 'recon':return reconView();case 'method':return methodView();
      case 'copilot':return copilotView();case 'prefs':return prefsView();
      default:if(EXT.V&&EXT.V[v])return EXT.V[v]();
    }
  }catch(e){console.error(e);try{w7Log(e,'view:'+v)}catch(x){}return `<div class="empty"><b>${esc(t('err.view'))}</b>${esc(String(e.message||e))}</div>`}
  return '';
}
function seg(act,opts,cur,label){return `<div class="seg" role="group" aria-label="${esc(label||'')}">${opts.map(([k,l])=>`<button data-a="${act}" data-v="${esc(k)}" aria-pressed="${k===cur}">${esc(l)}</button>`).join('')}</div>`}
const periodOpts=()=>['24H','1M','3M','6M','YTD','1Y','3Y','ALL'].map(k=>[k,t('per.'+k)]);
function emptyBlock(title,text,btn,act){return `<div class="empty"><b>${esc(title)}</b>${esc(text)}${btn?`<div><button class="btn" data-a="${act}">${ico('plus')}${esc(btn)}</button></div>`:''}</div>`}
function accAvatar(a,sm){const ty=TYP[a.type]||{};const c=CLS[ty.cls]||CLS.other;return `<span class="av${sm?' sm':''}" style="--c:var(${c.c})">${ico(ty.ic||'gem')}</span>`}

/* ================= synthèse ================= */
function homeParts(){
  const tt=totals();const d=D();
  const per=S.ui.period;const pts=per==='24H'?intraday24():seriesFor(per,'nw');
  const first=pts[0]?pts[0].v:tt.net,chg=tt.net-first,chgp=first?chg/Math.abs(first):0;
  const read=`<b>${money(tt.net)}</b> · ${esc(dateT(today()))}`;
  const pos=positions();const invVal=sum(pos.map(p=>p.value)),invCost=sum(pos.map(p=>p.cost));
  const pi=passiveIncome();const hl=health();
  const ym=curBudgetYm();const mg=aggTx(monthTx(ym));
  const segs=CLASSES.filter(c=>c.k!=='debt'&&tt.by[c.k]>0).map(c=>({k:c.k,l:clsL(c.k),v:tt.by[c.k],c:`var(${c.c})`}));
  const hero=`<div class="card">
    <div class="ch" style="margin-bottom:4px"><div><div class="eyebrow">${esc(t('k.net'))}</div></div><div class="act">${seg('period',periodOpts(),per,t('a11y.period'))}</div></div>
    <div class="hero-v">${heroMoney(tt.net)}</div>
    <div class="hrow"><span class="delta ${chg>=0?'up':'dn'}">${chg>=0?'▲':'▼'} ${moneyS(chg,0)} · ${pctS(chgp)}</span><span class="muted" style="font-size:13px">${esc(t('per.since.'+per))}</span></div>
    <div class="hover-read" id="nwread">${read}</div>
    ${chart({h:240,series:[{pts,c:'var(--accent)'}],xl:i=>pts[i].tm||dateT(pts[i].d,per==='1M'||per==='3M'?'short':'my'),tip:i=>richTip(pts,i,per==='24H'?2:0),read:'nwread',readDefault:read,label:t('k.net'),empty:t('home.histEmpty')})}
  </div>`;
  const alloc=`<div class="card"><div class="ch"><div><h2>${esc(t('home.alloc'))}</h2><p>${esc(t('home.allocSub'))}</p></div><button class="link" data-a="go" data-v="wealth">${esc(t('see.all'))}</button></div>
    ${donut(segs,esc(compactT(tt.gross)),t('k.gross'),'clsFilter')}
    <div class="legend" style="margin-top:16px">${segs.map(s=>`<button class="lg" data-a="clsFilter" data-v="${s.k}"><i class="sq" style="--c:${s.c}"></i><span class="n">${esc(s.l)}</span><span class="p">${pctT(s.v/(tt.gross||1))}</span><span class="v">${money(s.v,0)}</span></button>`).join('')}
    ${tt.debts>0?`<button class="lg" data-a="clsFilter" data-v="debt"><i class="sq" style="--c:var(--bad)"></i><span class="n">${esc(clsL('debt'))}</span><span class="p">${pctT(tt.debts/(tt.gross||1))}</span><span class="v bad">−${money(tt.debts,0)}</span></button>`:''}</div></div>`;
  const kpis=`<div class="kpis" style="margin:16px 0">
    ${kpi(t('k.gross'),money(tt.gross,0),t('k.grossS',{n:d.accounts.filter(a=>accCls(a)!=='debt').length}))}
    ${kpi(t('k.debts'),money(tt.debts,0),tt.gross?t('k.debtsS',{p:pctT(tt.debts/tt.gross,0)}):'')}
    ${kpi(t('k.liquid'),money(tt.liquid,0),hl.emergency!=null?t('k.liquidS',{n:numT(hl.emergency,1)}):'')}
    ${kpi(t('k.invested'),money(invVal,0),`<span class="${cls(invVal-invCost)}">${moneyS(invVal-invCost,0)} · ${pctS(invCost?(invVal-invCost)/invCost:0)}</span>`)}
    ${kpi(t('k.passive'),money(pi.total,pi.total<100?2:0),t('k.passiveS',{v:moneyT(pi.total/12,0)}))}
    ${kpi(t('k.savRate'),hl.savRate!=null?pctT(hl.savRate,0):'—',t('k.savRateS'))}
  </div>`;
  /* santé */
  const ins=insights(hl);
  const healthC=`<div class="card"><div class="ch"><div><h2>${esc(t('home.health'))}</h2><p>${esc(t('home.healthSub'))}</p></div></div>
    <div class="score">${ring(hl.score/100,hl.score>=70?'var(--good)':hl.score>=45?'var(--warn)':'var(--bad)','')}<div><div class="big">${hl.score}<span class="muted" style="font-size:16px">/100</span></div><div class="note">${esc(t(hl.score>=70?'health.good':hl.score>=45?'health.mid':'health.low'))}</div></div></div>
    <div class="list" style="margin-top:12px">${ins.slice(0,4).map(insHTML).join('')}</div></div>`;
  /* budget du mois */
  const bud=d.budgets;const bk=Object.keys(bud).filter(k=>bud[k]>0);const totB=sum(bk.map(k=>bud[k]));const spentB=sum(bk.map(k=>mg.cat[k]||0));
  const budC=`<div class="card"><div class="ch"><div><h2>${esc(t('home.month'))}</h2><p>${esc(monthT(ym))}</p></div><button class="link" data-a="go" data-v="budget">${esc(t('see.all'))}</button></div>
    <div class="grid g2 keep" style="gap:12px;margin-bottom:14px"><div><div class="note">${esc(t('b.income'))}</div><div style="font:600 20px var(--display)" class="good">${money(mg.inc,0)}</div></div><div><div class="note">${esc(t('b.expense'))}</div><div style="font:600 20px var(--display)">${money(mg.exp,0)}</div></div></div>
    ${totB?`<div class="note" style="display:flex;justify-content:space-between;margin-bottom:6px"><span>${esc(t('b.budgetUse'))}</span><span>${money(spentB,0)} / ${money(totB,0)}</span></div><div class="bar${spentB>totB?' over':''}"><i style="width:${clamp(spentB/totB*100,0,100)}%"></i></div>`:''}
    <div class="list" style="margin-top:10px">${bk.sort((a,b)=>(mg.cat[b]||0)/bud[b]-(mg.cat[a]||0)/bud[a]).slice(0,4).map(k=>{const s=mg.cat[k]||0,p=s/bud[k];return `<div class="row"><span class="av sm" style="--c:${cvar(CAT[k].c)}">${ico(CAT[k].ic)}</span><div class="m"><b>${esc(catL(k))}</b><div class="bar${p>1?' over':''}" style="margin-top:6px;--c:${cvar(CAT[k].c)}"><i style="width:${clamp(p*100,0,100)}%"></i></div></div><div class="r"><b>${money(s,0)}</b><span class="muted">/ ${money(bud[k],0)}</span></div></div>`}).join('')||`<p class="note">${esc(t('b.noBudget'))}</p>`}</div></div>`;
  /* objectifs */
  const goalsC=`<div class="card"><div class="ch"><div><h2>${esc(t('nav.goals'))}</h2><p>${esc(t('home.goalsSub'))}</p></div><button class="link" data-a="go" data-v="goals">${esc(t('see.all'))}</button></div>
    <div class="list">${d.goals.slice(0,3).map(g=>{const p=goalProjection(g);return `<button class="row btnrow" data-a="goal" data-v="${g.id}">${ring(p.pct)}<div class="m"><b>${esc(g.name)}</b><span>${money(p.cur,0)} / ${money(p.target,0)}</span><span>${p.date?esc(t('g.reach',{d:dateT(p.date,'my')})):esc(t('g.never'))}</span></div></button>`}).join('')||`<p class="note">${esc(t('g.empty'))}</p>`}</div></div>`;
  /* positions */
  const movers=[...pos].filter(p=>p.cost>0).sort((a,b)=>b.plp-a.plp);
  const top=movers.slice(0,3),worst=movers.slice(-2).reverse().filter(p=>!top.includes(p));
  const posRow=p=>`<button class="row btnrow" data-a="pos" data-v="${esc(p.key)}">${posAvatar(p)}<div class="m"><b>${esc(p.name)}</b><span>${money(p.value,0)}</span></div><div class="r"><b class="${cls(p.pl)}">${pctS(p.plp)}</b><span class="${cls(p.pl)}">${moneyS(p.pl,0)}</span></div></button>`;
  const posC=`<div class="card"><div class="ch"><div><h2>${esc(t('home.perf'))}</h2><p>${esc(t('home.perfSub'))}</p></div><button class="link" data-a="go" data-v="invest">${esc(t('see.all'))}</button></div><div class="list">${top.map(posRow).join('')}${worst.map(posRow).join('')||''}${!pos.length?`<p class="note">${esc(t('inv.empty'))}</p>`:''}</div></div>`;
  const recent=d.txs.slice().sort((a,b)=>b.d.localeCompare(a.d)).slice(0,6);
  const txC=`<div class="card"><div class="ch"><div><h2>${esc(t('home.recent'))}</h2><p>${esc(t('home.recentSub'))}</p></div><button class="link" data-a="budgetTab" data-v="ops">${esc(t('see.all'))}</button></div><div class="list">${recent.map(txRow).join('')||`<p class="note">${esc(t('b.noOps'))}</p>`}</div></div>`;
  const fc=finCheck();const finBand=!S.demo&&S.cap.mcp&&!(ST().finary&&ST().finary.at)?`<div class="demo-band" style="margin-bottom:16px">${ico('refresh')}<div><b>${esc(t('fin.inviteT'))}</b> ${esc(t('fin.inviteP'))}</div><button class="btn sm" data-a="finSync">${esc(t('fin.syncNow'))}</button></div>`:fc&&!fc.ok?`<button class="demo-band" data-a="finOpen" style="display:flex;gap:10px;align-items:center;font:inherit;color:inherit;margin-bottom:16px;width:100%;text-align:left;cursor:pointer;background:color-mix(in srgb,var(--warn) 10%,var(--surface));border-color:color-mix(in srgb,var(--warn) 40%,var(--line))">${ico('alert')}<div>${esc(t('fin.checkKo',{f:moneyT(fc.fin,2),v:moneyT(fc.vig,2)}))}</div></button>`:'';
  const sg=signals().slice(0,4);const sigC=sg.length?`<div class="card" style="margin-top:16px"><div class="ch"><div><h2>${esc(t('nav.signals'))}</h2><p>${esc(t('q.signals'))}</p></div><button class="link" data-a="go" data-v="signals">${esc(t('see.all'))}</button></div><div class="sigs compact">${sg.map(sigCard).join('')}</div></div>`:'';
  return {finBand,hero,alloc,kpis,sigC,healthC,budC,goalsC,posC,txC};
}
function heroMoney(v){const s=moneyT(v,2);if(priv())return esc(s);const m=s.match(/^(.*?)([.,]\d{2})(\s?\D*)$/);return m?`<span class="amt">${esc(m[1])}<span class="dec">${esc(m[2])}${esc(m[3])}</span></span>`:esc(s)}
function kpi(l,v,s){return `<div class="kpi"><div class="l">${esc(l)}</div><div class="v">${v}</div>${s?`<div class="s">${s}</div>`:''}</div>`}
function insights(h){
  const out=[];const S0=ST();
  if(h.emergency!=null){if(h.emergency<3)out.push({c:'--bad',ic:'alert',t:t('ins.emLowT'),p:t('ins.emLowP',{n:numT(h.emergency,1),m:S0.emergencyMonths})});
    else if(h.emergency>S0.emergencyMonths*2.5)out.push({c:'--info',ic:'info',t:t('ins.emHighT'),p:t('ins.emHighP',{n:numT(h.emergency,0)})});
    else out.push({c:'--good',ic:'shield',t:t('ins.emOkT'),p:t('ins.emOkP',{n:numT(h.emergency,1)})})}
  if(h.topW>.25&&h.top)out.push({c:'--warn',ic:'pie',t:t('ins.concT'),p:t('ins.concP',{n:h.top.name,p:pctT(h.topW,0)})});
  if(h.ter>.5)out.push({c:'--warn',ic:'receipt',t:t('ins.feesT'),p:t('ins.feesP',{p:pctT(h.ter/100,2)})});
  else if(h.ter>0)out.push({c:'--good',ic:'check',t:t('ins.feesOkT'),p:t('ins.feesOkP',{p:pctT(h.ter/100,2)})});
  if(h.savRate!=null){if(h.savRate<.1)out.push({c:'--warn',ic:'budget',t:t('ins.savLowT'),p:t('ins.savLowP',{p:pctT(h.savRate,0)})});else out.push({c:'--good',ic:'savings',t:t('ins.savOkT'),p:t('ins.savOkP',{p:pctT(h.savRate,0)})})}
  if(h.debtRatio>.5)out.push({c:'--bad',ic:'loan',t:t('ins.debtT'),p:t('ins.debtP',{p:pctT(h.debtRatio,0)})});
  const la=D().accounts.find(a=>a.type==='livretA');if(la&&accGross(la)>=22950)out.push({c:'--info',ic:'info',t:t('ins.capT'),p:t('ins.capP')});
  const unc=D().txs.filter(x=>x.c==='uncat').length;if(unc)out.push({c:'--warn',ic:'question',t:t('ins.uncT',{n:unc}),p:t('ins.uncP')});
  return out;
}
const insHTML=i=>`<div class="ins"><span class="ico" style="--c:var(${i.c})">${ico(i.ic)}</span><div><b>${esc(i.t)}</b><p>${esc(i.p)}</p></div></div>`;
function onboardingEmpty(){
  return `<div class="card" style="padding:32px"><div class="eyebrow">${esc(t('ob.step'))}</div><h2 style="font:600 28px/1.15 var(--display);letter-spacing:-.02em;margin:8px 0 10px">${esc(t('ob.t'))}</h2><p class="muted" style="max-width:60ch;margin:0 0 22px">${esc(t('ob.p'))}</p>
  <div class="grid g3">${[['checking','cash'],['livretA','savings'],['pea','bars'],['av','umbrella'],['property','house'],['wallet','crypto']].map(([ty,ic])=>`<button class="row btnrow card flat" style="border:1px solid var(--line);border-radius:14px;padding:14px" data-a="addAcc" data-v="${ty}"><span class="av" style="--c:var(${CLS[TYP[ty].cls].c})">${ico(ic)}</span><div class="m"><b>${esc(typL(ty))}</b><span>${esc(clsL(TYP[ty].cls))}</span></div>${ico('plus')}</button>`).join('')}</div>
  <div class="hrow" style="margin-top:22px"><button class="btn sec" data-a="import">${ico('upload')}${esc(t('ob.import'))}</button><button class="btn ghost" data-a="demo">${esc(t('ob.demo'))}</button></div></div>`;
}
function txRow(x){const c=CAT[x.c]||CAT.uncat;const acc=D().accounts.find(a=>a.id===x.acc);return `<button class="row btnrow" data-a="tx" data-v="${x.id}"><span class="av sm" style="--c:${cvar(c.c)}">${ico(c.ic)}</span><div class="m"><b>${esc(cleanLabel(x.l))}</b><span>${esc(catL(c.k))}${typeof subOf==='function'&&subOf(x)?' › '+esc(subL(x.c,subOf(x))):''} · ${esc(dateT(x.d,'short'))}${acc?' · '+esc(acc.name):''}</span></div><div class="r"><b class="${x.a>0?'good':''}">${moneyS(x.a,2,acc&&acc.cur)}</b></div></button>`}

/* ================= patrimoine ================= */
function wealthView(){
  const tt=totals(),d=D(),f=S.ui.cls||'all';
  if(!d.accounts.length)return onboardingEmpty();
  const segsAll=CLASSES.filter(c=>c.k!=='debt'&&tt.by[c.k]>0);
  const head=`<div class="grid g-21"><div class="card">
    <div class="grid wtop3">
      <div><div class="eyebrow">${esc(t('k.net'))}</div><div class="hero-v" style="font-size:clamp(28px,3.2vw,38px);white-space:nowrap">${money(tt.net,0)}</div></div>
      <div><div class="eyebrow">${esc(t('k.gross'))}</div><div style="font:600 22px/1.6 var(--display)">${money(tt.gross,0)}</div></div>
      <div><div class="eyebrow">${esc(t('k.debts'))}</div><div style="font:600 22px/1.6 var(--display)" class="${tt.debts?'bad':''}">${tt.debts?'−':''}${money(tt.debts,0)}</div></div>
    </div>
    <div class="stackbar" style="margin:16px 0 10px">${segsAll.map(c=>`<i style="--c:var(${c.c});width:${(tt.by[c.k]/tt.gross*100).toFixed(2)}%" title="${esc(clsL(c.k))}"></i>`).join('')}</div>
    <div class="chips">${[['all',t('w.all')]].concat(CLASSES.filter(c=>d.accounts.some(a=>accCls(a)===c.k)).map(c=>[c.k,clsL(c.k)])).map(([k,l])=>`<button class="chip" data-a="clsFilter" data-v="${k}" aria-pressed="${f===k}">${k!=='all'?`<i class="dot" style="--c:var(${CLS[k].c})"></i>`:''}${esc(l)}</button>`).join('')}</div>
  </div>
  <div class="card"><div class="ch"><div><h2>${esc(f==='all'?t('w.evo'):clsL(f))}</h2><p>${esc(t('per.since.'+S.ui.period))}</p></div></div>${(()=>{const pts=seriesFor(S.ui.period,f==='all'?'nw':f);const c=f==='all'?'var(--accent)':f==='debt'?'var(--bad)':`var(${CLS[f].c})`;return chart({h:150,series:[{pts:f==='debt'?pts.map(p=>({...p,v:-p.v})):pts,c}],axis:false,tip:i=>`<b>${esc(moneyT(Math.abs(pts[i].v),0))}</b><br>${esc(dateT(pts[i].d))}`,xl:i=>dateT(pts[i].d,'my'),empty:t('home.histEmpty')})})()}
  <div style="margin-top:10px">${seg('period',periodOpts(),S.ui.period,t('a11y.period'))}</div></div></div>`;
  const groups=CLASSES.filter(c=>(f==='all'||f===c.k)&&d.accounts.some(a=>accCls(a)===c.k)).map(c=>{
    const accs=d.accounts.filter(a=>accCls(a)===c.k).sort((a,b)=>Math.abs(accValue(b))-Math.abs(accValue(a)));
    const tot=sum(accs.filter(a=>a.include!==false).map(accValue));
    return `<section class="grp card"><div class="grp-h"><span class="av sm" style="--c:var(${c.c})">${ico(c.ic)}</span><b>${esc(clsL(c.k))}</b><span class="pill">${accs.length}</span><span class="sp"></span>${c.k!=='debt'&&tt.gross?`<span class="muted" style="font-size:12.5px">${pctT(tot/tt.gross)}</span>`:''}<span class="tot ${c.k==='debt'?'bad':''}">${money(tot,0)}</span></div>
      <div class="list">${accs.map(a=>{const v=accValue(a);const ty=TYP[a.type]||{};let sub=[a.inst,typL(a.type)].filter(Boolean).join(' · ');
        let right='';
        if(ty.h){const cost=sum(a.holdings.map(h=>hCost(h,a)));const hv=sum(a.holdings.map(h=>hVal(h,a)));right=cost?`<span class="${cls(hv-cost)}">${moneyS(hv-cost,0)} · ${pctS((hv-cost)/cost)}</span>`:''}
        else if(ty.rate||a.rate){right=`<span class="muted">${pctT(((+a.rate)||ST().rates[ty.rate]||0)/100,2)}</span>`}
        else if(ty.loan&&a.monthly){right=`<span class="muted">${esc(t('w.monthly',{v:moneyT(+a.monthly,0)}))}</span>`}
        else if(+a.rent){right=`<span class="muted">${esc(t('w.rent',{v:moneyT(+a.rent,0)}))}</span>`}
        return `<button class="row btnrow" data-a="acc" data-v="${a.id}" style="${a.include===false?'opacity:.5':''}">${accAvatar(a)}<div class="m"><b>${esc(a.name)}</b><span>${a.fid?`<i class="fdot ${a.fwarn?'warn':''}" title="${esc(t('fin.synced'))}"></i>`:''}${esc(sub)}${a.include===false?' · '+esc(t('w.excluded')):''}</span></div><div class="r"><b class="${v<0?'bad':''}">${money(v,0)}</b>${right}</div></button>`}).join('')}</div></section>`}).join('');
  return `${head}<div class="sec-t"><h2>${esc(t('w.accounts'))}</h2><div class="hrow"><button class="btn sec sm" data-a="prices">${ico('refresh')}${esc(t('inv.updatePrices'))}</button><button class="btn sm" data-a="addAcc">${ico('plus')}${esc(t('w.add'))}</button></div></div>${groups}`;
}

/* ================= fiche compte ================= */
function accDrawer(id){
  const a=D().accounts.find(x=>x.id===id);if(!a)return '';
  const ty=TYP[a.type]||{},v=accValue(a);
  let body=a.fid?`<button class="demo-band" data-a="finOpen" style="display:flex;gap:10px;align-items:center;font:inherit;color:inherit;margin:0 0 14px;width:100%;text-align:left;cursor:pointer${a.fwarn?';background:color-mix(in srgb,var(--warn) 10%,var(--surface));border-color:color-mix(in srgb,var(--warn) 40%,var(--line))':''}">${ico(a.fwarn?'alert':'refresh')}<div>${esc(t('fin.accBand',{i:a.inst||'Finary',t:finAgo(a.fsync)}))}${a.fwarn?' — '+esc(t('fin.w.'+a.fwarn)):''}</div></button>`:'';
  if(ty.h){
    const cost=sum(a.holdings.map(h=>hCost(h,a))),hv=sum(a.holdings.map(h=>hVal(h,a)));
    body+=`<div class="kpis" style="box-shadow:none;margin-bottom:16px">${kpi(t('inv.value'),money(hv,0))}${kpi(t('inv.pl'),`<span class="${cls(hv-cost)}">${moneyS(hv-cost,0)}</span>`,pctS(cost?(hv-cost)/cost:0))}${kpi(t('f.cash'),money(conv(+a.cash||0,a.cur),0))}</div>
    <div class="ch"><h2>${esc(t('inv.positions'))}</h2><div class="act"><button class="btn sec sm" data-a="pimport" data-v="${a.id}">${ico('upload')}${esc(t('acc.importPf'))}</button><button class="btn sm" data-a="addHold" data-v="${a.id}">${ico('plus')}${esc(t('inv.addPos'))}</button></div></div>${a.pfAt?`<p class="note" style="margin:-6px 0 10px;font-size:12.5px">${esc(t('acc.pfAt',{d:dateT(a.pfAt)}))}</p>`:''}
    <div class="list">${a.holdings.map(h=>{const hv=hVal(h,a),hc=hCost(h,a);return `<button class="row btnrow" data-a="editHold" data-v="${a.id}|${h.id}">${holdAvatar(h)}<div class="m"><b>${esc(h.name)}</b><span>${qtyT(+h.qty)} × ${esc(moneyT(+h.price,2,h.cur||a.cur))} · ${esc(t('inv.pru'))} ${esc(moneyT(+h.pru,2,h.cur||a.cur))}</span></div><div class="r"><b>${money(hv,0)}</b><span class="${cls(hv-hc)}">${pctS(hc?(hv-hc)/hc:0)}</span></div></button>`}).join('')||`<p class="note">${esc(t('inv.noPos'))}</p>`}</div>`;
    {const P=accPerf(a);if(P)body+=`<div class="card flat" style="margin:0 0 16px"><div class="hrow" style="justify-content:space-between;flex-wrap:wrap;gap:6px"><b>${esc(t('perf.t',{d:dateT(P.first)}))}</b><span class="pill ${P.total>=0?'good':'bad'}">${esc((P.total>=0?'+':'')+moneyT(P.total,2))} · ${esc(pctS(P.pct).replace(/<[^>]+>/g,''))}</span></div>
      <div class="kpis k4" style="box-shadow:none;margin-top:10px">${kpi(t('perf.net'),money(P.net,2))}${kpi(t('perf.value'),money(P.value,2))}${kpi(t('perf.latent'),`<span class="${cls(P.latent)}">${moneyS(P.latent,2)}</span>`)}${kpi(t('perf.real'),`<span class="${cls(P.real)}">${moneyS(P.real,2)}</span>`)}</div>
      <p class="note" style="margin:8px 0 0;font-size:12.5px">${esc(t('perf.note'))}</p></div>`}
    body+=iopsSection(a);
  }else{
    if(a.fid)body+=`<div class="card flat" style="margin-bottom:16px"><div class="lab">${esc(t(ty.cls==='debt'?'f.remaining':'f.balance'))}</div><b style="font-size:20px">${money(accGross(a),2)}</b><p class="note" style="margin:6px 0 0">${esc(t('fin.balNote',{t:finAgo(a.fsync)}))}</p></div>`;
    else if(a.ls&&+a.ls.p>0||a.type==='crowd'&&(a.projects||[]).length)body+=`<div class="card flat" style="margin-bottom:16px"><div class="lab">${esc(t(ty.cls==='debt'?'f.remaining':'f.balance'))}</div><b style="font-size:20px">${money(accGross(a),2)}</b><p class="note" style="margin:6px 0 0">${esc(t(a.ls?'as.autoLoan':'as.autoCrowd'))}</p></div>`;
    else body+=`<div class="card flat" style="margin-bottom:16px"><div class="lab">${esc(t(ty.cls==='debt'?'f.remaining':'f.balance'))}</div><form class="inline" data-form="quickBal" data-v="${a.id}" style="margin-top:8px"><input id="qb-${a.id}" name="v" type="number" step="0.01" inputmode="decimal" value="${+a.balance||0}" aria-label="${esc(t('f.balance'))}"><button class="btn">${esc(t('act.update'))}</button></form><p class="note" style="margin:8px 0 0">${esc(t(a.balAt?'acc.balAt':'acc.updated',{d:dateT(a.balAt||a.updatedAt||today())}))}</p></div>`;
    if(ty.cls==='cash'){const ops=D().txs.filter(x=>x.acc===a.id).sort((x,y)=>y.d.localeCompare(x.d));
      body+=`<div class="ch"><div><h2>${esc(t('acc.recentOps'))}</h2><p>${esc(t('b.count',{n:ops.length}))}</p></div><button class="btn sm" data-a="import" data-v="${a.id}">${ico('upload')}${esc(t('acc.importBtn'))}</button></div><div class="list">${ops.slice(0,8).map(txRow).join('')||`<p class="note">${esc(t('acc.noOps'))}</p>`}</div>`}
  }
  body+=EXT.accDrawer.map(fn=>fn(a)).join('');
  const facts=[];
  if(ty.rate||a.rate){const rate=(+a.rate)||ST().rates[ty.rate]||0;facts.push([t('f.rate'),pctT(rate/100,2)],[t('acc.interestY'),moneyT(accGross(a)*rate/100,2)]);if(ty.cap)facts.push([t('acc.cap'),`${moneyT(accGross(a),0)} / ${moneyT(ty.cap,0)}`])}
  if(ty.loan){const n=a.end?Math.max(0,Math.round(daysBetween(today(),a.end)/30.44)):null;facts.push([t('f.loanRate'),a.loanRate!=null?pctT(+a.loanRate/100,2):'—'],[t('f.monthly'),a.monthly?moneyT(+a.monthly,2):'—'],[t('f.end'),a.end?dateT(a.end):'—']);if(n!=null&&a.monthly){facts.push([t('acc.left'),t('acc.months',{n})],[t('acc.interestLeft'),moneyT(Math.max(0,n*(+a.monthly)-accGross(a)),0)])}}
  if(ty.cls==='realestate'&&+a.rent&&a.type!=='property'){facts.push([t('f.rent'),moneyT(+a.rent,0)],[t('acc.yield'),pctT(+a.rent*12/(accGross(a)||1),2)])}
  if(a.opened){const yrs=daysBetween(a.opened,today())/365.25;facts.push([t('f.opened'),dateT(a.opened)+' · '+t('acc.years',{n:numT(yrs,1)})])}
  if(a.cur&&a.cur!==ST().cur)facts.push([t('f.cur'),a.cur]);
  return `<div class="ph"><div style="display:flex;gap:12px;align-items:center">${accAvatar(a)}<div><div class="eyebrow">${esc(typL(a.type))}${a.inst?' · '+esc(a.inst):''}</div><h2>${esc(a.name)}</h2></div></div><div class="act">${favBtn('a:'+a.id)}<button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div></div>
  <div class="hero-v" style="font-size:36px;margin-top:0">${money(v)}</div>
  ${body}
  ${facts.length?`<div class="card flat" style="margin-top:16px">${facts.map(([l,v])=>`<div class="row"><div class="m muted">${esc(l)}</div><div class="r"><b>${esc(v)}</b></div></div>`).join('')}</div>`:''}
  ${a.note?`<p class="note" style="margin-top:14px">${esc(a.note)}</p>`:''}
  <div class="pfoot"><button class="btn ghost" data-a="delAcc" data-v="${a.id}">${ico('trash')}${esc(t(S.ui.confirm==='acc'+a.id?'act.confirmDel':'act.delete'))}</button><span class="sp"></span><button class="btn sec" data-a="toggleInc" data-v="${a.id}">${esc(t(a.include===false?'acc.include':'acc.exclude'))}</button><button class="btn" data-a="editAcc" data-v="${a.id}">${ico('edit')}${esc(t('act.edit'))}</button></div>`;
}
function typeOptions(sel){return CLASSES.map(c=>`<optgroup label="${esc(clsL(c.k))}">${TYPES.filter(x=>x.cls===c.k).map(x=>`<option value="${x.k}"${x.k===sel?' selected':''}>${esc(typL(x.k))}</option>`).join('')}</optgroup>`).join('')}
function accForm(id,preType){
  const a=id?D().accounts.find(x=>x.id===id):{type:preType||S.ui.formType||'checking',cur:ST().cur,include:true};
  const ty=TYP[S.ui.formType||a.type]||TYP.checking;const k=ty.k;
  const f=(name,label,input,cls='')=>`<div class="f ${cls}"><label for="af-${name}">${esc(label)}</label>${input}</div>`;
  const num=(name,val,step='0.01',ph='')=>`<input id="af-${name}" name="${name}" type="number" step="${step}" inputmode="decimal" value="${val??''}" placeholder="${esc(ph)}">`;
  return `<div class="ph"><div><h2>${esc(t(id?'acc.editT':'acc.newT'))}</h2><p>${esc(t('acc.formSub'))}</p></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  <form data-form="acc" data-v="${id||''}" class="form">
    ${f('type',t('f.type'),`<select id="af-type" name="type" data-a="formType">${typeOptions(k)}</select>`,'full')}
    ${f('name',t('f.name'),`<input id="af-name" name="name" required value="${esc(a.name||(id?'':typL(k)))}" maxlength="80">`)}
    ${f('inst',t('f.inst'),`<input id="af-inst" name="inst" value="${esc(a.inst||'')}" maxlength="60" placeholder="${esc(t('f.instPh'))}">`)}
    ${ty.h?f('cash',t('f.cash'),num('cash',a.cash)):f('balance',t(ty.cls==='debt'?'f.remaining':ty.cls==='realestate'||ty.cls==='other'?'f.estValue':'f.balance'),num('balance',a.balance))}
    ${f('cur',t('f.cur'),`<select id="af-cur" name="cur">${curOpts(a.cur||ST().cur)}</select>`)}
    ${ty.rate||k==='term'||k==='savingsOther'?f('rate',t('f.rateOv'),num('rate',a.rate,'0.01',ty.rate?String(ST().rates[ty.rate]):'')):''}
    ${ty.cls!=='debt'&&!ty.loan&&k!=='property'&&k!=='valuables'?f('opened',t('f.opened'),`<input id="af-opened" name="opened" type="date" value="${esc(a.opened||'')}">`):''}
    ${ty.cls==='realestate'&&k!=='property'?f('rent',t('f.rent'),num('rent',a.rent)):''}
    ${ty.loan?f('loanRate',t('f.loanRate'),num('loanRate',a.loanRate))+f('monthly',t('f.monthly'),num('monthly',a.monthly))+f('end',t('f.end'),`<input id="af-end" name="end" type="date" value="${esc(a.end||'')}">`):''}
    ${EXT.accForm.map(fn=>fn(k,ty,a,f,num)).join('')}
    <div class="f full"><label class="inline" style="font-size:13.5px;color:var(--fg)"><input type="checkbox" name="foreign" ${a.foreign?'checked':''}> ${esc(t('f.foreign'))}</label></div>
    ${f('note',t('f.note'),`<textarea id="af-note" name="note" maxlength="500">${esc(a.note||'')}</textarea>`,'full')}
    <div class="pfoot full" style="margin-top:6px"><button type="button" class="btn ghost" data-a="close">${esc(t('act.cancel'))}</button><button class="btn">${esc(t('act.save'))}</button></div>
  </form>`;
}
function holdForm(accId,hid){
  const a=D().accounts.find(x=>x.id===accId);if(!a)return '';const h=hid?a.holdings.find(x=>x.id===hid):{kind:a.type==='wallet'?'crypto':'etf',cur:a.cur,months:[]};
  const f=(name,label,input,cls='')=>`<div class="f ${cls}"><label for="hf-${name}">${esc(label)}</label>${input}</div>`;
  const num=(name,val,step='any')=>`<input id="hf-${name}" name="${name}" type="number" step="${step}" inputmode="decimal" value="${val??''}">`;
  const sel=(name,list,val,lab)=>`<select id="hf-${name}" name="${name}">${list.map(x=>`<option value="${x}"${x===val?' selected':''}>${esc(lab(x))}</option>`).join('')}</select>`;
  return `<div class="ph"><div><div class="eyebrow">${esc(a.name)}</div><h2>${esc(t(hid?'hold.editT':'hold.newT'))}</h2></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  <form data-form="hold" data-v="${a.id}|${hid||''}" class="form">
    ${f('name',t('f.secName'),`<input id="hf-name" name="name" required maxlength="80" value="${esc(h.name||'')}">`,'full')}
    ${f('gsym',t('f.gsym'),`<input id="hf-gsym" name="gsym" maxlength="24" value="${esc(h.gsym||'')}" placeholder="EPA:TTE">`)}
    ${f('ticker',t('f.ticker'),`<input id="hf-ticker" name="ticker" maxlength="16" value="${esc(h.ticker||'')}">`)}
    ${f('isin',t('f.isin'),`<input id="hf-isin" name="isin" maxlength="12" value="${esc(h.isin||'')}" placeholder="FR0000000000">`)}
    ${f('kind',t('f.kind'),sel('kind',KINDS,h.kind,kindL).replace('<select ','<select data-f="hkind" '))}
    ${f('cur',t('f.cur'),`<select id="hf-cur" name="cur">${curOpts(h.cur||a.cur)}</select>`)}
    ${f('qty',t('f.qty'),num('qty',h.qty))}
    ${f('pru',t('f.pru'),num('pru',h.pru))}
    ${f('price',t('f.price'),num('price',h.price))}
    ${f('ter',t('f.ter'),num('ter',h.ter))}
    ${f('region',t('f.region'),sel('region',REGIONS,h.region||'world',regL))}
    ${f('sector',t('f.sector'),sel('sector',SECTORS,h.sector||'diversified',secL))}
    ${f('div',t(h.kind==='fe'?'f.feRate':'f.div'),(()=>{const c=typeof catOf==='function'&&h.kind!=='fe'&&!h.divForce?catOf(h):null;const E=c?catDiv(h,a,c):null;return E?`<input id="hf-div" name="div" type="number" step="any" inputmode="decimal" value="" placeholder="${esc(numT(E.div,2)+' · '+t('ct.cat'))}">`:num('div',h.div)})())}
    ${EXT.holdForm.map(fn=>fn(a,h,f,num)).join('')}
    <div class="f full"><span class="lab">${esc(t('f.months'))}</span><div class="chips">${[1,2,3,4,5,6,7,8,9,10,11,12].map(m=>`<label class="chip"><input type="checkbox" name="m${m}" ${(h.months||[]).includes(m)?'checked':''}> ${esc(monthName(m))}</label>`).join('')}</div></div>
    <div class="pfoot full">${hid?`<button type="button" class="btn ghost" data-a="delHold" data-v="${a.id}|${h.id}">${ico('trash')}${esc(t(S.ui.confirm==='h'+h.id?'act.confirmDel':'act.delete'))}</button>`:''}${EXT.holdFoot.map(fn=>fn(a,h,hid)).join('')}<span class="sp"></span><button type="button" class="btn ghost" data-a="acc" data-v="${a.id}">${esc(t('act.cancel'))}</button><button class="btn">${esc(t('act.save'))}</button></div>
  </form>`;
}
