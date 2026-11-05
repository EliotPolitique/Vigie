/* ================= revenus passifs ================= */
function incomeView(){
  const pi=passiveIncome();const tt=totals();const exp=avgMonthlyExpense(6)*12;const rec=incomeReceived();
  if(!pi.lines.length&&!rec.total)return emptyBlock(t('inc.emptyT'),t('inc.emptyP'),t('w.add'),'addAcc');
  const cm=new Date().getMonth();
  const tot=m=>m.div+m.int+m.rent;
  return `<div class="kpis" style="margin-bottom:16px">${kpi(t('inc.year'),money(pi.total,pi.total<100?2:0))}${kpi(t('inc.month'),money(pi.total/12,pi.total<1200?2:0))}${kpi(t('inc.yield'),pctT(tt.financial+tt.by.realestate?pi.total/(tt.financial+tt.by.realestate):0,2),t('inc.yieldS'))}${kpi(t('inc.cover'),exp?pctT(pi.total/exp,0):'—',t('inc.coverS'))}${kpi(t('inc.fiProg'),exp?pctT(clamp(pi.total/exp,0,1),0):'—',t('inc.fiProgS'))}${kpi(t('inc.recv'),money(rec.total,2),t('inc.recvS',{d:moneyT(rec.div,2),i:moneyT(rec.int,2)}))}</div>
  <div class="grid g-21"><div class="card"><div class="ch"><div><h2>${esc(t('inc.cal'))}</h2><p>${esc(t('inc.calSub'))}</p></div><div class="hrow" style="font-size:12px"><span class="hrow" style="gap:6px"><i class="sq" style="--c:var(--k3)"></i>${esc(t('inc.div'))}</span><span class="hrow" style="gap:6px"><i class="sq" style="--c:var(--k2)"></i>${esc(t('inc.int'))}</span><span class="hrow" style="gap:6px"><i class="sq" style="--c:var(--k5)"></i>${esc(t('inc.rent'))}</span></div></div>
  ${chart({type:'bars',h:250,groups:pi.months.map((m,i)=>({label:monthName(i+1),vals:[m.div,m.int,m.rent],on:i===cm,title:moneyT(tot(m),0)})),keys:[{c:'var(--k3)'},{c:'var(--k2)'},{c:'var(--k5)'}],noDim:true,label:t('inc.cal')})}</div>
  <div class="card"><div class="ch"><h2>${esc(t('inc.split'))}</h2></div>${(()=>{const s=[{k:'div',l:t('inc.div'),v:sum(pi.lines.filter(l=>l.type==='div').map(l=>l.amount)),c:'var(--k3)'},{k:'int',l:t('inc.int'),v:sum(pi.lines.filter(l=>l.type==='int').map(l=>l.amount)),c:'var(--k2)'},{k:'rent',l:t('inc.rent'),v:sum(pi.lines.filter(l=>l.type==='rent').map(l=>l.amount)),c:'var(--k5)'}];return donut(s,esc(compactT(pi.total)),t('per.year'))+`<div class="legend" style="margin-top:14px">${s.map(x=>`<div class="lg"><i class="sq" style="--c:${x.c}"></i><span class="n">${esc(x.l)}</span><span class="p">${pctT(x.v/(pi.total||1),0)}</span><span class="v">${money(x.v,0)}</span></div>`).join('')}</div>`})()}</div></div>
  <div class="card" style="margin-top:16px"><div class="ch"><div><h2>${esc(t('inc.sources'))}</h2><p>${esc(t('inc.sourcesSub'))}</p></div></div><div class="list">${pi.lines.map(l=>`<div class="row"><span class="av sm" style="--c:var(${l.type==='div'?'--k3':l.type==='int'?'--k2':'--k5'})">${ico(l.type==='div'?'coins':l.type==='int'?'savings':'house')}</span><div class="m"><b>${esc(l.name)}</b><span>${esc(l.acc.name)} · ${esc(t('inc.'+l.type))} · ${pctT(l.yield/100,2)}${l.src==='ops'?' · '+esc(t(l.est==='x'?'inc.fromOpsEst':l.est==='one'?'inc.fromOpsOne':'inc.fromOps')):''}</span></div><div class="r"><b>${money(l.amount,l.amount<100?2:0)}</b><span class="muted">${esc(moneyT(l.amount/12,l.amount<1200?2:0))} / ${esc(t('per.month'))}</span></div></div>`).join('')}</div></div>
  <p class="note" style="margin-top:12px">${esc(t('inc.note'))}</p>`;
}

/* ================= objectifs ================= */
const GOAL_TPL=[['shield','gt.emergency',null],['house','gt.home',null],['spark','gt.fi',null],['plane','gt.travel',null],['car','gt.car',null],['book','gt.studies',null]];
function goalsView(){
  const gs=D().goals;
  const tpl=`<div class="chips">${GOAL_TPL.map(([ic,k])=>`<button class="chip" data-a="goalTpl" data-v="${k}|${ic}">${ico(ic)}${esc(t(k))}</button>`).join('')}</div>`;
  if(!gs.length)return `<div class="empty"><b>${esc(t('g.emptyT'))}</b>${esc(t('g.emptyP'))}<div style="margin-top:14px;display:flex;justify-content:center">${tpl}</div><div><button class="btn" data-a="addGoal">${ico('plus')}${esc(t('g.add'))}</button></div></div>`;
  const totT=sum(gs.map(g=>+g.target||0)),totC=sum(gs.map(goalCurrent));
  return `<div class="kpis" style="margin-bottom:16px">${kpi(t('g.count'),String(gs.length))}${kpi(t('g.saved'),money(totC,0),pctT(totT?totC/totT:0,0))}${kpi(t('g.target'),money(totT,0))}${kpi(t('g.monthly'),money(sum(gs.map(g=>+g.monthly||0)),0),t('g.monthlyS'))}</div>
  <div class="hrow" style="justify-content:space-between;margin-bottom:14px">${tpl}<button class="btn sm" data-a="addGoal">${ico('plus')}${esc(t('g.add'))}</button></div>
  <div class="grid g2">${gs.map(g=>{const p=goalProjection(g);const late=g.date&&p.date&&p.date>g.date;const accs=D().accounts.filter(a=>(g.accounts||[]).includes(a.id));
    return `<button class="card" style="text-align:left;cursor:pointer" data-a="goal" data-v="${g.id}"><div class="goal">${ring(p.pct,p.pct>=1?'var(--good)':late?'var(--warn)':'var(--accent)')}<div class="m"><div class="hrow" style="gap:8px"><span class="av sm" style="--c:var(--accent)">${ico(g.icon||'goals')}</span><h3>${esc(g.name)}</h3></div><div style="font:600 22px var(--display);margin-top:8px">${money(p.cur,0)} <span class="muted" style="font-size:14px">/ ${money(p.target,0)}</span></div>
    <div class="meta"><span>${p.pct>=1?esc(t('g.done')):p.date?esc(t('g.reach',{d:dateT(p.date,'my')})):esc(t('g.never'))}</span>${g.date?`<span class="${late?'warn':''}">${esc(t('g.deadline',{d:dateT(g.date,'my')}))}</span>`:''}<span>${esc(t('g.contrib',{v:moneyT(+g.monthly||0,0)}))}</span>${p.need!=null&&p.pct<1?`<span class="${late?'warn':''}">${esc(t('g.need',{v:moneyT(p.need,0)}))}</span>`:''}</div>
    ${accs.length?`<div class="chips" style="margin-top:10px">${accs.slice(0,4).map(a=>`<span class="pill">${esc(a.name)}</span>`).join('')}${accs.length>4?`<span class="pill">+${accs.length-4}</span>`:''}</div>`:''}</div></div></button>`}).join('')}</div>`;
}
function goalForm(id,tpl){
  const g=id?D().goals.find(x=>x.id===id):Object.assign({name:'',target:'',monthly:'',rate:'',accounts:[],icon:'goals'},tpl||{});if(!g)return '';
  return `<div class="ph"><div><h2>${esc(t(id?'g.editT':'g.newT'))}</h2><p>${esc(t('g.formSub'))}</p></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  <form data-form="goal" data-v="${id||''}" class="form">
    <div class="f full"><label for="gf-name">${esc(t('f.name'))}</label><input id="gf-name" name="name" required maxlength="80" value="${esc(g.name)}"></div>
    <div class="f"><label for="gf-target">${esc(t('g.target'))}</label><input id="gf-target" name="target" type="number" min="0" step="100" required value="${g.target??''}"></div>
    <div class="f"><label for="gf-date">${esc(t('g.date'))}</label><input id="gf-date" name="date" type="date" value="${esc(g.date||'')}"></div>
    <div class="f"><label for="gf-monthly">${esc(t('g.monthlyIn'))}</label><input id="gf-monthly" name="monthly" type="number" min="0" step="10" value="${g.monthly??''}"></div>
    <div class="f"><label for="gf-rate">${esc(t('g.rate'))}</label><input id="gf-rate" name="rate" type="number" step="0.1" value="${g.rate??''}" placeholder="3"></div>
    <div class="f full"><span class="lab">${esc(t('g.linked'))}</span><div class="chips">${D().accounts.filter(a=>accCls(a)!=='debt').map(a=>`<label class="chip"><input type="checkbox" name="acc_${a.id}" ${(g.accounts||[]).includes(a.id)?'checked':''}> ${esc(a.name)}</label>`).join('')||`<span class="note">${esc(t('g.noAcc'))}</span>`}</div><span class="hint">${esc(t('g.linkedHint'))}</span></div>
    <div class="f"><label for="gf-manual">${esc(t('g.manual'))}</label><input id="gf-manual" name="manual" type="number" min="0" step="10" value="${g.manual??''}"></div>
    <div class="f"><label for="gf-icon">${esc(t('g.icon'))}</label><select id="gf-icon" name="icon">${['goals','shield','house','spark','plane','car','book','gift','heart','watch'].map(i=>`<option value="${i}"${i===g.icon?' selected':''}>${esc(t('gi.'+i))}</option>`).join('')}</select></div>
    <div class="pfoot full">${id?`<button type="button" class="btn ghost" data-a="delGoal" data-v="${g.id}">${ico('trash')}${esc(t(S.ui.confirm==='g'+g.id?'act.confirmDel':'act.delete'))}</button>`:''}<span class="sp"></span><button type="button" class="btn ghost" data-a="close">${esc(t('act.cancel'))}</button><button class="btn">${esc(t('act.save'))}</button></div>
  </form>`;
}

/* ================= simulateurs ================= */
function simDefaults(){
  const tt=totals(),exp=avgMonthlyExpense(6)||1800;
  return {
    ci:{init:Math.round(tt.financial||10000),monthly:300,rate:6,years:20,fees:0.3,infl:2},
    fi:{exp:Math.round(exp*12),swr:ST().swr,cur:Math.round(tt.financial||20000),monthly:800,rate:5,age:30},
    loan:{amount:250000,rate:3.4,years:25,ins:0.3},
    mc:{init:Math.round(tt.financial||10000),monthly:300,mean:6.5,vol:15,years:20,target:300000}
  };
}
function simLegacy(tab){
  if(!S.ui.sim)S.ui.sim=simDefaults();const P=S.ui.sim[tab];
  const inp=(k,l,step='1',suf='')=>`<div class="f"><label for="sm-${tab}-${k}">${esc(l)}${suf?` <span class="faint">(${esc(suf)})</span>`:''}</label><input id="sm-${tab}-${k}" type="text" inputmode="decimal" autocomplete="off" data-f="sim" data-v="${k}" value="${esc(simTxt(tab,k,P[k]))}"></div>`;
  const c=curSym();let form='',res='';
  if(tab==='ci'){
    form=inp('init',t('sim.init'),'100',c)+inp('monthly',t('sim.monthly'),'10',c)+inp('rate',t('sim.rate'),'0.1','%')+inp('years',t('sim.years'),'1')+inp('fees',t('sim.fees'),'0.05','%')+inp('infl',t('sim.infl'),'0.1','%');
    const r=(P.rate-P.fees)/100/12;let v=+P.init,ctb=+P.init;const pv=[{v}],pc=[{v:ctb}];
    for(let m=1;m<=P.years*12;m++){v=v*(1+r)+(+P.monthly);ctb+=+P.monthly;if(m%12===0){pv.push({v});pc.push({v:ctb})}}
    const real=v/Math.pow(1+P.infl/100,P.years);const feeLoss=(()=>{let w=+P.init,rr=P.rate/100/12;for(let m=1;m<=P.years*12;m++)w=w*(1+rr)+(+P.monthly);return w-v})();
    res=`<div class="kpis" style="margin-bottom:16px">${kpi(t('sim.final'),money(v,0))}${kpi(t('sim.real'),money(real,0),t('sim.realS',{p:numT(P.infl,1)}))}${kpi(t('sim.contrib'),money(ctb,0))}${kpi(t('sim.gains'),`<span class="good">${moneyS(v-ctb,0)}</span>`)}${kpi(t('sim.feeLoss'),`<span class="bad">${money(feeLoss,0)}</span>`,t('sim.feeLossS'))}</div>
    <div class="card"><div class="ch"><h2>${esc(t('sim.growth'))}</h2><div class="hrow" style="font-size:12px"><span class="hrow" style="gap:6px"><i class="sq" style="--c:var(--accent)"></i>${esc(t('sim.value'))}</span><span class="hrow" style="gap:6px"><i class="sq" style="--c:var(--faint)"></i>${esc(t('sim.contrib'))}</span></div></div>${chart({h:260,zero:true,series:[{pts:pv,c:'var(--accent)'},{pts:pc,c:'var(--faint)',dash:true}],xl:i=>t('sim.yearN',{n:i}),tip:i=>`<b>${esc(t('sim.yearN',{n:i}))}</b><br>${esc(moneyT(pv[i].v,0))}<br><span style="opacity:.7">${esc(t('sim.contrib'))} ${esc(moneyT(pc[i].v,0))}</span>`})}</div>`;
  }else if(tab==='fi'){
    form=inp('exp',t('sim.fiExp'),'500',c)+inp('swr',t('sim.swr'),'0.1','%')+inp('cur',t('sim.fiCur'),'1000',c)+inp('monthly',t('sim.monthly'),'50',c)+inp('rate',t('sim.realRate'),'0.1','%')+inp('age',t('sim.age'),'1');
    const target=P.exp/(P.swr/100);const r=P.rate/100/12;let v=+P.cur,m=0;const pts=[{v}];
    while(v<target&&m<720){v=v*(1+r)+(+P.monthly);m++;if(m%12===0)pts.push({v})}
    if(m%12)pts.push({v});
    const yrs=m/12;const tgt=pts.map(()=>({v:target}));
    res=`<div class="kpis" style="margin-bottom:16px">${kpi(t('sim.fiNum'),money(target,0),t('sim.fiNumS',{p:numT(P.swr,1)}))}${kpi(t('sim.fiProg'),pctT(clamp(P.cur/target,0,1),0))}${kpi(t('sim.fiYears'),m>=720?'—':numT(yrs,1),m>=720?t('sim.never'):t('sim.fiAge',{n:Math.round(+P.age+yrs)}))}${kpi(t('sim.fiIncome'),money(P.cur*P.swr/100/12,0),t('sim.fiIncomeS'))}</div>
    <div class="card"><div class="ch"><h2>${esc(t('sim.fiPath'))}</h2></div>${chart({h:260,zero:true,series:[{pts,c:'var(--accent)'},{pts:tgt,c:'var(--good)',dash:true}],xl:i=>String(Math.round(+P.age+i)),tip:i=>`<b>${esc(t('sim.ageN',{n:Math.round(+P.age+i)}))}</b><br>${esc(moneyT(pts[i].v,0))}`})}<p class="note">${esc(t('sim.fiNote'))}</p></div>`;
  }else if(tab==='loan'){
    form=inp('amount',t('sim.amount'),'1000',c)+inp('rate',t('sim.loanRate'),'0.05','%')+inp('years',t('sim.duration'),'1')+inp('ins',t('sim.ins'),'0.01','%');
    const n=P.years*12,r=P.rate/100/12;const pay=r?P.amount*r/(1-Math.pow(1+r,-n)):P.amount/n;const ins=P.amount*P.ins/100/12;
    let bal=+P.amount;const pts=[{v:bal}];let intY=0,rows=[];let iy=0,py=0;
    for(let m=1;m<=n;m++){const i=bal*r;const p=pay-i;bal=Math.max(0,bal-p);intY+=i;iy+=i;py+=p;if(m%12===0){pts.push({v:bal});rows.push({y:m/12,i:iy,p:py,b:bal});iy=0;py=0}}
    res=`<div class="kpis" style="margin-bottom:16px">${kpi(t('sim.payment'),money(pay+ins,2),t('sim.paymentS',{v:moneyT(ins,2)}))}${kpi(t('sim.totInt'),money(intY,0))}${kpi(t('sim.totIns'),money(ins*n,0))}${kpi(t('sim.totCost'),money(intY+ins*n,0),pctT((intY+ins*n)/P.amount,0)+' '+t('sim.ofCap'))}${kpi(t('sim.income33'),money((pay+ins)/0.35,0),t('sim.income33S'))}</div>
    <div class="grid g-21"><div class="card"><div class="ch"><h2>${esc(t('sim.amort'))}</h2></div>${chart({h:240,zero:true,series:[{pts,c:'var(--k5)'}],xl:i=>t('sim.yearN',{n:i}),tip:i=>`<b>${esc(t('sim.yearN',{n:i}))}</b><br>${esc(t('sim.crd'))} ${esc(moneyT(pts[i].v,0))}`})}</div>
    <div class="card pad0" style="overflow:auto;max-height:340px"><table style="font-size:12.5px"><thead><tr><th>${esc(t('sim.year'))}</th><th>${esc(t('sim.interest'))}</th><th>${esc(t('sim.principal'))}</th><th>${esc(t('sim.crd'))}</th></tr></thead><tbody>${rows.map(x=>`<tr><td style="min-width:0">${x.y}</td><td>${esc(moneyT(x.i,0))}</td><td>${esc(moneyT(x.p,0))}</td><td>${esc(moneyT(x.b,0))}</td></tr>`).join('')}</tbody></table></div></div>`;
  }else{
    form=inp('init',t('sim.init'),'100',c)+inp('monthly',t('sim.monthly'),'10',c)+inp('mean',t('sim.mean'),'0.1','%')+inp('vol',t('sim.vol'),'0.5','%')+inp('years',t('sim.years'),'1')+inp('target',t('sim.target'),'1000',c);
    const runs=600,Y=Math.min(60,Math.max(1,Math.round(P.years)));const R=rng(7+Math.round(P.mean*10+P.vol*100+Y));const paths=[];
    const mu=P.mean/100,sg=P.vol/100;
    const gauss=()=>{let u=0,v=0;while(!u)u=R();while(!v)v=R();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
    for(let k=0;k<runs;k++){let w=+P.init;const p=[w];for(let y=1;y<=Y;y++){const ret=Math.exp((mu-sg*sg/2)+sg*gauss())-1;w=w*(1+ret)+P.monthly*12;p.push(w)}paths.push(p)}
    const q=(arr,p)=>{const s=[...arr].sort((a,b)=>a-b);return s[Math.floor(p*(s.length-1))]};
    const p10=[],p50=[],p90=[];for(let y=0;y<=Y;y++){const col=paths.map(p=>p[y]);p10.push(q(col,.1));p50.push(q(col,.5));p90.push(q(col,.9))}
    const prob=paths.filter(p=>p[Y]>=P.target).length/runs;
    res=`<div class="kpis" style="margin-bottom:16px">${kpi(t('sim.p50'),money(p50[Y],0))}${kpi(t('sim.p10'),money(p10[Y],0),t('sim.p10S'))}${kpi(t('sim.p90'),money(p90[Y],0),t('sim.p90S'))}${kpi(t('sim.prob'),pctT(prob,0),t('sim.probS',{v:moneyT(+P.target,0)}))}</div>
    <div class="card"><div class="ch"><h2>${esc(t('sim.mcT'))}</h2><p>${esc(t('sim.mcSub',{n:runs}))}</p></div>${chart({h:270,zero:true,band:{lo:p10,hi:p90},series:[{pts:p50.map(v=>({v})),c:'var(--accent)',fill:false},{pts:p50.map(()=>({v:+P.target})),c:'var(--good)',dash:true}],xl:i=>t('sim.yearN',{n:i}),tip:i=>`<b>${esc(t('sim.yearN',{n:i}))}</b><br>P90 ${esc(moneyT(p90[i],0))}<br>P50 ${esc(moneyT(p50[i],0))}<br>P10 ${esc(moneyT(p10[i],0))}`})}<p class="note">${esc(t('sim.mcNote'))}</p></div>`;
  }
  return `  <div class="grid g-12"><div class="card"><div class="ch"><div><h2>${esc(t('sim.params'))}</h2><p>${esc(t('sim.paramsSub.'+tab))}</p></div></div><div class="form" style="grid-template-columns:minmax(0,1fr)">${form}</div></div><div>${res}</div></div>`;
}

/* ================= fiscalité ================= */
function taxView(){
  const tx=ST().tax,R=ST().rates;const pfu=(tx.ir+tx.ps)/100;
  const accs=D().accounts.filter(a=>a.include!==false);
  const yrs=a=>a.opened?daysBetween(a.opened,today())/365.25:null;
  /* revenus imposables estimés de l'année */
  const lines=[];
  accs.forEach(a=>{const ty=TYP[a.type]||{};
    if(ty.env==='pfu'&&ty.h){const div=sum(a.holdings.map(h=>hVal(h,a)*(hDivEff(h,a).div||0)/100));if(div>0)lines.push({l:t('tax.divCto',{a:a.name}),base:div,rate:tx.mode==='bareme'?(tx.tmi*0.6+tx.ps)/100:pfu})}
    if(ty.env==='pfu'&&!ty.h){const rate=(+a.rate)||0;const it=accGross(a)*rate/100;if(it>0)lines.push({l:t('tax.intSav',{a:a.name}),base:it,rate:tx.mode==='bareme'?(tx.tmi+tx.ps)/100:pfu})}
    if(ty.env==='exempt'){const rate=(+a.rate)||R[ty.rate]||0;const it=accGross(a)*rate/100;if(it>0)lines.push({l:t('tax.intExempt',{a:a.name}),base:it,rate:0,ex:true})}
    if(ty.env==='pel'){const rate=(+a.rate)||R.pel||0;const it=accGross(a)*rate/100;if(it>0)lines.push({l:t('tax.intPel',{a:a.name}),base:it,rate:pfu})}
    if(ty.cls==='realestate'&&+a.rent>0&&!ty.h){const base=+a.rent*12;const taxable=base*0.7;lines.push({l:t('tax.rentMicro',{a:a.name}),base,rate:taxable/base*(tx.tmi+17.2)/100,note:t('tax.rentNote')})}
  });
  const taxYear=sum(lines.map(l=>l.base*l.rate));
  /* plus-values latentes */
  const pv=[];
  accs.filter(a=>(TYP[a.type]||{}).h).forEach(a=>{const ty=TYP[a.type];const v=sum(a.holdings.map(h=>hVal(h,a))),c=sum(a.holdings.map(h=>hCost(h,a)));const g=v-c;const y=yrs(a);let rate=pfu,rule='';
    if(ty.env==='pea'){if(y!=null&&y>=5){rate=tx.ps/100;rule=t('tax.peaOld')}else{rule=y==null?t('tax.peaUnknown'):t('tax.peaYoung',{n:numT(5-y,1)})}}
    else if(ty.env==='av'){if(y!=null&&y>=8){rate=(tx.avAfter8+tx.psAV)/100;rule=t('tax.avOld',{v:moneyT(tx.avAbatt,0)})}else{rate=(12.8+tx.psAV)/100;rule=y==null?t('tax.avUnknown'):t('tax.avYoung',{n:numT(8-y,1)})}}
    else if(ty.env==='crypto'){rule=t('tax.crypto')}
    else if(ty.env==='per'){rule=t('tax.per')}
    else if(ty.env==='pee'){rate=tx.ps/100;rule=t('tax.pee')}
    else if(ty.env==='immo'){rate=(19+17.2)/100;rule=t('tax.scpi')}
    else rule=t('tax.cto');
    let taxable=Math.max(0,g);if(ty.env==='av'&&y!=null&&y>=8)taxable=Math.max(0,g-tx.avAbatt);
    pv.push({a,g,rate,rule,tax:taxable*rate,y});
  });
  const totPv=sum(pv.map(p=>p.tax));
  /* plafonds */
  const caps=accs.filter(a=>accCap(a)).map(a=>{const ty=TYP[a.type];const paid=ty.h?accPaid(a):null;const used=paid!=null?paid:ty.h?sum(a.holdings.map(h=>hCost(h,a)))+conv(+a.cash||0,a.cur):accGross(a);return {a,cap:accCap(a),used,approx:!!ty.h&&paid==null}});
  const foreign=accs.filter(a=>a.foreign);
  const reNet=totals().by.realestate-sum(accs.filter(a=>(TYP[a.type]||{}).loan&&a.linked).map(a=>accGross(a)));
  return `<div class="demo-band" style="background:var(--surface2);border-color:var(--line)">${ico('info')}<div>${esc(t('tax.disclaimer',{p:numT(tx.ir+tx.ps,1)}))}</div><span class="sp"></span><button class="btn sec sm" data-a="go" data-v="prefs">${esc(t('tax.params'))}</button></div>
  ${taxProfileCard()}${taxReceivedCard()}
  <div class="kpis" style="margin-bottom:16px">${kpi(t('tax.pvLatent'),money(sum(pv.map(p=>p.g)),0))}${kpi(t('tax.pvTax'),money(totPv,0),t('tax.pvTaxS'))}${kpi(t('tax.mode'),tx.mode==='pfu'?t('tax.pfu',{p:numT(tx.ir+tx.ps,1)}):t('tax.bareme',{p:numT(tx.tmi,0)}))}</div>
  <div class="grid g2">
  <div class="card"><div class="ch"><div><h2>${esc(t('tax.sell'))}</h2><p>${esc(t('tax.sellSub'))}</p></div></div><div class="list">${pv.map(p=>`<div class="row"><span class="av sm" style="--c:var(--k3)">${ico((TYP[p.a.type]||{}).ic)}</span><div class="m"><b>${esc(p.a.name)}</b><span>${esc(p.rule)}</span></div><div class="r"><b>${p.g>0?money(p.tax,0):'—'}</b><span class="${cls(p.g)}">${moneyS(p.g,0)} · ${pctT(p.rate,1)}</span></div></div>`).join('')||`<p class="note">${esc(t('tax.noInv'))}</p>`}</div></div></div>
  <div class="grid g2" style="margin-top:16px"><div class="card"><div class="ch"><div><h2>${esc(t('tax.caps'))}</h2><p>${esc(t('tax.capsSub'))}</p></div></div><div class="list">${caps.map(c=>{const p=c.used/c.cap;return `<div class="row"><div class="m"><b>${esc(c.a.name)}</b><div class="bar${p>1?' over':''}" style="margin-top:6px"><i style="width:${clamp(p*100,0,100)}%"></i></div><span>${esc(t('tax.capRoom',{v:moneyT(Math.max(0,c.cap-c.used),0)}))}${c.approx?' · '+esc(t('tax.capApprox')):''}</span></div><div class="r"><b>${pctT(p,0)}</b><span class="muted">${esc(moneyT(c.cap,0))}</span></div></div>`}).join('')||`<p class="note">${esc(t('tax.noCaps'))}</p>`}</div></div>
  <div class="card"><div class="ch"><div><h2>${esc(t('tax.cal'))}</h2><p>${esc(t('tax.calSub'))}</p></div></div><div class="list">
    ${[['tax.c1T','tax.c1P','cal'],['tax.c2T','tax.c2P','receipt'],['tax.c3T','tax.c3P','tax']].map(([a,b,i])=>insHTML({c:'--info',ic:i,t:t(a),p:t(b)})).join('')}
    ${foreign.length?insHTML({c:'--warn',ic:'globe',t:t('tax.f3916T'),p:t('tax.f3916P',{n:foreign.map(a=>a.name).join(', ')})}):''}
    ${reNet>1300000?insHTML({c:'--warn',ic:'house',t:t('tax.ifiT'),p:t('tax.ifiP',{v:moneyT(reNet,0)})}):insHTML({c:'--good',ic:'house',t:t('tax.ifiNoT'),p:t('tax.ifiNoP')})}
  </div></div></div>`;
}

/* ================= copilote ================= */
function copilotContext(){
  const tt=totals(),pos=positions().slice(0,15),pi=passiveIncome(),h=health();const ym=today().slice(0,7);
  const months=[1,2,3].map(i=>{const m=ymAdd(ym,-i);const g=aggTx(monthTx(m));return {m,inc:Math.round(g.inc),exp:Math.round(g.exp),sav:Math.round(g.sav),top:Object.entries(g.cat).filter(([k])=>CAT[k]&&CAT[k].kind==='out').sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>catL(k)+':'+Math.round(v))}});
  return {date:today(),currency:ST().cur,net:Math.round(tt.net),gross:Math.round(tt.gross),debts:Math.round(tt.debts),byClass:Object.fromEntries(CLASSES.map(c=>[clsL(c.k),Math.round(tt.by[c.k])])),
    accounts:D().accounts.map(a=>({name:a.name,type:typL(a.type),value:Math.round(accValue(a)),opened:a.opened||undefined})),
    positions:pos.map(p=>({name:p.name,kind:kindL(p.kind),value:Math.round(p.value),pl:Math.round(p.pl),plPct:+(p.plp*100).toFixed(1),ter:p.ter,yield:p.div})),
    passiveIncomeYear:Math.round(pi.total),healthScore:h.score,emergencyMonths:h.emergency&&+h.emergency.toFixed(1),savingsRate:h.savRate&&+(h.savRate*100).toFixed(0),
    lastMonths:months,goals:D().goals.map(g=>{const p=goalProjection(g);return {name:g.name,target:g.target,current:Math.round(p.cur),deadline:g.date,eta:p.date}}),
    taxRules:'France 2026: PFU 31,4 % (12,8 IR + 18,6 PS) ; PEA > 5 ans : 18,6 % PS ; assurance-vie : PS 17,2 %, > 8 ans 7,5 % IR après abattement 4 600 € ; Livret A/LDDS 1,7 %, LEP 2,5 % (depuis le 01/08/2026).'};
}
function copilotView(){
  const C=S.ui.chat||(S.ui.chat=[]);
  if(S.cap.sample===null)return `<div class="empty"><b>${esc(t('cp.offT'))}</b>${esc(t('cp.offP'))}</div>`;
  const sug=['cp.s1','cp.s2','cp.s3','cp.s4','cp.s5'];
  return `<div class="grid g-21"><div class="card"><div class="ch"><div><h2>${esc(t('cp.t'))}</h2><p>${esc(t('cp.sub'))}</p></div>${C.length?`<button class="btn ghost sm" data-a="chatClear">${ico('refresh')}${esc(t('cp.new'))}</button>`:''}</div>
    <div class="chat" id="chat">${C.length?C.map(m=>`<div class="msg ${m.r==='user'?'u':'a'}">${esc(m.c)}</div>`).join(''):`<div class="empty" style="border-style:solid"><b>${esc(t('cp.hello'))}</b>${esc(t('cp.helloP'))}</div>`}${S.ui.chatBusy?`<div class="msg a" id="streaming">${esc(S.ui.chatPartial||t('cp.thinking'))}</div>`:''}</div>
    <form class="composer" data-form="chat"><textarea id="chatIn" name="q" rows="1" placeholder="${esc(t('cp.ph'))}" aria-label="${esc(t('cp.ph'))}" ${S.ui.chatBusy?'disabled':''}></textarea><button class="btn" ${S.ui.chatBusy?'disabled':''}>${esc(t('cp.send'))}</button></form></div>
    <div class="card"><div class="ch"><h2>${esc(t('cp.ideas'))}</h2></div><div class="sugg">${sug.map(k=>`<button class="chip" data-a="chatAsk" data-v="${esc(t(k))}" ${S.ui.chatBusy?'disabled':''}>${esc(t(k))}</button>`).join('')}</div><div class="hr"></div><p class="note" style="margin:0">${esc(t('cp.privacy'))}</p></div></div>`;
}

/* ================= paramètres ================= */
function prefsView(){
  const s=ST();const sec=(title,sub,body)=>`<section class="card"><div class="ch"><div><h2>${esc(title)}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div></div>${body}</section>`;
  const line=(label,ctl,hint)=>`<div class="row" style="flex-wrap:wrap"><div class="m" style="min-width:180px"><b style="font-weight:500;white-space:normal">${esc(label)}</b>${hint?`<span style="white-space:normal">${esc(hint)}</span>`:''}</div><div>${ctl}</div></div>`;
  const tgl=(f,on,lab)=>`<label class="tgl"><input type="checkbox" data-f="${f}" ${on?'checked':''} aria-label="${esc(lab)}"><i></i></label>`;
  const num=(f,v,step,w=110)=>`<input type="number" step="${step}" data-f="${f}" id="pf-${f.replace(/\W/g,'')}" value="${v}" style="width:${w}px;text-align:right">`;
  const accents=[['marine','#1E3A8A'],['saphir','#3550F2'],['emeraude','#0A8A6C'],['or','#9A6E12'],['amethyste','#6A3FE8'],['corail','#C9452F'],['ardoise','#2C3A52']];
  const storeTxt=S.demo?t('pf.storeDemo'):STORE.mode==='cloud'?t('pf.storeCloud'):t('pf.storeLocal');
  return `<div class="grid g2" style="align-items:start">
  ${sec(t('pf.profile'),t('pf.profileSub'),line(t('pf.name'),`<input id="pf-name" data-f="name" value="${esc(s.name)}" maxlength="40" style="width:200px">`)+line(t('pf.lang'),`<select id="pf-lang" data-f="lang" style="width:200px">${LANGS.map(([k,l])=>`<option value="${k}"${k===s.lang?' selected':''}>${l}</option>`).join('')}</select>`)+line(t('pf.cur'),`<select id="pf-cur" data-f="cur" style="width:200px">${curOpts(s.cur)}</select>`,t('pf.curHint')))}
  ${sec(t('pf.look'),t('pf.lookSub'),line(t('pf.theme'),seg('theme',[['system',t('pf.tSys')],['light',t('pf.tLight')],['dark',t('pf.tDark')]],s.theme,t('pf.theme')))+line(t('pf.accent'),`<div class="hrow" style="gap:8px">${accents.map(([k,c])=>`<button data-a="accent" data-v="${k}" aria-pressed="${s.accent===k}" title="${esc(t('acc.'+k))}" aria-label="${esc(t('acc.'+k))}" style="width:30px;height:30px;border-radius:50%;background:${c};border:3px solid ${s.accent===k?'var(--fg)':'transparent'};outline:1px solid var(--line);padding:0"></button>`).join('')}</div>`))}
  ${sec(t('pf.privacy'),t('pf.privacySub'),line(t('pf.mask'),tgl('privacy',s.privacy,t('pf.mask')),t('pf.maskHint'))+line(t('pf.pin'),s.pin?`<button class="btn sec sm" data-a="pinOff">${esc(t('pf.pinOff'))}</button> <button class="btn sec sm" data-a="lockNow">${ico('lock')}${esc(t('pf.lockNow'))}</button>`:`<button class="btn sec sm" data-a="pinSet">${ico('lock')}${esc(t('pf.pinSet'))}</button>`,t('pf.pinHint')))}
  ${sec(t('pf.rates'),t('pf.ratesSub'),Object.keys(s.rates).map(k=>line(typL(k),num('rate.'+k,s.rates[k],'0.05',90)+' %')).join('')+line(t('pf.emMonths'),num('emergencyMonths',s.emergencyMonths,'1',90))+line(t('pf.swr'),num('swr',s.swr,'0.1',90)+' %'))}
  ${sec(t('pf.tax'),t('pf.taxSub'),line(t('pf.taxMode'),seg('taxMode',[['pfu',t('pf.pfu')],['bareme',t('pf.bareme')]],s.tax.mode,t('pf.taxMode')))+line(t('pf.tmi'),`<select data-f="tax.tmi" id="pf-tmi" style="width:110px">${[0,11,30,41,45].map(v=>`<option value="${v}"${+s.tax.tmi===v?' selected':''}>${v} %</option>`).join('')}</select>`)+line(t('pf.ir'),num('tax.ir',s.tax.ir,'0.1',90)+' %')+line(t('pf.ps'),num('tax.ps',s.tax.ps,'0.1',90)+' %',t('pf.psHint'))+line(t('pf.psAV'),num('tax.psAV',s.tax.psAV,'0.1',90)+' %')+line(t('pf.avAbatt'),num('tax.avAbatt',s.tax.avAbatt,'100',110)))}
  ${sec(t('fin.prefT'),t('fin.prefSub'),`<div class="row" style="flex-wrap:wrap"><div class="m" style="min-width:180px"><b style="font-weight:500">${esc(t('fin.lastSync'))} : ${esc(ST().finary&&ST().finary.at?finAgo(ST().finary.at):t('fin.never'))}</b><span>${esc(t('fin.prefP'))}</span></div><button class="btn sec sm" data-a="finOpen">${ico('refresh')}${esc(t('fin.manage'))}</button></div>`)}
  ${sec(t('gs.sec'),t('gs.secSub'),gsPrefsHTML())}
  ${sec(t('pf.fx'),t('pf.fxSub',{c:s.cur}),fxUsed().filter(c=>c!=='EUR').map(c=>line('1 '+c+' =',num('fx.'+c,s.fx[c],'0.000001',120)+' EUR')).join('')+`<p class="note" style="margin:8px 0 0">${esc(t('fx.auto',{d:dateT(ST().fxAt||FX_AT)}))}</p>`)}
  ${sec(t('pf.data'),storeTxt,`<div class="hrow" style="flex-wrap:wrap;gap:8px">
    <button class="btn sec sm" data-a="exportJson">${ico('download')}${esc(t('pf.export'))}</button>
    <button class="btn sec sm" data-a="exportCsv">${ico('download')}${esc(t('pf.exportCsv'))}</button>
    <label class="btn sec sm" style="position:relative;overflow:hidden">${ico('upload')}${esc(t('pf.importJson'))}<input type="file" id="jsonFile" accept=".json,.gz,application/json,application/gzip" style="position:absolute;inset:0;opacity:0;cursor:pointer"></label>
    <button class="btn sec sm" data-a="import">${ico('upload')}${esc(t('b.import'))}</button>
    ${S.demo?`<button class="btn sm" data-a="exitDemo">${esc(t('demo.leave'))}</button>`:`<button class="btn ghost sm" data-a="demo">${esc(t('pf.demo'))}</button>`}
  </div><div class="hr"></div><div class="hrow" style="justify-content:space-between"><span class="note">${esc(t('pf.counts',{a:D().accounts.length,t:D().txs.length,h:D().history.length}))}</span>${S.demo?'':`<button class="btn ${S.ui.confirm==='wipe'?'danger':'ghost'} sm" data-a="wipe">${ico('trash')}${esc(t(S.ui.confirm==='wipe'?'pf.wipeConfirm':'pf.wipe'))}</button>`}</div>`)}
  ${sec(t('pf.rules'),t('pf.rulesSub'),D().rules.length?`<div class="list">${D().rules.map((r,i)=>`<div class="row"><div class="m"><b class="mono">${esc(r.p)}</b><span>→ ${esc(catL(r.c))}</span></div><button class="ib" data-a="delRule" data-v="${i}" aria-label="${esc(t('act.delete'))}">${ico('trash')}</button></div>`).join('')}</div>`:`<p class="note" style="margin:0">${esc(t('pf.noRules'))}</p>`)}
  ${sec(t('pf.about'),'',`<p style="margin:0 0 6px"><b>${APP.name}</b> · ${esc(t('pf.version',{v:APP.version}))}</p><p class="note" style="margin:0">${esc(t('pf.aboutP'))}</p>`)}
  </div>`;
}

/* ================= accueil, verrou, palette ================= */
function welcomeHTML(){
  const l=lang();
  return `<div class="welcome"><div class="l">
    <div class="brand" style="padding:0"><span class="mark">${MARK}</span><div><b>${APP.name}</b><small>${esc(t('brand.tag'))}</small></div></div>
    <div><h1>${esc(t('wel.h'))}</h1><p class="lead" style="margin-top:14px">${esc(t('wel.p'))}</p></div>
    <div class="feat">${[['wealth','wel.f1','wel.f1s'],['budget','wel.f2','wel.f2s'],['invest','wel.f3','wel.f3s'],['shield','wel.f4','wel.f4s']].map(([i,a,b])=>`<div>${ico(i)}<div><b>${esc(t(a))}</b><span>${esc(t(b))}</span></div></div>`).join('')}</div>
    <form data-form="welcome" class="grid" style="gap:12px;max-width:440px">
      <div class="form"><div class="f"><label for="wf-name">${esc(t('wel.name'))}</label><input id="wf-name" name="name" maxlength="40" placeholder="${esc(t('wel.namePh'))}"></div><div class="f"><label for="wf-cur">${esc(t('pf.cur'))}</label><select id="wf-cur" name="cur">${curOpts('EUR')}</select></div></div>
      <div class="hrow"><button class="btn">${esc(t('wel.start'))}</button><button type="button" class="btn sec" data-a="demo">${esc(t('wel.demo'))}</button></div>
    </form>
    <div class="langs">${LANGS.map(([k,n])=>`<button class="chip" data-a="lang" data-v="${k}" aria-pressed="${k===l}">${n}</button>`).join('')}</div>
  </div>
  <div class="r"><div class="eyebrow" style="color:inherit;opacity:.6">${esc(t('wel.preview'))}</div>
    <div class="wcard"><div class="l2">${esc(t('k.net'))}</div><div class="v2">${esc(new Intl.NumberFormat(loc(),{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(187420))}</div><div style="color:var(--good);font-weight:600;margin-top:4px">▲ +12,4 %</div>
    <svg viewBox="0 0 300 80" style="width:100%;height:80px;margin-top:10px"><defs><linearGradient id="wg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".45"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs><path d="M0,62 C30,58 45,64 70,52 S110,44 130,46 170,30 195,34 235,18 260,20 290,8 300,6 L300,80 L0,80Z" fill="url(#wg)"/><path d="M0,62 C30,58 45,64 70,52 S110,44 130,46 170,30 195,34 235,18 260,20 290,8 300,6" fill="none" stroke="var(--accent)" stroke-width="2.4"/></svg></div>
    <div class="grid g2 keep" style="gap:12px">${[['cls.invest','64 210','--k3'],['cls.savings','23 600','--k2'],['cls.realestate','148 000','--k5'],['cls.crypto','11 900','--k4']].map(([k,v,c])=>`<div class="wcard" style="padding:14px"><div class="l2" style="display:flex;gap:6px;align-items:center"><i class="dot" style="--c:var(${c})"></i>${esc(t(k))}</div><div style="font:600 18px var(--display)">${v} €</div></div>`).join('')}</div>
    <p style="opacity:.6;font-size:12.5px;margin:0">${esc(t('wel.legal'))}</p></div></div>`;
}
function lockHTML(){const n=(S.ui.pin||'').length;return `<div class="lockbox"><span class="mark" style="width:52px;height:52px;border-radius:16px">${MARK}</span><h2>${esc(t(S.ui.pinMode==='set'?'lock.setT':S.ui.pinMode==='confirm'?'lock.confirmT':'lock.t'))}</h2><p class="note" style="margin:0" id="lockmsg">${esc(S.ui.pinMsg||t(S.ui.pinMode?'lock.setP':'lock.p'))}</p><div class="pin">${[0,1,2,3].map(i=>`<i class="${i<n?'on':''}"></i>`).join('')}</div><div class="keys">${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k=>k===''?'<span></span>':`<button data-a="pinKey" data-v="${k}" aria-label="${k==='⌫'?esc(t('lock.del')):k}">${k}</button>`).join('')}</div>${S.ui.pinMode?`<button class="link" data-a="pinCancel">${esc(t('act.cancel'))}</button>`:`<button class="link" data-a="pinForgot">${esc(t('lock.forgot'))}</button>`}${S.ui.pinForgot?`<p class="note">${esc(t('lock.forgotP'))}</p><button class="btn danger sm" data-a="pinReset">${esc(t('lock.reset'))}</button>`:''}</div>`}
function cmdItems(q){
  const nq=norm(q);const out=[];
  const add=(g,ic,title,sub,act,v)=>out.push({g,ic,title,sub,act,v});
  VIEWS.filter(v=>!v.hide||v.k==='budget').forEach(v=>add(t('cmd.nav'),v.ic,t('nav.'+v.k),'',`go`,v.k));
  [['plus','cmd.addAcc','addAcc'],['plus','cmd.addTx','addTx'],['plus','cmd.addGoal','addGoal'],['upload','cmd.import','import'],['bars','cmd.importPf','pimport'],['refresh','inv.updatePrices','prices'],['eye','top.privacy','privacy'],['sun','cmd.theme','themeCycle'],['download','pf.export','exportJson']].forEach(([i,k,a])=>add(t('cmd.actions'),i,t(k),'',a,''));
  D().accounts.forEach(a=>add(t('cmd.accounts'),(TYP[a.type]||{}).ic,a.name,moneyT(accValue(a),0)+' · '+typL(a.type),'acc',a.id));
  positions().forEach(p=>add(t('cmd.positions'),'invest',p.name,[p.ticker,moneyT(p.value,0)].filter(Boolean).join(' · '),'pos',p.key));
  let list=nq?out.filter(o=>norm(o.title+' '+o.sub).includes(nq)):out.filter(o=>o.g!==t('cmd.positions')).slice(0,14);
  if(nq.length>1){D().txs.filter(x=>norm(x.l).includes(nq)).slice(0,8).forEach(x=>list.push({g:t('cmd.ops'),ic:(CAT[x.c]||CAT.uncat).ic,title:cleanLabel(x.l),sub:moneyT(x.a)+' · '+dateT(x.d),act:'tx',v:x.id}))}
  return list.slice(0,40);
}
function cmdResHTML(){
  const q=S.ui.cmdQ||'';const items=cmdItems(q);S.ui.cmdList=items;const sel=clamp(S.ui.cmdSel||0,0,Math.max(0,items.length-1));
  let g='',h='';items.forEach((it,i)=>{if(it.g!==g){g=it.g;h+=`<div class="grp-l">${esc(g)}</div>`}h+=`<button class="it" data-a="cmdGo" data-v="${i}" aria-selected="${i===sel}">${ico(it.ic)}<div class="m"><b>${esc(it.title)}</b>${it.sub?`<span>${esc(it.sub)}</span>`:''}</div></button>`});
  return h||`<p class="note" style="padding:14px">${esc(t('cmd.none'))}</p>`;
}
function cmdHTML(){return `<div class="cmd" role="dialog" aria-label="${esc(t('top.search'))}"><input id="cmdq" data-f="cmdQ" value="${esc(S.ui.cmdQ||'')}" placeholder="${esc(t('cmd.ph'))}" autocomplete="off"><div class="res">${cmdResHTML()}</div></div>`}
function cmdRefresh(){const r=$('.cmd .res');if(r){r.innerHTML=cmdResHTML();const s=r.querySelector('[aria-selected="true"]');if(s)s.scrollIntoView({block:'nearest'})}}
function quickMenu(){return `<div class="menu" role="menu" id="qmenu">${[['wealth','cmd.addAcc','addAcc'],['budget','cmd.addTx','addTx'],['goals','cmd.addGoal','addGoal'],['upload','cmd.import','import'],['bars','cmd.importPf','pimport'],['refresh','inv.updatePrices','prices']].map(([i,k,a])=>`<button role="menuitem" data-a="${a}">${ico(i)}${esc(t(k))}</button>`).join('')}</div>`}
function moreSheet(){return `<div class="ph"><h2>${esc(t('navs.more'))}</h2><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div><div class="list">${VIEWS.filter(v=>!MOBILE_NAV.includes(v.k)&&(!v.hide||v.k==='budget')).map(v=>`<button class="row btnrow" data-a="go" data-v="${v.k}"><span class="av sm" style="--c:var(--accent)">${ico(v.ic)}</span><div class="m"><b>${esc(t('nav.'+v.k))}</b></div>${ico('chev')}</button>`).join('')}<button class="row btnrow" data-a="cmd"><span class="av sm" style="--c:var(--accent)">${ico('search')}</span><div class="m"><b>${esc(t('top.search'))}</b></div>${ico('chev')}</button></div>`}
