/* ================= V3 — tableau de bord à widgets (inspiré de Finvygo) ================= */
Object.assign(IC,{
  star:'<path d="m12 3.2 2.7 5.5 6 .9-4.35 4.25 1 6L12 17l-5.4 2.85 1-6L3.3 9.6l6-.9z"/>',
  starf:'<path fill="currentColor" d="m12 3.2 2.7 5.5 6 .9-4.35 4.25 1 6L12 17l-5.4 2.85 1-6L3.3 9.6l6-.9z"/>',
  trophy:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5"/>',
  ruler:'<path d="M4 20 20 4M7.5 16.5l-1.5-1.5m4.5-1.5L9 12m4.5-1.5-1.5-1.5m4.5-1.5L15 6"/><rect x="2.7" y="9.3" width="21" height="6" rx="1" transform="rotate(-45 13.2 12.3)"/>',
  grid:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  up:'<path d="m6 15 6-6 6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',
  bell:'<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
  pulse:'<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
  tool:'<path d="M14.5 6.5a4 4 0 0 0 5 5L21 13l-8 8-3-3 8-8zM3 21l6-6"/><path d="m14.5 6.5 3-3 3 3-3 3"/>',
  medal:'<circle cx="12" cy="15" r="5.5"/><path d="M8.5 10.5 6 3h4l2 5 2-5h4l-2.5 7.5M12 12.5v5"/>'
});

/* ---------- variation du jour : on mémorise le dernier cours connu de la veille ---------- */
function rollPrices(d){
  d=d||S.data;if(!d)return;const td=today();
  d.accounts.forEach(a=>(a.holdings||[]).forEach(h=>{if(h.pxD!==td){if(+h.price>0)h.prevPx=+h.price;h.pxD=td}}));
}
EXT.boot.push(rollPrices);
function lineDay(h,a){if(!(+h.prevPx>0)||!(+h.price>0))return 0;return conv((+h.qty||0)*((+h.price)-(+h.prevPx)),h.cur||a.cur)}
function posDay(p){const c=sum(p.lines.map(({a,h})=>lineDay(h,a)));const base=p.value-c;return {chg:c,pct:base>0?c/base:0,known:p.lines.some(({h})=>+h.prevPx>0&&h.liveAt&&String(h.liveAt).slice(0,10)===today())}}
function nwDay(){const h=D().history;const td=today();const prev=[...h].reverse().find(x=>x.d<td);const n=totals().net;return prev?{chg:n-prev.nw,pct:prev.nw?(n-prev.nw)/Math.abs(prev.nw):0,from:prev.d}:null}

/* ---------- favoris ---------- */
const favs=()=>{const s=ST();if(!Array.isArray(s.favs))s.favs=[];return s.favs};
function isFav(k){return favs().includes(k)}
function favBtn(k){const on=isFav(k);return `<button class="ib fav${on?' on':''}" data-a="fav" data-v="${esc(k)}" aria-pressed="${on}" aria-label="${esc(t(on?'w.favOff':'w.favOn'))}" title="${esc(t(on?'w.favOff':'w.favOn'))}">${ico(on?'starf':'star')}</button>`}
EXT.A.fav=v=>{const f=favs();const i=f.indexOf(v);if(i>-1)f.splice(i,1);else{f.push(v);toast(t('w.favAdded'))}save();render();if(S.ui.ovl)renderOvl()};

/* ---------- prochains dividendes (estimés à partir de l'historique ou des mois saisis) ---------- */
function divCalendar(days=365){
  const end=dAdd(today(),days);const ev=[];
  investAccounts().forEach(a=>a.holdings.forEach(h=>{
    if(h.kind==='fe'||!(+h.qty>0))return;
    if(+h.div>0&&Array.isArray(h.months)&&h.months.length){
      const per=hVal(h,a)*(+h.div)/100/h.months.length;
      for(let k=0;k<13;k++){const dt=new Date(today()+'T12:00:00');dt.setDate(1);dt.setMonth(dt.getMonth()+k);const m=dt.getMonth()+1;if(!h.months.includes(m))continue;const d=isoOf(new Date(dt.getFullYear(),m-1,15,12));if(d>today()&&d<=end)ev.push({d,name:h.name,a,h,amt:per,est:true,src:'manual'})}
      return}
    const L=ledgerDiv(a,h);if(!L||!L.last)return;
    const step=Math.round(365/(L.per||1));let d=L.last.d;let guard=0;
    while(d<=today()&&guard++<60)d=dAdd(d,step);
    const amt=conv(L.last.ps*(+h.qty||0),L.cur);
    guard=0;while(d<=end&&guard++<14){ev.push({d,name:h.name,a,h,amt,est:true,src:'ops'});d=dAdd(d,step)}
  }));
  return ev.sort((x,y)=>x.d.localeCompare(y.d));
}

/* ---------- depuis l'achat ---------- */
function sinceRows(){
  const ops=D().iops||[];
  return positions().filter(p=>p.kind!=='fe').map(p=>{
    let first=null,div=0;
    p.lines.forEach(({a,h})=>{const keys=new Set([h.isin,h.ticker].filter(Boolean));const nn=norm(h.name||'');
      ops.forEach(o=>{if(o.acc!==a.id)return;const mine=(o.isin&&keys.has(o.isin))||(o.sym&&keys.has(o.sym))||(o.n&&norm(o.n)===nn);if(!mine)return;
        if((o.t==='buy'||o.t==='in')&&(!first||o.d<first))first=o.d;if(o.t==='div')div+=conv(iopNet(o),o.cur||a.cur)});
      if(!first&&h.since)first=h.since});
    const days=first?daysBetween(first,today()):0;const gain=p.pl+div;const gp=p.cost>0?gain/p.cost:0;
    const ann=days>=365&&p.cost>0?Math.pow(1+gp,365/days)-1:null;
    return {p,first,days,div,gain,gp,ann};
  }).sort((x,y)=>y.gain-x.gain);
}

/* ---------- hauteur de patrimoine (pile de pièces de 1 €) ---------- */
const COIN_MM=2.33;
const HEIGHTS=[['can',0.115],['ruler',0.3],['child',1.0],['door',2.04],['hoop',3.05],['giraffe',5.5],['building',10],['whale',25],['arc',50],['liberty',93],['montparnasse',210],['eiffel',330],['burj',828],['montblanc',4806],['everest',8849]];
const hEur=m=>m/(COIN_MM/1000);
function heightOf(v){return Math.max(0,v)*COIN_MM/1000}
function heightT(m){return m<1?numT(m*100,0)+' cm':m<1000?numT(m,m<10?2:0)+' m':numT(m/1000,2)+' km'}
function heightModel(){
  const nw=totals().net,h=heightOf(nw);
  const passed=HEIGHTS.filter(x=>x[1]<=h),next=HEIGHTS.find(x=>x[1]>h);
  const gk=ST().heightGoal;let goal=HEIGHTS.find(x=>x[0]===gk);if(!goal||goal[1]<=h)goal=next||HEIGHTS[HEIGHTS.length-1];
  return {nw,h,last:passed[passed.length-1]||null,next,goal,need:goal?Math.max(0,hEur(goal[1])-nw):0};
}

/* ---------- badges ---------- */
const BADGES=['firstAcc','firstInv','pea','imported','synced','diversified','classes4','firstDiv','passive100','nw1k','nw10k','nw100k','nw1m','emergency3','noDebt','streak6','streak12','budgetKept','goalDone','fav'];
function badgeChecks(){
  const d=D(),tt=totals(),pos=positions(),hl=health();
  let streak=0;try{const F=fluxModel();const L=F.months;for(let i=L.length-1;i>=0;i--){if(L[i].v>0)streak++;else if(i===L.length-1)continue;else break}}catch(e){}
  const budKept=(()=>{const bk=Object.keys(d.budgets).filter(k=>d.budgets[k]>0);if(!bk.length)return false;const ms=txMonths().slice(0,-1);return ms.some(m=>{const g=aggTx(monthTx(m));return sum(bk.map(k=>g.cat[k]||0))<=sum(bk.map(k=>d.budgets[k]))&&g.exp>0})})();
  const cls=CLASSES.filter(c=>c.k!=='debt'&&tt.by[c.k]>0).length;
  return {firstAcc:d.accounts.length>0,firstInv:pos.length>0,pea:d.accounts.some(a=>a.type==='pea'||a.type==='peapme'),imported:(d.iops||[]).length>0||d.txs.length>=30,synced:!!(ST().finary&&ST().finary.at),
    diversified:pos.length>=5,classes4:cls>=4,firstDiv:(d.iops||[]).some(o=>o.t==='div')||d.txs.some(x=>x.c==='investIncome'&&x.a>0),passive100:passiveIncome().total>=100,
    nw1k:tt.net>=1e3,nw10k:tt.net>=1e4,nw100k:tt.net>=1e5,nw1m:tt.net>=1e6,emergency3:hl.emergency!=null&&hl.emergency>=3,noDebt:d.accounts.length>0&&tt.debts<=0,
    streak6:streak>=6,streak12:streak>=12,budgetKept:budKept,goalDone:d.goals.some(g=>goalProjection(g).pct>=1),fav:favs().length>0};
}
function badges(){
  const s=ST();if(!s.badges||typeof s.badges!=='object')s.badges={};
  const c=badgeChecks();const fresh=[];
  BADGES.forEach(k=>{if(c[k]&&!s.badges[k]){s.badges[k]=today();fresh.push(k)}});
  if(fresh.length&&!S.demo){save();if(S.badgeInit)setTimeout(()=>toast(t('bd.new',{n:t('bd.'+fresh[0]+'.t')})),300)}
  S.badgeInit=true;
  return BADGES.map(k=>({k,on:!!c[k]||!!s.badges[k],d:s.badges[k]||null}));
}
function badgeIco(k){return ({firstAcc:'bank',firstInv:'invest',pea:'bars',imported:'upload',synced:'refresh',diversified:'pie',classes4:'grid',firstDiv:'coins',passive100:'income',nw1k:'medal',nw10k:'medal',nw100k:'medal',nw1m:'trophy',emergency3:'shield',noDebt:'check',streak6:'cal',streak12:'cal',budgetKept:'budget',goalDone:'goals',fav:'star'})[k]||'medal'}
function badgesDrawer(){
  const B=badges();const n=B.filter(b=>b.on).length;
  return {html:`<div class="ph"><div><div class="eyebrow">${esc(t('bd.count',{n,t:B.length}))}</div><h2>${esc(t('bd.title'))}</h2></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  <div class="bdg-grid">${B.map(b=>`<div class="bdg${b.on?' on':''}"><span class="bdg-i">${ico(badgeIco(b.k))}</span><b>${esc(t('bd.'+b.k+'.t'))}</b><span>${esc(t('bd.'+b.k+'.p'))}</span>${b.on&&b.d?`<em>${esc(t('bd.got',{d:dateT(b.d,'short')}))}</em>`:''}</div>`).join('')}</div>`};
}
EXT.ovl.badges=badgesDrawer;EXT.A.badges=()=>openOvl({k:'badges'});

/* ---------- répartition multi-axes ---------- */
function breakdown(by){
  const m=new Map();const add=(k,l,v)=>{if(!(v>0))return;const e=m.get(k)||{k,l,v:0};e.v+=v;m.set(k,e)};
  D().accounts.filter(a=>a.include!==false&&accCls(a)!=='debt').forEach(a=>{
    const ty=TYP[a.type]||{};
    if(by==='cur'){if(ty.h){a.holdings.forEach(h=>{const c=h.cur||a.cur||ST().cur;add(c,c,hVal(h,a))});const c=a.cur||ST().cur;add(c,c,conv(+a.cash||0,a.cur))}else{const c=a.cur||ST().cur;add(c,c,accGross(a))}}
    else if(by==='acc')add(a.id,a.name,accGross(a));
    else if(by==='inst'){const i=(a.inst||'').trim();add(i?norm(i):'_',i||t('w.instNone'),accGross(a))}
  });
  const pal=['--k1','--k2','--k3','--k4','--k5','--k6','--k7','--k8'];
  return [...m.values()].sort((x,y)=>y.v-x.v).map((e,i)=>({...e,c:`var(${pal[i%pal.length]})`}));
}
function allocWidget(){
  const by=S.ui.allocBy||'cls';const tt=totals();
  let segs;if(by==='cls')segs=CLASSES.filter(c=>c.k!=='debt'&&tt.by[c.k]>0).map(c=>({k:c.k,l:clsL(c.k),v:tt.by[c.k],c:`var(${c.c})`}));else segs=breakdown(by);
  const tot=sum(segs.map(s=>s.v))||1;const shown=segs.slice(0,7);const rest=segs.slice(7);if(rest.length)shown.push({k:'_rest',l:t('w.others',{n:rest.length}),v:sum(rest.map(s=>s.v)),c:'var(--surface3)'});
  const act=by==='cls'?'clsFilter':by==='acc'?'acc':'';
  return `<div class="card"><div class="ch"><div><h2>${esc(t('home.alloc'))}</h2><p>${esc(t('w.allocBy.'+by))}</p></div><button class="link" data-a="go" data-v="wealth">${esc(t('see.all'))}</button></div>
    <div style="margin-bottom:12px">${seg('allocBy',[['cls',t('w.by.cls')],['cur',t('w.by.cur')],['acc',t('w.by.acc')],['inst',t('w.by.inst')]],by,t('w.allocLbl'))}</div>
    ${donut(shown,esc(compactT(tot)),t('k.gross'),by==='cls'?'clsFilter':'')}
    <div class="legend" style="margin-top:16px">${shown.map(s=>`<${act&&s.k!=='_rest'?`button data-a="${act}" data-v="${esc(s.k)}"`:'div'} class="lg"><i class="sq" style="--c:${s.c}"></i><span class="n">${esc(s.l)}</span><span class="p">${pctT(s.v/tot)}</span><span class="v">${money(s.v,0)}</span></${act&&s.k!=='_rest'?'button':'div'}>`).join('')}
    ${by==='cls'&&tt.debts>0?`<button class="lg" data-a="clsFilter" data-v="debt"><i class="sq" style="--c:var(--bad)"></i><span class="n">${esc(clsL('debt'))}</span><span class="p">${pctT(tt.debts/(tt.gross||1))}</span><span class="v bad">−${money(tt.debts,0)}</span></button>`:''}</div></div>`;
}
EXT.A.allocBy=v=>{S.ui.allocBy=v;render()};

/* ---------- widgets ---------- */
function wCard(title,sub,body,link){return `<div class="card"><div class="ch"><div><h2>${esc(title)}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div>${link||''}</div>${body}</div>`}
const seeAll=(a,v,l)=>`<button class="link" data-a="${a}" data-v="${esc(v||'')}">${esc(l||t('see.all'))}</button>`;
function posMini(p,right){return `<button class="row btnrow" data-a="pos" data-v="${esc(p.key)}">${posAvatar(p)}<div class="m"><b>${esc(p.name)}</b><span>${money(p.value,0)}</span></div><div class="r">${right}</div></button>`}

const WIDGETS={
  alloc:{s:'s',r:()=>allocWidget()},
  kpis:{s:'l',r:P=>P.kpis},
  signals:{s:'l',r:P=>P.sigC},
  today:{s:'s',r:()=>{
    const nd=nwDay();const pos=positions().map(p=>({p,...posDay(p)})).filter(x=>x.known&&Math.abs(x.chg)>0.004).sort((a,b)=>Math.abs(b.chg)-Math.abs(a.chg));
    const tot=sum(pos.map(x=>x.chg));
    return wCard(t('w.today.t'),t('w.today.s'),`<div class="wbig">${nd?`<span class="${cls(nd.chg)}">${moneyS(nd.chg,2)}</span><small class="${cls(nd.chg)}">${pctS(nd.pct,2)}</small>`:'<span class="muted">—</span>'}</div>
      <p class="note" style="margin:2px 0 10px">${esc(nd?t('w.today.from',{d:dateT(nd.from,'short')}):t('w.today.none'))}</p>
      ${pos.length?`<div class="list">${pos.slice(0,4).map(x=>posMini(x.p,`<b class="${cls(x.chg)}">${moneyS(x.chg,2)}</b><span class="${cls(x.pct)}">${pctS(x.pct,2)}</span>`)).join('')}</div><p class="note" style="margin-top:8px">${esc(t('w.today.pos',{v:moneyT(tot,2)}))}</p>`:`<p class="note">${esc(t('w.today.noPos'))}</p>`}`)}},
  perfTrue:{s:'s',r:()=>{const M=perfModel();const tot=M.value-M.net;
    return wCard(t('w.perf.t'),t('w.perf.s'),`<div class="wbig"><span class="${cls(tot)}">${moneyS(tot,2)}</span><small class="${cls(tot)}">${pctS(M.net?tot/M.net:0)}</small></div>
      <div class="wkv"><div><span>${esc(t('pf2.net'))}</span><b>${money(M.net,0)}</b></div><div><span>${esc(t('pf2.value'))}</span><b>${money(M.value,0)}</b></div><div><span>${esc(t('pf2.xirr'))}</span><b class="${M.xirr!=null?cls(M.xirr):''}">${M.xirr==null?'—':pctS(M.xirr)}</b></div><div><span>${esc(t('pf2.fees'))}</span><b>${money(M.fees,0)}</b></div></div>`,seeAll('go','perf'))}},
  passive:{s:'s',r:()=>{const pi=passiveIncome();const by={div:0,coupon:0,rent:0,int:0};pi.lines.forEach(l=>{by[l.type]=(by[l.type]||0)+l.amount});const rec=incomeReceived();
    const rows=Object.entries(by).filter(([,v])=>v>0);const mx=Math.max(1,...rows.map(r=>r[1]));
    return wCard(t('w.passive.t'),t('w.passive.s'),`<div class="wbig"><span>${money(pi.total,pi.total<100?2:0)}</span><small class="muted">${esc(t('w.perYear'))}</small></div><p class="note" style="margin:2px 0 12px">${esc(t('w.passive.m',{v:moneyT(pi.total/12,0),r:moneyT(rec.total,2)}))}</p>
      ${rows.length?`<div class="mbars">${rows.map(([k,v])=>`<div class="mb"><span>${esc(t('w.inc.'+k))}</span><i><b style="width:${(v/mx*100).toFixed(1)}%"></b></i><em>${money(v,v<100?2:0)}</em></div>`).join('')}</div>`:`<p class="note">${esc(t('w.passive.none'))}</p>`}`,seeAll('go','income'))}},
  divNext:{s:'s',r:()=>{const ev=divCalendar(365);const tot=sum(ev.map(e=>e.amt));
    return wCard(t('w.div.t'),t('w.div.s',{v:moneyT(tot,2)}),ev.length?`<div class="list">${ev.slice(0,5).map(e=>`<button class="row btnrow" data-a="pos" data-v="${esc((e.h.isin||e.h.ticker||e.h.name||'').toUpperCase())}"><span class="dbox"><b>${esc(String(+e.d.slice(8,10)))}</b><em>${esc(monthT(e.d.slice(0,7),1))}</em></span><div class="m"><b>${esc(e.name)}</b><span>${esc(e.a.name)}</span></div><div class="r"><b>${moneyT(e.amt,2)}</b><span>${esc(t('w.est'))}</span></div></button>`).join('')}</div><p class="note" style="margin-top:8px">${esc(t('w.div.note'))}</p>`:`<p class="note">${esc(t('w.div.none'))}</p>`)}},
  best:{s:'s',r:()=>{const L=sinceRows().filter(x=>x.p.cost>0).sort((a,b)=>b.gp-a.gp).slice(0,4);return wCard(t('w.best.t'),t('w.best.s'),L.length?`<div class="list">${L.map(x=>posMini(x.p,`<b class="${cls(x.gp)}">${pctS(x.gp)}</b><span class="${cls(x.gain)}">${moneyS(x.gain,0)}</span>`)).join('')}</div>`:`<p class="note">${esc(t('inv.noPos'))}</p>`,seeAll('go','invest'))}},
  worst:{s:'s',r:()=>{const L=sinceRows().filter(x=>x.p.cost>0).sort((a,b)=>a.gp-b.gp).slice(0,4);return wCard(t('w.worst.t'),t('w.worst.s'),L.length?`<div class="list">${L.map(x=>posMini(x.p,`<b class="${cls(x.gp)}">${pctS(x.gp)}</b><span class="${cls(x.gain)}">${moneyS(x.gain,0)}</span>`)).join('')}</div>`:`<p class="note">${esc(t('inv.noPos'))}</p>`,seeAll('go','invest'))}},
  since:{s:'l',r:()=>{const R=sinceRows();
    return wCard(t('w.since.t'),t('w.since.s'),R.length?`<div class="tw cards"><table class="tbl"><thead><tr><th>${esc(t('w.since.line'))}</th><th>${esc(t('w.since.first'))}</th><th>${esc(t('w.since.gain'))}</th><th>${esc(t('w.since.div'))}</th><th>${esc(t('w.since.ann'))}</th></tr></thead><tbody>${R.slice(0,8).map(x=>`<tr class="click" data-a="pos" data-v="${esc(x.p.key)}"><td><b>${esc(x.p.name)}</b></td><td data-l="${esc(t('w.since.first'))}">${x.first?esc(dateT(x.first,'short'))+` <span class="muted">· ${esc(durT(x.days))}</span>`:'—'}</td><td data-l="${esc(t('w.since.gain'))}" class="${cls(x.gain)}"><b>${moneyS(x.gain,2)}</b> <span class="muted">${pctS(x.gp)}</span></td><td data-l="${esc(t('w.since.div'))}">${x.div?moneyT(x.div,2):'—'}</td><td data-l="${esc(t('w.since.ann'))}" class="${x.ann!=null?cls(x.ann):''}">${x.ann==null?`<span class="muted">${esc(t('w.since.lt1'))}</span>`:pctS(x.ann)}</td></tr>`).join('')}</tbody></table></div><p class="note">${esc(t('w.since.note'))}</p>`:`<p class="note">${esc(t('inv.noPos'))}</p>`)}},
  favorites:{s:'s',r:()=>{const f=favs();const pos=positions();const rows=f.map(k=>{if(k.startsWith('p:')){const p=pos.find(x=>x.key===k.slice(2));if(!p)return '';const dd=posDay(p);return posMini(p,dd.known?`<b class="${cls(dd.chg)}">${pctS(dd.pct,2)}</b><span>${esc(t('w.dayShort'))}</span>`:`<b class="${cls(p.pl)}">${pctS(p.plp)}</b>`)}
      const a=D().accounts.find(x=>x.id===k.slice(2));if(!a)return '';return `<button class="row btnrow" data-a="acc" data-v="${a.id}">${accAvatar(a,1)}<div class="m"><b>${esc(a.name)}</b><span>${esc(typL(a.type))}</span></div><div class="r"><b>${money(accValue(a),0)}</b></div></button>`}).filter(Boolean);
    return wCard(t('w.fav.t'),t('w.fav.s'),rows.length?`<div class="list">${rows.join('')}</div>`:`<div class="wempty">${ico('star')}<p>${esc(t('w.fav.none'))}</p><button class="btn sec sm" data-a="go" data-v="invest">${esc(t('w.fav.add'))}</button></div>`)}},
  height:{s:'s',r:()=>{const H=heightModel();const top=H.goal[1];const pct=clamp(H.h/top,0,1);const marks=[];HEIGHTS.filter(x=>x[1]<=top&&x[1]>=top/60).reverse().forEach(x=>{const y=x[1]/top;if(!marks.length||marks[marks.length-1][1]/top-y>=0.11)marks.push(x)});
    return wCard(t('w.ht.t'),t('w.ht.s'),`<div class="hgt"><div class="hgt-bar" role="img" aria-label="${esc(t('w.ht.aria',{h:heightT(H.h),g:t('ht.'+H.goal[0])}))}"><i style="height:${(pct*100).toFixed(1)}%"></i>${marks.map(x=>`<span class="hm${x[1]<=H.h?' ok':''}" style="bottom:${(x[1]/top*100).toFixed(1)}%"><em>${esc(t('ht.'+x[0]))}</em></span>`).join('')}</div>
      <div class="hgt-txt"><div class="wbig"><span>${esc(heightT(H.h))}</span></div><p class="note">${esc(t('w.ht.coins',{v:moneyT(Math.max(0,H.nw),0)}))}</p>
      ${H.last?`<p class="hgt-l">${ico('check')} ${esc(t('w.ht.passed',{x:t('ht.'+H.last[0]),h:heightT(H.last[1])}))}</p>`:''}
      <p class="hgt-n">${esc(t('w.ht.next',{x:t('ht.'+H.goal[0]),h:heightT(H.goal[1]),v:moneyT(H.need,0)}))}</p>
      <label class="note" for="htGoal">${esc(t('w.ht.goal'))}</label><select id="htGoal" data-f="heightGoal">${HEIGHTS.filter(x=>x[1]>H.h).map(x=>`<option value="${x[0]}"${x[0]===H.goal[0]?' selected':''}>${esc(t('ht.'+x[0]))} · ${esc(heightT(x[1]))}</option>`).join('')}</select></div></div>`)}},
  badges:{s:'s',r:()=>{const B=badges();const on=B.filter(b=>b.on);const last=on.filter(b=>b.d).sort((a,b)=>b.d.localeCompare(a.d)).slice(0,3);const nx=B.filter(b=>!b.on).slice(0,2);
    return wCard(t('bd.title'),t('bd.count',{n:on.length,t:B.length}),`<div class="score" style="margin-bottom:10px">${ring(on.length/B.length,'var(--accent)','')}<div><div class="big">${on.length}<span class="muted" style="font-size:16px">/${B.length}</span></div><div class="note">${esc(t('bd.sub'))}</div></div></div>
      <div class="list">${last.map(b=>`<div class="row"><span class="av sm" style="--c:var(--good)">${ico(badgeIco(b.k))}</span><div class="m"><b>${esc(t('bd.'+b.k+'.t'))}</b><span>${esc(t('bd.got',{d:dateT(b.d,'short')}))}</span></div></div>`).join('')}${nx.map(b=>`<div class="row dim"><span class="av sm" style="--c:var(--muted)">${ico('lock')}</span><div class="m"><b>${esc(t('bd.'+b.k+'.t'))}</b><span>${esc(t('bd.'+b.k+'.p'))}</span></div></div>`).join('')}</div>`,seeAll('badges','',t('bd.all')))}},
  health:{s:'s',r:P=>P.healthC},budget:{s:'s',r:P=>P.budC},goals:{s:'s',r:P=>P.goalsC},movers:{s:'m',r:P=>P.posC},recent:{s:'m',r:P=>P.txC}
};
const W_DEFAULT=['alloc','kpis','today','signals','perfTrue','passive','divNext','favorites','height','badges','best','worst','since','health','budget','goals','recent'];
function wLayout(){
  const s=ST();let L=Array.isArray(s.widgets)?s.widgets.filter(x=>x&&WIDGETS[x.k]):null;
  if(!L||!L.length)L=W_DEFAULT.map(k=>({k,on:true})).concat(Object.keys(WIDGETS).filter(k=>!W_DEFAULT.includes(k)).map(k=>({k,on:false})));
  Object.keys(WIDGETS).forEach(k=>{if(!L.some(x=>x.k===k))L.push({k,on:false})});
  return L;
}
function durT(days){if(days<45)return t('w.dur.d',{n:days});if(days<730)return t('w.dur.m',{n:Math.round(days/30.4)});return t('w.dur.y',{n:numT(days/365.25,1)})}
function homeView(){
  const d=D();if(!d.accounts.length)return onboardingEmpty();
  const P=homeParts();
  const cells=wLayout().filter(x=>x.on).map(x=>{let h='';try{h=WIDGETS[x.k].r(P)}catch(e){console.warn('widget',x.k,e);h=''}return h?`<div class="wg s-${WIDGETS[x.k].s}" data-w="${x.k}">${h}</div>`:''}).join('');
  return P.finBand+`<div class="wgrid"><div class="wg s-m">${P.hero}</div>${cells}</div>
    <div class="wfoot"><button class="btn sec sm" data-a="widgets">${ico('grid')}${esc(t('w.manage'))}</button></div>`;
}
function widgetsDrawer(){
  const L=wLayout();
  return {html:`<div class="ph"><div><div class="eyebrow">${esc(t('nav.home'))}</div><h2>${esc(t('w.manage'))}</h2></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  <p class="note" style="margin:-4px 0 14px">${esc(t('w.manageP'))}</p>
  <div class="wlist">${L.map((x,i)=>`<div class="wli${x.on?'':' off'}"><label class="sw"><input type="checkbox" data-f="wOn" data-v="${x.k}"${x.on?' checked':''}><span></span></label><div class="m"><b>${esc(t('w.n.'+x.k))}</b><span>${esc(t('w.d.'+x.k))}</span></div>
    <div class="wli-a"><button class="ib sm" data-a="wMove" data-v="${x.k}|-1"${i===0?' disabled':''} aria-label="${esc(t('w.up'))}">${ico('up')}</button><button class="ib sm" data-a="wMove" data-v="${x.k}|1"${i===L.length-1?' disabled':''} aria-label="${esc(t('w.down'))}">${ico('down')}</button></div></div>`).join('')}</div>
  <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn sec sm" data-a="wReset">${esc(t('w.reset'))}</button></div>`};
}
EXT.ovl.widgets=widgetsDrawer;
EXT.A.widgets=()=>openOvl({k:'widgets'});
EXT.A.wMove=v=>{const [k,dir]=v.split('|');const L=wLayout();const i=L.findIndex(x=>x.k===k),j=i+(+dir);if(i<0||j<0||j>=L.length)return;[L[i],L[j]]=[L[j],L[i]];ST().widgets=L;save();const p=$('#ovl .panel');S.ui.ovl.scroll=p?p.scrollTop:0;renderOvl();render()};
EXT.A.wReset=()=>{delete ST().widgets;save();renderOvl();render()};
EXT.field.wOn=(el,v)=>{const L=wLayout();const x=L.find(z=>z.k===el.dataset.v);if(x)x.on=!!v;ST().widgets=L;save();render();const p=$('#ovl .panel');S.ui.ovl.scroll=p?p.scrollTop:0;renderOvl()};
EXT.field.heightGoal=(el,v)=>{ST().heightGoal=v;save();render()};
