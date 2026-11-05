/* ================= import de transactions de portefeuille (CSV, PDF) ================= */
/* état : S.ui.timp = {queue, lockAcc, name, src:'trcsv'|'csv'|'pdf', groups, tgt, nname, ntype, recalc, rm, bal, cashTotal, last, header, rows, map} */
const TI_TYPES=['buy','sell','div','int','dep','wd','fee','tax','in','out','pl','other'];
function tiBank(){const I=S.ui.timp;return I.src==='trcsv'?'Trade Republic':(I.bank||'')}
function tiGuess(g,gi,I){
  const bank=norm(tiBank()).split(' ')[0];
  if(g.kind==='cash'){
    const acc=D().accounts.filter(a=>accCls(a)==='cash');
    const b=acc.map(a=>({a,s:(bank&&norm(a.inst+' '+a.name).includes(bank)?3:0)+(a.type==='checking'?1:0)})).sort((x,y)=>y.s-x.s)[0];
    return b&&b.s>=3?b.a.id:'__new';
  }
  if(I.lockAcc&&gi===I.lockGi)return I.lockAcc;
  const R=replayOps(g.ops);
  if(!R.open.length&&g.key==='crypto')return '__skip';
  const acc=pfAccounts('pos').filter(a=>a.id!==I.lockAcc);if(!acc.length)return '__new';
  const isins=new Set(g.ops.map(o=>o.isin).filter(Boolean));
  const sc=a=>{let s=0;if(a.type===g.type)s+=3;const bk=norm(a.inst+' '+a.name);const ov=a.holdings.filter(h=>h.isin&&isins.has(h.isin)).length+iopsOf(a.id).filter(o=>o.isin&&isins.has(o.isin)).length;if(bank&&bk.includes(bank))s+=2;else if(bank&&a.inst&&!ov)s-=3;return s+Math.min(5,ov)};
  const b=acc.map(a=>({a,s:sc(a)})).sort((x,y)=>y.s-x.s)[0];
  const used=Object.entries(I.tgt||{}).filter(([k])=>+k!==gi).map(([,v])=>v);
  return b&&b.s>=4&&!used.includes(b.a.id)?b.a.id:'__new';
}
function tiInit(I){
  I.tgt={};I.nname={};I.ntype={};I.recalc={};I.rm={};I.bal={};I.lockGi=null;
  const la=I.lockAcc&&D().accounts.find(a=>a.id===I.lockAcc);
  if(la){let best=-1,bs=-1;I.groups.forEach((g,gi)=>{if(g.kind!=='ops')return;const s=(g.type===la.type?3:0)+g.ops.length/1e4;if(s>bs){bs=s;best=gi}});if(best>-1)I.lockGi=best}
  I.groups.forEach((g,gi)=>{I.tgt[gi]=tiGuess(g,gi,I);I.ntype[gi]=g.type;I.nname[gi]=((tiBank()?tiBank()+' ':'')+(g.kind==='cash'?t('pi.cashName'):typL(g.type))).slice(0,40);
    const tg=I.tgt[gi]&&I.tgt[gi][0]!=='_'?D().accounts.find(a=>a.id===I.tgt[gi]):null;
    I.recalc[gi]=g.kind==='ops'&&(I.src==='trcsv'||!tg||!tg.holdings.length);I.rm[gi]=I.src==='trcsv';I.bal[gi]=true});
}
/* opérations nouvelles / déjà connues pour un groupe */
function tiSplit(gi){
  const I=S.ui.timp;const g=I.groups[gi];const tgt=I.tgt[gi];
  const a=tgt&&tgt[0]!=='_'?D().accounts.find(x=>x.id===tgt):null;
  if(g.kind==='cash'){
    const ex=new Map();if(a)D().txs.filter(x=>x.acc===a.id).forEach(x=>{const k=x.d+'|'+(+x.a).toFixed(2);ex.set(k,(ex.get(k)||0)+1)});
    const seen=new Map();const nw=[],dup=[];
    g.cash.forEach(o=>{const k=o.d+'|'+o.a.toFixed(2);seen.set(k,(seen.get(k)||0)+1);(seen.get(k)<=(ex.get(k)||0)?dup:nw).push(o)});
    return {a,nw,dup};
  }
  const have=a?iopsOf(a.id):[];const ext=new Set(have.map(o=>o.ext).filter(Boolean));const sig=new Map();have.forEach(o=>{const k=iopSig(o);sig.set(k,(sig.get(k)||0)+1)});
  const seen=new Map();const nw=[],dup=[];
  g.ops.forEach(o=>{if(o.ext&&ext.has(o.ext)){dup.push(o);return}const k=iopSig({...o,acc:a?a.id:''});seen.set(k,(seen.get(k)||0)+1);(seen.get(k)<=(sig.get(k)||0)?dup:nw).push(o)});
  return {a,nw,dup};
}
function tiCounts(ops){const c={};ops.forEach(o=>c[o.t]=(c[o.t]||0)+1);return c}
/* catégorie d'une opération espèces importée (Trade Republic : types fournis par l'export) */
function tiCat(o,accId){
  const selves=(ST().selfNames||[]).map(s=>norm(s).split(' ').filter(Boolean)).filter(x=>x.length>=2);
  const nl=norm(o.l);const self=selves.some(tk=>tk.every(w=>(' '+nl+' ').includes(' '+w+' ')));
  if(o.ty==='CUSTOMER_INPAYMENT')return 'transfer';
  if(/^(TRANSFER|CUSTOMER_INBOUND|CUSTOMER_OUTBOUND)/.test(o.ty||'')&&self)return 'transfer';
  if(o.ty==='INTEREST_PAYMENT'||o.ty==='DIVIDEND')return 'investIncome';
  if(/SAVEBACK|BONUS|STOCKPERK|COMPENSATION|TAX_OPTIMIZATION/.test(o.ty||''))return 'otherIn';
  if(o.ty==='CARD_ORDERING_FEE')return 'fees';
  const m=D().txs.find(x=>x.acc&&x.acc!==accId&&Math.abs(x.a+o.a)<0.005&&Math.abs(daysBetween(x.d,o.d))<=3);if(m)return 'transfer';
  let c=categorize(o.l,o.a,D().rules);if(c!=='transfer'&&TRANSFER_RE.test(nl)&&self)c='transfer';return c;
}

/* ---------- lecture ---------- */
function tiFromCsv(text,name){
  const all=parseCSVText(text,detectDelim(text));if(all.length<2)throw {msg:t('imp.noRows')};
  const header=all[0].map(c=>String(c).trim());const rows=all.slice(1).filter(r=>r.some(c=>String(c).trim()));
  if(isTrCsv(header)){const r=parseTrCsv(header,rows);return {src:'trcsv',groups:r.groups,cashTotal:r.cashTotal,last:r.last,bank:'Trade Republic'}}
  const m=guessItxCols(header);if(m.date<0||(m.qty<0&&m.amount<0))return null;
  return {src:'csv',header,rows,map:m,groups:[{key:'csv',kind:'ops',type:'cto',label:name.replace(/\.[a-z]+$/i,''),ops:parseGenericItx(header,rows,m),cash:[]}],bank:detectBank(text.slice(0,3000),name)};
}
function startTimport(state,queue,lockAcc){
  S.ui.timp=Object.assign({queue:queue||[],lockAcc:lockAcc||null},state);tiInit(S.ui.timp);S.ui.ovl={k:'timport'};renderOvl();
}
async function nextTimport(){
  const I=S.ui.timp;const f=I&&I.queue.shift();
  if(!f){S.ui.ovl=null;S.ui.timp=null;render();return}
  S.ui.pimp={queue:[f,...I.queue],lockAcc:I.lockAcc};S.ui.timp=null;S.ui.ovl={k:'pimport'};nextPimport();
}

/* ---------- application ---------- */
function doTimport(){
  const I=S.ui.timp;if(!I)return;let nOps=0,nTx=0,nPos=0;const touched=new Set();
  I.groups.forEach((g,gi)=>{
    let tgt=I.tgt[gi];if(!tgt||tgt==='__skip')return;
    const sp=tiSplit(gi);
    if(tgt==='__new'){const type=I.ntype[gi]||g.type;const ty=TYP[type]||{};const a={id:uid(),name:(I.nname[gi]||'').trim()||typL(type),inst:tiBank(),type,cur:ST().cur,balance:0,holdings:[],include:true,createdAt:today(),updatedAt:today()};if(ty.h)a.cash=0;D().accounts.push(a);tgt=a.id;I.tgt[gi]=a.id;sp.a=a}
    const a=D().accounts.find(x=>x.id===tgt);if(!a)return;touched.add(a.id);
    if(g.kind==='cash'){
      sp.nw.forEach(o=>{D().txs.push({id:uid(),d:o.d,a:r2(o.a),l:o.l,c:tiCat(o,a.id),acc:a.id});nTx++});
      D().txs.sort((x,y)=>y.d.localeCompare(x.d));
      if(I.bal[gi]){const b=tiBal(gi);if(b&&!(a.balAt&&a.balAt>b.d)){a.balance=b.v;a.balAt=b.d}}
      a.updatedAt=today();return;
    }
    if(!(TYP[a.type]||{}).h)return;
    if(!D().iops)D().iops=[];
    let s=Math.max(0,...iopsOf(a.id).map(o=>o.s||0))+1;
    sp.nw.forEach(o=>{const x={id:uid(),acc:a.id,d:o.d,t:o.t,q:+(+o.q||0).toFixed(8),px:+(+o.px||0).toFixed(6),amt:r2(+o.amt||0),fee:r2(+o.fee||0),tax:r2(+o.tax||0),cur:o.cur||'EUR',s:s++};
      ['isin','sym','n','cls','ext'].forEach(k=>{if(o[k])x[k]=o[k]});D().iops.push(x);nOps++});
    if(I.recalc[gi])nPos+=recalcHoldings(a,{rm:I.rm[gi]});
    a.updatedAt=today();
  });
  save();toast(t('ti.done',{o:nOps,p:nPos,x:nTx}));syncLive();
  const ids=[...touched];const q=I.queue||[];
  if(q.length){nextTimport();return}
  S.ui.timp=null;
  const inv=ids.map(id=>D().accounts.find(a=>a.id===id)).filter(a=>a&&(TYP[a.type]||{}).h);
  if(inv.length===1){S.ui.ovl={k:'acc',id:inv[0].id};render()}else{S.ui.ovl=null;S.ui.view=inv.length?'invest':'budget';render()}
}
function tiBal(gi){
  const I=S.ui.timp;const g=I.groups[gi];
  if(I.src==='trcsv'&&g.key==='cash')return {v:I.cashTotal,d:I.last};
  if(g.endBal!=null&&g.period)return {v:g.endBal,d:g.period.to};
  return null;
}

/* ---------- tiroir ---------- */
function timportDrawer(){
  const I=S.ui.timp;if(!I)return '';
  const head=`<div class="ph"><div><h2>${esc(t('ti.t'))}</h2><p>${esc(t('ti.sub'))}</p></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>`;
  const nOps=sum(I.groups.map(g=>g.ops.length+g.cash.length));
  const dates=I.groups.flatMap(g=>g.ops.map(o=>o.d).concat(g.cash.map(o=>o.d))).sort();
  let out=head+`<div class="card flat" style="margin-bottom:14px"><div class="hrow" style="justify-content:space-between"><div class="hrow" style="gap:8px;min-width:0">${ico(I.src==='pdf'?'receipt':'budget')}<b style="overflow-wrap:anywhere">${esc(I.name||'')}</b>${I.queue&&I.queue.length?`<span class="pill acc">${esc(t('imp.queue',{n:I.queue.length}))}</span>`:''}</div><button class="link" data-a="tiReset">${esc(t('imp.other'))}</button></div></div>
  <div class="pff">${[[t('imp.bank'),tiBank()||t('imp.bankUnknown')],[t('imp.period'),dates.length?dateT(dates[0])+' → '+dateT(dates[dates.length-1]):'—'],[t('ti.nOps'),String(nOps)]].map(([l,v])=>`<div class="card flat" style="padding:12px"><div class="note">${esc(l)}</div><b>${esc(v)}</b></div>`).join('')}</div>`;
  if(I.src==='csv'){const cols=I.header.map((h,i)=>`<option value="${i}">${esc(h||t('imp.col',{n:i+1}))}</option>`).join('');
    const sel=k=>`<div class="f"><label for="ti-${k}">${esc(t('ti.col.'+k))}</label><select id="ti-${k}" data-f="tiMap" data-v="${k}"><option value="-1">—</option>${cols.replace(`value="${I.map[k]}"`,`value="${I.map[k]}" selected`)}</select></div>`;
    out+=`<details class="card flat" style="margin-top:12px"><summary><b>${esc(t('ti.mapT'))}</b></summary><div class="mapgrid" style="margin-top:10px">${ITX_ROLES.map(sel).join('')}</div></details>`}
  const TL=k=>t('ti.t.'+k);
  I.groups.forEach((g,gi)=>{
    const tgt=I.tgt[gi];const isCash=g.kind==='cash';
    const accs=isCash?D().accounts.filter(a=>accCls(a)==='cash'):pfAccounts('pos');
    const typeOpts=isCash?['checking','card']:TYPES.filter(x=>x.h).map(x=>x.k);
    const sel=`<select id="ti-acc-${gi}" data-f="tiAcc" data-v="${gi}" aria-label="${esc(t('f.account'))}">${accs.map(a=>`<option value="${a.id}"${a.id===tgt?' selected':''}>${esc(a.name)} · ${esc(typL(a.type))}</option>`).join('')}<option value="__new"${tgt==='__new'?' selected':''}>${esc(t('imp.newAcc'))}</option><option value="__skip"${tgt==='__skip'?' selected':''}>${esc(t('pi.skipGroup'))}</option></select>`;
    const newF=tgt==='__new'?`<div class="form" style="margin-top:10px"><div class="f"><label for="ti-nn-${gi}">${esc(t('imp.newName'))}</label><input id="ti-nn-${gi}" data-f="tiNewName" data-v="${gi}" value="${esc(I.nname[gi]||'')}"></div><div class="f"><label for="ti-nt-${gi}">${esc(t('f.type'))}</label><select id="ti-nt-${gi}" data-f="tiNewType" data-v="${gi}">${typeOpts.map(k=>`<option value="${k}"${k===I.ntype[gi]?' selected':''}>${esc(typL(k))}</option>`).join('')}</select></div></div>`:'';
    const sp=tgt==='__skip'?null:tiSplit(gi);
    const cnt=tiCounts(isCash?[]:g.ops);
    out+=`<section class="card flat pfg" style="margin-top:16px"><div class="hrow" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><div class="hrow" style="gap:8px;min-width:0">${ico(isCash?'cash':g.type==='wallet'?'crypto':'bars')}<b>${esc(isCash?t('ti.cashT'):g.label)}</b><span class="pill">${esc(t('ti.nLines',{n:isCash?g.cash.length:g.ops.length}))}</span></div>
      ${sp?`<span class="pill ${sp.nw.length?'acc':''}">${esc(t('ti.newDup',{n:sp.nw.length,d:sp.dup.length}))}</span>`:''}</div>
      ${!isCash?`<div class="chips" style="margin-top:8px">${TI_TYPES.filter(k=>cnt[k]).map(k=>`<span class="pill">${esc(TL(k))} · ${cnt[k]}</span>`).join('')}</div>`:''}
      <div class="form" style="margin-top:10px"><div class="f full"><label for="ti-acc-${gi}">${esc(t(isCash?'ti.cashInto':'pi.into'))}</label>${sel}${newF}</div></div>`;
    if(!sp){out+=`<p class="note" style="margin:8px 0 0">${esc(t('pi.skipped'))}</p></section>`;return}
    if(isCash){
      out+=`<p class="note" style="margin:10px 0 0">${esc(t('ti.cashP'))}</p><div class="prev" style="margin-top:10px"><table><thead><tr><th>${esc(t('f.date'))}</th><th>${esc(t('f.label'))}</th><th>${esc(t('f.amount'))}</th></tr></thead><tbody>${[...sp.nw].sort((x,y)=>y.d.localeCompare(x.d)).slice(0,40).map(o=>`<tr><td>${esc(dateT(o.d,'short'))}</td><td style="white-space:normal">${esc(o.l)}</td><td class="${o.a>0?'good':''}">${esc(moneyT(o.a))}</td></tr>`).join('')||`<tr><td colspan="3" class="note">${esc(t('ti.allKnown'))}</td></tr>`}</tbody></table></div>`;
      const b=tiBal(gi);if(b)out+=`<label class="inline note" style="margin-top:10px"><input type="checkbox" data-f="tiBal" data-v="${gi}" ${I.bal[gi]?'checked':''}> ${esc(t('imp.updBal',{v:moneyT(b.v),d:dateT(b.d)}))}</label>`;
      out+=`</section>`;return}
    /* positions obtenues après import */
    const a=sp.a;const R=replayOps((a?iopsOf(a.id):[]).concat(sp.nw));
    out+=`<div class="kpis k4" style="box-shadow:none;margin:12px 0 0">${R.T.ownCash?kpi(t('ti.k.dep'),money(R.T.dep-R.T.wd,0)):kpi(t('ti.k.buys'),money(R.T.buys,0))}${kpi(t('ti.k.div'),money(R.T.div,2))}${kpi(t('ti.k.fee'),money(R.T.fee+R.T.tax,2))}${kpi(t('ti.k.real'),`<span class="${cls(R.T.real)}">${moneyS(R.T.real,2)}</span>`)}</div>`;
    out+=`<div class="hrow" style="justify-content:space-between;margin:14px 0 6px"><b>${esc(t('ti.openT',{n:R.open.length}))}</b><span class="note">${esc(t('ti.pmp'))}</span></div>
    <div class="prev"><table><thead><tr><th></th><th>${esc(t('inv.colName'))}</th><th>${esc(t('f.qty'))}</th><th>${esc(t('inv.pru'))}</th><th>${esc(t('inv.cost'))}</th><th>${esc(t('pi.status'))}</th></tr></thead><tbody>${R.open.map(p=>{const h=a?pfMatch(a,{name:p.n,isin:p.isin||null,sym:p.sym||null}):null;const st=!h?'new':Math.abs((+h.qty||0)-p.qty)>1e-7?'upd':Math.abs((+h.pru||0)-p.pru)>0.005?'px':'same';
      return `<tr><td></td><td style="white-space:normal"><b>${esc(p.n||p.sym||p.isin)}</b><div class="note" style="font-size:12px">${esc([p.isin,p.sym].filter(Boolean).join(' · '))}</div><span class="pill pfst">${esc(t('pi.st.'+st))}</span></td><td>${h&&st==='upd'?`<span class="note">${esc(qtyT(+h.qty))} →</span> `:''}<b>${esc(qtyT(p.qty))}</b></td><td>${esc(moneyT(p.pru,p.pru<10?4:2))}</td><td>${esc(moneyT(p.cost,2))}</td><td><span class="pill ${st==='new'?'acc':st==='upd'?'warn':''}">${esc(t('pi.st.'+(st==='px'?'pruUpd':st)))}</span></td></tr>`}).join('')||`<tr><td colspan="6" class="note">${esc(t('ti.noneOpen'))}</td></tr>`}</tbody></table></div>`;
    const stale=a?a.holdings.filter(h=>h.kind!=='fe'&&!R.open.some(p=>pfMatch({holdings:[h]},{name:p.n,isin:p.isin||null,sym:p.sym||null}))):[];
    out+=`<label class="inline note" style="margin-top:10px;align-items:flex-start"><input type="checkbox" data-f="tiRecalc" data-v="${gi}" ${I.recalc[gi]?'checked':''}> <span>${esc(t('ti.recalc'))}<br><span class="faint">${esc(t(I.src==='trcsv'?'ti.recalcFull':'ti.recalcPart'))}</span></span></label>`;
    if(I.recalc[gi]&&stale.length)out+=`<label class="inline note" style="margin-top:8px;align-items:flex-start"><input type="checkbox" data-f="tiRm" data-v="${gi}" ${I.rm[gi]?'checked':''}> <span>${esc(t('pi.absent',{n:stale.length}))} <span class="faint">${esc(stale.slice(0,6).map(h=>h.name).join(', '))}</span></span></label>`;
    out+=`</section>`;
  });
  const any=I.groups.some((g,gi)=>I.tgt[gi]&&I.tgt[gi]!=='__skip'&&(tiSplit(gi).nw.length||(g.kind==='ops'&&I.recalc[gi])||(g.kind==='cash'&&I.bal[gi]&&tiBal(gi))));
  out+=`<div class="pfoot"><button class="btn ghost" data-a="${I.queue&&I.queue.length?'tiSkip':'close'}">${esc(t(I.queue&&I.queue.length?'imp.skip':'act.cancel'))}</button><span class="sp"></span><button class="btn" data-a="tiGo" ${any?'':'disabled'}>${ico('check')}${esc(t('ti.go'))}</button></div>`;
  return out;
}
