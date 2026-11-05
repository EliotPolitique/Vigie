/* ================= V4.4 — comparaison avec un indice =================
   Collection « bench » : un document par indice de référence (MSCI World, S&P 500, CAC 40), suivi au travers d'un ETF
   capitalisant coté en euros (dividendes réinvestis), cours hebdomadaires puis quotidiens.
   Méthode : chaque versement net (ou achat net pour un compte sans espèces propres) est « placé » dans l'indice à sa date ;
   on compare la valeur obtenue à la valeur réelle. C'est la comparaison juste quand on investit au fil de l'eau. */
const BENCH={map:new Map(),unsub:null};
function startBench(){const db=S.cap.db;if(!db||BENCH.unsub)return;try{BENCH.unsub=db.collection('bench').onSnapshot(snap=>{BENCH.map.clear();
  snap.docs.forEach(d=>{const b=d.data()||{};const pts=Object.entries(b.hist||{}).filter(([k,v])=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&+v>0).map(([k,v])=>({d:k,v:+v})).sort((x,y)=>x.d.localeCompare(y.d));if(pts.length>4)BENCH.map.set(d.id,{id:d.id,l:b.l||d.id,proxy:b.proxy||'',src:b.src||'',tr:!!b.tr,pts})});
  if(S.phase==='app'&&!S.ui.ovl&&['perf','invest','acct','env'].includes(S.ui.view))render()},()=>{BENCH.unsub=null})}catch(e){BENCH.unsub=null}}
{const _sb3=startBase;startBase=function(){_sb3();startBench()}}
const BENCH_ORDER=['msci-world','sp500','cac40'];
function benchList(){return BENCH_ORDER.map(k=>BENCH.map.get(k)).filter(Boolean).concat([...BENCH.map.values()].filter(b=>!BENCH_ORDER.includes(b.id)))}
/* flux d'argent placés sur un ensemble de comptes d'investissement */
function invFlows(ids){const F=[];ids.forEach(id=>{const a=D().accounts.find(x=>x.id===id);if(!a)return;const ops=iopsOf(id);const own=ops.some(o=>o.t==='dep'||o.t==='wd');
  if(!ops.length){const v=sum((a.holdings||[]).map(h=>hCost(h,a)))+conv(+a.cash||0,a.cur);const d=a.opened||a.createdAt;if(v>0&&d)F.push({d,v});return}
  ops.forEach(o=>{const v=conv(iopNet(o),o.cur||a.cur);if(own){if(o.t==='dep'||o.t==='wd')F.push({d:o.d,v})}else if(['buy','sell','div','int'].includes(o.t))F.push({d:o.d,v:-v,inc:o.t==='div'||o.t==='int'})})});
  return F.filter(f=>f.v).sort((a,b)=>a.d.localeCompare(b.d))}
function benchModel(ids,bid){const B=BENCH.map.get(bid);if(!B)return null;const F=invFlows(ids);if(!F.length)return null;
  const mine=accHist(ids,1);if(mine.length<3)return null;const px=pxCurve(B.pts);if(F[0].d<B.pts[0].d)return {err:'early',B,from:B.pts[0].d};
  let j=0,units=0,net=0;const idx=[],me=[];
  mine.forEach(p=>{while(j<F.length&&F[j].d<=p.d){const f=F[j++];const q=px(f.d);if(q>0)units+=f.v/q;if(!f.inc)net+=f.v}idx.push({d:p.d,v:r2(units*px(p.d)),net:r2(net)});me.push(p)});
  const f0=me.findIndex(p=>p.d>=F[0].d);const s=Math.max(0,f0-1);
  const A=me.slice(s),I=idx.slice(s);const last=A[A.length-1],li=I[I.length-1];
  return {B,mine:A,idx:I,val:last.v,iv:li.v,net:li.net,diff:last.v-li.v,from:F[0].d}}
function benchCompareCard(ids,title){if(!BENCH.map.size)return '';const L=benchList();let bid=S.ui.bench&&BENCH.map.has(S.ui.bench)?S.ui.bench:L[0].id;
  const M=benchModel(ids,bid);const sel=seg('bench',L.map(b=>[b.id,b.l]),bid,t('bm.t'));
  if(!M)return `<div class="card"><div class="ch"><div><h2>${esc(title||t('bm.t'))}</h2><p>${esc(t('bm.none'))}</p></div><div class="act">${sel}</div></div></div>`;
  if(M.err)return `<div class="card"><div class="ch"><div><h2>${esc(title||t('bm.t'))}</h2><p>${esc(t('bm.early',{d:dateT(M.from)}))}</p></div><div class="act">${sel}</div></div></div>`;
  const step=M.mine.length>420?3:1;const a=M.mine.filter((p,i)=>i%step===0||i===M.mine.length-1),b=M.idx.filter((p,i)=>i%step===0||i===M.idx.length-1);
  const lead=M.diff>=0;
  return `<div class="card bmc"><div class="ch"><div><h2>${esc(title||t('bm.t'))}</h2><p>${esc(t('bm.s',{i:M.B.l,d:dateT(M.from)}))}</p></div><div class="act">${sel}</div></div>
    <div class="bmk"><div><span><i class="sq" style="--c:var(--accent)"></i>${esc(t('bm.you'))}</span><b>${money(M.val,0)}</b></div><div><span><i class="sq dash" style="--c:var(--k4)"></i>${esc(t('bm.idx',{i:M.B.l}))}</span><b>${money(M.iv,0)}</b></div><div><span>${esc(t('bm.net'))}</span><b>${money(M.net,0)}</b></div><div><span>${esc(t('bm.gap'))}</span><b class="${cls(M.diff)}">${moneyS(M.diff,0)}</b></div></div>
    ${chart({h:220,series:[{pts:a,c:'var(--accent)'},{pts:b,c:'var(--k4)',dash:true}],xl:i=>dateT(a[i].d,'my'),tip:i=>{const g=a[i].v-b[i].v;return `<div class="tipd">${esc(dateT(a[i].d,'long'))}</div><div class="tipr"><i style="--c:var(--accent)"></i>${esc(t('bm.you'))}<b>${esc(moneyT(a[i].v,0))}</b></div><div class="tipr"><i style="--c:var(--k4)"></i>${esc(M.B.l)}<b>${esc(moneyT(b[i].v,0))}</b></div><div class="tipr"><i></i>${esc(t('bm.net'))}<b>${esc(moneyT(b[i].net,0))}</b></div><div class="tipr"><i></i>${esc(t('bm.gap'))}<b class="${g>=0?'good':'bad'}">${esc((g>=0?'+':'')+moneyT(g,0))}</b></div>`},label:t('bm.t')})}
    <p class="note" style="margin-top:8px">${esc(t(lead?'bm.ahead':'bm.behind',{i:M.B.l,v:moneyT(Math.abs(M.diff),0)}))} ${esc(t('bm.note',{p:M.B.proxy}))}</p></div>`}
EXT.A.bench=v=>{S.ui.bench=v;render()};
/* intégration : Performance et vue d'ensemble des investissements */
{const _pv=perfView;perfView=function(){const h=_pv();const ids=invAccs().map(a=>a.id);const c=benchCompareCard(ids);return c?h+`<div style="margin-top:16px">${c}</div>`:h}}
{const _iv=investView;investView=function(){const h=_iv();if(S.ui.invTab&&S.ui.invTab!=='pos')return h;const ids=invAccs().map(a=>a.id);const c=benchCompareCard(ids,t('bm.tInv'));return c?h+`<div style="margin-top:16px">${c}</div>`:h}}

/* ---------- infobulles plus riches sur la courbe du patrimoine ---------- */
function richTip(pts,i,dec){const p=pts[i],f=pts[0],pr=pts[i-1];const d0=p.v-f.v,dp=pr?p.v-pr.v:0;
  return `<div class="tipd">${esc(p.tm?dateT(p.d,'short')+' '+p.tm:dateT(p.d,'long'))}</div><div class="tipv">${esc(moneyT(p.v,dec))}</div>${i>0?`<div class="tipr"><i></i>${esc(t('tip.since'))}<b class="${d0>=0?'good':'bad'}">${esc((d0>=0?'+':'')+moneyT(d0,0))} · ${esc((f.v?(d0/Math.abs(f.v)*100):0).toFixed(1).replace('.',','))} %</b></div><div class="tipr"><i></i>${esc(t('tip.prev'))}<b class="${dp>=0?'good':'bad'}">${esc((dp>=0?'+':'')+moneyT(dp,dec))}</b></div>`:''}`}
