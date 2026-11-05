/* ================= V4.5 — Bilan du mois et allocation cible ================= */

/* ---------- Bilan du mois ---------- */
VIEWS.push({k:'review',g:'analyse',ic:'cal',hide:1},{k:'target',g:'pilot',ic:'pie',hide:1});
const eom=ym=>{const [y,m]=ym.split('-').map(Number);return isoOf(new Date(y,m,0,12))};
function reviewModel(ym){const prev=ymAdd(ym,-1);const e1=eom(prev),e2=ym===today().slice(0,7)?today():eom(ym);
  const n1=nwAt(e1),n2=ym===today().slice(0,7)?totals().net:nwAt(e2);if(n1==null||n2==null)return null;
  const g=aggTx(monthTx(ym));const ids=invAccs().map(a=>a.id);let inv1=0,inv2=0,contrib=0;
  try{const H=accHist(ids,1);const at=d=>{let v=0;for(const p of H){if(p.d<=d)v=p.v;else break}return v};inv1=at(e1);inv2=ym===today().slice(0,7)?sum(invAccs().map(accValue)):at(e2);
    contrib=sum(invFlows(ids).filter(f=>!f.inc&&f.d>e1&&f.d<=e2).map(f=>f.v))}catch(e){}
  const market=inv2-inv1-contrib;const delta=n2-n1;const other=delta-(g.inc-g.exp)-market;
  const avg={};const P3=[1,2,3].map(i=>aggTx(monthTx(ymAdd(ym,-i))));CATS.filter(c=>c.kind==='out').forEach(c=>avg[c.k]=sum(P3.map(p=>p.cat[c.k]||0))/3);
  const cats=CATS.filter(c=>c.kind==='out').map(c=>({k:c.k,v:g.cat[c.k]||0,a:avg[c.k]||0})).filter(x=>x.v||x.a).map(x=>({...x,d:x.v-x.a})).sort((a,b)=>b.d-a.d);
  const expAvg=sum(P3.map(p=>p.exp))/3,incAvg=sum(P3.map(p=>p.inc))/3;
  const rec=typeof receivedList==='function'?receivedList(ym+'-01',e2):[];
  return {ym,n1,n2,delta,inc:g.inc,exp:g.exp,sav:g.inc-g.exp,rate:g.inc>0?(g.inc-g.exp)/g.inc:null,market,contrib,other,cats,expAvg,incAvg,rec,recT:sum(rec.map(r=>r.v))}}
function reviewView(){const months=txMonths();const def=ymAdd(today().slice(0,7),-1);const ym=S.ui.rvYm||def;const M=reviewModel(ym);
  const nav=`<div class="hrow" style="justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px"><div class="hrow"><button class="ib" data-a="rvYm" data-v="-1" aria-label="${esc(t('b.prev'))}">${ico('chevl')}</button><b style="font:650 19px var(--display);min-width:170px;text-align:center;text-transform:capitalize">${esc(monthT(ym))}</b><button class="ib" data-a="rvYm" data-v="1" aria-label="${esc(t('b.next'))}"${ym>=today().slice(0,7)?' disabled style="opacity:.4"':''}>${ico('chev')}</button></div><span class="note">${esc(ym===today().slice(0,7)?t('rv.current'):t('rv.closed'))}</span></div>`;
  if(!M)return nav+emptyBlock(t('rv.noneT'),t('rv.noneP'),'','');
  const steps=[{l:t('rv.w.start'),v:M.n1,kind:'base'},{l:t('rv.w.inc'),v:M.inc,kind:'delta'},{l:t('rv.w.exp'),v:-M.exp,kind:'delta'},{l:t('rv.w.mkt'),v:M.market,kind:'delta'},{l:t('rv.w.other'),v:M.other,kind:'delta'},{l:t('rv.w.end'),v:M.n2,kind:'total'}];
  const story=[t('rv.s.nw',{v:moneyT(Math.abs(M.delta),0),dir:t(M.delta>=0?'rv.up':'rv.down'),e:moneyT(M.n2,0)}),
    t('rv.s.sav',{i:moneyT(M.inc,0),e:moneyT(M.exp,0),s:moneyT(M.sav,0),r:M.rate!=null?pctT(M.rate,0):'—'}),
    M.expAvg>0?t(M.exp>M.expAvg*1.1?'rv.s.expHi':M.exp<M.expAvg*0.9?'rv.s.expLo':'rv.s.expEq',{v:moneyT(Math.abs(M.exp-M.expAvg),0),a:moneyT(M.expAvg,0)}):'',
    Math.abs(M.market)>=1?t(M.market>=0?'rv.s.mktUp':'rv.s.mktDn',{v:moneyT(Math.abs(M.market),0),c:moneyT(M.contrib,0)}):'',
    M.recT>0?t('rv.s.div',{v:moneyT(M.recT,2),n:M.rec.length}):''].filter(Boolean);
  const kp=`<div class="kpis k4" style="margin-bottom:16px">${kpi(t('rv.k.nw'),`<span class="${cls(M.delta)}">${moneyS(M.delta,0)}</span>`,t('rv.k.nwS',{v:moneyT(M.n2,0)}))}${kpi(t('rv.k.sav'),`<span class="${cls(M.sav)}">${moneyS(M.sav,0)}</span>`,M.rate!=null?t('rv.k.savS',{p:pctT(M.rate,0)}):'')}${kpi(t('rv.k.mkt'),`<span class="${cls(M.market)}">${moneyS(M.market,0)}</span>`,t('rv.k.mktS',{c:moneyT(M.contrib,0)}))}${kpi(t('rv.k.div'),money(M.recT,2),t('rv.k.divS',{n:M.rec.length}))}</div>`;
  const storyC=`<div class="card"><div class="ch"><div><h2>${esc(t('rv.storyT'))}</h2><p>${esc(t('rv.storyS'))}</p></div></div><div class="rvstory">${story.map(s=>`<p>${esc(s)}</p>`).join('')}</div></div>`;
  const wfC=`<div class="card"><div class="ch"><div><h2>${esc(t('rv.wfT'))}</h2><p>${esc(t('rv.wfS'))}</p></div></div>${waterfall(steps)}<p class="note" style="margin-top:8px">${esc(t('rv.wfNote'))}</p></div>`;
  const up=M.cats.filter(x=>x.d>1).slice(0,4),dn=M.cats.filter(x=>x.d<-1).sort((a,b)=>a.d-b.d).slice(0,4);
  const crow=x=>`<button class="row btnrow" data-a="catDetail" data-v="${x.k}"><span class="av sm" style="--c:${cvar(CAT[x.k].c)}">${ico(CAT[x.k].ic)}</span><div class="m"><b>${esc(catL(x.k))}</b><span>${esc(t('rv.vsAvg',{a:moneyT(x.a,0)}))}</span></div><div class="r"><b>${money(x.v,0)}</b><span class="${x.d>0?'bad':'good'}">${x.d>0?'+':'−'}${esc(moneyT(Math.abs(x.d),0))}</span></div></button>`;
  const catC=`<div class="card"><div class="ch"><div><h2>${esc(t('rv.catT'))}</h2><p>${esc(t('rv.catS'))}</p></div></div><div class="grid g2 keep" style="gap:18px"><div><div class="eyebrow" style="margin-bottom:4px">${esc(t('rv.more'))}</div><div class="list">${up.map(crow).join('')||'<p class="note">—</p>'}</div></div><div><div class="eyebrow" style="margin-bottom:4px">${esc(t('rv.less'))}</div><div class="list">${dn.map(crow).join('')||'<p class="note">—</p>'}</div></div></div></div>`;
  const divC=M.rec.length?`<div class="card"><div class="ch"><div><h2>${esc(t('rv.divT'))}</h2></div></div><div class="list">${M.rec.map(r=>`<div class="row"><div class="m"><b>${esc(r.name)}</b><span>${esc(dateT(r.d))} · ${esc(r.acc?r.acc.name:'—')}</span></div><div class="r"><b class="good">+${esc(moneyT(r.v,2))}</b></div></div>`).join('')}</div></div>`:'';
  return nav+kp+`<div class="grid g2">${storyC}${wfC}</div><div class="grid g2" style="margin-top:16px">${catC}${divC||'<div></div>'}</div>`}
EXT.V.review=reviewView;
EXT.A.rvYm=v=>{const ym=S.ui.rvYm||ymAdd(today().slice(0,7),-1);const n=ymAdd(ym,+v);if(n>today().slice(0,7))return;S.ui.rvYm=n;render()};
/* accès : synthèse (rappel en début de mois) et Flux & épargne */
{const _wi=watchItems;watchItems=function(){const L=_wi();const td=today();if(+td.slice(8,10)<=7&&D().txs.length){const pm=ymAdd(td.slice(0,7),-1);if(!(ST().rvSeen||[]).includes(pm))L.push({lvl:'info',ic:'cal',l:t('rv.ready',{m:monthT(pm)}),s:t('rv.readyS'),act:'review',v:pm,prio:5})}return L.sort((a,b)=>b.prio-a.prio)}}
EXT.A.review=v=>{if(v){S.ui.rvYm=v;const s=ST();s.rvSeen=(s.rvSeen||[]).concat(v).slice(-12);save()}go('review')};

/* ---------- Allocation cible et rééquilibrage ---------- */
function targetModel(){const pos=positions().filter(p=>p.value>0.004&&p.kind!=='fe');const tot=sum(pos.map(p=>p.value));const T=ST().alloc||{};
  const rows=pos.map(p=>({p,v:p.value,cur:tot?p.value/tot:0,tg:T[p.key]!=null?+T[p.key]/100:null})).sort((a,b)=>b.v-a.v);const sumT=sum(rows.map(r=>r.tg||0));
  return {rows,tot,sumT,set:rows.some(r=>r.tg!=null)}}
function buyPlan(M,amount){const T2=M.tot+amount;const def=M.rows.map(r=>({r,d:Math.max(0,(r.tg||0)*T2-r.v)}));const sd=sum(def.map(x=>x.d));
  return def.map(x=>({...x,buy:sd>0?Math.min(x.d,amount*x.d/sd):0}))}
function targetView(){const M=targetModel();if(!M.rows.length)return envChips('target')+emptyBlock(t('inv.emptyT'),t('inv.emptyP'),t('inv.addAcc'),'addAccInv');
  const amt=+(S.ui.tgAmt||0);const plan=M.set&&Math.abs(M.sumT-1)<0.005&&amt>0?buyPlan(M,amt):null;
  const ok=Math.abs(M.sumT-1)<0.005;
  const rows=M.rows.map((r,i)=>{const gap=r.tg!=null?r.tg*M.tot-r.v:null;const pl=plan?plan[i]:null;
    return `<tr><td><div class="nm">${posAvatar(r.p)}<div><b>${esc(r.p.name)}</b><span>${esc([r.p.ticker,kindL(r.p.kind)].filter(Boolean).join(' · '))}</span></div></div></td><td data-l="${esc(t('tg.c.val'))}">${esc(moneyT(r.v,0))}</td><td data-l="${esc(t('tg.c.cur'))}"><div class="tgbar"><i style="width:${(r.cur*100).toFixed(1)}%"></i>${r.tg!=null?`<b style="left:${Math.min(100,r.tg*100).toFixed(1)}%"></b>`:''}</div>${esc(pctT(r.cur,1))}</td>
      <td data-l="${esc(t('tg.c.tg'))}"><input type="text" inputmode="decimal" class="tgin" data-f="tgPct" data-v="${esc(r.p.key)}" value="${r.tg!=null?esc(String(+(r.tg*100).toFixed(2)).replace('.',',')):''}" placeholder="%" aria-label="${esc(t('tg.c.tg'))} ${esc(r.p.name)}"></td>
      <td data-l="${esc(t('tg.c.gap'))}" class="${gap==null?'':gap>=0?'good':'bad'}">${gap==null?'—':esc((gap>=0?'+':'−')+moneyT(Math.abs(gap),0))}</td>${plan?`<td data-l="${esc(t('tg.c.buy'))}"><b>${pl.buy>0.5?esc(moneyT(pl.buy,0)):'—'}</b>${pl.buy>0.5&&r.p.price>0?`<span class="muted" style="display:block;font-size:11.5px">${esc(t('tg.units',{q:numT(pl.buy/conv(r.p.price,r.p.cur),2)}))}</span>`:''}</td>`:''}</tr>`}).join('');
  const head=`${envChips('target')}<div class="kpis k4" style="margin-bottom:16px">${kpi(t('tg.k.tot'),money(M.tot,0),t('tg.k.totS',{n:M.rows.length}))}${kpi(t('tg.k.sum'),`<span class="${ok?'good':M.set?'bad':''}">${pctT(M.sumT,1)}</span>`,ok?t('tg.k.sumOk'):t('tg.k.sumKo'))}${kpi(t('tg.k.drift'),M.set?pctT(sum(M.rows.filter(r=>r.tg!=null).map(r=>Math.abs(r.cur-r.tg)))/2,1):'—',t('tg.k.driftS'))}${kpi(t('tg.k.move'),M.set?money(sum(M.rows.filter(r=>r.tg!=null).map(r=>Math.max(0,r.tg*M.tot-r.v))),0):'—',t('tg.k.moveS'))}</div>`;
  const calc=`<div class="card" style="margin-bottom:16px"><div class="ch"><div><h2>${esc(t('tg.calcT'))}</h2><p>${esc(t('tg.calcS'))}</p></div><div class="act"><button class="btn sec sm" data-a="tgFill">${esc(t('tg.fill'))}</button><button class="btn ghost sm" data-a="tgClear">${esc(t('tg.clear'))}</button></div></div>
    <div class="hrow" style="gap:10px;flex-wrap:wrap"><label class="note" for="tg-amt">${esc(t('tg.amt'))}</label><input id="tg-amt" type="text" inputmode="decimal" data-f="tgAmt" value="${amt?esc(String(amt).replace('.',',')):''}" placeholder="100" style="max-width:160px">${!ok&&M.set?`<span class="note bad">${esc(t('tg.sumWarn',{p:pctT(M.sumT,1)}))}</span>`:''}</div></div>`;
  return head+calc+`<div class="card"><div class="tw cards"><table class="tbl"><thead><tr><th>${esc(t('tg.c.line'))}</th><th>${esc(t('tg.c.val'))}</th><th>${esc(t('tg.c.cur'))}</th><th>${esc(t('tg.c.tg'))}</th><th>${esc(t('tg.c.gap'))}</th>${plan?`<th>${esc(t('tg.c.buy'))}</th>`:''}</tr></thead><tbody>${rows}</tbody></table></div><p class="note">${esc(t('tg.note'))}</p></div>`}
EXT.V.target=targetView;
EXT.field.tgPct=(el,v,later)=>{const n=typeof parseIn==='function'?parseIn(v):+String(v).replace(',','.');el.classList.toggle('bad',n===null||n<0||n>100);if(n===null&&String(v).trim()!=='')return;const s=ST();s.alloc=s.alloc||{};if(String(v).trim()===''||n===null)delete s.alloc[el.dataset.v];else s.alloc[el.dataset.v]=n;save();later(render)};
EXT.field.tgAmt=(el,v,later)=>{const n=typeof parseIn==='function'?parseIn(v):+String(v).replace(',','.');S.ui.tgAmt=n>0?n:0;later(render)};
EXT.A.tgFill=()=>{const M=targetModel();const s=ST();s.alloc={};M.rows.forEach(r=>s.alloc[r.p.key]=+(r.cur*100).toFixed(1));const d=100-sum(Object.values(s.alloc));if(M.rows.length)s.alloc[M.rows[0].p.key]=+(s.alloc[M.rows[0].p.key]+d).toFixed(1);save();render()};
EXT.A.tgClear=()=>{delete ST().alloc;save();render()};
/* navigation : sous-menu Investissements et puces */
{const _ns=navSub;navSub=function(k){const h=_ns(k);if(k!=='invest'||!h.includes('class="nvs"'))return h;return h.replace('<div class="nvs">',`<div class="nvs"><button class="nv sub" data-a="go" data-v="target"${S.ui.view==='target'?' aria-current="page"':''}><i class="dot" style="--c:var(--accent)"></i><span>${esc(t('tg.nav'))}</span></button>`)}}
{const _ec=envChips;envChips=function(cur){const h=_ec(cur);if(!h)return h;return h.replace(/(<button class="chip" data-a="go" data-v="expo"[^>]*>[^<]*<\/button>)/,`$1<button class="chip" data-a="go" data-v="target" aria-pressed="${cur==='target'}">${esc(t('tg.nav'))}</button>`)}}
{const _ns2=navSub;navSub=function(k){const h=_ns2(k);if(k!=='daily'||!h.includes('class="nvs"'))return h;return h.replace('<div class="nvs">',`<div class="nvs"><button class="nv sub" data-a="review" data-v=""${S.ui.view==='review'?' aria-current="page"':''}><i class="dot" style="--c:var(--k4)"></i><span>${esc(t('rv.nav'))}</span></button>`)}}
