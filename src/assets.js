/* ================= V3 — actifs et prêts complets (inspiré de Finvygo) ================= */
/* ---------- nouveaux types ---------- */
[{k:'cel',cls:'savings',ic:'savings',rate:'cel',cap:15300,env:'exempt'},
 {k:'cashNotes',cls:'cash',ic:'cash'},
 {k:'percol',cls:'invest',ic:'brief',h:1,env:'per'},
 {k:'crowd',cls:'invest',ic:'coins',env:'pfu'},
 {k:'opci',cls:'realestate',ic:'bank',h:1,env:'immo'},
 {k:'metals',cls:'other',ic:'gem',h:1,env:'metal'},
 {k:'unlisted',cls:'other',ic:'brief'},
 {k:'debtOther',cls:'debt',ic:'loan',loan:1}
].forEach(x=>{if(TYP[x.k])return;let i=-1;TYPES.forEach((y,j)=>{if(y.cls===x.cls)i=j});if(i<0)TYPES.push(x);else TYPES.splice(i+1,0,x);TYP[x.k]=x});

/* ---------- taux réglementés (mis à jour avec l'application) ---------- */
const RATES_AT='2026-08-01',RATES_NOW={livretA:1.7,ldds:1.7,lep:2.5,livretJeune:1.7,pel:2.0,cel:1.25};
EXT.boot.push(d=>{const s=d.settings;if(!s.rates)s.rates={};if(s.ratesAt!==RATES_AT){Object.entries(RATES_NOW).forEach(([k,v])=>{if(!(s.ratesUser||{})[k])s.rates[k]=v});s.ratesAt=RATES_AT}else Object.entries(RATES_NOW).forEach(([k,v])=>{if(s.rates[k]==null)s.rates[k]=v})});
EXT.accDrawer.push(a=>{const ty=TYP[a.type]||{};if(!ty.rate||a.rate)return '';return `<p class="note" style="margin:-4px 0 14px">${esc(t('as.rateAuto',{d:dateT(RATES_AT)}))}</p>`});

/* ---------- métaux précieux ---------- */
const OZ=31.1035;const METAL_UNITS={oz:1,g:1/OZ,kg:1000/OZ,napoleon:5.806/OZ,krugerrand:1,vreneli:5.806/OZ,sovereign:7.322/OZ};
function metalMul(h){return (METAL_UNITS[h.unit]||1)*((+h.purity>0&&h.unit!=='napoleon'&&h.unit!=='krugerrand'&&h.unit!=='vreneli'&&h.unit!=='sovereign')?(+h.purity)/1000:1)}

/* ---------- moteur de prêt : échéancier éditable ---------- */
function addMonths(iso,n){const d=new Date(iso+'T12:00:00');const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return isoOf(d)}
function loanSchedule(L){
  const P=+L.p||0,N=Math.max(1,Math.round(+L.n||0)),start=L.start||today();if(!(P>0))return {rows:[],int:0,ins:0,pay:0,end:start};
  const vars=(L.vars||[]).filter(v=>+v.m>0).sort((x,y)=>x.m-y.m),steps=(L.steps||[]).filter(v=>+v.m>0&&+v.pay>0).sort((x,y)=>x.m-y.m);
  const D0=+((L.defer||{}).n)||0,dmode=(L.defer||{}).mode||'partial',ins=+L.ins||0,kind=L.kind||'amort';
  let bal=P;const rows=[];let tInt=0,tIns=0;
  for(let k=1;k<=N&&bal>0.004;k++){
    let r=+L.r||0;vars.forEach(v=>{if(v.m<=k)r=+v.r});const i=r/1200;const int=bal*i;let princ=0,pay=0;
    if(k<=D0){if(dmode==='total'){bal+=int;rows.push({k,d:addMonths(start,k-1),r,pay:ins,int:0,cap:int,princ:0,ins,bal});tIns+=ins;continue}pay=int}
    else if(kind==='infine'){pay=int;if(k===N){princ=bal;pay+=bal}}
    else{let st=null;steps.forEach(s=>{if(s.m<=k)st=s});const left=N-k+1;
      if(st)pay=+st.pay;else pay=i>0?bal*i/(1-Math.pow(1+i,-left)):bal/left;
      princ=Math.min(bal,pay-int);if(k===N||princ>bal)princ=bal;pay=princ+int}
    bal=Math.max(0,bal-princ);tInt+=int;tIns+=ins;
    rows.push({k,d:addMonths(start,k-1),r,pay:pay+ins,int,cap:0,princ,ins,bal});
  }
  return {rows,int:tInt,ins:tIns,end:rows.length?rows[rows.length-1].d:start,cost:tInt+tIns};
}
function loanAt(a,date){const S0=loanSchedule(a.ls);const past=S0.rows.filter(r=>r.d<=date);const cur=past.length?past[past.length-1]:null;const next=S0.rows.find(r=>r.d>date);return {S:S0,bal:cur?cur.bal:(+a.ls.p||0),next,done:past.length}}
EXT.boot.push(d=>{d.accounts.forEach(a=>{if(!a.ls||!(+a.ls.p>0)||a.fid)return;const X=loanAt(a,today());a.balance=Math.round(X.bal*100)/100;a.end=X.S.end;if(X.next){a.monthly=Math.round(X.next.pay*100)/100;a.loanRate=X.next.r}})});

function loanSection(a){
  const ty=TYP[a.type]||{};if(!ty.loan)return '';
  if(!a.ls||!(+a.ls.p>0))return `<div class="card flat" style="margin-bottom:16px"><div class="hrow" style="justify-content:space-between;gap:10px;flex-wrap:wrap"><div><b>${esc(t('ln.schedT'))}</b><p class="note" style="margin:4px 0 0">${esc(t('ln.schedP'))}</p></div><button class="btn sm" data-a="loanEdit" data-v="${a.id}">${ico('cal')}${esc(t('ln.create'))}</button></div></div>`;
  const X=loanAt(a,today());const R=X.S.rows;const paid=R.slice(0,X.done);const pInt=sum(paid.map(r=>r.int)),pPr=sum(paid.map(r=>r.princ));const pct=(+a.ls.p)>0?1-X.bal/(+a.ls.p):0;
  const pts=[{d:a.ls.start,v:+a.ls.p}].concat(R.map(r=>({d:r.d,v:r.bal})));const step=Math.max(1,Math.ceil(pts.length/120));const P2=pts.filter((_,i)=>i%step===0||i===pts.length-1);
  const all=S.ui.lsAll===a.id;const list=all?R:R.slice(Math.max(0,X.done-1),X.done+11);
  const linked=D().accounts.filter(p=>p.loanId===a.id);
  return `<div class="ch"><div><h2>${esc(t('ln.schedT'))}</h2><p>${esc(t('ln.kind.'+(a.ls.kind||'amort')))} · ${esc(t('ln.sum',{n:R.length,r:numT(+a.ls.r||0,2)}))}</p></div><button class="btn sec sm" data-a="loanEdit" data-v="${a.id}">${ico('edit')}${esc(t('ln.edit'))}</button></div>
  <div class="kpis k4" style="box-shadow:none;margin-bottom:12px">${kpi(t('ln.left'),money(X.bal,2),t('ln.repaid',{p:pctT(pct,0)}))}${kpi(t('ln.next'),X.next?money(X.next.pay,2):'—',X.next?dateT(X.next.d,'short'):t('ln.done'))}${kpi(t('ln.intPaid'),money(pInt,0),t('ln.intTot',{v:moneyT(X.S.int,0)}))}${kpi(t('ln.cost'),money(X.S.cost,0),t('ln.end',{d:dateT(X.S.end,'my')}))}</div>
  <div class="bar" style="margin-bottom:14px"><i style="width:${(clamp(pct,0,1)*100).toFixed(1)}%"></i></div>
  <div class="card flat" style="margin-bottom:12px">${chart({h:170,zero:true,series:[{pts:P2,c:'var(--bad)'}],xl:i=>dateT(P2[i].d,'my'),tip:i=>`<b>${esc(moneyT(P2[i].v,0))}</b><br>${esc(dateT(P2[i].d,'my'))}`,label:t('ln.left')})}</div>
  ${linked.length?`<p class="note">${ico('house')} ${esc(t('ln.linked',{n:linked.map(p=>p.name).join(', ')}))}</p>`:''}
  <div class="tw cards"><table class="tbl ls"><thead><tr><th>${esc(t('ln.c.n'))}</th><th>${esc(t('ln.c.d'))}</th><th>${esc(t('ln.c.pay'))}</th><th>${esc(t('ln.c.int'))}</th><th>${esc(t('ln.c.princ'))}</th><th>${esc(t('ln.c.bal'))}</th></tr></thead><tbody>${list.map(r=>`<tr class="${r.d<=today()?'past':''}${X.next&&r.k===X.next.k?' nextr':''}"><td>${r.k}</td><td data-l="${esc(t('ln.c.d'))}">${esc(dateT(r.d,'short'))}</td><td data-l="${esc(t('ln.c.pay'))}">${esc(moneyT(r.pay,2))}</td><td data-l="${esc(t('ln.c.int'))}">${esc(moneyT(r.int||r.cap,2))}${r.cap?` <span class="muted">${esc(t('ln.capit'))}</span>`:''}</td><td data-l="${esc(t('ln.c.princ'))}">${esc(moneyT(r.princ,2))}</td><td data-l="${esc(t('ln.c.bal'))}"><b>${esc(moneyT(r.bal,2))}</b></td></tr>`).join('')}</tbody></table></div>
  <div style="display:flex;justify-content:center;margin:10px 0 16px"><button class="btn ghost sm" data-a="lsAll" data-v="${a.id}">${esc(t(all?'ln.less':'ln.all',{n:R.length}))}</button></div>`;
}
EXT.accDrawer.push(loanSection);
EXT.A.lsAll=v=>{S.ui.lsAll=S.ui.lsAll===v?null:v;const p=$('#ovl .panel');if(S.ui.ovl)S.ui.ovl.scroll=p?p.scrollTop:0;renderOvl()};
/* éditeur d'échéancier */
EXT.A.loanEdit=v=>{const a=D().accounts.find(x=>x.id===v);if(!a)return;const L=a.ls?JSON.parse(JSON.stringify(a.ls)):{p:+a.balance||'',r:+a.loanRate||'',n:a.end?Math.max(1,Math.round(daysBetween(today(),a.end)/30.44)):240,start:addMonths(today().slice(0,8)+'05',1),kind:'amort',defer:{n:0,mode:'partial'},ins:0,steps:[],vars:[]};S.ui.lsDraft={id:a.id,L};openOvl({k:'loanEdit'})};
function loanEditDrawer(){
  const X=S.ui.lsDraft;if(!X)return {html:''};const a=D().accounts.find(z=>z.id===X.id);if(!a)return {html:''};const L=X.L;
  const f=(n,l,inp,c='')=>`<div class="f ${c}"><label for="ls-${n}">${esc(l)}</label>${inp}</div>`;
  const num=(n,v,step='0.01')=>`<input id="ls-${n}" type="number" step="${step}" inputmode="decimal" data-f="ls" data-v="${n}" value="${v??''}">`;
  const pv=loanSchedule(L);const first=pv.rows.find(r=>r.k>((L.defer||{}).n||0))||pv.rows[0];
  return {html:`<div class="ph"><div><div class="eyebrow">${esc(a.name)}</div><h2>${esc(t('ln.editT'))}</h2></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  <form data-form="loanEdit" class="form">
    ${f('kind',t('ln.f.kind'),`<select id="ls-kind" data-f="ls" data-v="kind">${['amort','infine','ptz'].map(k=>`<option value="${k}"${(L.kind||'amort')===k?' selected':''}>${esc(t('ln.kind.'+k))}</option>`).join('')}</select>`,'full')}
    ${f('p',t('ln.f.p'),num('p',L.p))}${f('r',t('ln.f.r'),num('r',L.kind==='ptz'?0:L.r,'0.001'))}
    ${f('n',t('ln.f.n'),num('n',L.n,'1'))}${f('start',t('ln.f.start'),`<input id="ls-start" type="date" data-f="ls" data-v="start" value="${esc(L.start||'')}">`)}
    ${f('ins',t('ln.f.ins'),num('ins',L.ins))}${f('dn',t('ln.f.dn'),num('dn',(L.defer||{}).n||0,'1'))}
    ${f('dm',t('ln.f.dm'),`<select id="ls-dm" data-f="ls" data-v="dm"><option value="partial"${(L.defer||{}).mode!=='total'?' selected':''}>${esc(t('ln.dm.partial'))}</option><option value="total"${(L.defer||{}).mode==='total'?' selected':''}>${esc(t('ln.dm.total'))}</option></select>`,'full')}
    <div class="f full"><span class="lab">${esc(t('ln.steps'))}</span><p class="note" style="margin:0 0 6px">${esc(t('ln.stepsP'))}</p>${(L.steps||[]).map((s,i)=>`<div class="lsrow"><input type="number" step="1" data-f="lsRow" data-v="steps|${i}|m" value="${s.m??''}" aria-label="${esc(t('ln.fromM'))}" placeholder="${esc(t('ln.fromM'))}"><input type="number" step="0.01" data-f="lsRow" data-v="steps|${i}|pay" value="${s.pay??''}" aria-label="${esc(t('ln.payM'))}" placeholder="${esc(t('ln.payM'))}"><button type="button" class="ib sm" data-a="lsDel" data-v="steps|${i}" aria-label="${esc(t('act.delete'))}">${ico('trash')}</button></div>`).join('')}<button type="button" class="btn ghost sm" data-a="lsAdd" data-v="steps">${ico('plus')}${esc(t('ln.addStep'))}</button></div>
    <div class="f full"><span class="lab">${esc(t('ln.vars'))}</span><p class="note" style="margin:0 0 6px">${esc(t('ln.varsP'))}</p>${(L.vars||[]).map((s,i)=>`<div class="lsrow"><input type="number" step="1" data-f="lsRow" data-v="vars|${i}|m" value="${s.m??''}" aria-label="${esc(t('ln.fromM'))}" placeholder="${esc(t('ln.fromM'))}"><input type="number" step="0.001" data-f="lsRow" data-v="vars|${i}|r" value="${s.r??''}" aria-label="${esc(t('ln.rateM'))}" placeholder="${esc(t('ln.rateM'))}"><button type="button" class="ib sm" data-a="lsDel" data-v="vars|${i}" aria-label="${esc(t('act.delete'))}">${ico('trash')}</button></div>`).join('')}<button type="button" class="btn ghost sm" data-a="lsAdd" data-v="vars">${ico('plus')}${esc(t('ln.addVar'))}</button></div>
    <div class="callout full" id="lsPrev">${esc(pv.rows.length?t('ln.preview',{m:moneyT(first?first.pay:0,2),i:moneyT(pv.int,0),c:moneyT(pv.cost,0),e:dateT(pv.end,'my')}):t('ln.previewNone'))}</div>
    <div class="pfoot full">${a.ls?`<button type="button" class="btn ghost" data-a="lsClear" data-v="${a.id}">${ico('trash')}${esc(t('ln.clear'))}</button>`:''}<span class="sp"></span><button type="button" class="btn ghost" data-a="acc" data-v="${a.id}">${esc(t('act.cancel'))}</button><button class="btn">${esc(t('act.save'))}</button></div>
  </form>`};
}
EXT.ovl.loanEdit=loanEditDrawer;
function lsPreview(){const X=S.ui.lsDraft;const el=$('#lsPrev');if(!X||!el)return;const pv=loanSchedule(X.L);const first=pv.rows.find(r=>r.k>((X.L.defer||{}).n||0))||pv.rows[0];el.textContent=pv.rows.length?t('ln.preview',{m:moneyT(first?first.pay:0,2),i:moneyT(pv.int,0),c:moneyT(pv.cost,0),e:dateT(pv.end,'my')}):t('ln.previewNone')}
EXT.field.ls=(el,v)=>{const X=S.ui.lsDraft;if(!X)return;const k=el.dataset.v,L=X.L;const n=+String(v).replace(',','.');
  if(k==='kind'){L.kind=v;if(v==='ptz')L.r=0;const p=$('#ovl .panel');S.ui.ovl.scroll=p?p.scrollTop:0;renderOvl();return}
  if(k==='start')L.start=v;else if(k==='dn'){L.defer=L.defer||{};L.defer.n=isFinite(n)?n:0}else if(k==='dm'){L.defer=L.defer||{};L.defer.mode=v}else L[k]=isFinite(n)?n:'';lsPreview()};
EXT.field.lsRow=(el,v)=>{const X=S.ui.lsDraft;if(!X)return;const [g,i,f]=el.dataset.v.split('|');const n=+String(v).replace(',','.');X.L[g][+i][f]=isFinite(n)?n:'';lsPreview()};
EXT.A.lsAdd=g=>{const X=S.ui.lsDraft;if(!X)return;X.L[g]=X.L[g]||[];X.L[g].push(g==='steps'?{m:'',pay:''}:{m:'',r:''});const p=$('#ovl .panel');S.ui.ovl.scroll=p?p.scrollTop:0;renderOvl()};
EXT.A.lsDel=v=>{const X=S.ui.lsDraft;if(!X)return;const [g,i]=v.split('|');X.L[g].splice(+i,1);const p=$('#ovl .panel');S.ui.ovl.scroll=p?p.scrollTop:0;renderOvl()};
EXT.A.lsClear=v=>{const a=D().accounts.find(x=>x.id===v);if(!a)return;delete a.ls;save();openOvl({k:'acc',id:a.id});render()};
EXT.F.loanEdit=()=>{const X=S.ui.lsDraft;if(!X)return;const a=D().accounts.find(z=>z.id===X.id);if(!a)return;const L=X.L;
  if(!(+L.p>0)||!(+L.n>0)||!L.start){toast(t('ln.invalid'),true);return}
  L.steps=(L.steps||[]).filter(s=>+s.m>0&&+s.pay>0);L.vars=(L.vars||[]).filter(s=>+s.m>0&&s.r!=='');a.ls=L;a.updatedAt=today();
  const Y=loanAt(a,today());a.balance=Math.round(Y.bal*100)/100;a.end=Y.S.end;if(Y.next){a.monthly=Math.round(Y.next.pay*100)/100;a.loanRate=Y.next.r}
  S.ui.lsDraft=null;save();openOvl({k:'acc',id:a.id});render();toast(t('toast.saved'))};

/* ---------- immobilier physique : rentabilité et cash-flow ---------- */
function propModel(a){
  const val=accGross(a),cost=(+a.buyPrice||0)+(+a.buyFees||0)+(+a.works||0);
  const short=a.usage==='short';const rentM=short?(+a.nightly||0)*(+a.nights||0):(+a.rentM||+a.rent||0);const vac=short?0:(+a.vacancy||0)/100;
  const grossY=conv(rentM*12*(1-vac),a.cur);
  const chY=conv((+a.taxFonc||0)+(+a.copro||0)*12+(+a.insur||0)+(+a.upkeep||0)+(+a.otherCh||0)*12,a.cur)+grossY*(+a.mgmt||0)/100;
  const loan=a.loanId?D().accounts.find(x=>x.id===a.loanId):null;const loanM=loan?conv(+loan.monthly||0,loan.cur):0;const loanBal=loan?accGross(loan):0;
  return {val,cost,grossY,chY,netY:grossY-chY,loan,loanM,loanBal,cfM:(grossY-chY)/12-loanM,yG:cost>0?grossY/cost:(val>0?grossY/val:0),yN:cost>0?(grossY-chY)/cost:(val>0?(grossY-chY)/val:0),equity:val-loanBal,pv:cost>0?val-cost:null,rental:a.usage==='long'||a.usage==='short'};
}
EXT.accForm.push((k,ty,a,f,num)=>{
  if(k!=='property')return '';const lo=D().accounts.filter(x=>(TYP[x.type]||{}).loan);
  return `<div class="f full sect"><span class="lab">${esc(t('re.sec'))}</span></div>
    ${f('usage',t('re.usage'),`<select id="af-usage" name="usage">${['main','second','long','short'].map(u=>`<option value="${u}"${(a.usage||'main')===u?' selected':''}>${esc(t('re.u.'+u))}</option>`).join('')}</select>`)}
    ${f('loanId',t('re.loan'),`<select id="af-loanId" name="loanId"><option value="">${esc(t('re.noLoan'))}</option>${lo.map(x=>`<option value="${x.id}"${a.loanId===x.id?' selected':''}>${esc(x.name)}</option>`).join('')}</select>`)}
    ${f('buyPrice',t('re.buyPrice'),num('buyPrice',a.buyPrice))}${f('buyDate',t('re.buyDate'),`<input id="af-buyDate" name="buyDate" type="date" value="${esc(a.buyDate||'')}">`)}
    ${f('buyFees',t('re.buyFees'),num('buyFees',a.buyFees))}${f('works',t('re.works'),num('works',a.works))}
    <div class="f full sect"><span class="lab">${esc(t('re.rentSec'))}</span><p class="note" style="margin:0">${esc(t('re.rentP'))}</p></div>
    ${f('rentM',t('re.rentM'),num('rentM',a.rentM??a.rent))}${f('vacancy',t('re.vacancy'),num('vacancy',a.vacancy,'0.1'))}
    ${f('nightly',t('re.nightly'),num('nightly',a.nightly))}${f('nights',t('re.nights'),num('nights',a.nights,'0.5'))}
    <div class="f full sect"><span class="lab">${esc(t('re.chSec'))}</span></div>
    ${f('taxFonc',t('re.taxFonc'),num('taxFonc',a.taxFonc))}${f('copro',t('re.copro'),num('copro',a.copro))}
    ${f('insur',t('re.insur'),num('insur',a.insur))}${f('upkeep',t('re.upkeep'),num('upkeep',a.upkeep))}
    ${f('mgmt',t('re.mgmt'),num('mgmt',a.mgmt,'0.1'))}${f('otherCh',t('re.otherCh'),num('otherCh',a.otherCh))}`;
});
EXT.accSave.push((fd,o,ty,n)=>{
  ['buyPrice','buyFees','works','rentM','vacancy','nightly','nights','taxFonc','copro','insur','upkeep','mgmt','otherCh','paid'].forEach(k=>{if(fd.has(k))o[k]=n(k)});
  ['usage','loanId','buyDate'].forEach(k=>{if(fd.has(k))o[k]=fd.get(k)||undefined});
  if(o.type==='property'){const short=o.usage==='short';o.rent=(o.usage==='long'||short)?(short?(o.nightly||0)*(o.nights||0):(o.rentM||0)):0}
});
EXT.accDrawer.push(a=>{
  if(a.type!=='property')return '';const M=propModel(a);
  const rows=[[t('re.k.cost'),M.cost?moneyT(M.cost,0):'—'],[t('re.k.pv'),M.pv==null?'—':(M.pv>=0?'+':'−')+moneyT(Math.abs(M.pv),0)]];
  if(M.loan)rows.push([t('re.k.loan'),moneyT(M.loanBal,0)+' · '+M.loan.name],[t('re.k.equity'),moneyT(M.equity,0)]);
  return `<div class="ch"><div><h2>${esc(t(M.rental?'re.t.rent':'re.t.own'))}</h2><p>${esc(t('re.u.'+(a.usage||'main')))}</p></div></div>
  ${M.rental?`<div class="kpis k4" style="box-shadow:none;margin-bottom:12px">${kpi(t('re.k.gross'),money(M.grossY,0),t('w.perYear'))}${kpi(t('re.k.ch'),money(M.chY,0),t('w.perYear'))}${kpi(t('re.k.cf'),`<span class="${cls(M.cfM)}">${moneyS(M.cfM,0)}</span>`,t('re.k.cfS',{v:moneyT(M.loanM,0)}))}${kpi(t('re.k.yield'),pctT(M.yN,2),t('re.k.yieldG',{v:pctT(M.yG,2)}))}</div>`:''}
  <div class="card flat" style="margin-bottom:16px">${rows.map(([l,v])=>`<div class="row"><div class="m muted">${esc(l)}</div><div class="r"><b>${esc(v)}</b></div></div>`).join('')}</div>
  ${M.rental?`<p class="note" style="margin:-6px 0 16px">${esc(t('re.note'))}</p>`:''}`;
});

/* ---------- financement participatif (crowdlending) ---------- */
function projOut(p,date){
  const amt=+p.amt||0;if(p.status==='done')return 0;const n=Math.max(1,+p.months||1);const st=p.start||today();
  const el=Math.max(0,Math.min(n,Math.floor(daysBetween(st,date)/30.44)));
  if(p.mode==='amort'){const i=(+p.rate||0)/1200;let bal=amt;const pay=i>0?amt*i/(1-Math.pow(1+i,-n)):amt/n;for(let k=0;k<el;k++)bal-=pay-bal*i;return Math.max(0,bal-(+p.extra||0))}
  return Math.max(0,amt-(+p.extra||0));
}
function crowdModel(a){const P=a.projects||[];let out=0,def=0,late=0,inc=0,lent=0;P.forEach(p=>{const o=projOut(p,today());lent+=+p.amt||0;if(p.status==='default'){def+=o;return}if(p.status==='late')late+=o;out+=o;inc+=o*(+p.rate||0)/100});return {P,out,def,late,inc,lent,live:P.filter(p=>p.status==='live'||p.status==='late').length}}
EXT.boot.push(d=>d.accounts.forEach(a=>{if(a.type==='crowd'&&Array.isArray(a.projects)&&a.projects.length&&!a.fid)a.balance=Math.round(crowdModel(a).out*100)/100}));
EXT.passive.push((a,months,lines)=>{if(a.type!=='crowd'||a.include===false)return;const M=crowdModel(a);const y=conv(M.inc,a.cur);if(y>0){for(let m=0;m<12;m++)months[m].int+=y/12;lines.push({type:'int',name:a.name,acc:a,amount:y,months:[1,2,3,4,5,6,7,8,9,10,11,12],yield:M.out>0?M.inc/M.out*100:0})}});
EXT.accDrawer.push(a=>{
  if(a.type!=='crowd')return '';const M=crowdModel(a);
  return `<div class="ch"><div><h2>${esc(t('cr.t'))}</h2><p>${esc(t('cr.sub',{n:M.P.length,l:M.live}))}</p></div><button class="btn sm" data-a="crowdProj" data-v="${a.id}|">${ico('plus')}${esc(t('cr.add'))}</button></div>
  <div class="kpis k4" style="box-shadow:none;margin-bottom:12px">${kpi(t('cr.k.out'),money(M.out,0))}${kpi(t('cr.k.inc'),money(M.inc,0),t('w.perYear'))}${kpi(t('cr.k.late'),`<span class="${M.late?'warn':''}">${money(M.late,0)}</span>`)}${kpi(t('cr.k.def'),`<span class="${M.def?'bad':''}">${money(M.def,0)}</span>`,M.lent?pctT(M.def/M.lent,1):'')}</div>
  <div class="list">${M.P.map(p=>`<button class="row btnrow" data-a="crowdProj" data-v="${a.id}|${p.id}"><span class="av sm" style="--c:var(${p.status==='default'?'--bad':p.status==='late'?'--warn':p.status==='done'?'--good':'--k2'})">${ico('coins')}</span><div class="m"><b>${esc(p.name)}</b><span>${esc(t('cr.st.'+p.status))} · ${esc(numT(+p.rate||0,2))} % · ${esc(t('cr.m',{n:p.months||0}))}${p.start?' · '+esc(dateT(addMonths(p.start,+p.months||0),'my')):''}</span></div><div class="r"><b>${money(projOut(p,today()),0)}</b><span>${esc(t('cr.of',{v:moneyT(+p.amt||0,0)}))}</span></div></button>`).join('')||`<p class="note">${esc(t('cr.none'))}</p>`}</div>
  <p class="note" style="margin:8px 0 16px">${esc(t('cr.note'))}</p>`;
});
EXT.A.crowdProj=v=>{const [aid,pid]=v.split('|');openOvl({k:'crowdProj',acc:aid,id:pid||''})};
EXT.ovl.crowdProj=o=>{const a=D().accounts.find(x=>x.id===o.acc);if(!a)return {html:''};const p=(a.projects||[]).find(x=>x.id===o.id)||{status:'live',mode:'infine',start:today()};
  const f=(n,l,inp,c='')=>`<div class="f ${c}"><label for="cp-${n}">${esc(l)}</label>${inp}</div>`;const num=(n,v,s='0.01')=>`<input id="cp-${n}" name="${n}" type="number" step="${s}" inputmode="decimal" value="${v??''}">`;
  return {html:`<div class="ph"><div><div class="eyebrow">${esc(a.name)}</div><h2>${esc(t(o.id?'cr.editT':'cr.newT'))}</h2></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  <form data-form="crowd" data-v="${a.id}|${o.id||''}" class="form">
    ${f('name',t('cr.f.name'),`<input id="cp-name" name="name" required maxlength="80" value="${esc(p.name||'')}">`,'full')}
    ${f('amt',t('cr.f.amt'),num('amt',p.amt))}${f('rate',t('cr.f.rate'),num('rate',p.rate,'0.01'))}
    ${f('months',t('cr.f.months'),num('months',p.months,'1'))}${f('start',t('cr.f.start'),`<input id="cp-start" name="start" type="date" value="${esc(p.start||'')}">`)}
    ${f('mode',t('cr.f.mode'),`<select id="cp-mode" name="mode"><option value="infine"${p.mode!=='amort'?' selected':''}>${esc(t('cr.mode.infine'))}</option><option value="amort"${p.mode==='amort'?' selected':''}>${esc(t('cr.mode.amort'))}</option></select>`)}
    ${f('status',t('cr.f.status'),`<select id="cp-status" name="status">${['live','late','default','done'].map(s=>`<option value="${s}"${p.status===s?' selected':''}>${esc(t('cr.st.'+s))}</option>`).join('')}</select>`)}
    ${f('extra',t('cr.f.extra'),num('extra',p.extra))}
    <div class="pfoot full">${o.id?`<button type="button" class="btn ghost" data-a="crowdDel" data-v="${a.id}|${o.id}">${ico('trash')}${esc(t('act.delete'))}</button>`:''}<span class="sp"></span><button type="button" class="btn ghost" data-a="acc" data-v="${a.id}">${esc(t('act.cancel'))}</button><button class="btn">${esc(t('act.save'))}</button></div>
  </form>`}};
EXT.F.crowd=(fd,v)=>{const [aid,pid]=v.split('|');const a=D().accounts.find(x=>x.id===aid);if(!a)return;a.projects=a.projects||[];const n=k=>{const x=fd.get(k);return x===''||x==null?0:+String(x).replace(',','.')};
  const o={name:(fd.get('name')||'').trim(),amt:n('amt'),rate:n('rate'),months:n('months'),start:fd.get('start')||today(),mode:fd.get('mode'),status:fd.get('status'),extra:n('extra')};
  if(pid){Object.assign(a.projects.find(x=>x.id===pid),o)}else a.projects.push(Object.assign({id:uid()},o));
  a.balance=Math.round(crowdModel(a).out*100)/100;a.updatedAt=today();save();openOvl({k:'acc',id:a.id});render();toast(t('toast.saved'))};
EXT.A.crowdDel=v=>{const [aid,pid]=v.split('|');const a=D().accounts.find(x=>x.id===aid);if(!a)return;a.projects=(a.projects||[]).filter(x=>x.id!==pid);a.balance=Math.round(crowdModel(a).out*100)/100;save();openOvl({k:'acc',id:a.id});render()};

/* ---------- total versé (comptes suivis par leur solde) ---------- */
EXT.accForm.push((k,ty,a,f,num)=>(!ty.h&&(ty.cls==='savings'||ty.cls==='other'||k==='crowd'))?f('paid',t('as.paid'),num('paid',a.paid)):'');
EXT.accDrawer.push(a=>{const ty=TYP[a.type]||{};if(ty.h||!(+a.paid>0)||ty.cls==='debt')return '';const v=accGross(a),p=conv(+a.paid,a.cur),g=v-p;
  return `<div class="card flat" style="margin-bottom:16px"><div class="row"><div class="m muted">${esc(t('as.paid'))}</div><div class="r"><b>${esc(moneyT(p,2))}</b></div></div><div class="row"><div class="m muted">${esc(t('as.gain'))}</div><div class="r"><b class="${cls(g)}">${moneyS(g,2)} · ${pctS(p?g/p:0)}</b></div></div></div>`});
/* intérêts des livrets : quinzaines et date de versement */
EXT.accDrawer.push(a=>{const ty=TYP[a.type]||{};if(!ty.rate||ty.cls!=='savings')return '';return `<p class="note" style="margin:-6px 0 16px">${ico('cal')} ${esc(t('as.intDates'))}</p>`});

/* ---------- obligations et métaux : champs de ligne ---------- */
EXT.holdForm.push((a,h,f,num)=>{
  const k=h.kind;
  return `<div class="f full sect kf kf-bond"${k==='bond'?'':' hidden'}><span class="lab">${esc(t('bo.sec'))}</span></div>
  <div class="f kf kf-bond"${k==='bond'?'':' hidden'}><label for="hf-coupon">${esc(t('bo.coupon'))}</label>${num('coupon',h.coupon)}</div>
  <div class="f kf kf-bond"${k==='bond'?'':' hidden'}><label for="hf-nominal">${esc(t('bo.nominal'))}</label>${num('nominal',h.nominal)}</div>
  <div class="f kf kf-bond"${k==='bond'?'':' hidden'}><label for="hf-maturity">${esc(t('bo.maturity'))}</label><input id="hf-maturity" name="maturity" type="date" value="${esc(h.maturity||'')}"></div>
  <div class="f kf kf-bond"${k==='bond'?'':' hidden'}><label for="hf-cmonths">${esc(t('bo.cmonths'))}</label><input id="hf-cmonths" name="cmonths" value="${esc((h.cmonths||[]).join(', '))}" placeholder="6, 12"></div>
  <div class="f full sect kf kf-metal"${k==='metal'?'':' hidden'}><span class="lab">${esc(t('mt.sec'))}</span><p class="note" style="margin:0">${esc(t('mt.p'))}</p></div>
  <div class="f kf kf-metal"${k==='metal'?'':' hidden'}><label for="hf-metal">${esc(t('mt.metal'))}</label><select id="hf-metal" name="metal">${['gold','silver','platinum','palladium'].map(m=>`<option value="${m}"${(h.metal||'gold')===m?' selected':''}>${esc(t('mt.'+m))}</option>`).join('')}</select></div>
  <div class="f kf kf-metal"${k==='metal'?'':' hidden'}><label for="hf-unit">${esc(t('mt.unit'))}</label><select id="hf-unit" name="unit">${Object.keys(METAL_UNITS).map(u=>`<option value="${u}"${(h.unit||'oz')===u?' selected':''}>${esc(t('mt.u.'+u))}</option>`).join('')}</select></div>
  <div class="f kf kf-metal"${k==='metal'?'':' hidden'}><label for="hf-purity">${esc(t('mt.purity'))}</label>${num('purity',h.purity)}</div>`;
});
EXT.field.hkind=(el,v)=>{const fm=el.closest('form');if(!fm)return;fm.querySelectorAll('.kf').forEach(x=>{x.hidden=!x.classList.contains('kf-'+v)})};
EXT.holdSave.push((fd,o,a,hid)=>{
  const n=k=>{const x=fd.get(k);return x===''||x===null?0:+String(x).replace(',','.')};
  if(o.kind==='bond'){o.coupon=n('coupon');o.nominal=n('nominal');o.maturity=fd.get('maturity')||'';o.cmonths=String(fd.get('cmonths')||'').split(/[,;\s]+/).map(Number).filter(m=>m>=1&&m<=12)}
  if(o.kind==='metal'){o.metal=fd.get('metal')||'gold';o.unit=fd.get('unit')||'oz';o.purity=n('purity');if(o.metal==='gold'){o.ticker='PAXG';o.livePair='PAXG_USD'}o.region=o.region||'world';o.sector='diversified'}
  /* doublon : même ISIN ou même nom dans le compte */
  if(!hid&&!fd.get('dupOk')){const nn=norm(o.name||'');const dup=a.holdings.find(x=>(o.isin&&x.isin===o.isin)||(nn&&norm(x.name||'')===nn));
    if(dup){const fm=$('form[data-form=hold]');if(fm&&!fm.querySelector('.dupband')){const b=document.createElement('div');b.className='demo-band dupband full';b.innerHTML=`${ico('alert')}<div><b>${esc(t('dup.t'))}</b> ${esc(t('dup.p',{n:dup.name}))}</div><button type="button" class="btn sec sm" data-a="editHold" data-v="${a.id}|${dup.id}">${esc(t('dup.open'))}</button><input type="hidden" name="dupOk" value="1">`;fm.prepend(b);b.scrollIntoView({block:'nearest'})}return false}}
});

/* ---------- vente d'une ligne ---------- */
EXT.holdFoot.push((a,h,hid)=>hid&&+h.qty>0?`<button type="button" class="btn sec" data-a="sell" data-v="${a.id}|${h.id}">${ico('swap')}${esc(t('sl.btn'))}</button><button type="button" class="btn sec" data-a="planNew" data-v="${a.id}|${h.id}">${ico('cal')}${esc(t('pl.btn'))}</button>`:'');
EXT.A.sell=v=>{const [aid,hid]=v.split('|');openOvl({k:'sell',acc:aid,id:hid})};
EXT.ovl.sell=o=>{const a=D().accounts.find(x=>x.id===o.acc);const h=a&&a.holdings.find(x=>x.id===o.id);if(!h)return {html:''};
  const cur=h.cur||a.cur;
  return {html:`<div class="ph"><div><div class="eyebrow">${esc(a.name)}</div><h2>${esc(t('sl.t',{n:h.name}))}</h2></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  ${a.fid?`<div class="demo-band">${ico('info')}<div>${esc(t('sl.fin'))}</div></div>`:''}
  <form data-form="sell" data-v="${a.id}|${h.id}" class="form">
    <div class="f"><label for="sl-d">${esc(t('sl.d'))}</label><input id="sl-d" name="d" type="date" value="${today()}" required></div>
    <div class="f"><label for="sl-q">${esc(t('sl.q',{n:qtyT(+h.qty)}))}</label><input id="sl-q" name="q" type="number" step="any" min="0" max="${+h.qty}" value="${+h.qty}" required></div>
    <div class="f"><label for="sl-px">${esc(t('sl.px',{c:cur}))}</label><input id="sl-px" name="px" type="number" step="any" value="${+h.price||''}" required></div>
    <div class="f"><label for="sl-fee">${esc(t('sl.fee'))}</label><input id="sl-fee" name="fee" type="number" step="0.01" value="0"></div>
    <p class="note full">${esc(t('sl.note',{p:moneyT(+h.pru||0,2,cur)}))}</p>
    <div class="pfoot full"><span class="sp"></span><button type="button" class="btn ghost" data-a="editHold" data-v="${a.id}|${h.id}">${esc(t('act.cancel'))}</button><button class="btn">${esc(t('sl.go'))}</button></div>
  </form>`}};
EXT.F.sell=(fd,v)=>{const [aid,hid]=v.split('|');const a=D().accounts.find(x=>x.id===aid);const h=a&&a.holdings.find(x=>x.id===hid);if(!h)return;
  const q=Math.min(+h.qty||0,+String(fd.get('q')).replace(',','.')||0),px=+String(fd.get('px')).replace(',','.')||0,fee=+String(fd.get('fee')).replace(',','.')||0,d=fd.get('d')||today();
  if(!(q>0)||!(px>0)){toast(t('sl.invalid'),true);return}
  const proceeds=q*px-fee,real=proceeds-q*(+h.pru||0);
  if(Array.isArray(D().iops)&&(D().iops.some(o=>o.acc===a.id)))D().iops.push({id:uid(),acc:a.id,d,t:'sell',isin:h.isin||'',sym:h.ticker||'',n:h.name,cls:h.kind,q,px,amt:Math.round(q*px*100)/100,fee,tax:0,cur:h.cur||a.cur,ext:'vigie-sell-'+uid(),s:0});
  else a.realized=Math.round(((+a.realized||0)+real)*100)/100;
  if(!a.fid){h.qty=Math.max(0,(+h.qty||0)-q);a.cash=Math.round(((+a.cash||0)+proceeds)*100)/100;if(h.qty<1e-9)a.holdings=a.holdings.filter(x=>x!==h)}
  a.updatedAt=today();save();openOvl({k:'acc',id:a.id});render();toast(t('sl.done',{v:(real>=0?'+':'−')+moneyT(Math.abs(real),2,h.cur||a.cur)}))};
EXT.accDrawer.push(a=>(+a.realized)?`<p class="note" style="margin:-4px 0 14px">${esc(t('sl.real',{v:(a.realized>=0?'+':'−')+moneyT(Math.abs(a.realized),2,a.cur)}))}</p>`:'');

/* ---------- achats récurrents ---------- */
const PL_STEP={w:7,'2w':14};
function planDates(p,from,to){const out=[];if(!p.start)return out;let d=p.start;let g=0;
  if(p.freq==='m'||p.freq==='q'){const step=p.freq==='q'?3:1;let k=0;d=p.start;while(d<=to&&g++<600){if(d>=from)out.push(d);k+=step;d=addMonths(p.start,k)}}
  else{const st=PL_STEP[p.freq]||30;while(d<=to&&g++<2000){if(d>=from)out.push(d);d=dAdd(d,st)}}
  return out.filter(x=>!p.end||x<=p.end)}
function nextPlan(p){const ds=planDates(p,dAdd(today(),1),dAdd(today(),120));return ds[0]||null}
function runPlans(){
  if(!S.data||S.demo)return 0;let n=0;
  D().accounts.forEach(a=>{if(a.fid||!Array.isArray(a.plans))return;a.plans.forEach(p=>{if(p.on===false)return;const h=a.holdings.find(x=>x.id===p.hid);if(!h||!(+h.price>0)||!(+p.amt>0))return;
    const from=p.last?dAdd(p.last,1):p.start;const due=planDates(p,from,today());
    due.forEach(d=>{const px=+h.price,q=(+p.amt-(+p.fee||0))/px;const cost=(+h.pru||0)*(+h.qty||0);h.qty=(+h.qty||0)+q;h.pru=(cost+(+p.amt))/h.qty;
      const led=(D().iops||[]).some(o=>o.acc===a.id);if(led){const own=(D().iops||[]).some(o=>o.acc===a.id&&(o.t==='dep'||o.t==='wd'));if(own)D().iops.push({id:uid(),acc:a.id,d,t:'dep',amt:+p.amt,fee:0,tax:0,cur:a.cur,ext:'vigie-plan-dep-'+p.id+'-'+d,s:0});
        D().iops.push({id:uid(),acc:a.id,d,t:'buy',isin:h.isin||'',sym:h.ticker||'',n:h.name,cls:h.kind,q,px,amt:-(+p.amt-(+p.fee||0)),fee:+p.fee||0,tax:0,cur:h.cur||a.cur,ext:'vigie-plan-'+p.id+'-'+d,s:1})}
      else if(p.fromCash)a.cash=Math.round(((+a.cash||0)-(+p.amt))*100)/100;
      p.last=d;n++});
    if(due.length)a.updatedAt=today()})});
  if(n){save();setTimeout(()=>toast(t('pl.ran',{n})),400)}
  return n;
}
EXT.boot.push(()=>setTimeout(()=>{if(S.phase==='app'){if(runPlans())render()}},0));
EXT.accDrawer.push(a=>{const ty=TYP[a.type]||{};if(!ty.h)return '';const P=(a.plans||[]);if(!P.length)return '';
  return `<div class="ch"><div><h2>${esc(t('pl.t'))}</h2><p>${esc(a.fid?t('pl.subFin'):t('pl.sub'))}</p></div></div><div class="list" style="margin-bottom:16px">${P.map(p=>{const h=a.holdings.find(x=>x.id===p.hid);const nx=nextPlan(p);return `<button class="row btnrow" data-a="planEdit" data-v="${a.id}|${p.id}"><span class="av sm" style="--c:var(${p.on===false?'--muted':'--k2'})">${ico('cal')}</span><div class="m"><b>${esc(h?h.name:t('pl.gone'))}</b><span>${esc(t('pl.f.'+p.freq))}${nx&&p.on!==false?' · '+esc(t('pl.next',{d:dateT(nx,'short')})):''}${p.on===false?' · '+esc(t('pl.paused')):''}</span></div><div class="r"><b>${esc(moneyT(+p.amt,2,a.cur))}</b></div></button>`}).join('')}</div>`});
EXT.A.planNew=v=>{const [aid,hid]=v.split('|');openOvl({k:'plan',acc:aid,hid,id:''})};
EXT.A.planEdit=v=>{const [aid,pid]=v.split('|');const a=D().accounts.find(x=>x.id===aid);const p=a&&(a.plans||[]).find(x=>x.id===pid);if(p)openOvl({k:'plan',acc:aid,hid:p.hid,id:pid})};
EXT.ovl.plan=o=>{const a=D().accounts.find(x=>x.id===o.acc);const h=a&&a.holdings.find(x=>x.id===o.hid);if(!a)return {html:''};const p=(a.plans||[]).find(x=>x.id===o.id)||{freq:'m',start:addMonths(today(),1),on:true};
  const f=(n,l,inp,c='')=>`<div class="f ${c}"><label for="pl-${n}">${esc(l)}</label>${inp}</div>`;
  return {html:`<div class="ph"><div><div class="eyebrow">${esc(a.name)}</div><h2>${esc(t('pl.formT',{n:h?h.name:''}))}</h2></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  ${a.fid?`<div class="demo-band">${ico('info')}<div>${esc(t('pl.finNote'))}</div></div>`:''}
  <form data-form="plan" data-v="${a.id}|${o.hid}|${o.id||''}" class="form">
    ${f('amt',t('pl.amt'),`<input id="pl-amt" name="amt" type="number" step="0.01" required value="${p.amt??''}">`)}${f('freq',t('pl.freq'),`<select id="pl-freq" name="freq">${['w','2w','m','q'].map(k=>`<option value="${k}"${p.freq===k?' selected':''}>${esc(t('pl.f.'+k))}</option>`).join('')}</select>`)}
    ${f('start',t('pl.start'),`<input id="pl-start" name="start" type="date" required value="${esc(p.start||'')}">`)}${f('end',t('pl.end'),`<input id="pl-end" name="end" type="date" value="${esc(p.end||'')}">`)}
    ${f('fee',t('pl.fee'),`<input id="pl-fee" name="fee" type="number" step="0.01" value="${p.fee??0}">`)}
    <div class="f"><label class="inline" style="margin-top:26px"><input type="checkbox" name="on" ${p.on!==false?'checked':''}> ${esc(t('pl.on'))}</label></div>
    <div class="f full"><label class="inline"><input type="checkbox" name="fromCash" ${p.fromCash?'checked':''}> ${esc(t('pl.fromCash'))}</label></div>
    <p class="note full">${esc(t('pl.note'))}</p>
    <div class="pfoot full">${o.id?`<button type="button" class="btn ghost" data-a="planDel" data-v="${a.id}|${o.id}">${ico('trash')}${esc(t('act.delete'))}</button>`:''}<span class="sp"></span><button type="button" class="btn ghost" data-a="acc" data-v="${a.id}">${esc(t('act.cancel'))}</button><button class="btn">${esc(t('act.save'))}</button></div>
  </form>`}};
EXT.F.plan=(fd,v)=>{const [aid,hid,pid]=v.split('|');const a=D().accounts.find(x=>x.id===aid);if(!a)return;a.plans=a.plans||[];
  const o={hid,amt:+String(fd.get('amt')).replace(',','.')||0,freq:fd.get('freq'),start:fd.get('start'),end:fd.get('end')||'',fee:+String(fd.get('fee')||0).replace(',','.')||0,on:!!fd.get('on'),fromCash:!!fd.get('fromCash')};
  if(!(o.amt>0)||!o.start){toast(t('pl.invalid'),true);return}
  if(pid){const p=a.plans.find(x=>x.id===pid);if(p.start!==o.start)delete p.last;Object.assign(p,o)}else{const p=Object.assign({id:uid()},o);if(o.start<today())p.last=dAdd(today(),-1);a.plans.push(p)}
  save();const n=runPlans();openOvl({k:'acc',id:a.id});render();if(!n)toast(t('toast.saved'))};
EXT.A.planDel=v=>{const [aid,pid]=v.split('|');const a=D().accounts.find(x=>x.id===aid);if(!a)return;a.plans=(a.plans||[]).filter(x=>x.id!==pid);save();openOvl({k:'acc',id:a.id});render()};
