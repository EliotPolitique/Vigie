/* ================= V4.5 — analyse des frais et du trading =================
   Pour un compte-titres : nombre d'ordres, frais (courtage et taxes), résultat des ventes avant et après frais
   (coût moyen pondéré, comme le reste de l'application), durée moyenne de détention (méthode premier entré, premier sorti),
   rotation du portefeuille, détail par titre et frais par mois. */
VIEWS.push({k:'trading',g:'pilot',ic:'receipt',hide:1});
function tradeStats(acc){const a=D().accounts.find(x=>x.id===acc);if(!a)return null;const ops=iopsOf(acc).filter(o=>['buy','sell','div','int','fee','tax'].includes(o.t)).sort((x,y)=>x.d.localeCompare(y.d)||(x.s||0)-(y.s||0));
  const cur=o=>o.cur||a.cur;const P=new Map();const T={buys:0,sells:0,nb:0,ns:0,fee:0,tax:0,gross:0,real:0,div:0,hold:0,holdW:0,win:0,lose:0,first:null,last:null,months:{}};
  const get=o=>{const k=iopKey(o)||('?'+(o.n||''));let p=P.get(k);if(!p){p={k,n:o.n||o.sym||o.isin||'—',isin:o.isin||'',qty:0,costEx:0,feeIn:0,lots:[],nb:0,ns:0,bought:0,sold:0,fee:0,gross:0,real:0,div:0};P.set(k,p)}if(o.n)p.n=o.n;return p};
  for(const o of ops){const f=conv((+o.fee||0)+(+o.tax||0),cur(o));const m=o.d.slice(0,7);if(!T.first)T.first=o.d;T.last=o.d;
    if(o.t==='buy'||o.t==='sell'){T.fee+=conv(+o.fee||0,cur(o));T.tax+=conv(+o.tax||0,cur(o));const M=T.months[m]=T.months[m]||{f:0,n:0};M.f+=f;M.n++}
    if(o.t==='buy'){const p=get(o);const g=conv(Math.abs(+o.amt||0),cur(o)),q=Math.abs(+o.q||0);p.qty+=q;p.costEx+=g;p.feeIn+=f;p.lots.push({q,d:o.d});p.nb++;p.bought+=g;p.fee+=f;T.buys+=g;T.nb++}
    else if(o.t==='sell'){const p=get(o);const g=conv(Math.abs(+o.amt||0),cur(o)),q=Math.abs(+o.q||0);const sh=p.qty>1e-12?Math.min(1,q/p.qty):0;const c=p.costEx*sh,fi=p.feeIn*sh;
      const gr=g-c;p.gross+=gr;p.real+=gr-fi-f;p.costEx-=c;p.feeIn-=fi;p.qty-=Math.min(q,p.qty);p.ns++;p.sold+=g;p.fee+=f;T.sells+=g;T.ns++;T.gross+=gr;T.real+=gr-fi-f;if(gr-fi-f>=0)T.win++;else T.lose++;
      let left=q;while(left>1e-12&&p.lots.length){const L=p.lots[0];const u=Math.min(L.q,left);const days=daysBetween(L.d,o.d);T.hold+=days*u*(g/q||0);T.holdW+=u*(g/q||0);L.q-=u;left-=u;if(L.q<=1e-12)p.lots.shift()}
      if(p.qty<1e-7){p.qty=0;p.costEx=0;p.feeIn=0;p.lots=[]}}
    else if(o.t==='div'||o.t==='int'){const p=o.t==='div'?get(o):null;const v=conv(iopNet(o),cur(o));if(p)p.div+=v;T.div+=v}
    else if(o.t==='fee'||o.t==='tax'){const v=-conv(iopNet(o),cur(o));T.fee+=o.t==='fee'?v:0;T.tax+=o.t==='tax'?v:0}}
  const value=sum((a.holdings||[]).map(h=>hVal(h,a)));const hist=accHist([a.id],7);const avgVal=hist.length?sum(hist.map(x=>x.v))/hist.length:value;
  const yrs=T.first?Math.max(1/12,daysBetween(T.first,today())/365.25):1;
  return {a,T,rows:[...P.values()].filter(p=>p.nb||p.ns).sort((x,y)=>y.fee-x.fee),value,avgVal,yrs,feeTot:T.fee+T.tax,orders:T.nb+T.ns,
    avgOrder:(T.buys+T.sells)/Math.max(1,T.nb+T.ns),holdDays:T.holdW?T.hold/T.holdW:null,turnover:avgVal>0?T.buys/avgVal/yrs:null}}
function tradeAccs(){return invAccs().filter(a=>iopsOf(a.id).some(o=>o.t==='buy'||o.t==='sell')).sort((x,y)=>iopsOf(y.id).length-iopsOf(x.id).length)}
function tradingView(){const L=tradeAccs();if(!L.length)return emptyBlock(t('tr.emptyT'),t('tr.emptyP'),t('nav.invest'),'go');
  const id=L.some(a=>a.id===S.ui.trAcc)?S.ui.trAcc:L[0].id;const R=tradeStats(id);const T=R.T;
  const sel=L.length>1?`<select data-f="trAcc" style="width:auto;border-radius:999px;padding:7px 12px" aria-label="${esc(t('f.account'))}">${L.map(a=>`<option value="${a.id}"${a.id===id?' selected':''}>${esc(a.name)}</option>`).join('')}</select>`:'';
  const feePctBuy=T.buys?R.feeTot/T.buys:0;const feeYear=R.feeTot/R.yrs;const feePctVal=R.avgVal>0?feeYear/R.avgVal:null;const perOrder=R.orders?R.feeTot/R.orders:0;
  const head=`<div class="pgnav"><button class="btn ghost sm" data-a="go" data-v="perf">${ico('chevl')}${esc(t('nav.perf'))}</button></div>
   <div class="hrow" style="justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px"><div><div class="eyebrow">${esc(t('tr.eyebrow'))}</div><h2 style="font:650 22px var(--display);letter-spacing:-.02em">${esc(R.a.name)}</h2><p class="note" style="margin:2px 0 0">${esc(t('tr.period',{a:dateT(T.first),b:dateT(T.last),n:R.orders}))}</p></div>${sel}</div>
   <div class="kpis k4" style="margin-bottom:16px">${kpi(t('tr.k.orders'),String(R.orders),t('tr.k.ordersS',{b:T.nb,s:T.ns}))}${kpi(t('tr.k.fees'),`<span class="bad">${money(R.feeTot,2)}</span>`,t('tr.k.feesS',{p:pctT(feePctBuy,2),o:moneyT(perOrder,2)}))}${kpi(t('tr.k.gross'),`<span class="${cls(T.gross)}">${moneyS(T.gross,2)}</span>`,t('tr.k.grossS'))}${kpi(t('tr.k.net'),`<span class="${cls(T.real)}">${moneyS(T.real,2)}</span>`,t('tr.k.netS',{w:T.win,l:T.lose}))}
   ${kpi(t('tr.k.avg'),money(R.avgOrder,2),t('tr.k.avgS',{p:pctT(R.avgOrder?perOrder/R.avgOrder:0,2)}))}${kpi(t('tr.k.hold'),R.holdDays==null?'—':durT(Math.round(R.holdDays)),t('tr.k.holdS'))}${kpi(t('tr.k.turn'),R.turnover==null?'—':numT(R.turnover,1)+'×',t('tr.k.turnS'))}${kpi(t('tr.k.year'),money(feeYear,2),feePctVal!=null?t('tr.k.yearS',{p:pctT(feePctVal,1)}):'')}</div>`;
  /* lecture : constats chiffrés, sans conseil */
  const obs=[];if(T.gross&&R.feeTot)obs.push(t('tr.o.split',{g:moneyT(T.gross,2),f:moneyT(R.feeTot,2),n:moneyT(T.real,2)}));
  if(R.avgOrder)obs.push(t('tr.o.small',{o:moneyT(R.avgOrder,2),f:moneyT(perOrder,2),p:pctT(perOrder/R.avgOrder,2)}));
  if(feePctVal!=null&&feePctVal>0.005)obs.push(t('tr.o.ter',{p:pctT(feePctVal,1)}));
  if(R.turnover!=null&&R.turnover>2)obs.push(t('tr.o.turn',{x:numT(R.turnover,1)}));
  const obsC=`<div class="card"><div class="ch"><div><h2>${esc(t('tr.obsT'))}</h2><p>${esc(t('tr.obsS'))}</p></div></div><div class="list">${obs.map(o=>`<div class="row"><span class="av sm" style="--c:var(--k1)">${ico('info')}</span><div class="m"><span style="white-space:normal;color:var(--fg2);font-size:13.5px">${esc(o)}</span></div></div>`).join('')}</div><p class="note" style="margin-top:10px">${esc(t('tr.obsNote'))}</p></div>`;
  const ms=Object.keys(T.months).sort().slice(-24);const feesC=ms.length?`<div class="card"><div class="ch"><div><h2>${esc(t('tr.feesT'))}</h2><p>${esc(t('tr.feesS'))}</p></div></div>${chart({type:'bars',h:220,groups:ms.map(m=>({key:m,label:monthT(m,1),vals:[T.months[m].f],title:monthT(m)+' · '+moneyT(T.months[m].f,2)+' · '+t('tr.nOrders',{n:T.months[m].n})})),keys:[{c:'var(--bad)'}],noDim:true,label:t('tr.feesT')})}</div>`:'';
  const tbl=`<div class="card" style="margin-top:16px"><div class="ch"><div><h2>${esc(t('tr.byT'))}</h2><p>${esc(t('tr.byS',{n:R.rows.length}))}</p></div></div><div class="tw cards"><table class="tbl"><thead><tr><th>${esc(t('tr.c.sec'))}</th><th>${esc(t('tr.c.orders'))}</th><th>${esc(t('tr.c.bought'))}</th><th>${esc(t('tr.c.sold'))}</th><th>${esc(t('tr.c.fees'))}</th><th>${esc(t('tr.c.gross'))}</th><th>${esc(t('tr.c.net'))}</th><th>${esc(t('tr.c.div'))}</th></tr></thead><tbody>${R.rows.slice(0,S.ui.trAll?9999:20).map(p=>`<tr><td><b>${esc(p.n)}</b>${p.qty>0?` <span class="tag">${esc(t('tr.open'))}</span>`:''}</td><td data-l="${esc(t('tr.c.orders'))}">${p.nb} / ${p.ns}</td><td data-l="${esc(t('tr.c.bought'))}">${esc(moneyT(p.bought,0))}</td><td data-l="${esc(t('tr.c.sold'))}">${esc(moneyT(p.sold,0))}</td><td data-l="${esc(t('tr.c.fees'))}" class="bad">${esc(moneyT(p.fee,2))}</td><td data-l="${esc(t('tr.c.gross'))}" class="${cls(p.gross)}">${p.ns?moneyS(p.gross,2):'—'}</td><td data-l="${esc(t('tr.c.net'))}" class="${cls(p.real)}"><b>${p.ns?moneyS(p.real,2):'—'}</b></td><td data-l="${esc(t('tr.c.div'))}">${p.div?esc(moneyT(p.div,2)):'—'}</td></tr>`).join('')}</tbody></table></div>${R.rows.length>20&&!S.ui.trAll?`<div style="text-align:center;margin:10px 0"><button class="btn sec sm" data-a="trAll">${esc(t('tr.all',{n:R.rows.length}))}</button></div>`:''}<p class="note">${esc(t('tr.tblNote'))}</p></div>`;
  return head+`<div class="grid g2">${obsC}${feesC||'<div></div>'}</div>`+tbl}
EXT.V.trading=tradingView;
EXT.field.trAcc=(el,v)=>{S.ui.trAcc=v;render()};
EXT.A.trading=v=>{if(v)S.ui.trAcc=v;go('trading')};
/* accès : Performance et page d'un compte d'investissement */
{const _pv2=perfView;perfView=function(){const h=_pv2();const L=tradeAccs();if(!L.length)return h;const R=tradeStats(L[0].id);
  return `<div class="callout" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px">${ico('receipt')}<div style="flex:1;min-width:220px"><b>${esc(t('tr.bandT',{f:moneyT(R.feeTot,2),n:R.orders}))}</b><br><span class="note">${esc(t('tr.bandP',{a:R.a.name}))}</span></div><button class="btn sm" data-a="trading" data-v="${R.a.id}">${esc(t('tr.open2'))}</button></div>`+h}}
{const _ap=EXT.V.acct;EXT.V.acct=function(){const h=_ap();const a=D().accounts.find(x=>x.id===S.ui.accId);if(!a||!iopsOf(a.id).some(o=>o.t==='buy'||o.t==='sell'))return h;
  return h.replace('<div class="pgside">',`<div class="pgside"><button class="card btnrow" data-a="trading" data-v="${a.id}" style="text-align:left;cursor:pointer;display:flex;gap:12px;align-items:center">${ico('receipt')}<div><b>${esc(t('tr.open2'))}</b><div class="note">${esc(t('tr.cardP'))}</div></div></button>`)}}
EXT.A.trAll=()=>{S.ui.trAll=1;render()};
