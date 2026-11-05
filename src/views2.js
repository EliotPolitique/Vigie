/* ================= investissements ================= */
function investView(){
  const envSet=S.ui.envSet||null;const pos=positions();const accs=investAccounts().filter(a=>!envSet||envSet.has(a.id));
  if(!accs.length)return emptyBlock(t('inv.emptyT'),t('inv.emptyP'),t('inv.addAcc'),'addAccInv');
  const fa=accs.some(a=>a.id===S.ui.invAcc)?S.ui.invAcc:'all';
  const list=fa==='all'&&!envSet?pos:positions().map(p=>{const lines=p.lines.filter(l=>fa==='all'?envSet.has(l.a.id):l.a.id===fa);if(!lines.length)return null;const value=sum(lines.map(l=>hVal(l.h,l.a))),cost=sum(lines.map(l=>hCost(l.h,l.a)));return {...p,lines,value,cost,qty:sum(lines.map(l=>+l.h.qty||0)),pl:value-cost,plp:cost?(value-cost)/cost:0}}).filter(Boolean);
  const val=sum(list.map(p=>p.value)),cost=sum(list.map(p=>p.cost));
  const divY=sum(list.map(p=>p.kind==='fe'?0:p.value*(p.div||0)/100));
  const ter=val?sum(list.map(p=>p.value*(p.ter||0)))/val:0;
  const cash=fa==='all'?sum(accs.map(a=>conv(+a.cash||0,a.cur))):conv(+(accs.find(a=>a.id===fa)||{}).cash||0,(accs.find(a=>a.id===fa)||{}).cur);
  const tab=S.ui.invTab||'pos';
  const head=`<div class="kpis" style="margin-bottom:16px">
    ${kpi(t('inv.value'),money(val+cash,0),t('inv.cashS',{v:moneyT(cash,0)}))}
    ${kpi(t('inv.cost'),money(cost,0))}
    ${kpi(t('inv.pl'),`<span class="${cls(val-cost)}">${moneyS(val-cost,0)}</span>`,`<span class="${cls(val-cost)}">${pctS(cost?(val-cost)/cost:0)}</span>`)}
    ${kpi(t('inv.divY'),money(divY,0),t('inv.yieldS',{p:pctT(val?divY/val:0,2)}))}
    ${kpi(t('inv.ter'),pctT(ter/100,2),t('inv.terS',{v:moneyT(val*ter/100,0)}))}
  </div>${liveBadgeHTML()}
  <div class="hrow" style="justify-content:space-between;margin-bottom:14px">
    ${seg('invTab',[['pos',t('inv.tabPos')],['alloc',t('inv.tabAlloc')],['div',t('inv.tabDiv')],['acc',t('inv.tabAcc')]],tab,'')}
    <div class="hrow"><select id="invAccSel" data-f="invAcc" style="width:auto;min-height:36px;padding:6px 12px;border-radius:999px" aria-label="${esc(t('inv.filterAcc'))}"><option value="all">${esc(t('inv.allAcc'))}</option>${accs.map(a=>`<option value="${a.id}"${a.id===fa?' selected':''}>${esc(a.name)}</option>`).join('')}</select><button class="btn sec sm" data-a="pimport">${ico('upload')}${esc(t('pi.btn'))}</button><button class="btn sec sm" data-a="prices">${ico('refresh')}${esc(t('inv.updatePrices'))}</button></div>
  </div>`;
  let body='';
  if(tab==='pos'){
    const sk=S.ui.sort||'value',dir=S.ui.sortDir||-1;
    const sorted=[...list].sort((a,b)=>{const va=sk==='name'?a.name:a[sk],vb=sk==='name'?b.name:b[sk];return (typeof va==='string'?va.localeCompare(vb):(va-vb))*dir});
    const th=(k,l)=>`<th><button data-a="sort" data-v="${k}"${sk===k?` aria-sort="${dir>0?'ascending':'descending'}"`:''}>${esc(l)}${sk===k?(dir>0?' ↑':' ↓'):''}</button></th>`;
    body=list.length?`<div class="tw cards"><table class="tbl"><thead><tr>${th('name',t('inv.colName'))}${th('qty',t('f.qty'))}<th>${esc(t('inv.pru'))}</th><th>${esc(t('f.price'))}</th>${th('value',t('inv.value'))}${th('pl',t('inv.pl'))}${th('plp','%')}<th>${esc(t('inv.weight'))}</th></tr></thead><tbody>
    ${sorted.map(p=>{const pr=p.lines[0];const c=p.cur;return `<tr class="click" data-a="pos" data-v="${esc(p.key)}"><td><div class="nm">${posAvatar(p)}<div><b>${esc(p.name)}</b><span>${esc([p.ticker,kindL(p.kind),p.lines.length>1?t('inv.nAcc',{n:p.lines.length}):pr.a.name].filter(Boolean).join(' · '))}${pr.h.liveAt&&isFinite(pr.h.chg)?` · <span class="${cls(pr.h.chg)}">${esc(t('live.d24'))} ${pctS(pr.h.chg)}</span>`:''}</span></div></div></td>
      <td data-l="${esc(t('f.qty'))}">${qtyT(p.qty)}</td><td data-l="${esc(t('inv.pru'))}">${esc(moneyT(p.qty?sum(p.lines.map(l=>(+l.h.qty||0)*(+l.h.pru||0)))/p.qty:0,2,c))}</td><td data-l="${esc(t('f.price'))}">${esc(moneyT(p.price,2,c))}${p.lines.some(l=>l.h.liveAt)?`<span class="lv">${esc(t('live.badge'))}</span>`:''}</td>
      <td data-l="${esc(t('inv.value'))}"><b>${money(p.value,0)}</b></td><td data-l="${esc(t('inv.pl'))}" class="${cls(p.pl)}">${moneyS(p.pl,0)}</td><td data-l="%" class="${cls(p.pl)}">${pctS(p.plp)}</td><td data-l="${esc(t('inv.weight'))}">${pctT(val?p.value/val:0)}</td></tr>`}).join('')}
    <tr class="tot"><td>${esc(t('inv.total'))}</td><td></td><td></td><td></td><td data-l="${esc(t('inv.value'))}">${money(val,0)}</td><td data-l="${esc(t('inv.pl'))}" class="${cls(val-cost)}">${moneyS(val-cost,0)}</td><td data-l="%" class="${cls(val-cost)}">${pctS(cost?(val-cost)/cost:0)}</td><td>100 %</td></tr></tbody></table></div>`:emptyBlock(t('inv.noPosT'),t('inv.noPos'),t('inv.addPos'),'addHoldAny');
  }else if(tab==='alloc'){
    const grp=(fn,lab,colors)=>{const m={};list.forEach(p=>{const k=fn(p)||'other';m[k]=(m[k]||0)+p.value});const arr=Object.entries(m).sort((a,b)=>b[1]-a[1]);const pal=['--k1','--k3','--k2','--k4','--k5','--k7','--k8','--k6'];return arr.map(([k,v],i)=>({k,l:lab(k),v,c:`var(${pal[i%pal.length]})`}))};
    const box=(title,segs)=>`<div class="card"><div class="ch"><h2>${esc(title)}</h2></div>${donut(segs,esc(compactT(val)),'')}<div class="legend" style="margin-top:14px">${segs.map(s=>`<div class="lg"><i class="sq" style="--c:${s.c}"></i><span class="n">${esc(s.l)}</span><span class="p">${pctT(s.v/(val||1))}</span><span class="v">${money(s.v,0)}</span></div>`).join('')}</div></div>`;
    const envSegs=grp(p=>p.lines.length>1?'multi':p.lines[0].a.type,k=>k==='multi'?t('inv.multi'):typL(k));
    body=`<div class="grid g3">${box(t('inv.byKind'),grp(p=>p.kind,kindL))}${box(t('inv.byRegion'),grp(p=>p.region,regL))}${box(t('inv.bySector'),grp(p=>p.sector,secL))}</div><div class="grid g2" style="margin-top:16px">${box(t('inv.byEnv'),envSegs)}<div class="card"><div class="ch"><div><h2>${esc(t('inv.divers'))}</h2><p>${esc(t('inv.diversSub'))}</p></div></div>${diversHTML(list,val)}</div></div>`;
  }else if(tab==='div'){
    const months=Array(12).fill(0);list.forEach(p=>{if(p.kind==='fe'||!p.div)return;const y=p.value*p.div/100;const ms=p.months&&p.months.length?p.months:[1,2,3,4,5,6,7,8,9,10,11,12];ms.forEach(m=>months[m-1]+=y/ms.length)});
    const cm=new Date().getMonth();
    body=`<div class="grid g-21"><div class="card"><div class="ch"><div><h2>${esc(t('inv.divCal'))}</h2><p>${esc(t('inv.divCalSub'))}</p></div></div>${chart({type:'bars',h:230,groups:months.map((v,i)=>({label:monthName(i+1),vals:[v],on:i===cm})),keys:[{c:'var(--accent)'}],noDim:true,label:t('inv.divCal')})}</div>
    <div class="card"><div class="ch"><h2>${esc(t('inv.divTop'))}</h2></div><div class="list">${list.filter(p=>p.div&&p.kind!=='fe').sort((a,b)=>b.value*b.div-a.value*a.div).map(p=>`<div class="row">${posAvatar(p)}<div class="m"><b>${esc(p.name)}</b><span>${pctT(p.div/100,2)} · ${esc((p.months||[]).map(monthName).join(', ')||t('inv.monthlyish'))}</span></div><div class="r"><b>${money(p.value*p.div/100,0)}</b><span class="muted">${esc(t('per.year'))}</span></div></div>`).join('')||`<p class="note">${esc(t('inv.noDiv'))}</p>`}</div></div></div>`;
  }else{
    body=`<div class="grid g2">${accs.filter(a=>fa==='all'||a.id===fa).map(a=>{const hv=sum(a.holdings.map(h=>hVal(h,a))),hc=sum(a.holdings.map(h=>hCost(h,a)));return `<button class="card" style="text-align:left;cursor:pointer" data-a="acc" data-v="${a.id}"><div class="ch" style="margin-bottom:8px"><div style="display:flex;gap:12px;align-items:center">${accAvatar(a)}<div><h2>${esc(a.name)}</h2><p>${esc([a.inst,typL(a.type)].filter(Boolean).join(' · '))}</p></div></div>${ico('chev')}</div><div style="font:600 26px var(--display);letter-spacing:-.02em">${money(accValue(a),0)}</div><div class="hrow" style="margin-top:6px"><span class="${cls(hv-hc)}">${moneyS(hv-hc,0)} · ${pctS(hc?(hv-hc)/hc:0)}</span><span class="muted">· ${esc(t('inv.nPos',{n:a.holdings.length}))}</span></div></button>`}).join('')}</div>`;
  }
  return head+body;
}
function diversHTML(list,val){
  if(!val)return `<p class="note">${esc(t('inv.noPos'))}</p>`;
  const w=list.map(p=>p.value/val);const hhi=sum(w.map(x=>x*x));const eff=hhi?1/hhi:0;
  const regions=new Set(list.map(p=>p.region)).size,sectors=new Set(list.map(p=>p.sector)).size;
  const etf=sum(list.filter(p=>['etf','fund','fe','scpi'].includes(p.kind)).map(p=>p.value))/val;
  const top3=sum(w.slice(0,3));
  const score=Math.round(clamp(eff*8,0,40)+clamp(regions*6,0,25)+clamp(sectors*3,0,15)+etf*20);
  return `<div class="score" style="margin-bottom:12px">${ring(clamp(score,0,100)/100,score>=65?'var(--good)':score>=40?'var(--warn)':'var(--bad)','')}<div><div class="big">${clamp(score,0,100)}</div><div class="note">${esc(t('inv.diversScore'))}</div></div></div>
  ${[[t('inv.effN'),numT(eff,1)],[t('inv.top3'),pctT(top3,0)],[t('inv.fundsShare'),pctT(etf,0)],[t('inv.nRegions'),String(regions)],[t('inv.nSectors'),String(sectors)]].map(([l,v])=>`<div class="row"><div class="m muted">${esc(l)}</div><div class="r"><b>${esc(v)}</b></div></div>`).join('')}`;
}
function posDrawer(key){
  const p=positions().find(x=>x.key===key);if(!p)return '';
  return `<div class="ph"><div><div class="eyebrow">${esc([p.ticker,kindL(p.kind),p.isin].filter(Boolean).join(' · '))}</div><h2>${esc(p.name)}</h2></div><div class="act">${favBtn('p:'+p.key)}${alertBtn(p.key)}<button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div></div>
  <div class="hero-v" style="font-size:36px;margin-top:0">${money(p.value)}</div><div class="hrow"><span class="delta ${p.pl>=0?'up':'dn'}">${moneyS(p.pl,0)} · ${pctS(p.plp)}</span></div>
  <div class="kpis" style="box-shadow:none;margin:16px 0">${kpi(t('f.qty'),qtyT(p.qty))}${kpi(t('f.price'),esc(moneyT(p.price,2,p.cur)))}${kpi(t('inv.cost'),money(p.cost,0))}</div>
  <div class="card flat">${[[t('f.region'),regL(p.region||'other')],[t('f.sector'),secL(p.sector||'other')],[t('f.ter'),pctT((p.ter||0)/100,2)],[t('f.div'),pctT((p.div||0)/100,2)],[t('inv.divY'),moneyT(p.kind==='fe'?0:p.value*(p.div||0)/100,0)]].concat(p.lines[0].h.liveAt?(isFinite(p.lines[0].h.chg)?[[t('live.d24'),pctS(+p.lines[0].h.chg)]]:[]).concat([[t('live.src'),(p.lines[0].h.liveSrc||LIVE_SERVER)+' · '+dateT(String(p.lines[0].h.liveAt).slice(0,10),'short')+' '+String(p.lines[0].h.liveAt).slice(11,16)+' UTC']]):[]).map(([l,v])=>`<div class="row"><div class="m muted">${esc(l)}</div><div class="r"><b>${esc(v)}</b></div></div>`).join('')}</div>
  ${(()=>{const hs=baseHist(p.lines[0].h);if(hs.length<2)return '';const pts=hs.map(x=>({d:x.d,v:x.v}));return `<div class="sec-t" style="margin-top:20px"><h2>${esc(t('live.hist'))}</h2><span class="note">${esc(t('live.histSub'))}</span></div><div class="card flat">${chart({h:170,series:[{pts,c:'var(--accent)'}],xl:i=>dateT(pts[i].d,'short'),tip:i=>`<b>${esc(moneyT(pts[i].v,2,hs[0].cur))}</b><br>${esc(dateT(pts[i].d))}`,fy:v=>moneyT(v,2,hs[0].cur)})}</div>`})()}
  ${posOpsSection(p)}
  <div class="sec-t" style="margin-top:20px"><h2>${esc(t('inv.lines'))}</h2></div>
  <div class="list">${p.lines.map(({a,h})=>`<button class="row btnrow" data-a="editHold" data-v="${a.id}|${h.id}">${accAvatar(a,1)}<div class="m"><b>${esc(a.name)}</b><span>${qtyT(+h.qty)} · ${esc(t('inv.pru'))} ${esc(moneyT(+h.pru,2,h.cur||a.cur))}</span></div><div class="r"><b>${money(hVal(h,a),0)}</b>${ico('edit')}</div></button>`).join('')}</div>`;
}
function pricesDrawer(){
  const pos=positions().filter(p=>p.kind!=='fe');
  return `<div class="ph"><div><h2>${esc(t('inv.updatePrices'))}</h2><p>${esc(t('prices.sub'))}</p></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  <form data-form="prices">${pos.map(p=>`<div class="row">${posAvatar(p)}<div class="m"><b>${esc(p.name)}${p.lines.some(l=>l.h.liveAt)?`<span class="lv">${esc(t('live.badge'))}</span>`:''}</b><span>${esc(p.ticker||'')} · ${esc(p.cur)}</span></div><input name="${esc(p.key)}" type="number" step="any" inputmode="decimal" value="${p.price}" style="width:130px;text-align:right" aria-label="${esc(t('f.price'))} ${esc(p.name)}"></div>`).join('')||`<p class="note">${esc(t('inv.noPos'))}</p>`}
  <div class="pfoot"><button type="button" class="btn ghost" data-a="close">${esc(t('act.cancel'))}</button><button class="btn">${esc(t('act.save'))}</button></div></form>`;
}

/* ================= budget ================= */
function budgetViewV1(noNav){
  const d=D();const ym=S.ui.ym||curBudgetYm();const tab=S.ui.bTab||'over';
  const months=txMonths();const g=aggTx(monthTx(ym));
  const nav=`<div class="hrow" style="justify-content:space-between;margin-bottom:16px">
    <div class="hrow"><button class="ib" data-a="ym" data-v="-1" aria-label="${esc(t('b.prev'))}">${ico('chevl')}</button><b style="font:600 18px var(--display);min-width:150px;text-align:center;text-transform:capitalize">${esc(monthT(ym))}</b><button class="ib" data-a="ym" data-v="1" aria-label="${esc(t('b.next'))}" ${ym>=today().slice(0,7)?'disabled style="opacity:.4"':''}>${ico('chev')}</button></div>
    ${seg('budgetTab',[['over',t('b.tabOver')],['ops',t('b.tabOps')],['bud',t('b.tabBud')],['rec',t('b.tabRec')]],tab,'')}
    <div class="hrow"><button class="btn sec sm" data-a="import">${ico('upload')}${esc(t('b.import'))}</button><button class="btn sm" data-a="addTx">${ico('plus')}${esc(t('b.addTx'))}</button></div></div>`;
  if(!d.txs.length&&tab!=='bud')return nav+`<div class="empty"><b>${esc(t('b.emptyT'))}</b>${esc(t('b.emptyP'))}<div class="hrow" style="justify-content:center;margin-top:14px"><button class="btn" data-a="import">${ico('upload')}${esc(t('b.import'))}</button><button class="btn sec" data-a="addTx">${ico('plus')}${esc(t('b.addTx'))}</button></div></div>`;
  let body='';
  if(tab==='over'){
    const last12=[];for(let i=11;i>=0;i--)last12.push(ymAdd(today().slice(0,7),-i));
    const aggs=last12.map(m=>({m,g:aggTx(monthTx(m))}));
    const segs=CATS.filter(c=>c.kind==='out'||c.kind==='nc').map(c=>({k:c.k,l:catL(c.k),v:g.cat[c.k]||0,c:cvar(c.c)})).filter(s=>s.v>0).sort((a,b)=>b.v-a.v);
    const rest=g.inc-g.exp-g.sav;
    body=`<div class="kpis" style="margin-bottom:16px">${kpi(t('b.income'),`<span class="good">${money(g.inc,0)}</span>`)}${kpi(t('b.expense'),money(g.exp,0))}${kpi(t('b.saved'),money(g.sav,0),t('b.savedS'))}${kpi(t('b.rest'),`<span class="${cls(rest)}">${moneyS(rest,0)}</span>`,t('b.restS'))}${kpi(t('k.savRate'),g.rate!=null?pctT(g.rate,0):'—',t('b.rateS'))}</div>
    <div class="grid g-21"><div class="card"><div class="ch"><div><h2>${esc(t('b.flow'))}</h2><p>${esc(t('b.flowSub'))}</p></div><div class="hrow" style="font-size:12px"><span class="hrow" style="gap:6px"><i class="sq" style="--c:var(--good)"></i>${esc(t('b.income'))}</span><span class="hrow" style="gap:6px"><i class="sq" style="--c:var(--k5)"></i>${esc(t('b.expense'))}</span><span class="hrow" style="gap:6px"><i class="sq" style="--c:var(--accent)"></i>${esc(t('b.saved'))}</span></div></div>
      ${chart({type:'bars',h:240,act:'ymSet',groups:aggs.map(x=>({key:x.m,label:monthT(x.m,true),vals:[x.g.inc,x.g.exp,x.g.sav],on:x.m===ym,title:monthT(x.m)})),keys:[{c:'var(--good)'},{c:'var(--k5)'},{c:'var(--accent)'}],label:t('b.flow')})}</div>
    <div class="card"><div class="ch"><div><h2>${esc(t('b.byCat'))}</h2><p>${esc(monthT(ym))}</p></div></div>${donut(segs,esc(compactT(g.exp)),t('b.expense'),'catFilter')}<div class="legend" style="margin-top:14px">${segs.slice(0,8).map(s=>`<button class="lg" data-a="catFilter" data-v="${s.k}"><i class="sq" style="--c:${s.c}"></i><span class="n">${esc(s.l)}</span><span class="p">${pctT(s.v/(g.exp||1),0)}</span><span class="v">${money(s.v,0)}</span></button>`).join('')||`<p class="note">${esc(t('b.noOpsM'))}</p>`}</div></div></div>
    <div class="grid g2" style="margin-top:16px"><div class="card"><div class="ch"><div><h2>${esc(t('b.topExp'))}</h2></div></div><div class="list">${monthTx(ym).filter(x=>x.a<0&&(CAT[x.c]||{}).kind!=='move'&&(CAT[x.c]||{}).kind!=='save').sort((a,b)=>a.a-b.a).slice(0,6).map(txRow).join('')||`<p class="note">${esc(t('b.noOpsM'))}</p>`}</div></div>
    <div class="card"><div class="ch"><div><h2>${esc(t('b.incSrc'))}</h2></div></div><div class="list">${CATS.filter(c=>c.kind==='in').map(c=>({c,v:g.cat[c.k]||0})).filter(x=>x.v>0).map(({c,v})=>`<div class="row"><span class="av sm" style="--c:${cvar(c.c)}">${ico(c.ic)}</span><div class="m"><b>${esc(catL(c.k))}</b><div class="bar" style="margin-top:6px;--c:${cvar(c.c)}"><i style="width:${(v/(g.inc||1)*100).toFixed(1)}%"></i></div></div><div class="r"><b class="good">${money(v,0)}</b><span class="muted">${pctT(v/(g.inc||1),0)}</span></div></div>`).join('')||`<p class="note">${esc(t('b.noOpsM'))}</p>`}</div></div></div>`;
  }else if(tab==='ops'){
    const q=S.ui.q||'',fl=S.ui.fl||'all',fc=S.ui.fc||'';
    let rows=(typeof txOf==='function'?txOf(d.txs):d.txs).filter(x=>S.ui.allMonths?true:ymOf(x.d)===ym);
    if(fl==='in')rows=rows.filter(x=>x.a>0);else if(fl==='out')rows=rows.filter(x=>x.a<0);else if(fl==='nc')rows=rows.filter(x=>x.c==='uncat');
    if(fc)rows=rows.filter(x=>x.c===fc);const fs=S.ui.fs;if(fc&&fs!=null&&fs!==undefined&&typeof subOf==='function')rows=rows.filter(x=>(subOf(x)||'_')===fs);
    if(q){const nq=norm(q);rows=rows.filter(x=>norm(x.l+' '+catL(x.c)+' '+(x.note||'')).includes(nq)||String(Math.abs(x.a)).includes(q.replace(',','.')))}
    rows.sort((a,b)=>b.d.localeCompare(a.d));
    const byDay={};rows.forEach(x=>(byDay[x.d]=byDay[x.d]||[]).push(x));
    const shown=Object.keys(byDay).slice(0,S.ui.lim||40);
    body=`<div class="hrow" style="margin-bottom:12px"><input id="txq" data-f="q" type="search" placeholder="${esc(t('b.search'))}" value="${esc(q)}" style="max-width:340px;border-radius:999px" aria-label="${esc(t('b.search'))}">
      <div class="chips">${[['all',t('b.fAll')],['out',t('b.expense')],['in',t('b.income')],['nc',t('b.fNc')]].map(([k,l])=>`<button class="chip" data-a="fl" data-v="${k}" aria-pressed="${fl===k}">${esc(l)}</button>`).join('')}${fc?`<button class="chip" data-a="catFilter" data-v="" aria-pressed="true">${esc(catL(fc))}${fc&&S.ui.fs!=null&&typeof subL==='function'?' › '+esc(subL(fc,S.ui.fs==='_'?'':S.ui.fs)):''} ${ico('x')}</button>`:''}</div>
      <label class="inline note" style="margin-left:auto"><input type="checkbox" data-f="allMonths" ${S.ui.allMonths?'checked':''}> ${esc(t('b.allMonths'))}</label></div>
      <div class="card" style="padding:4px 16px 12px">${shown.map(dd=>`<div class="day-h"><span style="text-transform:capitalize">${esc(dateT(dd,'long'))}</span><span>${moneyS(sum(byDay[dd].map(x=>x.a)),2)}</span></div><div class="list">${byDay[dd].map(txRow).join('')}</div>`).join('')||`<p class="note" style="padding:16px 0">${esc(t('b.noMatch'))}</p>`}
      ${Object.keys(byDay).length>shown.length?`<div style="text-align:center;padding-top:10px"><button class="btn sec sm" data-a="more40">${esc(t('b.more'))}</button></div>`:''}</div>
      <p class="note" style="margin-top:10px">${esc(t('b.count',{n:rows.length}))} · ${moneyS(sum(rows.map(x=>x.a)),2)}</p>`;
  }else if(tab==='bud'){
    const avg={};const prev=[1,2,3].map(i=>aggTx(monthTx(ymAdd(today().slice(0,7),-i))));CATS.filter(c=>c.kind==='out').forEach(c=>avg[c.k]=sum(prev.map(p=>p.cat[c.k]||0))/3);
    const bud=d.budgets;const tb=sum(Object.values(bud).map(v=>+v||0)),ts=sum(CATS.filter(c=>bud[c.k]>0).map(c=>g.cat[c.k]||0));
    body=`<div class="card" style="margin-bottom:16px"><div class="ch"><div><h2>${esc(t('b.budTot'))}</h2><p>${esc(monthT(ym))}</p></div><button class="btn sec sm" data-a="suggestBud">${ico('spark')}${esc(t('b.suggest'))}</button></div>
      <div class="hrow" style="justify-content:space-between;margin-bottom:8px"><span style="font:600 24px var(--display)">${money(ts,0)} <span class="muted" style="font-size:15px">/ ${money(tb,0)}</span></span><span class="${ts>tb?'bad':'good'}">${tb?(ts>tb?t('b.over',{v:moneyT(ts-tb,0)}):t('b.left',{v:moneyT(tb-ts,0)})):''}</span></div><div class="bar${ts>tb?' over':''}" style="height:10px"><i style="width:${tb?clamp(ts/tb*100,0,100):0}%"></i></div></div>
    <div class="card"><div class="list">${CATS.filter(c=>c.kind==='out').map(c=>{const s=g.cat[c.k]||0,b=+bud[c.k]||0,p=b?s/b:0;return `<div class="row" style="flex-wrap:wrap"><span class="av sm" style="--c:${cvar(c.c)}">${ico(c.ic)}</span><div class="m" style="min-width:160px"><b>${esc(catL(c.k))}</b><span>${esc(t('b.avg3',{v:moneyT(avg[c.k],0)}))}</span>${b?`<div class="bar${p>1?' over':''}" style="margin-top:6px;--c:${cvar(c.c)}"><i style="width:${clamp(p*100,0,100)}%"></i></div>`:''}</div><div class="r" style="min-width:90px"><b class="${p>1?'bad':''}">${money(s,0)}</b>${b?`<span class="muted">${pctT(p,0)}</span>`:''}</div><input type="number" min="0" step="10" inputmode="decimal" data-f="bud" data-v="${c.k}" id="bud-${c.k}" value="${b||''}" placeholder="${esc(t('b.noLimit'))}" style="width:120px;text-align:right" aria-label="${esc(t('b.limitFor',{c:catL(c.k)}))}"></div>`}).join('')}</div></div>`;
  }else{
    const rec=recurring();const tot=sum(rec.map(r=>r.avg));
    body=`<div class="kpis" style="margin-bottom:16px">${kpi(t('b.recMonthly'),money(tot,0))}${kpi(t('b.recYearly'),money(tot*12,0))}${kpi(t('b.recCount'),String(rec.length))}</div>
    <div class="card"><div class="ch"><div><h2>${esc(t('b.recT'))}</h2><p>${esc(t('b.recSub'))}</p></div></div><div class="list">${rec.map(r=>`<div class="row"><span class="av sm" style="--c:${cvar((CAT[r.c]||CAT.uncat).c)}">${ico((CAT[r.c]||CAT.uncat).ic)}</span><div class="m"><b>${esc(r.l)}</b><span>${esc(catL(r.c))} · ${esc(t('b.recDay',{d:r.day}))} · ${esc(t('b.recSeen',{n:r.n}))}</span></div><div class="r"><b>${money(r.avg,2)}</b><span class="muted">${esc(moneyT(r.avg*12,0))} / ${esc(t('per.year'))}</span></div></div>`).join('')||`<p class="note">${esc(t('b.recNone'))}</p>`}</div></div>`;
  }
  return noNav?body:nav+body;
}
function catOptions(sel){return [['in',t('b.income')],['out',t('b.expense')],['save',t('cat.saving')],['move',t('cat.transfer')],['nc','']].map(([kind,l])=>{const o=CATS.filter(c=>c.kind===kind).map(c=>`<option value="${c.k}"${c.k===sel?' selected':''}>${esc(catL(c.k))}</option>`).join('');return l&&kind!=='save'&&kind!=='move'?`<optgroup label="${esc(l)}">${o}</optgroup>`:o}).join('')}
function txDrawer(id){
  const x=id?D().txs.find(y=>y.id===id):{d:today(),a:'',l:'',c:'uncat',acc:(D().accounts.find(a=>a.type==='checking')||D().accounts[0]||{}).id};
  if(!x)return '';
  const accs=D().accounts.filter(a=>['cash','savings'].includes(accCls(a)));
  return `<div class="ph"><div><h2>${esc(t(id?'tx.editT':'tx.newT'))}</h2>${id?`<p>${esc(x.l)}</p>`:''}</div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  <form data-form="tx" data-v="${id||''}" class="form">
    <div class="f full"><label for="tf-l">${esc(t('f.label'))}</label><input id="tf-l" name="l" required maxlength="140" value="${esc(x.l)}"></div>
    <div class="f"><label for="tf-a">${esc(t('f.amount'))}</label><input id="tf-a" name="a" type="number" step="0.01" inputmode="decimal" required value="${x.a}" placeholder="-12,50"><span class="hint">${esc(t('f.amountHint'))}</span></div>
    <div class="f"><label for="tf-d">${esc(t('f.date'))}</label><input id="tf-d" name="d" type="date" required value="${esc(x.d)}"></div>
    <div class="f"><label for="tf-c">${esc(t('f.cat'))}</label><select id="tf-c" name="c" data-f="txCat">${catOptions(x.c)}</select></div><div class="f"><label for="tf-s">${esc(t('bg.sub'))}</label><select id="tf-s" name="s">${subOptions(x.c,subOf(x))}</select></div>
    <div class="f"><label for="tf-acc">${esc(t('f.account'))}</label><select id="tf-acc" name="acc"><option value="">—</option>${accs.map(a=>`<option value="${a.id}"${a.id===x.acc?' selected':''}>${esc(a.name)}</option>`).join('')}</select></div>
    <div class="f full"><label for="tf-n">${esc(t('f.note'))}</label><input id="tf-n" name="note" maxlength="200" value="${esc(x.note||'')}"></div>
    ${id?`<div class="f full"><label class="inline" style="font-size:13.5px;color:var(--fg)"><input type="checkbox" name="rule"${(()=>{const p=norm(cleanLabel(x.l)).split(' ').slice(0,2).join(' ');return p&&p.length>=3&&D().txs.some(y=>y.id!==x.id&&(' '+norm(cleanLabel(y.l))).startsWith(' '+p))?' checked':''})()}> ${esc(t('tx.rule',{p:norm(cleanLabel(x.l)).split(' ').slice(0,2).join(' ')}))}</label></div>`:''}
    <div class="pfoot full">${id?`<button type="button" class="btn ghost" data-a="delTx" data-v="${x.id}">${ico('trash')}${esc(t(S.ui.confirm==='tx'+x.id?'act.confirmDel':'act.delete'))}</button>`:''}<span class="sp"></span><button type="button" class="btn ghost" data-a="close">${esc(t('act.cancel'))}</button><button class="btn">${esc(t('act.save'))}</button></div>
  </form>`;
}

/* ================= import ================= */
function importAccounts(){return D().accounts.filter(a=>accCls(a)==='cash')}
function importDrawer(){
  const I=S.ui.imp||{};
  const head=`<div class="ph"><div><h2>${esc(t('imp.t'))}</h2><p>${esc(t('imp.sub'))}</p></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>`;
  if(I.busy)return head+`<div class="empty" style="border-style:solid"><b>${esc(t('imp.reading',{f:I.busyName||''}))}</b>${esc(t('imp.readingP'))}</div>`;
  if(I.needPwd)return head+`<form class="card flat" data-form="impPwd" style="display:grid;gap:10px"><div class="hrow" style="gap:8px">${ico('lock')}<b>${esc(t('pi.pwdT'))}</b></div><p class="note" style="margin:0">${esc(I.name||'')} — ${esc(t('pi.pwdP'))}</p><div class="form" style="margin:0"><div class="f full"><label for="im-pwd">${esc(t('pi.pwdL'))}</label><input id="im-pwd" name="pwd" type="password" autocomplete="off" required></div></div>${I.needPwd.bad?`<p class="bad" style="margin:0;font-size:13px">${esc(t('pi.pwdBad'))}</p>`:''}<div class="hrow" style="justify-content:space-between"><button type="button" class="btn ghost" data-a="impReset">${esc(t('act.cancel'))}</button><button class="btn">${ico('check')}${esc(t('pi.pwdGo'))}</button></div></form>`;
  if(!I.kind)return head+`${I.acc&&I.lockAcc?`<div class="card flat" style="margin-bottom:14px;display:flex;gap:12px;align-items:center">${accAvatar(D().accounts.find(a=>a.id===I.acc)||{type:'checking'},1)}<div><div class="note">${esc(t('imp.into'))}</div><b>${esc((D().accounts.find(a=>a.id===I.acc)||{}).name||'')}</b></div></div>`:''}
    <label class="drop" id="drop">${ico('upload')}<b>${esc(t('imp.drop'))}</b><span class="note">${esc(t('imp.formats2'))}</span><input type="file" id="impFile" multiple accept=".pdf,.csv,.txt,.ofx,.qfx,application/pdf,text/csv"></label>
    <div class="card flat" style="margin-top:16px"><h2 style="font-size:14px;margin-bottom:8px">${esc(t('imp.howT'))}</h2><p class="note" style="margin:0">${esc(t('imp.howP2'))}</p></div>
    ${I.err?`<p class="bad" style="margin-top:12px">${esc(I.err)}</p>`:''}`;
  const accs=importAccounts();
  const prev=importPreview();
  const queue=I.queue&&I.queue.length?`<span class="pill acc">${esc(t('imp.queue',{n:I.queue.length}))}</span>`:'';
  let src='';
  if(I.kind==='csv'||I.kind==='ofx'){
    const cols=I.header.map((h,i)=>`<option value="${i}">${esc(h||t('imp.col',{n:i+1}))}</option>`).join('');
    const sel=(k,l)=>`<div class="f"><label for="im-${k}">${esc(l)}</label><select id="im-${k}" data-f="impMap" data-v="${k}"><option value="-1">—</option>${cols.replace(`value="${I.map[k]}"`,`value="${I.map[k]}" selected`)}</select></div>`;
    src=`<div class="mapgrid">${sel('date',t('f.date'))}${sel('label',t('f.label'))}${sel('amount',t('f.amount'))}${sel('debit',t('imp.debit'))}${sel('credit',t('imp.credit'))}</div>
    <label class="inline note" style="margin-top:10px"><input type="checkbox" data-f="impInv" ${I.inv?'checked':''}> ${esc(t('imp.invert'))}</label>`;
  }else{
    const R=I.res;const bc=balanceCheck(R);
    const facts=[[t('imp.bank'),R.bank||t('imp.bankUnknown')],[t('imp.period'),R.period?dateT(R.period.from)+' → '+dateT(R.period.to):'—'],[t('imp.pages'),String(R.pages||1)]];
    src=`${R.sections?`<div class="form" style="margin:0 0 12px"><div class="f full"><label for="im-sec">${esc(t('imp.section'))}</label><select id="im-sec" data-f="impSec">${R.sections.map((x,k)=>`<option value="${k}"${(I.sec||0)===k?' selected':''}>${esc(x.name||t('imp.col',{n:k+1}))} · ${esc(t('b.count',{n:x.ops.length}))}</option>`).join('')}</select></div><p class="note" style="margin:6px 0 0;font-size:12.5px">${esc(t('imp.sectionP'))}</p></div>`:''}<div class="grid g3" style="gap:10px">${facts.map(([l,v])=>`<div class="card flat" style="padding:12px"><div class="note">${esc(l)}</div><b>${esc(v)}</b></div>`).join('')}</div>
    ${bc?`<div class="demo-band" style="margin:12px 0 0;${bc.ok?'':'background:color-mix(in srgb,var(--warn) 12%,var(--surface));border-color:color-mix(in srgb,var(--warn) 40%,var(--line))'}">${ico(bc.ok?'check':'alert')}<div>${bc.ok?esc(t('imp.balOk',{s:moneyT(bc.start),e:moneyT(bc.end)})):esc(t('imp.balKo',{d:moneyT(Math.abs(bc.diff))}))}</div></div>`:R.ops.length?`<p class="note" style="margin:12px 0 0">${esc(t('imp.balNone'))}</p>`:''}
    ${(R.warn||[]).map(w=>`<p class="warn" style="margin:8px 0 0;font-size:13px">${esc(w.k?t('imp.w.'+w.k,{n:w.n}):w)}</p>`).join('')}
    ${!R.ops.length||R.chars<80||(bc&&!bc.ok)?`<div class="card flat" style="margin-top:12px"><b>${esc(t(R.chars<80?'imp.scanT':R.ops.length?'imp.aiT2':'imp.aiT'))}</b><p class="note" style="margin:4px 0 10px">${esc(t(R.chars<80?'imp.scanP':'imp.aiP'))}</p>${S.cap.sample?`<button class="btn sec sm" data-a="impAi" ${I.ai?'disabled':''}>${ico('copilot')}${esc(t(I.ai?'imp.aiBusy':'imp.aiGo'))}</button>`:`<span class="note">${esc(t('imp.aiOff'))}</span>`}</div>`:''}`;
  }
  const newAcc=I.acc==='__new'?`<div class="form" style="margin-top:10px"><div class="f"><label for="im-nname">${esc(t('imp.newName'))}</label><input id="im-nname" data-f="impNewName" value="${esc(I.newName||'')}"></div><div class="f"><label for="im-ntype">${esc(t('f.type'))}</label><select id="im-ntype" data-f="impNewType"><option value="checking"${I.newType!=='card'?' selected':''}>${esc(typL('checking'))}</option><option value="card"${I.newType==='card'?' selected':''}>${esc(typL('card'))}</option></select></div></div>`:'';
  const bal=importBalance();
  return head+`<div class="card flat" style="margin-bottom:14px"><div class="hrow" style="justify-content:space-between"><div class="hrow" style="gap:8px">${ico(I.kind==='pdf'?'receipt':'budget')}<b>${esc(I.name)}</b>${queue}</div><button class="link" data-a="impReset">${esc(t('imp.other'))}</button></div></div>
  ${src}
  <div class="form" style="margin-top:14px"><div class="f full"><label for="im-acc">${esc(t('f.account'))}</label><select id="im-acc" data-f="impAcc">${!I.acc?`<option value="" selected disabled>${esc(t('imp.pickAcc'))}</option>`:''}${accs.map(a=>`<option value="${a.id}"${a.id===I.acc?' selected':''}>${esc(a.name)} · ${esc(typL(a.type))}</option>`).join('')}<option value="__new"${I.acc==='__new'?' selected':''}>${esc(t('imp.newAcc'))}</option></select>${newAcc}</div></div>
  ${bal?`<label class="inline note" style="margin-top:10px"><input type="checkbox" data-f="impBal" ${I.updBal!==false?'checked':''}> ${esc(t('imp.updBal',{v:moneyT(bal.v),d:dateT(bal.d)}))}</label>`:''}
  <div class="hrow" style="justify-content:space-between;margin:16px 0 8px"><b>${esc(t('imp.preview'))}</b><span class="note">${esc(t('imp.stats2',{n:prev.ok.length,d:prev.dup,s:prev.skip,i:prev.moves}))}</span></div>
  <div class="prev"><table><thead><tr><th>${esc(t('f.date'))}</th><th>${esc(t('f.label'))}</th><th>${esc(t('f.cat'))}</th><th>${esc(t('f.amount'))}</th></tr></thead><tbody>${prev.all.slice(0,I.showAll?1000:60).map(o=>`<tr class="${o.dup?'dup':''}"><td>${esc(dateT(o.d,'short'))}</td><td style="min-width:0;white-space:normal">${esc(o.l)}</td><td>${o.dup?esc(catL(o.c)):`<select class="csel" data-f="impCat" data-v="${esc(o.key)}" aria-label="${esc(t('f.cat'))}">${catOptions(o.c)}</select>`}</td><td class="${o.a>0?'good':''}">${esc(moneyT(o.a))}</td></tr>`).join('')}</tbody></table></div>
  ${prev.all.length>60&&!I.showAll?`<button class="link" data-a="impAll" style="margin-top:8px">${esc(t('imp.showAll',{n:prev.all.length-60}))}</button>`:''}
  <div class="pfoot"><button class="btn ghost" data-a="${I.queue&&I.queue.length?'impSkip':'close'}">${esc(t(I.queue&&I.queue.length?'imp.skip':'act.cancel'))}</button>${!I.acc?`<span class="warn" style="font-size:13px;align-self:center">${esc(t('imp.pickAccP'))}</span>`:''}<button class="btn" data-a="impGo" ${(prev.ok.length||bal)&&I.acc?'':'disabled'}>${ico('check')}${esc(t('imp.go',{n:prev.ok.length}))}</button></div>`;
}
const TRANSFER_RE=/\b(vir|virement|virt|transfert|transfer|to|a partir de|depuis|vers|de)\b/;
const DEFERRED_RE=/debit differe|releve (de )?carte|total (des )?operations carte|arrete carte|prlv carte differe/;
function importPreview(){
  const I=S.ui.imp;let raw=[];let skip=0;
  if(I.kind==='csv'||I.kind==='ofx'){const m=I.map;
    for(const r of I.rows){
      const d=parseDate(r[m.date]);if(!d){skip++;continue}
      let a;if(m.amount>-1&&String(r[m.amount]??'').trim()!=='')a=parseAmount(r[m.amount]);else{const de=m.debit>-1?parseAmount(r[m.debit]):NaN,cr=m.credit>-1?parseAmount(r[m.credit]):NaN;if(!isFinite(de)&&!isFinite(cr)){skip++;continue}a=(isFinite(cr)?Math.abs(cr):0)-(isFinite(de)?Math.abs(de):0)}
      if(!isFinite(a)||a===0){skip++;continue}if(I.inv)a=-a;
      raw.push({d,a:r2(a),l:scrubLabel(String(m.label>-1?r[m.label]:'').replace(/\s+/g,' ').trim())||t('imp.op')});
    }
  }else raw=(I.res&&I.res.ops||[]).map(o=>({d:o.d,a:r2(o.a),l:o.l||t('imp.op')}));
  const existing=new Map();D().txs.filter(x=>x.acc===I.acc).forEach(x=>{const k=x.d+'|'+x.a.toFixed(2);existing.set(k,(existing.get(k)||0)+1)});
  const seen=new Map();const hasCard=D().accounts.some(a=>a.type==='card');let moves=0;
  const selves=(ST().selfNames||[]).concat(I.res&&I.res.holder?[I.res.holder.join(' ')]:[]).map(s=>norm(s).split(' ').filter(Boolean)).filter(a=>a.length>=2);
  const isSelf=nl=>selves.some(tk=>tk.every(w=>(' '+nl+' ').includes(' '+w+' ')));
  const all=raw.map(o=>{
    const k=o.d+'|'+o.a.toFixed(2);seen.set(k,(seen.get(k)||0)+1);const dup=seen.get(k)<=(existing.get(k)||0);
    let c=categorize(o.l,o.a,D().rules);const nl=norm(o.l);
    /* virement entre tes comptes : montant opposé sur un autre de tes comptes à 3 jours près */
    if(!dup&&(TRANSFER_RE.test(nl)||c==='uncat'||c==='otherIn')){const m=D().txs.find(x=>x.acc&&x.acc!==I.acc&&Math.abs(x.a+o.a)<0.005&&Math.abs(daysBetween(x.d,o.d))<=3);if(m){c='transfer';moves++}}
    if(!dup&&c!=='transfer'&&TRANSFER_RE.test(nl)&&isSelf(nl)){c='transfer';moves++}
    if(!dup&&hasCard&&o.a<0&&DEFERRED_RE.test(nl)&&c!=='transfer'){c='transfer';moves++}
    const key=o.d+'|'+o.a+'|'+o.l;if(I.catOver&&I.catOver[key])c=I.catOver[key];
    return {...o,c,dup,key};
  });
  all.sort((x,y)=>y.d.localeCompare(x.d));
  return {all,ok:all.filter(o=>!o.dup),dup:all.filter(o=>o.dup).length,skip,moves};
}
function importBalance(){
  const I=S.ui.imp;const R=I.res;if(!R||I.kind!=='pdf')return null;
  let b=null;if(R.curBal)b=R.curBal;else if(R.endBal!=null&&R.period)b={d:R.period.to,v:R.endBal};
  if(!b)return null;
  const a=D().accounts.find(x=>x.id===I.acc);if(a&&a.balAt&&a.balAt>b.d)return null;
  return b;
}
function ofxRows(text){const tag=(b,tg)=>{const m=b.match(new RegExp('<'+tg+'>([^<\\r\\n]*)','i'));return m?m[1].trim():''};return text.split(/<STMTTRN>/i).slice(1).map(b=>{b=b.split(/<\/STMTTRN>/i)[0];const ds=tag(b,'DTPOSTED');return [ds.slice(0,4)+'-'+ds.slice(4,6)+'-'+ds.slice(6,8),[tag(b,'NAME'),tag(b,'MEMO')].filter(Boolean).join(' '),tag(b,'TRNAMT').replace(',','.')]})}
