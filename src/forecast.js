/* ================= V4 — prévision de trésorerie, hausses d'abonnements, rapport ================= */
/* opérations récurrentes (revenus et dépenses) des comptes courants, sur les 6 derniers mois */
function recurAll(){
  const ids=new Set(dailyAccs().map(a=>a.id));const from=ymAdd(today().slice(0,7),-6);const G={};
  D().txs.filter(x=>ids.has(x.acc)&&ymOf(x.d)>=from&&Math.abs(x.a)>=1&&(CAT[x.c]||{}).kind!=='move').forEach(x=>{const k=(x.a>0?'+':'-')+(merchant(x.l)||'');if(k.length<3)return;(G[k]=G[k]||[]).push(x)});
  const out=[];
  for(const [k,g] of Object.entries(G)){g.sort((a,b)=>a.d.localeCompare(b.d));const byM={};g.forEach(x=>{(byM[ymOf(x.d)]=byM[ymOf(x.d)]||[]).push(x)});const ms=Object.keys(byM).sort();if(ms.length<3)continue;
    /* une occurrence par mois (la plus proche du jour habituel) */
    const dayMed=(()=>{const ds=g.map(x=>+x.d.slice(8,10)).sort((a,b)=>a-b);return ds[Math.floor(ds.length/2)]})();
    const one=ms.map(m=>byM[m].slice().sort((a,b)=>Math.abs(+a.d.slice(8,10)-dayMed)-Math.abs(+b.d.slice(8,10)-dayMed))[0]);
    const days=one.map(x=>+x.d.slice(8,10));if(Math.max(...days)-Math.min(...days)>8)continue;
    const am=one.map(x=>Math.abs(x.a));const rec=am.slice(-3).sort((a,b)=>a-b)[Math.min(1,am.slice(-3).length-1)];if(Math.max(...am.slice(-3))/Math.min(...am.slice(-3))>1.5)continue;
    const last=one[one.length-1],prev=one[one.length-2];
    out.push({k,sign:x0(k),l:cleanLabel(last.l),c:last.c,day:dayMed,amt:rec,last:last.d,lastAmt:Math.abs(last.a),prevAmt:Math.abs(prev.a),n:ms.length,acc:last.acc})}
  /* un même prélèvement sous deux libellés (changement de format du relevé) : on n'en garde qu'un */
  out.sort((a,b)=>b.last.localeCompare(a.last));const keep=[];out.forEach(r=>{if(keep.some(q=>q.sign===r.sign&&q.c===r.c&&Math.abs(q.amt-r.amt)<=Math.max(0.05,q.amt*0.02)&&Math.abs(q.day-r.day)<=3))return;keep.push(r)});
  return keep.sort((a,b)=>b.amt-a.amt)}
function x0(k){return k[0]==='+'?1:-1}
/* dépenses courantes hors récurrentes : moyenne quotidienne sur 90 jours */
function varDaily(R,sign){const ids=new Set(dailyAccs().map(a=>a.id));const from=dAdd(today(),-90);const keys=new Set(R.map(r=>r.k));sign=sign||-1;
  const v=D().txs.filter(x=>ids.has(x.acc)&&x.d>=from&&x.d<today()&&Math.sign(x.a)===sign&&(sign<0?['out','nc'].includes((CAT[x.c]||{}).kind):(CAT[x.c]||{}).kind==='in')&&!keys.has((sign<0?'-':'+')+(merchant(x.l)||''))).reduce((s,x)=>s+Math.abs(x.a),0);return v/90}
function forecast(days){
  days=days||90;const R=recurAll();const td=today();const start=sum(dailyAccs().map(accValue));const vd=varDaily(R,-1),vi=varDaily(R,1);
  const pts=[{d:td,v:start}];let b=start;const events=[];
  for(let i=1;i<=days;i++){const d=dAdd(td,i);const dom=+d.slice(8,10);const dim=new Date(+d.slice(0,4),+d.slice(5,7),0).getDate();
    R.forEach(r=>{const day=Math.min(r.day,dim);if(dom!==day)return;/* déjà passée ce mois-ci ? */if(ymOf(r.last)===ymOf(d)&&r.last<=td)return;b+=r.sign*r.amt;events.push({d,r})});
    b+=vi-vd;pts.push({d,v:r2(b)})}
  const low=pts.reduce((m,p)=>p.v<m.v?p:m,pts[0]);const firstNeg=pts.find(p=>p.v<0);
  return {pts,start,R,vd,vi,low,firstNeg,events,inc:sum(R.filter(r=>r.sign>0).map(r=>r.amt)),out:sum(R.filter(r=>r.sign<0).map(r=>r.amt))}}
function forecastCard(){
  if(!dailyAccs().length)return '';const F=forecast(90);const at=n=>F.pts[Math.min(n,F.pts.length-1)].v;const p=(S.ui.fcN||90);const pts=F.pts.slice(0,p+1);
  const next=F.events.slice(0,6);
  return `<div class="card" style="margin-top:16px"><div class="ch"><div><h2>${esc(t('fc.t'))}</h2><p>${esc(t('fc.s'))}</p></div>${seg('fcN',[['30','30 j'],['60','60 j'],['90','90 j']],String(p),t('fc.t'))}</div>
    ${F.firstNeg?`<div class="callout bad" style="margin-bottom:12px">${ico('alert')} ${esc(t('fc.neg',{d:dateT(F.firstNeg.d,'long'),v:moneyT(F.low.v,0)}))}</div>`:''}
    <div class="kpis k4" style="box-shadow:none;margin-bottom:12px">${kpi(t('fc.k30'),money(at(30),0))}${kpi(t('fc.k60'),money(at(60),0))}${kpi(t('fc.k90'),money(at(90),0))}${kpi(t('fc.low'),`<span class="${F.low.v<0?'bad':''}">${money(F.low.v,0)}</span>`,dateT(F.low.d))}</div>
    ${chart({h:190,zero:true,series:[{pts,c:'var(--k2)'}],xl:i=>dateT(pts[i].d,'short'),tip:i=>`<b>${esc(moneyT(pts[i].v,0))}</b><br>${esc(dateT(pts[i].d,'long'))}`})}
    <div class="grid g2 keep" style="gap:12px;margin-top:12px"><div><div class="note">${esc(t('fc.next'))}</div><div class="list">${next.map(e=>`<div class="row"><div class="m"><b>${esc(e.r.l)}</b><span>${esc(dateT(e.d,'long'))}</span></div><div class="r"><b class="${e.r.sign>0?'good':''}">${e.r.sign>0?'+':'−'}${esc(moneyT(e.r.amt,2))}</b></div></div>`).join('')||`<p class="note">—</p>`}</div></div>
    <div><div class="wkv"><div><span>${esc(t('fc.inc'))}</span><b class="good">${money(F.inc,0)}</b></div><div><span>${esc(t('fc.out'))}</span><b>${money(F.out,0)}</b></div><div><span>${esc(t('fc.vin'))}</span><b class="good">${money(F.vi*30,0)}</b></div><div><span>${esc(t('fc.var'))}</span><b>${money(F.vd*30,0)}</b></div><div><span>${esc(t('fc.start'))}</span><b>${money(F.start,0)}</b></div></div></div></div>
    <p class="note" style="margin-top:10px">${esc(t('fc.how'))}</p></div>`}
EXT.A.fcN=v=>{S.ui.fcN=+v;render()};
/* hausses de prix des abonnements et prélèvements */
function subsCard(){const R=recurAll().filter(r=>r.sign<0&&(CAT[r.c]||{}).kind==='out');if(!R.length)return '';
  const up=R.filter(r=>r.lastAmt>r.prevAmt*1.02&&r.lastAmt-r.prevAmt>=0.2);const yr=sum(R.map(r=>r.amt))*12;
  return `<div class="card" style="margin-top:16px"><div class="ch"><div><h2>${esc(t('sb.t'))}</h2><p>${esc(t('sb.s',{n:R.length,v:moneyT(yr,0)}))}</p></div><button class="link" data-a="budgetTab" data-v="rec">${esc(t('see.all'))}</button></div>
    ${up.length?`<div class="callout" style="margin-bottom:10px">${esc(t('sb.up',{n:up.length}))}</div><div class="list">${up.map(r=>`<div class="row"><div class="m"><b>${esc(r.l)}</b><span>${esc(t('sb.upS',{a:moneyT(r.prevAmt,2),b:moneyT(r.lastAmt,2),d:dateT(r.last)}))}</span></div><div class="r"><b class="bad">+${esc(pctT(r.lastAmt/r.prevAmt-1,0))}</b><span>${esc(t('sb.yr',{v:moneyT((r.lastAmt-r.prevAmt)*12,0)}))}</span></div></div>`).join('')}</div>`:`<p class="note">${ico('check')} ${esc(t('sb.none'))}</p>`}
    <div class="list" style="margin-top:8px">${R.slice(0,6).map(r=>`<div class="row"><div class="m"><b>${esc(r.l)}</b><span>${esc(catL(r.c))} · ${esc(t('b.recDay',{d:r.day}))}</span></div><div class="r"><b>${money(r.amt,2)}</b><span>${esc(moneyT(r.amt*12,0))} / ${esc(t('per.year'))}</span></div></div>`).join('')}</div></div>`}
const _dlyV=dailyView;dailyView=function(){const h=_dlyV();if(curDacc())return h;return h+forecastCard()+subsCard()};

/* ---------- rapport téléchargeable ---------- */
function reportHTML(){
  const tt=totals();const d=D();const ym=ymAdd(today().slice(0,7),-1);const g=aggTx(monthTx(ym));const M=typeof perfModel==='function'?perfModel():null;const H=healthChecks();
  const cs=catSpend(monthTx(ym));const rowsC=Object.entries(cs).sort((a,b)=>b[1].v-a[1].v).map(([k,e])=>`<tr><td>${esc(catL(k))}</td><td class="n">${esc(moneyT(e.v,2))}</td></tr>`).join('');
  const accs=d.accounts.filter(a=>a.include!==false).map(a=>`<tr><td>${esc(a.name)}</td><td>${esc(typL(a.type))}</td><td class="n">${esc(moneyT(accValue(a),2))}</td></tr>`).join('');
  const cls=CLASSES.map(c=>[c.k,tt.by[c.k]]).filter(([,v])=>Math.abs(v)>0.004).map(([k,v])=>`<tr><td>${esc(clsL(k))}</td><td class="n">${esc(moneyT(v,2))}</td></tr>`).join('');
  const X=expoModel();const zone=Object.entries(X.zone).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${esc(t('ex.z.'+k))}</td><td class="n">${esc(pctT(v/(X.eqT||1),1))}</td></tr>`).join('');
  const h1=(s)=>`<h2>${esc(s)}</h2>`;
  return `<!doctype html><html lang="${esc(lang())}"><head><meta charset="utf-8"><title>${esc(t('rp2.title',{d:dateT(today())}))}</title><style>
  body{font:14px/1.5 -apple-system,Segoe UI,Inter,Arial,sans-serif;color:#141821;max-width:860px;margin:32px auto;padding:0 20px}h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
  table{width:100%;border-collapse:collapse}td{padding:5px 4px;border-bottom:1px solid #eee}td.n{text-align:right;font-variant-numeric:tabular-nums}.k{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}.k div{border:1px solid #ddd;border-radius:10px;padding:10px}.k b{display:block;font-size:18px}.muted{color:#667}@media print{body{margin:0}}</style></head><body>
  <h1>${esc(t('rp2.title',{d:dateT(today())}))}</h1><div class="muted">${esc(APP.name)} · ${esc(ST().name||'')} · ${esc(ST().cur)}</div>
  <div class="k"><div>${esc(t('k.net'))}<b>${esc(moneyT(tt.net,2))}</b></div><div>${esc(t('k.gross'))}<b>${esc(moneyT(tt.gross,2))}</b></div><div>${esc(t('k.debts'))}<b>${esc(moneyT(tt.debts,2))}</b></div><div>${esc(t('h.t'))}<b>${healthScore(H)}/100</b></div></div>
  ${h1(t('rp2.cls'))}<table>${cls}</table>${h1(t('rp2.accs'))}<table>${accs}</table>
  ${M?`${h1(t('nav.perf'))}<table><tr><td>${esc(t('pf2.net'))}</td><td class="n">${esc(moneyT(M.net,2))}</td></tr><tr><td>${esc(t('pf2.value'))}</td><td class="n">${esc(moneyT(M.value,2))}</td></tr><tr><td>${esc(t('rp2.gain'))}</td><td class="n">${esc(moneyT(M.value-M.net,2))}</td></tr></table>`:''}
  ${zone?`${h1(t('ex.zoneT'))}<table>${zone}</table><p class="muted">${esc(t('ex.method'))}</p>`:''}
  ${h1(t('rp2.budget',{m:monthT(ym)}))}<table><tr><td>${esc(t('b.income'))}</td><td class="n">${esc(moneyT(g.inc,2))}</td></tr><tr><td>${esc(t('b.expense'))}</td><td class="n">${esc(moneyT(g.exp,2))}</td></tr><tr><td>${esc(t('b.saved'))}</td><td class="n">${esc(moneyT(g.sav,2))}</td></tr></table>
  <h3 style="font-size:14px;margin:14px 0 6px">${esc(t('rp2.cats'))}</h3><table>${rowsC}</table>
  <p class="muted" style="margin-top:28px">${esc(t('rp2.foot'))}</p></body></html>`}
EXT.A.report=()=>{try{exportFile('vigie-rapport-'+today()+'.html',reportHTML(),'text/html')}catch(e){console.error(e);toast(t('err.export'),true)}};
const _qm2=quickMenu;quickMenu=function(){return _qm2().replace(/<\/div>$/,`<button role="menuitem" data-a="report">${ico('download')}${esc(t('rp2.btn'))}</button></div>`)};
