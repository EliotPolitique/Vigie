/* ================= V3 — les outils (inspirés de Finvygo) ================= */
const TOOL_CATS=[
  ['save',['ci','growth','goalInv','whatif','mc']],
  ['credit',['loan','loanCmp','capacity','prepay','reneg','changePay']],
  ['immo',['rental','rentBuy']],
  ['fire',['fi','stopWork','health']],
  ['life',['budget','inflation','realSalary','grossNet','country']]
];
const TOOL_IC={ci:'spark',growth:'invest',goalInv:'goals',whatif:'refresh',mc:'pie',loan:'loan',loanCmp:'swap',capacity:'bank',prepay:'down',reneg:'refresh',changePay:'edit',rental:'house',rentBuy:'house',fi:'trophy',stopWork:'sun',health:'heart',budget:'budget',inflation:'alert',realSalary:'brief',grossNet:'receipt',country:'globe'};
const LEGACY_TOOLS=['ci','fi','loan','mc'];

/* taux du Livret A (date d'effet → taux annuel %) */
const LIVRETA_HIST=[['2008-08-01',4],['2009-02-01',2.5],['2009-05-01',1.75],['2009-08-01',1.25],['2010-08-01',1.75],['2011-02-01',2],['2011-08-01',2.25],['2013-02-01',1.75],['2013-08-01',1.25],['2014-08-01',1],['2015-08-01',0.75],['2020-02-01',0.5],['2022-02-01',1],['2022-08-01',2],['2023-02-01',3],['2025-02-01',2.4],['2025-08-01',1.7],['2026-02-01',1.5],['2026-08-01',1.7]];
const livretAAt=d=>{let r=LIVRETA_HIST[0][1];LIVRETA_HIST.forEach(([x,v])=>{if(x<=d)r=v});return r};

/* repères fiscaux par pays (au 1er janvier 2026, indicatifs) */
const COUNTRIES={FR:{vat:20,ir:'45 % (+ CEHR jusqu’à 4 %)',cap:'31,4 % (PFU)',div:'31,4 % (PFU)'},DE:{vat:19,ir:'45 % (+ solidarité)',cap:'26,375 %',div:'26,375 %'},ES:{vat:21,ir:'≈ 47 % (selon la région)',cap:'19 à 30 %',div:'19 à 30 %'},IT:{vat:22,ir:'43 %',cap:'26 %',div:'26 %'},PT:{vat:23,ir:'48 % (+ solidarité)',cap:'28 %',div:'28 %'},BE:{vat:21,ir:'50 % (+ additionnels communaux)',cap:'—',div:'30 %'},NL:{vat:21,ir:'49,5 %',cap:'Box 3 : 36 % d’un rendement forfaitaire',div:'Box 3'},LU:{vat:17,ir:'42 % (+ contribution emploi)',cap:'exonérées après 6 mois (participation < 10 %)',div:'barème après abattement de 50 %'},CH:{vat:8.1,ir:'11,5 % fédéral + canton et commune',cap:'exonérées (fortune privée)',div:'barème (retenue de 35 % récupérable)'},GB:{vat:20,ir:'45 %',cap:'24 %',div:'39,35 %'},IE:{vat:23,ir:'40 % (+ USC)',cap:'33 %',div:'taux marginal'},US:{vat:0,ir:'37 % fédéral (+ États)',cap:'20 % (+ 3,8 % NIIT)',div:'20 % (+ 3,8 % NIIT)'}};

function toolDefaults(){
  const tt=totals(),exp=avgMonthlyExpense(6)||1800;let inc=0;try{const ms=txMonths().slice(-4,-1);if(ms.length)inc=sum(ms.map(m=>aggTx(monthTx(m)).inc))/ms.length}catch(e){}
  let flux=0;try{const F=fluxModel();const L=F.months.slice(-13,-1);if(L.length)flux=Math.max(0,sum(L.map(x=>x.v))/L.length)}catch(e){}
  const pi=passiveIncome().total/12;const lo=D().accounts.find(a=>(TYP[a.type]||{}).loan&&accGross(a)>0);
  const crd=lo?Math.round(accGross(lo)):180000,lr=lo&&+lo.loanRate?+lo.loanRate:3.8,lm=lo&&a_months(lo)||200,lpay=lo&&+lo.monthly?+lo.monthly:1100;
  const fin=Math.round(tt.financial||5000);
  return Object.assign(simDefaults(),{
    growth:{init:fin,monthly:Math.round(flux||100),rate:5,years:25,infl:2},
    goalInv:{target:100000,years:15,init:fin,rate:5},
    whatif:{asset:'livretA',amount:1000,monthly:0,start:'2015-01-01',rate:7},
    loanCmp:{amount:200000,r1:3.5,y1:20,i1:0.30,f1:1000,r2:3.3,y2:20,i2:0.40,f2:1500,r3:3.7,y3:25,i3:0.25,f3:800},
    capacity:{income:Math.round(inc||2500),charges:0,rate:3.5,years:25,ins:0.3,ratio:35,down:10000},
    prepay:{crd,rate:lr,months:lm,amount:20000,pen:1},
    reneg:{crd,rate:lr,months:lm,newRate:Math.max(0.5,+(lr-1).toFixed(2)),fees:1500,pen:1},
    changePay:{crd,rate:lr,pay:Math.round(lpay),newPay:Math.round(lpay*1.15)},
    rental:{price:180000,notary:7.5,works:5000,rent:850,vac:5,taxF:900,copro:600,insur:150,mgmt:0,loan:150000,lrate:3.6,lyears:20,regime:'micro',tmi:+(ST().tax&&ST().tax.tmi)||11},
    rentBuy:{price:300000,down:40000,notary:7.5,rate:3.5,years:25,ins:0.3,own:1.2,pg:2,rent:1100,rg:2,ret:5,horizon:20,sell:5},
    stopWork:{exp:Math.round(exp),passive:Math.round(pi*100)/100,save:Math.round(flux||100),yield:4,growth:3,infl:2},
    health:{income:Math.round(inc||2000),exp:Math.round(exp),debt:lo?Math.round(+lo.monthly||0):0,liquid:Math.round(tt.liquid),nw:Math.round(tt.net),age:30},
    budget:{income:Math.round(inc||2000),housing:Math.round(exp*0.33),transport:Math.round(exp*0.12),food:Math.round(exp*0.2),subs:Math.round(exp*0.05),other:Math.round(exp*0.15),save:Math.round(flux||100)},
    inflation:{amount:10000,years:20,rate:2},
    realSalary:{then:2000,now:2300,years:5,infl:12},
    grossNet:{amount:3000,dir:'g2n',per:'m',stat:'nc',pas:5},
    country:{c1:'FR',c2:'PT',c3:'CH'}
  });
}
function a_months(a){return a.end?Math.max(1,Math.round(daysBetween(today(),a.end)/30.44)):0}
function annuity(P,rate,n){const i=rate/1200;return i>0?P*i/(1-Math.pow(1+i,-n)):P/n}
function monthsToRepay(P,rate,pay){const i=rate/1200;if(i===0)return P/pay;if(pay<=P*i)return Infinity;return -Math.log(1-P*i/pay)/Math.log(1+i)}
function totalInt(P,rate,n){return annuity(P,rate,n)*n-P}
function irrMonthly(flows){let lo=-0.99,hi=1;const f=r=>flows.reduce((s,c,k)=>s+c/Math.pow(1+r,k),0);if(f(lo)*f(hi)>0)return null;for(let k=0;k<100;k++){const m=(lo+hi)/2;if(f(lo)*f(m)<=0)hi=m;else lo=m}return (lo+hi)/2}

function toolsHub(){
  return `<p class="lead">${esc(t('tl.lead'))}</p>${TOOL_CATS.map(([c,ks])=>`<section style="margin-bottom:22px"><div class="sec-t"><h2>${esc(t('tl.cat.'+c))}</h2></div><div class="tgrid">${ks.map(k=>`<button class="tcard" data-a="simTab" data-v="${k}"><span class="tic">${ico(TOOL_IC[k]||'tool')}</span><b>${esc(t('tl.n.'+k))}</b><span>${esc(t('tl.d.'+k))}</span></button>`).join('')}</div></section>`).join('')}<p class="note">${esc(t('tl.disclaimer'))}</p>`;
}
function simView(){
  if(!S.ui.sim||!S.ui.sim.growth)S.ui.sim=toolDefaults();
  const tab=S.ui.simTab;if(!tab||tab==='hub'||!(tab in S.ui.sim))return toolsHub();
  const head=`<div class="hrow" style="justify-content:space-between;margin-bottom:16px;gap:10px;flex-wrap:wrap"><button class="btn ghost sm" data-a="simTab" data-v="hub">${ico('chevl')}${esc(t('tl.all'))}</button><div class="hrow" style="gap:8px"><b>${esc(t('tl.n.'+tab))}</b><button class="btn ghost sm" data-a="simReset">${ico('refresh')}${esc(t('sim.reset'))}</button></div></div>`;
  if(LEGACY_TOOLS.includes(tab))return head+simLegacy(tab);
  const P=S.ui.sim[tab];const c=curSym();
  const inp=(k,l,step='1',suf='')=>`<div class="f"><label for="sm-${tab}-${k}">${esc(l)}${suf?` <span class="faint">(${esc(suf)})</span>`:''}</label><input id="sm-${tab}-${k}" type="${k==='start'?'date':'text'}" inputmode="decimal" autocomplete="off" data-f="${k==='start'?'simSel':'sim'}" data-v="${k}" value="${esc(k==='start'?String(P[k]??''):simTxt(tab,k,P[k]))}"></div>`;
  const sel=(k,l,opts)=>`<div class="f"><label for="sm-${tab}-${k}">${esc(l)}</label><select id="sm-${tab}-${k}" data-f="simSel" data-v="${k}">${opts.map(([v,lab])=>`<option value="${esc(v)}"${String(P[k])===String(v)?' selected':''}>${esc(lab)}</option>`).join('')}</select></div>`;
  const R=TOOLS[tab](P,{inp,sel,c});
  return head+`<div class="grid ${tab==='budget'?'g2':'g-12'}" style="align-items:start"><div class="card"><div class="ch"><div><h2>${esc(t('sim.params'))}</h2><p>${esc(t('tl.d.'+tab))}</p></div></div><div class="form" style="grid-template-columns:minmax(0,1fr)">${R.form}</div></div><div id="simRes">${R.res}</div></div>`;
}
EXT.A.simReset=()=>{S.ui.sim=toolDefaults();S.ui.simTxt={};if(S.ui.simTab==='budget'){delete ST().budgetTool;save()}render()};
EXT.field.simSel=(el,v)=>{const tab=S.ui.simTab;if(!S.ui.sim||!S.ui.sim[tab])return;S.ui.sim[tab][el.dataset.v]=v;render()};
const yLab=i=>t('sim.yearN',{n:i});
function kp(l,v,s){return kpi(l,v,s)}

const TOOLS={
  growth(P,{inp,c}){
    const r=P.rate/100/12;let v=+P.init,ctb=+P.init;const pv=[{v}],pc=[{v:ctb}];const ms={};
    for(let m=1;m<=P.years*12;m++){v=v*(1+r)+(+P.monthly);ctb+=+P.monthly;[1e4,1e5,1e6].forEach(x=>{if(!ms[x]&&v>=x)ms[x]=m});if(m%12===0){pv.push({v});pc.push({v:ctb})}}
    const real=v/Math.pow(1+P.infl/100,P.years);
    return {form:inp('init',t('sim.init'),'100',c)+inp('monthly',t('sim.monthly'),'10',c)+inp('rate',t('sim.rate'),'0.1','%')+inp('years',t('sim.years'))+inp('infl',t('sim.infl'),'0.1','%')+`<p class="note">${esc(t('tl.prefill'))}</p>`,
      res:`<div class="kpis k4" style="margin-bottom:16px">${kp(t('sim.final'),money(v,0))}${kp(t('sim.real'),money(real,0),t('sim.realS',{p:numT(P.infl,1)}))}${kp(t('sim.contrib'),money(ctb,0))}${kp(t('sim.gains'),`<span class="good">${moneyS(v-ctb,0)}</span>`)}</div>
      <div class="card"><div class="ch"><h2>${esc(t('sim.growth'))}</h2></div>${chart({h:260,zero:true,series:[{pts:pv,c:'var(--accent)'},{pts:pc,c:'var(--k3)',fill:false}],xl:yLab,tip:i=>`<b>${esc(yLab(i))}</b><br>${esc(moneyT(pv[i].v,0))}<br><span class="muted">${esc(t('sim.contrib'))} ${esc(moneyT(pc[i].v,0))}</span>`})}
      <div class="list" style="margin-top:12px">${[1e4,1e5,1e6].map(x=>`<div class="row"><div class="m"><b>${esc(moneyT(x,0))}</b></div><div class="r"><b>${ms[x]?esc(t('tl.inY',{n:numT(ms[x]/12,1)})):x<=+P.init?esc(t('tl.already')):'—'}</b></div></div>`).join('')}</div></div>`};
  },
  goalInv(P,{inp,c}){
    const n=P.years*12;const pmt=r=>{const i=r/1200;const fv=+P.init*Math.pow(1+i,n);const need=+P.target-fv;if(need<=0)return 0;return i>0?need*i/(Math.pow(1+i,n)-1):need/n};
    const m=pmt(+P.rate);
    return {form:inp('target',t('tl.target'),'1000',c)+inp('years',t('sim.years'))+inp('init',t('sim.init'),'100',c)+inp('rate',t('sim.rate'),'0.1','%'),
      res:`<div class="kpis k4" style="margin-bottom:16px">${kp(t('tl.gi.need'),money(m,2),t('tl.perMonth'))}${kp(t('tl.gi.total'),money(m*n+(+P.init),0))}${kp(t('tl.gi.gain'),money(Math.max(0,+P.target-m*n-(+P.init)),0))}${kp(t('tl.gi.daily'),money(m*12/365,2),t('tl.perDay'))}</div>
      <div class="card"><div class="ch"><div><h2>${esc(t('tl.gi.byRate'))}</h2><p>${esc(t('tl.gi.byRateS'))}</p></div></div><div class="list">${[0,2,4,6,8,10].map(r=>`<div class="row"><div class="m"><b>${esc(numT(r,0))} %</b><span>${esc(t('tl.gi.rateL.'+(r===0?'0':r<=2?'2':r<=4?'4':r<=6?'6':'8')))}</span></div><div class="r"><b>${esc(moneyT(pmt(r),0))}</b><span>${esc(t('tl.perMonth'))}</span></div></div>`).join('')}</div>${m===0?`<p class="note">${esc(t('tl.already'))}</p>`:''}</div>`};
  },
  whatif(P,{inp,sel,c}){
    const pos=positions().filter(p=>p.lines.some(({a,h})=>(D().iops||[]).some(o=>o.acc===a.id&&(o.isin&&o.isin===h.isin||o.n&&norm(o.n)===norm(h.name))&&+o.px>0)));
    const opts=[['livretA',t('tl.wi.livretA')],['rate',t('tl.wi.rate')]].concat(pos.map(p=>['p:'+p.key,p.name]));
    let pts=[],note='';const start=P.start||'2015-01-01';const months=[];let d=start.slice(0,7)+'-01';while(d<=today()&&months.length<600){months.push(d);d=addMonths(d,1)}
    if(P.asset==='livretA'||P.asset==='rate'){let v=0,acc=0,inv=0;months.forEach((m,k)=>{const add=(k===0?+P.amount:0)+(k>0?+P.monthly:0);v+=add;inv+=add;const r=P.asset==='livretA'?livretAAt(m):+P.rate;
        if(P.asset==='livretA'){acc+=v*r/100/12;if(m.slice(5,7)==='12'){v+=acc;acc=0}}else v*=Math.pow(1+r/100,1/12);pts.push({d:m,v:v+acc,inv})});note=t(P.asset==='livretA'?'tl.wi.noteA':'tl.wi.noteR')}
    else{const p=pos.find(x=>'p:'+x.key===P.asset);if(p){const ops=[];p.lines.forEach(({a,h})=>(D().iops||[]).forEach(o=>{if(o.acc===a.id&&(o.isin&&o.isin===h.isin||o.n&&norm(o.n)===norm(h.name))&&+o.px>0)ops.push({d:o.d,px:conv(+o.px,o.cur||a.cur)})}));ops.sort((x,y)=>x.d.localeCompare(y.d));ops.push({d:today(),px:conv(p.price,p.cur)});
        const pxAt=dt=>{if(dt<=ops[0].d)return null;let i=ops.findIndex(o=>o.d>=dt);if(i<0)return ops[ops.length-1].px;if(i===0)return ops[0].px;const A0=ops[i-1],B=ops[i];const w=daysBetween(A0.d,dt)/Math.max(1,daysBetween(A0.d,B.d));return A0.px+(B.px-A0.px)*w};
        let q=0,inv=0;const first=ops[0].d;months.filter(m=>m>=first.slice(0,7)+'-01').forEach((m,k)=>{const px=pxAt(m<first?first:m)||ops[0].px;const add=(k===0?+P.amount:+P.monthly);if(add>0){q+=add/px;inv+=add}pts.push({d:m,v:q*px,inv})});
        note=t('tl.wi.noteP',{d:dateT(first)})}}
    const last=pts[pts.length-1]||{v:0,inv:0};const yrs=pts.length/12;const cagr=last.inv>0&&yrs>=1&&!(+P.monthly)?Math.pow(last.v/last.inv,1/yrs)-1:null;
    const step=Math.max(1,Math.ceil(pts.length/120));const P2=pts.filter((_,i)=>i%step===0||i===pts.length-1);
    return {form:sel('asset',t('tl.wi.asset'),opts)+inp('amount',t('tl.wi.amount'),'100',c)+inp('monthly',t('tl.wi.monthly'),'10',c)+inp('start',t('tl.wi.start'))+(P.asset==='rate'?inp('rate',t('sim.rate'),'0.1','%'):'')+`<p class="note">${esc(t('tl.wi.help'))}</p>`,
      res:pts.length?`<div class="kpis k4" style="margin-bottom:16px">${kp(t('tl.wi.value'),money(last.v,0))}${kp(t('tl.wi.inv'),money(last.inv,0))}${kp(t('sim.gains'),`<span class="${cls(last.v-last.inv)}">${moneyS(last.v-last.inv,0)}</span>`,pctS(last.inv?(last.v-last.inv)/last.inv:0))}${kp(t('tl.wi.cagr'),cagr==null?'—':pctS(cagr),cagr==null?t('tl.wi.cagrNa'):'')}</div>
      <div class="card">${chart({h:260,zero:true,series:[{pts:P2.map(x=>({v:x.v})),c:'var(--accent)'},{pts:P2.map(x=>({v:x.inv})),c:'var(--k3)',fill:false}],xl:i=>dateT(P2[i].d,'my'),tip:i=>`<b>${esc(moneyT(P2[i].v,0))}</b><br>${esc(dateT(P2[i].d,'my'))}<br><span class="muted">${esc(t('tl.wi.inv'))} ${esc(moneyT(P2[i].inv,0))}</span>`})}<p class="note" style="margin-top:10px">${esc(note)}</p></div>`:`<div class="empty">${esc(t('tl.wi.none'))}</div>`};
  },
  loanCmp(P,{inp,c}){
    const offers=[1,2,3].map(k=>{const n=P['y'+k]*12,r=+P['r'+k];const pay=annuity(+P.amount,r,n);const ins=+P.amount*P['i'+k]/100/12;const int=pay*n-P.amount;const fees=+P['f'+k];
      const irr=irrMonthly([+P.amount-fees].concat(Array(n).fill(-(pay+ins))));return {k,n,r,pay,ins,int,fees,cost:int+ins*n+fees,taeg:irr==null?null:Math.pow(1+irr,12)-1}});
    const best=offers.reduce((a,b)=>b.cost<a.cost?b:a);
    return {form:inp('amount',t('sim.amount'),'1000',c)+[1,2,3].map(k=>`<div class="f sect"><span class="lab">${esc(t('tl.lc.offer',{n:k}))}</span></div>`+inp('r'+k,t('sim.loanRate'),'0.01','%')+inp('y'+k,t('sim.duration'))+inp('i'+k,t('sim.ins'),'0.01','%')+inp('f'+k,t('tl.lc.fees'),'50',c)).join(''),
      res:`<div class="card"><div class="ch"><div><h2>${esc(t('tl.lc.t'))}</h2><p>${esc(t('tl.lc.s'))}</p></div></div><div class="tw cards"><table class="tbl"><thead><tr><th></th>${offers.map(o=>`<th>${esc(t('tl.lc.offer',{n:o.k}))}${o===best?` <span class="pill good">${esc(t('tl.lc.best'))}</span>`:''}</th>`).join('')}</tr></thead><tbody>
      ${[[t('sim.payment'),o=>moneyT(o.pay+o.ins,2)],[t('sim.totInt'),o=>moneyT(o.int,0)],[t('sim.totIns'),o=>moneyT(o.ins*o.n,0)],[t('tl.lc.fees'),o=>moneyT(o.fees,0)],[t('sim.totCost'),o=>moneyT(o.cost,0)],[t('tl.lc.taeg'),o=>o.taeg==null?'—':pctT(o.taeg,2)]].map(([l,f])=>`<tr><td><b>${esc(l)}</b></td>${offers.map(o=>`<td data-l="${esc(t('tl.lc.offer',{n:o.k}))}">${esc(f(o))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="note">${esc(t('tl.lc.note',{v:moneyT(Math.max(...offers.map(o=>o.cost))-best.cost,0)}))}</p></div>`};
  },
  capacity(P,{inp,c}){
    const maxPay=Math.max(0,(+P.income)*P.ratio/100-(+P.charges));const n=P.years*12,i=P.rate/1200;const insR=P.ins/100/12;
    const k=i>0?(1-Math.pow(1+i,-n))/i:n;const L=maxPay/(1/k+insR);const budget=L+(+P.down);
    return {form:inp('income',t('tl.cap.income'),'50',c)+inp('charges',t('tl.cap.charges'),'10',c)+inp('rate',t('sim.loanRate'),'0.01','%')+inp('years',t('sim.duration'))+inp('ins',t('sim.ins'),'0.01','%')+inp('ratio',t('tl.cap.ratio'),'1','%')+inp('down',t('tl.cap.down'),'1000',c),
      res:`<div class="kpis k4" style="margin-bottom:16px">${kp(t('tl.cap.loan'),money(L,0))}${kp(t('tl.cap.pay'),money(maxPay,0),t('tl.perMonth'))}${kp(t('tl.cap.budget'),money(budget,0),t('tl.cap.budgetS'))}${kp(t('tl.cap.price'),money(budget/1.075,0),t('tl.cap.priceS'))}</div>
      <div class="callout">${esc(t('tl.cap.note',{r:numT(P.ratio,0)}))}</div>`};
  },
  prepay(P,{inp,c}){
    const n=Math.max(1,Math.round(P.months)),pay=annuity(+P.crd,+P.rate,n);const intBefore=pay*n-P.crd;const left=Math.max(0,P.crd-P.amount);
    const pen=+P.pen?Math.min(P.amount*P.rate/100/2,P.amount*0.03):0;
    const n2=Math.ceil(monthsToRepay(left,+P.rate,pay));const intA=left>0?pay*n2-left:0;const pay2=left>0?annuity(left,+P.rate,n):0;const intB=pay2*n-left;
    return {form:inp('crd',t('tl.crd'),'1000',c)+inp('rate',t('sim.loanRate'),'0.01','%')+inp('months',t('tl.monthsLeft'))+inp('amount',t('tl.pp.amount'),'1000',c)+`<div class="f"><label class="inline"><input type="checkbox" data-f="simChk" data-v="pen" ${+P.pen?'checked':''}> ${esc(t('tl.pp.pen'))}</label></div>`,
      res:`<div class="kpis k4" style="margin-bottom:16px">${kp(t('tl.pp.penK'),money(pen,0),t('tl.pp.penS'))}${kp(t('tl.payNow'),money(pay,2))}${kp(t('tl.intLeft'),money(intBefore,0))}${kp(t('tl.crdAfter'),money(left,0))}</div>
      <div class="grid g2"><div class="card"><div class="ch"><h2>${esc(t('tl.pp.optA'))}</h2></div><div class="wkv"><div><span>${esc(t('tl.payNew'))}</span><b>${esc(moneyT(pay,2))}</b></div><div><span>${esc(t('tl.durNew'))}</span><b>${esc(t('tl.mo',{n:isFinite(n2)?n2:0}))}</b></div><div><span>${esc(t('tl.intSaved'))}</span><b class="good">${esc(moneyT(intBefore-intA,0))}</b></div><div><span>${esc(t('tl.netGain'))}</span><b class="${cls(intBefore-intA-pen)}">${moneyS(intBefore-intA-pen,0)}</b></div></div></div>
      <div class="card"><div class="ch"><h2>${esc(t('tl.pp.optB'))}</h2></div><div class="wkv"><div><span>${esc(t('tl.payNew'))}</span><b>${esc(moneyT(pay2,2))}</b></div><div><span>${esc(t('tl.durNew'))}</span><b>${esc(t('tl.mo',{n}))}</b></div><div><span>${esc(t('tl.intSaved'))}</span><b class="good">${esc(moneyT(intBefore-intB,0))}</b></div><div><span>${esc(t('tl.netGain'))}</span><b class="${cls(intBefore-intB-pen)}">${moneyS(intBefore-intB-pen,0)}</b></div></div></div></div>
      <p class="note">${esc(t('tl.pp.note'))}</p>`};
  },
  reneg(P,{inp,c}){
    const n=Math.max(1,Math.round(P.months));const p1=annuity(+P.crd,+P.rate,n),p2=annuity(+P.crd,+P.newRate,n);const pen=+P.pen?Math.min(P.crd*P.rate/100/2,P.crd*0.03):0;const cost=pen+(+P.fees);
    const gainM=p1-p2,gainT=gainM*n-cost;const be=gainM>0?Math.ceil(cost/gainM):null;
    return {form:inp('crd',t('tl.crd'),'1000',c)+inp('rate',t('tl.rn.cur'),'0.01','%')+inp('months',t('tl.monthsLeft'))+inp('newRate',t('tl.rn.new'),'0.01','%')+inp('fees',t('tl.rn.fees'),'50',c)+`<div class="f"><label class="inline"><input type="checkbox" data-f="simChk" data-v="pen" ${+P.pen?'checked':''}> ${esc(t('tl.rn.pen'))}</label></div>`,
      res:`<div class="kpis k4" style="margin-bottom:16px">${kp(t('tl.payNow'),money(p1,2))}${kp(t('tl.payNew'),money(p2,2),`<span class="good">${moneyS(-gainM,2)}</span> ${esc(t('tl.perMonth'))}`)}${kp(t('tl.rn.costs'),money(cost,0),t('tl.rn.costsS',{p:moneyT(pen,0)}))}${kp(t('tl.netGain'),`<span class="${cls(gainT)}">${moneyS(gainT,0)}</span>`,be?t('tl.rn.be',{n:be}):'')}</div>
      <div class="callout">${esc(t(gainT>0?'tl.rn.yes':'tl.rn.no',{d:numT(P.rate-P.newRate,2)}))}</div>`};
  },
  changePay(P,{inp,c}){
    const n1=monthsToRepay(+P.crd,+P.rate,+P.pay),n2=monthsToRepay(+P.crd,+P.rate,+P.newPay);const i1=isFinite(n1)?P.pay*n1-P.crd:null,i2=isFinite(n2)?P.newPay*n2-P.crd:null;
    return {form:inp('crd',t('tl.crd'),'1000',c)+inp('rate',t('sim.loanRate'),'0.01','%')+inp('pay',t('tl.payNow'),'10',c)+inp('newPay',t('tl.payNew'),'10',c),
      res:`<div class="kpis k4" style="margin-bottom:16px">${kp(t('tl.durNow'),isFinite(n1)?t('tl.mo',{n:Math.ceil(n1)}):'∞')}${kp(t('tl.durNew'),isFinite(n2)?t('tl.mo',{n:Math.ceil(n2)}):'∞',isFinite(n1)&&isFinite(n2)?t('tl.cp.diff',{n:Math.ceil(n1)-Math.ceil(n2)}):'')}${kp(t('tl.intLeft'),i1==null?'—':money(i1,0))}${kp(t('tl.cp.intNew'),i2==null?'—':money(i2,0),i1!=null&&i2!=null?`<span class="${cls(i1-i2)}">${moneyS(i1-i2,0)}</span>`:'')}</div>
      ${!isFinite(n2)?`<div class="callout">${esc(t('tl.cp.tooLow'))}</div>`:`<p class="note">${esc(t('tl.cp.note'))}</p>`}`};
  },
  rental(P,{inp,sel,c}){
    const cost=+P.price*(1+P.notary/100)+(+P.works);const rentY=P.rent*12*(1-P.vac/100);const chY=(+P.taxF)+(+P.copro)+(+P.insur)+rentY*P.mgmt/100;
    const n=P.lyears*12,pay=+P.loan>0?annuity(+P.loan,+P.lrate,n):0;const int1=+P.loan>0?(()=>{let b=+P.loan,s=0;const i=P.lrate/1200;for(let k=0;k<12;k++){const it=b*i;s+=it;b-=pay-it}return s})():0;
    const ps=P.regime==='lmnp'?18.6:17.2;let base=0;if(P.regime==='micro')base=rentY*0.7;else if(P.regime==='lmnp')base=rentY*0.5;else base=Math.max(0,rentY-chY-int1);
    const tax=base*(P.tmi+ps)/100;const yG=rentY/cost,yN=(rentY-chY)/cost,yNN=(rentY-chY-tax)/cost;const cf=(rentY-chY)/12-pay,cfT=(rentY-chY-tax)/12-pay;
    return {form:inp('price',t('tl.rt.price'),'1000',c)+inp('notary',t('tl.rt.notary'),'0.1','%')+inp('works',t('re.works'),'500',c)+inp('rent',t('re.rentM'),'10',c)+inp('vac',t('re.vacancy'),'0.5')+inp('taxF',t('re.taxFonc'),'50',c)+inp('copro',t('tl.rt.copro'),'50',c)+inp('insur',t('re.insur'),'10',c)+inp('mgmt',t('re.mgmt'),'0.5')+inp('loan',t('tl.rt.loan'),'1000',c)+inp('lrate',t('sim.loanRate'),'0.01','%')+inp('lyears',t('sim.duration'))+sel('regime',t('tl.rt.regime'),[['micro',t('tl.rt.micro')],['reel',t('tl.rt.reel')],['lmnp',t('tl.rt.lmnp')]])+inp('tmi',t('tl.rt.tmi'),'1','%'),
      res:`<div class="kpis k4" style="margin-bottom:16px">${kp(t('tl.rt.yG'),pctT(yG,2))}${kp(t('tl.rt.yN'),pctT(yN,2))}${kp(t('tl.rt.yNN'),pctT(yNN,2),t('tl.rt.yNNS'))}${kp(t('tl.rt.cf'),`<span class="${cls(cfT)}">${moneyS(cfT,0)}</span>`,t('tl.rt.cfS',{v:moneyT(cf,0)}))}</div>
      <div class="card"><div class="list">${[[t('tl.rt.cost'),moneyT(cost,0)],[t('re.k.gross'),moneyT(rentY,0)],[t('re.k.ch'),moneyT(chY,0)],[t('tl.rt.pay'),moneyT(pay,2)],[t('tl.rt.tax'),moneyT(tax,0)+' · '+t('tl.rt.taxS',{t:numT(P.tmi,0),p:numT(ps,1)})]].map(([l,v])=>`<div class="row"><div class="m">${esc(l)}</div><div class="r"><b>${esc(v)}</b></div></div>`).join('')}</div><p class="note" style="margin-top:10px">${esc(t('tl.rt.note.'+P.regime))}</p></div>`};
  },
  rentBuy(P,{inp,c}){
    const H=Math.max(1,Math.round(P.horizon)),n=P.years*12;const L=Math.max(0,P.price*(1+P.notary/100)-P.down);const pay=annuity(L,+P.rate,n),insM=L*P.ins/100/12;
    let bal=L,val=+P.price,rent=+P.rent,port=+P.down;const rows=[];let be=null;const i=P.rate/1200,rr=Math.pow(1+P.ret/100,1/12)-1;
    for(let m=1;m<=H*12;m++){const own=val*P.own/100/12;const cBuy=(m<=n?pay+insM:0)+own;if(m<=n){const it=bal*i;bal=Math.max(0,bal-(pay-it))}
      port=port*(1+rr)+(cBuy-rent);if(m%12===0){val*=1+P.pg/100;rent*=1+P.rg/100;const wB=val*(1-P.sell/100)-bal;rows.push({y:m/12,b:wB,r:port});if(be==null&&wB>=port)be=m/12}}
    const last=rows[rows.length-1];
    return {form:inp('price',t('tl.rt.price'),'5000',c)+inp('down',t('tl.rb.down'),'1000',c)+inp('notary',t('tl.rt.notary'),'0.1','%')+inp('rate',t('sim.loanRate'),'0.01','%')+inp('years',t('sim.duration'))+inp('ins',t('sim.ins'),'0.01','%')+inp('own',t('tl.rb.own'),'0.1','%')+inp('pg',t('tl.rb.pg'),'0.1','%')+inp('rent',t('tl.rb.rent'),'10',c)+inp('rg',t('tl.rb.rg'),'0.1','%')+inp('ret',t('tl.rb.ret'),'0.1','%')+inp('sell',t('tl.rb.sell'),'0.5','%')+inp('horizon',t('tl.rb.horizon')),
      res:`<div class="kpis k4" style="margin-bottom:16px">${kp(t('tl.rb.wB'),money(last.b,0),t('tl.rb.atY',{n:H}))}${kp(t('tl.rb.wR'),money(last.r,0),t('tl.rb.atY',{n:H}))}${kp(t('tl.rb.diff'),`<span class="${cls(last.b-last.r)}">${moneyS(last.b-last.r,0)}</span>`,t(last.b>=last.r?'tl.rb.buyWins':'tl.rb.rentWins'))}${kp(t('tl.rb.be'),be?t('tl.inY',{n:numT(be,0)}):'—',be?'':t('tl.rb.never',{n:H}))}</div>
      <div class="card"><div class="ch"><h2>${esc(t('tl.rb.chart'))}</h2></div>${chart({h:260,series:[{pts:[{v:0}].concat(rows.map(r=>({v:r.b}))),c:'var(--accent)',fill:false},{pts:[{v:+P.down}].concat(rows.map(r=>({v:r.r}))),c:'var(--k3)',fill:false}],xl:yLab,tip:i=>i?`<b>${esc(yLab(i))}</b><br>${esc(t('tl.rb.wB'))} ${esc(moneyT(rows[i-1].b,0))}<br>${esc(t('tl.rb.wR'))} ${esc(moneyT(rows[i-1].r,0))}`:''})}<p class="note" style="margin-top:10px">${esc(t('tl.rb.note'))}</p></div>`};
  },
  stopWork(P,{inp,c}){
    let pass=+P.passive,exp=+P.exp,m=0;const pts=[{v:pass}],ex=[{v:exp}];const yl=+P.yield/100/12,g=Math.pow(1+P.growth/100,1/12)-1,inf=Math.pow(1+P.infl/100,1/12)-1;
    while(pass<exp&&m<600){pass=pass*(1+g)+(+P.save)*yl;exp*=1+inf;m++;if(m%12===0){pts.push({v:pass});ex.push({v:exp})}}
    if(m%12){pts.push({v:pass});ex.push({v:exp})}
    return {form:inp('exp',t('tl.sw.exp'),'50',c)+inp('passive',t('tl.sw.passive'),'1',c)+inp('save',t('tl.sw.save'),'10',c)+inp('yield',t('tl.sw.yield'),'0.1','%')+inp('growth',t('tl.sw.growth'),'0.1','%')+inp('infl',t('sim.infl'),'0.1','%')+`<p class="note">${esc(t('tl.prefill'))}</p>`,
      res:`<div class="kpis k4" style="margin-bottom:16px">${kp(t('tl.sw.when'),m>=600?'—':t('tl.inY',{n:numT(m/12,1)}),m>=600?t('tl.sw.never'):dateT(addMonths(today(),m),'my'))}${kp(t('tl.sw.cover'),pctT(clamp(+P.passive/(+P.exp||1),0,1),1),t('tl.sw.coverS'))}${kp(t('tl.sw.gap'),money(Math.max(0,P.exp-P.passive),0),t('tl.perMonth'))}${kp(t('tl.sw.capital'),money(Math.max(0,P.exp-P.passive)*12/(P.yield/100||1),0),t('tl.sw.capitalS',{p:numT(+P.yield,1)}))}</div>
      <div class="card"><div class="ch"><h2>${esc(t('tl.sw.chart'))}</h2></div>${chart({h:250,zero:true,series:[{pts,c:'var(--good)'},{pts:ex,c:'var(--bad)',fill:false,dash:true}],xl:yLab,tip:i=>`<b>${esc(yLab(i))}</b><br>${esc(t('tl.sw.passive'))} ${esc(moneyT(pts[i].v,0))}<br>${esc(t('tl.sw.exp'))} ${esc(moneyT(ex[i].v,0))}`})}<p class="note" style="margin-top:10px">${esc(t('tl.sw.note'))}</p></div>`};
  },
  health(P,{inp,c}){
    const sr=P.income>0?(P.income-P.exp)/P.income:0,dr=P.income>0?P.debt/P.income:0,em=P.exp>0?P.liquid/P.exp:0,tgt=P.age*P.income*12/10,nwR=tgt>0?P.nw/tgt:0;
    const parts=[['sr',clamp(sr/0.2,0,1)*30,pctT(sr,0),t('tl.hl.srT')],['dr',(dr<=0.35?1:clamp(1-(dr-0.35)/0.2,0,1))*20,pctT(dr,0),t('tl.hl.drT')],['em',clamp(em/6,0,1)*25,numT(em,1)+' '+t('tl.months'),t('tl.hl.emT')],['nw',clamp(nwR,0,1)*25,pctT(clamp(nwR,0,9),0),t('tl.hl.nwT',{v:moneyT(tgt,0)})]];
    const score=Math.round(sum(parts.map(p=>p[1])));
    return {form:inp('income',t('tl.hl.income'),'50',c)+inp('exp',t('tl.hl.exp'),'50',c)+inp('debt',t('tl.hl.debt'),'10',c)+inp('liquid',t('tl.hl.liquid'),'100',c)+inp('nw',t('k.net'),'100',c)+inp('age',t('sim.age'))+`<p class="note">${esc(t('tl.prefill'))}</p>`,
      res:`<div class="card"><div class="score" style="margin-bottom:14px">${ring(score/100,score>=70?'var(--good)':score>=45?'var(--warn)':'var(--bad)','')}<div><div class="big">${score}<span class="muted" style="font-size:16px">/100</span></div><div class="note">${esc(t(score>=70?'health.good':score>=45?'health.mid':'health.low'))}</div></div></div>
      <div class="mbars">${parts.map(([k,v,val,tg])=>`<div class="mb" style="grid-template-columns:150px 1fr auto"><span>${esc(t('tl.hl.'+k))}<br><small class="muted">${esc(val)} · ${esc(tg)}</small></span><i><b style="width:${(v/({sr:30,dr:20,em:25,nw:25})[k]*100).toFixed(0)}%"></b></i><em>${Math.round(v)}/${({sr:30,dr:20,em:25,nw:25})[k]}</em></div>`).join('')}</div><p class="note" style="margin-top:12px">${esc(t('tl.hl.note'))}</p></div>`};
  },
  budget(P,{inp,c}){
    const out=['housing','transport','food','subs','other'].map(k=>[k,+P[k]||0]);const spent=sum(out.map(x=>x[1]));const disp=P.income-spent,left=disp-P.save;
    const pal=['--k1','--k2','--k3','--k4','--k5'];const segs=out.filter(x=>x[1]>0).map((x,i)=>({k:x[0],l:t('tl.bg.'+x[0]),v:x[1],c:`var(${pal[i]})`}));if(P.save>0)segs.push({k:'save',l:t('tl.bg.save'),v:+P.save,c:'var(--good)'});if(left>0)segs.push({k:'left',l:t('tl.bg.left'),v:left,c:'var(--surface3)'});
    return {form:inp('income',t('tl.hl.income'),'50',c)+['housing','transport','food','subs','other'].map(k=>inp(k,t('tl.bg.'+k),'10',c)).join('')+inp('save',t('tl.bg.save'),'10',c)+`<p class="note">${esc(t('tl.prefill'))}</p>`,
      res:`<div class="kpis k4" style="margin-bottom:16px">${kp(t('tl.bg.disp'),`<span class="${cls(disp)}">${money(disp,0)}</span>`,t('tl.perMonth'))}${kp(t('tl.bg.left'),`<span class="${cls(left)}">${money(left,0)}</span>`,t('tl.bg.leftS'))}${kp(t('tl.bg.rate'),pctT(P.income>0?(+P.save)/P.income:0,0))}${kp(t('tl.bg.housingR'),pctT(P.income>0?P.housing/P.income:0,0),t('tl.bg.housingS'))}</div>
      <div class="card">${donut(segs,esc(compactT(+P.income)),t('tl.hl.income'),'')}<div class="legend" style="margin-top:14px">${segs.map(s=>`<div class="lg"><i class="sq" style="--c:${s.c}"></i><span class="n">${esc(s.l)}</span><span class="p">${pctT(s.v/(+P.income||1))}</span><span class="v">${money(s.v,0)}</span></div>`).join('')}</div>${left<0?`<div class="callout" style="margin-top:12px">${esc(t('tl.bg.over',{v:moneyT(-left,0)}))}</div>`:''}</div>`};
  },
  inflation(P,{inp,c}){
    const f=Math.pow(1+P.rate/100,P.years);const rows=[1,5,10,15,20,25,30].filter(y=>y<=Math.max(30,P.years));
    return {form:inp('amount',t('tl.in.amount'),'100',c)+inp('years',t('sim.years'))+inp('rate',t('sim.infl'),'0.1','%'),
      res:`<div class="kpis k4" style="margin-bottom:16px">${kp(t('tl.in.power'),money(P.amount/f,0),t('tl.in.powerS',{n:P.years}))}${kp(t('tl.in.need'),money(P.amount*f,0),t('tl.in.needS'))}${kp(t('tl.in.loss'),pctT(1-1/f,1))}${kp(t('tl.in.half'),P.rate>0?t('tl.inY',{n:numT(Math.log(2)/Math.log(1+P.rate/100),0)}):'—',t('tl.in.halfS'))}</div>
      <div class="card"><div class="list">${rows.map(y=>{const g=Math.pow(1+P.rate/100,y);return `<div class="row"><div class="m"><b>${esc(yLab(y))}</b></div><div class="r"><b>${esc(moneyT(P.amount/g,0))}</b><span>${esc(t('tl.in.eq',{v:moneyT(P.amount*g,0)}))}</span></div></div>`}).join('')}</div></div>`};
  },
  realSalary(P,{inp,c}){
    const nom=P.then>0?P.now/P.then-1:0,real=(1+nom)/(1+P.infl/100)-1;const need=P.then*(1+P.infl/100);
    return {form:inp('then',t('tl.rs.then'),'10',c)+inp('now',t('tl.rs.now'),'10',c)+inp('years',t('sim.years'))+inp('infl',t('tl.rs.infl'),'0.1','%')+`<p class="note">${esc(t('tl.rs.help'))}</p>`,
      res:`<div class="kpis k4" style="margin-bottom:16px">${kp(t('tl.rs.nom'),pctS(nom))}${kp(t('tl.rs.real'),`<span class="${cls(real)}">${pctS(real)}</span>`)}${kp(t('tl.rs.need'),money(need,0),t('tl.rs.needS'))}${kp(t('tl.rs.perY'),pctS(P.years>0?Math.pow(1+real,1/P.years)-1:0),t('tl.rs.perYS'))}</div>
      <div class="callout">${esc(t(real>=0?'tl.rs.up':'tl.rs.down',{v:moneyT(Math.abs(P.now-need),0)}))}</div>`};
  },
  grossNet(P,{inp,sel,c}){
    const RATES={nc:22,cadre:25,pub:15,app:0};const st=['nc','cadre','pub'];const per=P.per==='y'?12:1;
    const conv2=(amt,s)=>{const r=RATES[s]/100;return P.dir==='g2n'?{g:amt,n:amt*(1-r)}:{g:amt/(1-r),n:amt}};
    const rows=st.map(s=>{const x=conv2(+P.amount,s);return {s,g:x.g,n:x.n,na:x.n*(1-P.pas/100)}});
    return {form:inp('amount',t('tl.gn.amount'),'50',c)+sel('dir',t('tl.gn.dir'),[['g2n',t('tl.gn.g2n')],['n2g',t('tl.gn.n2g')]])+sel('per',t('tl.gn.per'),[['m',t('tl.gn.m')],['y',t('tl.gn.y')]])+inp('pas',t('tl.gn.pas'),'0.1','%'),
      res:`<div class="card"><div class="tw cards"><table class="tbl"><thead><tr><th>${esc(t('tl.gn.stat'))}</th><th>${esc(t('tl.gn.gross'))}</th><th>${esc(t('tl.gn.net'))}</th><th>${esc(t('tl.gn.after'))}</th><th>${esc(t('tl.gn.perM'))}</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(t('tl.gn.s.'+r.s))}</b> <span class="muted">${RATES[r.s]} %</span></td><td data-l="${esc(t('tl.gn.gross'))}">${esc(moneyT(r.g,0))}</td><td data-l="${esc(t('tl.gn.net'))}">${esc(moneyT(r.n,0))}</td><td data-l="${esc(t('tl.gn.after'))}"><b>${esc(moneyT(r.na,0))}</b></td><td data-l="${esc(t('tl.gn.perM'))}">${esc(moneyT(r.na/per,0))}</td></tr>`).join('')}</tbody></table></div><p class="note">${esc(t('tl.gn.note'))}</p></div>`};
  },
  country(P,{sel}){
    const opts=Object.keys(COUNTRIES).map(k=>[k,t('tl.ct.'+k)]);const cs=[P.c1,P.c2,P.c3].filter(k=>COUNTRIES[k]);
    const rows=[['vat',k=>COUNTRIES[k].vat?numT(COUNTRIES[k].vat,1)+' %':t('tl.ct.noVat')],['ir',k=>COUNTRIES[k].ir],['cap',k=>COUNTRIES[k].cap],['div',k=>COUNTRIES[k].div]];
    return {form:sel('c1',t('tl.ct.c',{n:1}),opts)+sel('c2',t('tl.ct.c',{n:2}),opts)+sel('c3',t('tl.ct.c',{n:3}),opts),
      res:`<div class="card"><div class="tw cards"><table class="tbl"><thead><tr><th></th>${cs.map(k=>`<th>${esc(t('tl.ct.'+k))}</th>`).join('')}</tr></thead><tbody>${rows.map(([r,f])=>`<tr><td><b>${esc(t('tl.ct.r.'+r))}</b></td>${cs.map(k=>`<td data-l="${esc(t('tl.ct.'+k))}">${esc(f(k))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="note">${esc(t('tl.ct.note'))}</p></div>`};
  }
};
EXT.field.simChk=(el,v)=>{const tab=S.ui.simTab;if(!S.ui.sim||!S.ui.sim[tab])return;S.ui.sim[tab][el.dataset.v]=v?1:0;render()};
EXT.A.simTab=v=>{S.ui.simTab=v;render();scrollTo(0,0)};

/* ---------- saisie libre des montants dans les outils ---------- */
function numIn(v){return v==null||v===''?'':String(+v).replace('.',numSep())}
function numSep(){try{return (1.5).toLocaleString(loc()).replace(/\d/g,'')[0]||','}catch(e){return ','}}
function simTxt(tab,k,v){const T=S.ui.simTxt&&S.ui.simTxt[tab];return T&&k in T?T[k]:numIn(v)}
function parseIn(v){let s=String(v??'').replace(/[\s  ']/g,'').replace(/[€$£%]/g,'');if(s===''||s==='-'||s==='+')return 0;
  const lc=s.lastIndexOf(','),ld=s.lastIndexOf('.');if(lc>-1&&ld>-1){const dec=lc>ld?',':'.';s=s.split(dec==','?'.':',').join('').replace(dec,'.')}else if(lc>-1){s=(s.match(/,/g).length>1||/,\d{3}$/.test(s)&&s.length>5&&false)?s.replace(/,/g,''):s.replace(',','.')}
  const n=+s;return isFinite(n)?n:null}
function simRefresh(){const el=$('#simRes');if(!el){render();return}const tab=S.ui.simTab;const P=S.ui.sim[tab];if(!TOOLS[tab]){render();return}
  const R=TOOLS[tab](P,{inp:()=>'',sel:()=>'',c:curSym()});el.innerHTML=R.res;if(el.querySelector('.chart'))requestAnimationFrame(drawCharts)}

/* ---------- équilibre budgétaire : postes de revenus et de dépenses libres ---------- */
function btModel(){const s=ST();if(s.budgetTool&&Array.isArray(s.budgetTool.inc))return s.budgetTool;
  const d=toolDefaults().budget;
  s.budgetTool={inc:[{l:t('bt.d.inc'),v:d.income}],out:[['housing',d.housing],['transport',d.transport],['food',d.food],['subs',d.subs],['other',d.other]].map(([k,v])=>({l:t('tl.bg.'+k),v})),save:d.save};
  return s.budgetTool}
function btFromData(){/* moyenne des 3 derniers mois complets, par catégorie */
  const ms=[1,2,3].map(i=>ymAdd(today().slice(0,7),-i));const L=D().txs.filter(x=>ms.includes(ymOf(x.d)));
  const inc={},out={};L.forEach(x=>{const c=CAT[x.c]||CAT.uncat;if(c.kind==='in'&&x.a>0){const k=x.c==='otherIn'&&subOf(x)==='family'?'family':x.c;inc[k]=(inc[k]||0)+x.a/3}else if(c.kind==='out'&&x.a<0)out[x.c]=(out[x.c]||0)-x.a/3});
  const sv=L.filter(x=>(CAT[x.c]||{}).kind==='save').reduce((s,x)=>s-x.a,0)/3;
  const r=v=>Math.round(v*100)/100;
  return {inc:Object.entries(inc).filter(([,v])=>v>=0.5).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({l:k==='family'?t('sub.otherIn.family'):catL(k),v:r(v)})),out:Object.entries(out).filter(([,v])=>v>=0.5).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({l:catL(k),v:r(v)})),save:r(Math.max(0,sv))}}
TOOLS.budget=function(P,{c}){
  const B=btModel();const si=sum(B.inc.map(x=>+x.v||0)),so=sum(B.out.map(x=>+x.v||0)),sv=+B.save||0;const disp=si-so,left=disp-sv;
  const pal=['--k1','--k2','--k3','--k4','--k5','--k6','--k7'];
  const segs=B.out.map((x,i)=>({k:'o'+i,l:x.l||t('bt.noName'),v:+x.v||0,c:`var(${pal[i%pal.length]})`})).filter(x=>x.v>0);if(sv>0)segs.push({k:'save',l:t('tl.bg.save'),v:sv,c:'var(--good)'});if(left>0)segs.push({k:'left',l:t('tl.bg.left'),v:left,c:'var(--surface3)'});
  const big=B.out.slice().sort((a,b)=>(+b.v||0)-(+a.v||0))[0];
  const line=(g,x,i)=>`<div class="btl"><input type="text" id="bt-${g}-l-${i}" data-f="btL" data-v="${g}|${i}" value="${esc(x.l||'')}" placeholder="${esc(t(g==='inc'?'bt.phInc':'bt.phOut'))}" maxlength="60" aria-label="${esc(t('bt.label'))}"><input type="text" inputmode="decimal" autocomplete="off" id="bt-${g}-v-${i}" data-f="btV" data-v="${g}|${i}" value="${esc(btTxt(g,i,x.v))}" placeholder="0" aria-label="${esc(t('f.amount'))}" class="btv"><span class="faint">${esc(c)}</span><button class="ib sm" data-a="btDel" data-v="${g}|${i}" aria-label="${esc(t('act.delete'))}">${ico('x')}</button></div>`;
  const grp=g=>`<div class="btg"><div class="hrow" style="justify-content:space-between"><b>${esc(t(g==='inc'?'bt.inc':'bt.out'))}</b><span class="btsum ${g}">${money(g==='inc'?si:so,2)}</span></div>${B[g].map((x,i)=>line(g,x,i)).join('')}<button class="link" data-a="btAdd" data-v="${g}">${ico('plus')} ${esc(t(g==='inc'?'bt.addInc':'bt.addOut'))}</button></div>`;
  const form=`${grp('inc')}${grp('out')}<div class="btg"><div class="btl"><label for="bt-save" style="flex:1;font-weight:600">${esc(t('tl.bg.save'))}</label><input type="text" inputmode="decimal" autocomplete="off" id="bt-save" data-f="btV" data-v="save|0" value="${esc(btTxt('save',0,B.save))}" placeholder="0" class="btv"><span class="faint">${esc(c)}</span></div></div>
    <div class="hrow" style="gap:8px;flex-wrap:wrap"><button class="btn sec sm" data-a="btFill">${ico('spark')}${esc(t('bt.fill'))}</button></div><p class="note">${esc(t('bt.note'))}</p>`;
  const res=`<div class="kpis k2" style="margin-bottom:16px">${kp(t('tl.bg.disp'),`<span class="${cls(disp)}">${money(disp,0)}</span>`,t('bt.dispS'))}${kp(t('tl.bg.left'),`<span class="${cls(left)}">${money(left,0)}</span>`,t('tl.bg.leftS'))}${kp(t('tl.bg.rate'),pctT(si>0?sv/si:0,0),t('bt.rateS'))}${kp(t('bt.big'),big&&+big.v?pctT((+big.v)/(si||1),0):'—',big&&+big.v?(big.l||t('bt.noName')):'')}</div>
    <div class="card">${si>0?donut(segs,esc(compactT(si)),t('bt.inc'),''):`<p class="note">${esc(t('bt.noInc'))}</p>`}<div class="legend" style="margin-top:14px">${segs.map(s=>`<div class="lg"><i class="sq" style="--c:${s.c}"></i><span class="n">${esc(s.l)}</span><span class="p">${pctT(s.v/(si||1))}</span><span class="v">${money(s.v,0)}</span></div>`).join('')}</div>${left<0?`<div class="callout" style="margin-top:12px">${esc(t('tl.bg.over',{v:moneyT(-left,0)}))}</div>`:''}
    ${B.inc.length>1?`<div class="sec-t" style="margin-top:16px"><h2 style="font-size:14px">${esc(t('bt.incSplit'))}</h2></div><div class="mbars">${B.inc.filter(x=>+x.v>0).map(x=>`<div class="mb" style="grid-template-columns:150px 1fr auto"><span>${esc(x.l||t('bt.noName'))}</span><i><b style="width:${((+x.v)/(si||1)*100).toFixed(1)}%;background:var(--good)"></b></i><em>${money(+x.v,0)}</em></div>`).join('')}</div>`:''}</div>`;
  return {form,res};
};
function btTxt(g,i,v){const T=S.ui.btTxt||{};const k=g+'|'+i;return k in T?T[k]:numIn(v)}
EXT.field.btL=(el,v)=>{const [g,i]=el.dataset.v.split('|');const B=btModel();if(B[g]&&B[g][+i]){B[g][+i].l=String(v).slice(0,60);save();simRefresh()}};
EXT.field.btV=(el,v)=>{const [g,i]=el.dataset.v.split('|');const B=btModel();const n=parseIn(v);(S.ui.btTxt=S.ui.btTxt||{})[g+'|'+i]=v;el.classList.toggle('bad',n===null);if(n===null)return;
  if(g==='save')B.save=n;else if(B[g]&&B[g][+i])B[g][+i].v=n;save();simRefresh()};
EXT.A.btAdd=g=>{const B=btModel();B[g].push({l:'',v:0});S.ui.btTxt={};save();render();setTimeout(()=>{const el=$('#bt-'+g+'-l-'+(B[g].length-1));if(el)el.focus()},30)};
EXT.A.btDel=v=>{const [g,i]=v.split('|');const B=btModel();B[g].splice(+i,1);S.ui.btTxt={};save();render()};
EXT.A.btFill=()=>{const R=btFromData();if(!R.inc.length&&!R.out.length){toast(t('bt.noData'),true);return}const s=ST();s.budgetTool=R;S.ui.btTxt={};save();render();toast(t('bt.filled'))};
