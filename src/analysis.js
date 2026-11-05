/* ================= écrans d'analyse (repris de Cadran) : Performance, Flux, Projection, Signaux, Réconciliation, Méthode ================= */
const invAccs=()=>D().accounts.filter(a=>a.include!==false&&(TYP[a.type]||{}).h);
/* XIRR : Σ CF·(1+r)^(−j/365) = 0, Newton puis bissection */
function xirr(cfs){
  if(cfs.length<2||!cfs.some(c=>c.v>0)||!cfs.some(c=>c.v<0))return null;
  const t0=Date.parse(cfs[0].d);const f=r=>sum(cfs.map(c=>c.v/Math.pow(1+r,(Date.parse(c.d)-t0)/864e5/365)));
  const df=r=>sum(cfs.map(c=>{const e=(Date.parse(c.d)-t0)/864e5/365;return -e*c.v/Math.pow(1+r,e+1)}));
  let r=0.05;for(let i=0;i<60;i++){const y=f(r),d=df(r);if(!isFinite(y)||!isFinite(d)||Math.abs(d)<1e-12)break;const n=r-y/d;if(n<=-0.999)break;if(Math.abs(n-r)<1e-9)return n;r=n}
  let lo=-0.99,hi=10,flo=f(lo),fhi=f(hi);if(flo*fhi>0)return null;
  for(let i=0;i<200;i++){const m=(lo+hi)/2,fm=f(m);if(Math.abs(fm)<1e-7)return m;if(flo*fm<0){hi=m;fhi=fm}else{lo=m;flo=fm}}return (lo+hi)/2;
}
/* décomposition par compte : versé net → latente → réalisée → revenus → frais et écarts → valeur */
function perfModel(){
  let net=0,latent=0,real=0,inc=0,value=0,fees=0,buys=0;const rows=[];const cfs=[];
  invAccs().forEach(a=>{
    const hv=sum(a.holdings.map(h=>hVal(h,a))),cost=sum(a.holdings.map(h=>hCost(h,a))),cash=conv(+a.cash||0,a.cur);
    const ops=iopsOf(a.id);const R=ops.length?replayOps(ops):null;const P=accPerf(a);
    let n,re=0,i=0,f=0;
    if(P){n=P.net;re=R.T.real;i=R.T.div+R.T.int;f=R.T.fee+R.T.tax;
      ops.filter(o=>o.t==='dep'||o.t==='wd'||o.t==='other').forEach(o=>cfs.push({d:o.d,v:-iopNet(o)}))}
    else if(R){/* espèces partagées (ex. compte-titres Trade Republic) : versé net = achats − ventes, dividendes versés sur le compte espèces */
      n=-sum(ops.filter(o=>o.t==='buy'||o.t==='sell').map(o=>conv(iopNet(o),o.cur||a.cur)))+cash;re=R.T.real;i=R.T.div+R.T.int;f=R.T.fee+R.T.tax;
      ops.filter(o=>['buy','sell','div','int'].includes(o.t)).forEach(o=>cfs.push({d:o.d,v:conv(iopNet(o),o.cur||a.cur)}))}
    else{n=cost+cash}
    const v=hv+cash;const lat=hv-cost;
    if(R)buys+=R.T.buys;net+=n;latent+=lat;real+=R?re:0;inc+=R?i:0;value+=v;fees+=f;
    rows.push({a,net:n,value:v,latent:lat,real:re,inc:i,fees:f,hasHist:!!R,kind:P?'own':R?'trade':'none'});
  });
  if(cfs.length){const envVal=sum(rows.filter(r=>r.hasHist).map(r=>r.value));cfs.sort((x,y)=>x.d.localeCompare(y.d));cfs.push({d:today(),v:envVal})}
  const resid=value-(net+latent+real+inc);
  return {net,latent,real,inc,value,resid,fees,buys,rows,xirr:cfs.length>2?xirr(cfs):null,first:cfs.length?cfs[0].d:null};
}
function waterfall(steps){
  /* steps : [{l,v,kind:'base'|'delta'|'total'}] */
  let run=0;const bars=steps.map(s=>{let a,b;if(s.kind==='base'){a=0;b=s.v;run=s.v}else if(s.kind==='total'){a=0;b=s.v}else{a=run;b=run+s.v;run=b}return {...s,a,b}});
  const lo=Math.min(0,...bars.map(x=>Math.min(x.a,x.b))),hi=Math.max(...bars.map(x=>Math.max(x.a,x.b)),1);const H=v=>((v-lo)/(hi-lo))*100;
  return `<div class="wf" role="img" aria-label="${esc(steps.map(s=>s.l+' '+moneyT(s.v,0)).join(', '))}">${bars.map(x=>{const top=100-H(Math.max(x.a,x.b)),h=Math.max(.8,Math.abs(H(x.b)-H(x.a)));const c=x.kind==='total'?'var(--accent)':x.kind==='base'?'var(--k3)':x.v>=0?'var(--good)':'var(--bad)';
    return `<div class="wfc"><div class="wfp"><span class="wfv" style="bottom:calc(${100-top}% + 4px)">${x.kind==='delta'&&x.v>0?'+':''}${esc(moneyT(x.v,0))}</span><i style="top:${top}%;height:${h}%;background:${c}"></i></div><span class="wfl">${esc(x.l)}</span></div>`}).join('')}</div>`;
}
function perfView(){
  if(!invAccs().length)return emptyBlock(t('inv.emptyT'),t('inv.emptyP'),t('inv.addAcc'),'addAccInv');
  const M=perfModel();const pos=positions();const win=pos.filter(p=>p.pl>0).length;
  const rec=incomeReceived();const tt=totals();
  const head=`<div class="kpis k4" style="margin-bottom:16px">${kpi(t('pf2.value'),money(M.value,2),t('pf2.valueS',{n:pos.length}))}${kpi(t('pf2.net'),money(M.net,2),t('pf2.netS'))}${kpi(t('pf2.latent'),`<span class="${cls(M.latent)}">${moneyS(M.latent,2)}</span>`,pctS(M.net?M.latent/M.net:0))}${kpi(t('pf2.real'),`<span class="${cls(M.real)}">${moneyS(M.real,2)}</span>`,t('pf2.realS'))}${kpi(t('pf2.inc'),money(rec.total,2),t('pf2.incS'))}${kpi(t('pf2.xirr'),M.xirr==null?'—':`<span class="${cls(M.xirr)}">${pctS(M.xirr)}</span>`,M.first?t('pf2.xirrS',{d:dateT(M.first,'short')}):t('pf2.xirrNone'))}${kpi(t('pf2.fees'),money(M.fees,2),t('pf2.feesS'))}${kpi(t('pf2.win'),`${win}/${pos.length}`,t('pf2.winS',{n:pos.length-win}))}</div>`;
  const steps=[{l:t('pf2.w.net'),v:M.net,kind:'base'},{l:t('pf2.w.latent'),v:M.latent,kind:'delta'},{l:t('pf2.w.real'),v:M.real,kind:'delta'},{l:t('pf2.w.inc'),v:M.inc,kind:'delta'},{l:t('pf2.w.resid'),v:M.resid,kind:'delta'},{l:t('pf2.w.value'),v:M.value,kind:'total'}];
  const cascade=`<div class="card"><div class="ch"><div><h2>${esc(t('pf2.cascT'))}</h2><p>${esc(t('pf2.cascSub'))}</p></div></div>${waterfall(steps)}
    <div class="callout" style="margin-top:14px">${esc(t('pf2.check',{s:moneyT(M.net+M.latent+M.real+M.inc,2),v:moneyT(M.value,2),r:moneyT(M.resid,2)}))}</div></div>`;
  /* contribution de chaque ligne */
  const sorted=[...pos].sort((a,b)=>b.pl-a.pl);const mx=Math.max(1,...sorted.map(p=>Math.abs(p.pl)));
  const contrib=`<div class="card"><div class="ch"><div><h2>${esc(t('pf2.contribT'))}</h2><p>${esc(t('pf2.contribSub'))}</p></div></div><div class="hbars">${sorted.map(p=>`<button class="hb" data-a="pos" data-v="${esc(p.key)}"><span class="hbn">${esc(p.name)}</span><span class="hbt"><i class="${p.pl>=0?'pos':'neg'}" style="width:${(Math.abs(p.pl)/mx*50).toFixed(1)}%"></i></span><span class="hbv ${cls(p.pl)}">${moneyS(p.pl,2)}</span></button>`).join('')||`<p class="note">${esc(t('inv.noPos'))}</p>`}</div></div>`;
  /* revenus encaissés par année */
  const byY={};D().txs.forEach(x=>{if(x.c==='investIncome'&&x.a>0){const y=x.d.slice(0,4);byY[y]=(byY[y]||0)+x.a}});
  D().accounts.forEach(a=>{const ops=iopsOf(a.id);if(!ops.some(o=>o.t==='dep'||o.t==='wd'))return;ops.forEach(o=>{if(o.t==='div'||o.t==='int'){const y=o.d.slice(0,4);byY[y]=(byY[y]||0)+iopNet(o)}})});
  const ys=Object.keys(byY).sort();
  const incC=`<div class="card"><div class="ch"><div><h2>${esc(t('pf2.incYT'))}</h2><p>${esc(t('pf2.incYSub'))}</p></div></div>${ys.length?chart({type:'bars',h:200,groups:ys.map(y=>({label:y,vals:[byY[y]],title:moneyT(byY[y],2)})),keys:[{c:'var(--k3)'}],label:t('pf2.incYT')}):`<p class="note">${esc(t('pf2.incNone'))}</p>`}</div>`;
  /* par compte */
  const accT=`<div class="card" style="margin-top:16px"><div class="ch"><div><h2>${esc(t('pf2.accT'))}</h2><p>${esc(t('pf2.accSub'))}</p></div></div><div class="tw cards"><table class="tbl"><thead><tr><th>${esc(t('f.account'))}</th><th>${esc(t('pf2.net'))}</th><th>${esc(t('pf2.value'))}</th><th>${esc(t('pf2.latent'))}</th><th>${esc(t('pf2.real'))}</th><th>${esc(t('pf2.total'))}</th></tr></thead><tbody>${M.rows.map(r=>{const tot=r.value-r.net+(r.kind==='trade'?r.inc:0);return `<tr class="click" data-a="acc" data-v="${r.a.id}"><td><div class="nm">${accAvatar(r.a,1)}<div><b>${esc(r.a.name)}</b><span>${esc(r.kind==='own'?t('pf2.hist'):r.kind==='trade'?t('pf2.trade'):t('pf2.noHist'))}</span></div></div></td><td data-l="${esc(t('pf2.net'))}">${esc(moneyT(r.net,2))}</td><td data-l="${esc(t('pf2.value'))}">${esc(moneyT(r.value,2))}</td><td data-l="${esc(t('pf2.latent'))}" class="${cls(r.latent)}">${moneyS(r.latent,2)}</td><td data-l="${esc(t('pf2.real'))}" class="${cls(r.real)}">${r.hasHist?moneyS(r.real,2):'—'}</td><td data-l="${esc(t('pf2.total'))}" class="${cls(tot)}"><b>${moneyS(tot,2)}</b> <span class="muted">${r.net?pctS(tot/r.net):''}</span></td></tr>`}).join('')}</tbody></table></div><p class="note">${esc(t('pf2.accNote'))}</p></div>`;
  return head+cascade+`<div class="grid g2" style="margin-top:16px">${contrib}${incC}</div>`+accT;
}

/* ---------- flux et épargne ---------- */
/* investissements programmés (DCA) détectés dans l'historique : même ligne achetée ≥ 3 mois sur les 6 derniers, montant et jour réguliers */
function dcaDetect(){
  const out=[];const from=dAdd(today(),-200).slice(0,7);
  invAccs().forEach(a=>{const g={};iopsOf(a.id).forEach(o=>{if(o.t!=='buy'||o.d.slice(0,7)<from)return;const k=o.isin||norm(o.n||'');if(!k)return;(g[k]=g[k]||[]).push(o)});
    Object.entries(g).forEach(([k,L])=>{const byM={};L.forEach(o=>{const m=o.d.slice(0,7);(byM[m]=byM[m]||[]).push(o)});const ms=Object.keys(byM).sort();if(ms.length<3)return;
      /* le premier achat de chaque mois sert de référence (l'exécution du plan) */
      const dc={};L.forEach(o=>{const d=+o.d.slice(8,10);dc[d]=(dc[d]||0)+1});const mode=+Object.entries(dc).sort((x,y)=>y[1]-x[1]||x[0]-y[0])[0][0];
      const firsts=ms.map(m=>byM[m].slice().sort((x,y)=>Math.abs(+x.d.slice(8,10)-mode)-Math.abs(+y.d.slice(8,10)-mode))[0]);const allA=firsts.map(o=>Math.abs(+o.amt||0)+(+o.fee||0));const amts=allA.slice().sort((x,y)=>x-y);const rec=allA.slice(-3).sort((x,y)=>x-y);const days=firsts.map(o=>+o.d.slice(8,10)).sort((x,y)=>x-y);
      const med=amts[Math.floor(amts.length/2)],dmed=days[Math.floor(days.length/2)];const okA=amts.filter(v=>Math.abs(v-med)<=Math.max(2,med*0.3)).length,okD=days.filter(d=>Math.abs(d-dmed)<=4).length;
      const okA2=allA.filter(v=>Math.abs(v-rec[1])<=Math.max(2,rec[1]*0.3)).length;if((okA>=3||okA2>=3)&&okD>=3)out.push({a,key:k,name:L[0].n||k,amt:rec[1],day:dmed,months:new Set(ms.filter((m,i)=>Math.abs(days[i]-dmed)<=4||true)),plan:(()=>{const v=rec[1];const c=Math.round(v/5)*5;return c>0&&Math.abs(c-v)/v<=0.15?c:Math.max(1,Math.round(v))})()})})});
  return out;
}
function fluxGoalDef(){const D0=dcaDetect();return D0.length?Math.max(5,sum(D0.map(x=>x.plan))):100}
function fluxGoal(){const g=ST().fluxGoal;return g>0?+g:fluxGoalDef()}
function fluxModel(){
  const by={},bank={};const add=(d,v)=>{const m=d.slice(0,7);by[m]=(by[m]||0)+v};
  const dca=dcaDetect();
  invAccs().forEach(a=>{const ops=iopsOf(a.id);if(!ops.length)return;const own=ops.some(o=>o.t==='dep'||o.t==='wd');
    if(own){
      /* enveloppe avec espèces propres (PEA, AV…) : versements nets, ou l'exécution du DCA si elle est plus élevée (achat payé avec les espèces déjà présentes) */
      const dep={},plan={};ops.forEach(o=>{const m=o.d.slice(0,7);if(o.t==='dep'||o.t==='wd')dep[m]=(dep[m]||0)+iopNet(o)});
      dca.filter(x=>x.a===a).forEach(x=>ops.forEach(o=>{if(o.t==='buy'&&(o.isin||norm(o.n||''))===x.key&&Math.abs(+o.d.slice(8,10)-x.day)<=4){const m=o.d.slice(0,7);plan[m]=Math.max(plan[m]||0,Math.abs(+o.amt||0)+(+o.fee||0))}}));
      new Set([...Object.keys(dep),...Object.keys(plan)]).forEach(m=>add(m+'-01',Math.max(dep[m]||0,plan[m]||0)));return}
    /* compte sans espèces propres : achats nets des ventes, mois par mois, plancher à zéro (une vente n'est pas une « anti-épargne ») */
    const pm={};ops.forEach(o=>{if(o.t==='buy'||o.t==='sell'){const m=o.d.slice(0,7);pm[m]=(pm[m]||0)-iopNet(o)}});Object.entries(pm).forEach(([m,v])=>{if(v>0)add(m+'-01',v)})});
  /* épargne bancaire nette (livrets, coffres…) : suivie à part, hors score de régularité ; les virements vers une enveloppe déjà suivie sont exclus */
  const tracked=invAccs().filter(a=>iopsOf(a.id).length);
  const words=new Set(['pea','trade republic','xtb','boursorama','degiro','bourse direct','fortuneo','interactive brokers','scalable','saxo']);
  tracked.forEach(a=>{[a.inst,a.name].forEach(w=>{w=norm(w||'');if(w.length>=4&&!/^(compte|cto|pea|livret)/.test(w))words.add(w.split(' ').slice(0,2).join(' '))})});
  const toTracked=l=>{const n=' '+norm(l)+' ';for(const w of words)if(n.includes(' '+w+' '))return true;return false};
  D().txs.forEach(x=>{if(x.c!=='saving')return;const acc=D().accounts.find(a=>a.id===x.acc);if(acc&&(TYP[acc.type]||{}).h)return;if(tracked.length&&toTracked(x.l))return;const m=x.d.slice(0,7);bank[m]=(bank[m]||0)-x.a});
  let months=Object.keys(by).sort();if(!months.length)months=Object.keys(bank).sort();if(!months.length)return {months:[],by,bank,first:null,dca};
  const first=months[0];const list=[];let m=first;const cur=today().slice(0,7);
  while(m<=cur){list.push({m,v:r2(by[m]||0),bank:r2(bank[m]||0)});const [y,mo]=m.split('-').map(Number);m=mo===12?`${y+1}-01`:`${y}-${String(mo+1).padStart(2,'0')}`}
  return {months:list,by,bank,first,dca};
}
function fluxView(){
  const F=fluxModel();const goal=fluxGoal();
  if(!F.months.length)return emptyBlock(t('fx.emptyT'),t('fx.emptyP'),t('ti.importBtn'),'pimport');
  const L=F.months;const pos=L.filter(x=>x.v>0);const tot=sum(L.map(x=>Math.max(0,x.v)));
  let streak=0;for(let i=L.length-1;i>=0;i--){if(L[i].v>0)streak++;else if(i===L.length-1)continue;else break}
  let best=0,run=0;L.forEach(x=>{if(x.v>0){run++;best=Math.max(best,run)}else run=0});
  const missed=L.filter((x,i)=>x.v<=0&&i<L.length-1).length;const elapsed=Math.max(1,L.length-1);
  const mean=pos.length?sum(pos.map(x=>x.v))/pos.length:0;const sd=pos.length>1?Math.sqrt(sum(pos.map(x=>(x.v-mean)**2))/(pos.length-1)):0;const capd=pos.map(x=>Math.min(x.v,goal*1.5));const cm=capd.length?sum(capd)/capd.length:0;const cv=cm&&capd.length>1?Math.sqrt(sum(capd.map(v=>(v-cm)**2))/(capd.length-1))/cm:0;
  const R=1-missed/elapsed,A=Math.min(1,tot/(goal*L.length||1)),C=Math.max(0,1-cv);const score=Math.round(40*R+35*A+25*C);
  const rec=incomeReceived();const sr=(()=>{const ms=txMonths().slice(-4,-1);if(!ms.length)return null;const g=ms.map(m=>aggTx(monthTx(m)));const inc=sum(g.map(x=>x.inc)),out=sum(g.map(x=>x.exp));return inc>0?(inc-out)/inc:null})();
  /* grille mois × années */
  const years=[...new Set(L.map(x=>x.m.slice(0,4)))];const cell=v=>v<=0?'none':v<goal*0.9?'part':v<goal*1.5?'ok':'over';
  const grid=`<div class="fgrid"><span></span>${[1,2,3,4,5,6,7,8,9,10,11,12].map(m=>`<span class="fgh">${esc(monthName(m).slice(0,1).toUpperCase())}</span>`).join('')}${years.map(y=>`<span class="fgy">${y}</span>${[1,2,3,4,5,6,7,8,9,10,11,12].map(m=>{const k=`${y}-${String(m).padStart(2,'0')}`;const x=L.find(z=>z.m===k);return x?`<span class="fgc ${cell(x.v)}" title="${esc(monthT(k)+' · '+moneyT(x.v,2))}"></span>`:'<span class="fgc fge"></span>'}).join('')}`).join('')}</div>
    <div class="lgd2"><span><i class="none"></i>${esc(t('fx.l.none'))}</span><span><i class="part"></i>${esc(t('fx.l.part'))}</span><span><i class="ok"></i>${esc(t('fx.l.ok'))}</span><span><i class="over"></i>${esc(t('fx.l.over'))}</span></div>`;
  const last24=L.slice(-24);
  const k=`<div class="kpis k4" style="margin:16px 0">${kpi(t('fx.streak'),`<span class="good">${esc(t('fx.months',{n:streak}))}</span>`,t('fx.best',{n:best}))}${kpi(t('fx.missed'),String(missed),t('fx.missedS',{n:elapsed}))}${kpi(t('fx.mean'),money(mean,2),t('fx.sd',{v:moneyT(sd,2)}))}${kpi(t('fx.total'),money(tot,2),t('fx.goalCum',{v:moneyT(goal*L.length,0)}))}${kpi(t('fx.inc'),money(rec.total,2),t('fx.incS'))}${kpi(t('fx.rate'),sr==null?'—':pctT(sr,0),t('fx.rateS'))}${kpi(t('fx.thisMonth'),money(L[L.length-1].v,2),t('fx.vsGoal',{v:moneyT(goal,0)}))}${kpi(t('fx.first'),esc(monthT(F.first)),'')}</div>`;
  const bank12=sum(L.slice(-13,-1).map(x=>x.bank));const notes=[];notes.push(t('fx.n.bank',{v:moneyT(bank12,0)}));if(missed)notes.push(t('fx.n.missed',{n:missed,e:elapsed,p:Math.round((1-R)*40)}));notes.push(A>=1?t('fx.n.goalOk'):t('fx.n.goalKo',{p:Math.round(A*100)}));notes.push(t('fx.n.cv',{c:cv.toFixed(2).replace('.',',')}));
  const dcaC=F.dca.length?`<div class="card" style="margin-bottom:16px"><div class="ch"><div><h2>${esc(t('fx.dcaT'))}</h2><p>${esc(t('fx.dcaS'))}</p></div></div><div class="list">${F.dca.map(x=>`<div class="row"><span class="av sm" style="--c:var(--good)">${ico('cal')}</span><div class="m"><b>${esc(x.name)}</b><span>${esc(t('fx.dcaL',{a:x.a.name,d:x.day,p:moneyT(x.plan,0)}))}</span></div><div class="r"><b>${esc(moneyT(x.amt,2))}</b><span>${esc(t('fx.dcaMed'))}</span></div></div>`).join('')}</div>${ST().fluxGoal>0?'':`<p class="note" style="margin-top:8px">${esc(t('fx.dcaGoal',{v:moneyT(goal,0)}))}</p>`}</div>`:'';
  const scoreC=`<div class="card"><div class="ch"><div><h2>${esc(t('fx.scoreT'))}</h2><p>${esc(t('fx.scoreSub'))}</p></div></div><div style="display:grid;place-items:center;margin:4px 0 12px">${ring(score/100,score>=70?'var(--good)':score>=45?'var(--warn)':'var(--bad)',String(score))}</div>
    ${[['fx.s.r',40*R,40],['fx.s.a',35*A,35],['fx.s.c',25*C,25]].map(([l,v,m])=>`<div class="sbar"><span>${esc(t(l))}</span><b>${Math.round(v)}/${m}</b><i style="--w:${(v/m*100).toFixed(0)}%"></i></div>`).join('')}
    <ul class="notes">${notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>
    <div class="form" style="margin-top:10px"><div class="f full"><label for="fx-goal">${esc(t('fx.goalL'))}</label><input id="fx-goal" type="number" step="10" min="0" data-f="fluxGoal" value="${goal}"></div></div></div>`;
  return `<div class="grid g-21"><div><div class="card"><div class="ch"><div><h2>${esc(t('fx.gridT'))}</h2><p>${esc(t('fx.gridSub',{v:moneyT(goal,0)}))}</p></div></div>${grid}</div>${k}${dcaC}
    <div class="card"><div class="ch"><div><h2>${esc(t('fx.barsT'))}</h2><p>${esc(t('fx.barsSub'))}</p></div></div>${chart({type:'bars',h:220,groups:last24.map(x=>({label:['01','04','07','10'].includes(x.m.slice(5))?monthT(x.m,1)+' '+x.m.slice(2,4):'',vals:[Math.max(0,x.v),Math.max(0,x.bank)],title:t('fx.barT',{v:moneyT(x.v,2),b:moneyT(x.bank,2)})})),keys:[{c:'var(--accent)',l:t('fx.k.inv')},{c:'var(--k3)',l:t('fx.k.bank')}],label:t('fx.barsT')})}<div class="lgd2" style="margin-top:8px"><span><i style="background:var(--accent)"></i>${esc(t('fx.k.inv'))}</span><span><i style="background:var(--k3)"></i>${esc(t('fx.k.bank'))}</span></div></div></div>${scoreC}</div>`;
}

/* ---------- projection ---------- */
const PROJ_DEF={monthly:100,ret:6,vol:15,infl:2,swr:4,rente:1500,years:30};
function projView(){
  const P=Object.assign({},PROJ_DEF,ST().proj||{});const tt=totals();const start=tt.financial;
  const F=fluxModel();const avg=F.months.length?sum(F.months.slice(-12).map(x=>Math.max(0,x.v)))/Math.min(12,F.months.length):0;
  if(!(ST().proj&&ST().proj.monthly!=null)&&avg>0)P.monthly=Math.round(avg);
  const target=P.rente*12/(P.swr/100);const Y=Math.max(5,Math.min(50,Math.round(P.years)));
  const mu=(P.ret-P.infl)/100,sg=P.vol/100;const runs=1500;const R=rng(11+Math.round(P.ret*7+P.vol*3+P.monthly));
  const gauss=()=>{let u=0,v=0;while(!u)u=R();while(!v)v=R();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
  const mm=Math.log(1+mu)/12,ms=sg/Math.sqrt(12);const paths=[];
  for(let k=0;k<runs;k++){let w=start;const p=[w];for(let y=1;y<=Y;y++){for(let m=0;m<12;m++){w=(w+P.monthly)*Math.exp(mm-ms*ms/2+ms*gauss())}p.push(w)}paths.push(p)}
  const q=(arr,pp)=>{const s=[...arr].sort((a,b)=>a-b);return s[Math.floor(pp*(s.length-1))]};
  const p10=[],p50=[],p90=[];for(let y=0;y<=Y;y++){const col=paths.map(p=>p[y]);p10.push(q(col,.1));p50.push(q(col,.5));p90.push(q(col,.9))}
  const prob=paths.filter(p=>p[Y]>=target).length/runs;const yHit=p50.findIndex(v=>v>=target);
  const hitDate=yHit>0?(()=>{const d=new Date();d.setFullYear(d.getFullYear()+yHit);return d.toISOString().slice(0,10)})():null;
  const inp=(k,l,step,suf)=>`<div class="f"><label for="pj-${k}">${esc(l)}${suf?` <span class="faint">(${esc(suf)})</span>`:''}</label><input id="pj-${k}" type="number" step="${step}" data-f="proj" data-v="${k}" value="${P[k]}"></div>`;
  const c=curSym();
  const hz=[5,10,20,30].filter(h=>h<=Y);
  const peaDep=sum(D().accounts.filter(a=>a.type==='pea').map(a=>{const ops=iopsOf(a.id);return sum(ops.filter(o=>o.t==='dep').map(iopNet))-sum(ops.filter(o=>o.t==='wd').map(o=>-iopNet(o)))}));
  const hasPea=D().accounts.some(a=>a.type==='pea');const peaCap=Math.max(0,...D().accounts.filter(a=>a.type==='pea').map(accCap),0)||150000;
  return `<div class="grid g-21"><div>
    <div class="card"><div class="ch"><div><h2>${esc(t('pj.t',{n:Y,r:runs}))}</h2><p>${esc(t('pj.sub'))}${target>Math.max(...p90)*1.6?' · '+esc(t('pj.offScale',{v:moneyT(target,0)})):''}</p></div></div>${chart({h:280,zero:true,band:{lo:p10,hi:p90},series:[{pts:p50.map(v=>({v})),c:'var(--accent)',fill:false}].concat(target<=Math.max(...p90)*1.6?[{pts:p50.map(()=>({v:target})),c:'var(--good)',dash:true}]:[]),xl:i=>t('sim.yearN',{n:i}),tip:i=>`<b>${esc(t('sim.yearN',{n:i}))}</b><br>P90 ${esc(moneyT(p90[i],0))}<br>P50 ${esc(moneyT(p50[i],0))}<br>P10 ${esc(moneyT(p10[i],0))}`})}</div>
    <div class="kpis k4" style="margin:16px 0">${hz.map(h=>kpi(t('pj.in',{n:h}),money(p50[h],0),t('pj.range',{a:moneyT(p10[h],0),b:moneyT(p90[h],0),r:moneyT(p50[h]*P.swr/100/12,0)}))).join('')}</div>
    <div class="card"><div class="ch"><div><h2>${esc(t('pj.fiT'))}</h2><p>${esc(t('pj.fiSub'))}</p></div></div>
      <div class="kpis k4" style="box-shadow:none">${kpi(t('pj.target'),money(target,0),t('pj.targetS',{r:moneyT(P.rente,0),s:pctT(P.swr/100,1)}))}${kpi(t('pj.date'),hitDate?esc(monthT(hitDate.slice(0,7))):t('pj.never',{n:Y}),hitDate?t('pj.dateS',{n:yHit}):'')}${kpi(t('pj.prob',{n:Y}),`<span class="${prob>=.5?'good':'warn'}">${pctT(prob,0)}</span>`,t('pj.probS'))}${kpi(t('pj.now'),pctT(target?start/target:0,2),t('pj.nowS',{v:moneyT(start,0)}))}</div>
      <div class="callout" style="margin-top:14px">${esc(t('pj.note',{p:Math.round(prob*100),q:100-Math.round(prob*100)}))}</div></div></div>
    <div><div class="card"><div class="ch"><div><h2>${esc(t('pj.hypT'))}</h2><p>${esc(t('pj.hypSub'))}</p></div></div><div class="form">
      ${inp('monthly',t('pj.h.monthly'),'10',c)}${inp('ret',t('pj.h.ret'),'0.5','%')}${inp('vol',t('pj.h.vol'),'1','%')}${inp('infl',t('pj.h.infl'),'0.1','%')}${inp('swr',t('pj.h.swr'),'0.1','%')}${inp('rente',t('pj.h.rente'),'50',c)}${inp('years',t('pj.h.years'),'1','')}</div>
      <p class="note" style="margin-top:10px">${esc(t('pj.hypNote',{v:moneyT(start,0),a:moneyT(avg,0)}))}</p></div>
    ${hasPea?`<div class="card" style="margin-top:16px"><div class="ch"><div><h2>${esc(t('pj.peaT'))}</h2></div></div><div class="track"><i style="width:${Math.min(100,peaDep/peaCap*100).toFixed(2)}%"></i></div><p class="note" style="margin-top:10px">${esc(t('pj.peaP',{v:moneyT(peaDep,2),r:moneyT(Math.max(0,peaCap-peaDep),0),c:moneyT(peaCap,0)}))}</p></div>`:''}</div></div>`;
}

/* ---------- signaux : constat chiffré, comparaison, conséquence ---------- */
function signals(){
  const S2=[];const add=(kind,text,act,v,prio)=>S2.push({kind,text,act,v,prio:prio||0});
  if(!S.data)return S2;
  const F=ST().finary;
  if(FIN.st==='off')add('alert',t('sg.finOff'),'finOpen','',9);
  const fc=finCheck();if(fc&&!fc.ok)add('alert',t('sg.finGap',{d:moneyT(Math.abs(fc.diff),2)}),'finOpen','',8);
  D().accounts.filter(a=>a.fwarn).forEach(a=>add('alert',t('sg.accWarn',{a:a.name,w:t('fin.w.'+a.fwarn)}),'acc',a.id,7));
  const noPx=[];invAccs().forEach(a=>a.holdings.forEach(h=>{if(h.kind!=='fe'&&!(+h.price>0)&&(+h.qty||0)>0)noPx.push(h.name)}));
  if(noPx.length)add('alert',t('sg.noPx',{n:noPx.length,l:noPx.slice(0,3).join(', ')}),'go','recon',7);
  const stale=D().accounts.filter(a=>!a.fid&&a.include!==false&&Math.abs(accGross(a))>0.004&&(a.balAt||a.updatedAt||'')<dAdd(today(),-45));
  if(stale.length)add('alert',t('sg.stale',{n:stale.length,l:stale.slice(0,3).map(a=>a.name).join(', ')}),'go','recon',5);
  const ym=today().slice(0,7);const unc=D().txs.filter(x=>x.d.slice(0,7)>=dAdd(today(),-60).slice(0,7)&&x.c==='uncat').length;
  if(unc)add('gap',t('sg.uncat',{n:unc}),'go','budget',3);
  /* écarts */
  const goal=fluxGoal();const Fm=fluxModel();const cur=Fm.months.length?Fm.months[Fm.months.length-1]:null;
  {const day=+today().slice(8,10);const tm=day>=20?ym:dAdd(ym+'-01',-1).slice(0,7);const e=Fm.months.find(x=>x.m===tm);const v=e?e.v:0;
    if(Fm.months.length&&tm>=Fm.months[0].m&&v<goal)add('gap',t(tm===ym?'sg.underGoal':'sg.underGoalP',{d:moneyT(goal-v,2),m:monthT(tm),v:moneyT(v,2)}),'go','flux',4)}
  const pos=positions();const tot=sum(pos.map(p=>p.value));
  if(tot>0){const top=pos[0];const hhi=sum(pos.map(p=>(p.value/tot)**2));if(top&&top.value/tot>0.3)add('gap',t('sg.conc',{n:top.name,p:pctT(top.value/tot,0),e:(1/hhi).toFixed(1).replace('.',',')}),'pos',top.key,3)}
  const exp=avgMonthlyExpense(6);const liq=totals().liquid;if(exp>0&&liq<exp*3)add('gap',t('sg.cushion',{m:(liq/exp).toFixed(1).replace('.',','),v:moneyT(exp*3-liq,0)}),'go','wealth',4);
  /* progrès */
  const M=invAccs().length?perfModel():null;
  if(M&&M.net>0)add(M.latent>=0?'progress':'gap',t('sg.latent',{v:(M.latent>=0?'+':'')+moneyT(M.latent,2),p:pctT(Math.abs(M.net?M.latent/M.net:0),1),c:moneyT(M.net,0)}),'go','perf',2);
  const h=D().history||[];if(h.length>1){const past=h.find(x=>x.d>=dAdd(today(),-30))||h[0];const nw=totals().net;if(past&&past.d<today())add(nw>=past.nw?'progress':'gap',t('sg.nw',{a:dateT(past.d,'short'),b:moneyT(past.nw,2),c:moneyT(nw,2),d:(nw-past.nw>=0?'+':'')+moneyT(nw-past.nw,2)}),'go','home',1)}
  if(Fm.months.length>2){let s=0;for(let i=Fm.months.length-1;i>=0;i--){if(Fm.months[i].v>0)s++;else if(i===Fm.months.length-1)continue;else break}if(s>=3)add('progress',t('sg.streak',{n:s}),'go','flux',2)}
  const rec=incomeReceived();if(rec.total>0)add('progress',t('sg.income',{v:moneyT(rec.total,2)}),'go','income',1);
  const P=Object.assign({},PROJ_DEF,ST().proj||{});const tg=P.rente*12/(P.swr/100);add('progress',t('sg.fi',{p:pctT(totals().financial/tg,2),r:moneyT(P.rente,0)}),'go','proj',0);
  /* découvertes */
  const terCost=sum(pos.map(p=>p.value*(p.ter||0)/100));if(terCost>0)add('discover',t('sg.ter',{v:moneyT(terCost,2),p:pctT(tot?terCost/tot:0,2)}),'go','invest',1);
  if(M&&M.fees>0)add('discover',t('sg.fees',{v:moneyT(M.fees,2),p:pctT(M.buys?M.fees/M.buys:0,1)}),'go','perf',1);
  return S2.sort((a,b)=>b.prio-a.prio);
}
const SG_KINDS=['alert','gap','progress','discover'];
function sigCard(s){return `<div class="sig ${s.kind}"><div class="sk">${esc(t('sg.k.'+s.kind))}</div><p>${esc(s.text)}</p>${s.act?`<button class="btn ghost sm" data-a="${s.act}" data-v="${esc(s.v||'')}">${esc(t('sg.open'))} →</button>`:''}</div>`}
function signalsView(){
  const L=signals();
  return `<p class="lead">${esc(t('sg.lead'))}</p>`+SG_KINDS.map(k=>{const xs=L.filter(s=>s.kind===k);return xs.length?`<h2 class="sgh">${esc(t('sg.h.'+k))}</h2><div class="sigs">${xs.map(sigCard).join('')}</div>`:''}).join('')||`<div class="empty"><b>${esc(t('sg.none'))}</b></div>`;
}

/* ---------- réconciliation ---------- */
function reconModel(){
  const gaps=[];
  invAccs().forEach(a=>{const ops=iopsOf(a.id);if(!ops.length)return;const R=replayOps(ops);const seen=new Set();
    R.open.forEach(p=>{const h=pfMatch(a,{name:p.n,isin:p.isin||null,sym:p.sym||null});if(h)seen.add(h.id);const hq=h?+h.qty||0:0;if(Math.abs(hq-p.qty)>1e-6)gaps.push({a,name:p.n||p.sym||p.isin,isin:p.isin,hist:p.qty,decl:hq})});
    a.holdings.forEach(h=>{if(!seen.has(h.id)&&h.kind!=='fe'&&(+h.qty||0)>0)gaps.push({a,name:h.name,isin:h.isin,hist:0,decl:+h.qty})})});
  const noPx=[];invAccs().forEach(a=>a.holdings.forEach(h=>{if(h.kind==='fe')return;if(!(+h.price>0))noPx.push({a,h,why:'none'});else if(!h.fin&&h.liveAt&&h.liveAt.slice(0,10)<dAdd(today(),-7))noPx.push({a,h,why:'old'});else if(!h.fin&&!h.liveAt)noPx.push({a,h,why:'manual'})}));
  const stale=D().accounts.filter(a=>!a.fid&&a.include!==false&&Math.abs(accGross(a))>0.004&&(a.balAt||a.updatedAt||'')<dAdd(today(),-45));
  const unc=D().txs.filter(x=>x.c==='uncat');
  const dupMap=new Map();D().txs.forEach(x=>{if(x.c==='saving'||x.c==='transfer')return;const k=x.acc+'|'+x.d+'|'+x.a.toFixed(2)+'|'+norm(x.l);dupMap.set(k,(dupMap.get(k)||[]).concat([x]))});const dups=[...dupMap.values()].filter(v=>v.length>1);
  return {gaps,noPx,stale,unc,dups,fc:finCheck()};
}
function reconView(){
  const R=reconModel();const nIss=R.gaps.length+R.noPx.filter(x=>x.why!=='manual').length+R.stale.length+(R.fc&&!R.fc.ok?1:0);
  let out=`<p class="lead">${esc(t('rc.lead'))}</p><div class="kpis" style="margin-bottom:16px">${kpi(t('rc.k.iss'),`<span class="${nIss?'bad':'good'}">${nIss}</span>`,t('rc.k.issS'))}${kpi(t('rc.k.px'),`<span class="${R.noPx.filter(x=>x.why!=='manual').length?'warn':'good'}">${R.noPx.filter(x=>x.why!=='manual').length}</span>`,t('rc.k.pxS'))}${kpi(t('rc.k.stale'),`<span class="${R.stale.length?'warn':'good'}">${R.stale.length}</span>`,t('rc.k.staleS'))}${kpi(t('rc.k.ops'),String((D().iops||[]).length+D().txs.length),t('rc.k.opsS',{i:(D().iops||[]).length,b:D().txs.length}))}</div>`;
  /* 1. Finary */
  const F=ST().finary;
  out+=`<section class="card"><div class="ch"><div><h2>${esc(t('rc.finT'))}</h2><p>${esc(t('rc.finSub'))}</p></div><button class="btn sec sm" data-a="finOpen">${ico('refresh')}${esc(t('fin.manage'))}</button></div>${R.fc?`<div class="demo-band" style="margin:0;${R.fc.ok?'':'background:color-mix(in srgb,var(--warn) 12%,var(--surface));border-color:color-mix(in srgb,var(--warn) 40%,var(--line))'}">${ico(R.fc.ok?'check':'alert')}<div>${esc(R.fc.ok?t('fin.checkOk',{v:moneyT(R.fc.fin,2)}):t('fin.checkKo',{f:moneyT(R.fc.fin,2),v:moneyT(R.fc.vig,2)}))}</div></div>`:`<p class="note">${esc(t('rc.finNone'))}</p>`}
    <div class="list" style="margin-top:10px">${D().accounts.filter(a=>a.fid).map(a=>`<button class="row btnrow" data-a="acc" data-v="${a.id}">${accAvatar(a,1)}<div class="m"><b>${esc(a.name)}</b><span>${esc([a.inst,t('fin.syncedAt',{t:finAgo(a.fsync)}),a.fwarn?t('fin.w.'+a.fwarn):''].filter(Boolean).join(' · '))}</span></div><div class="r"><b>${money(accGross(a),2)}</b>${a.fwarn?`<span class="warn">${esc(t('rc.check'))}</span>`:`<span class="good">${esc(t('rc.ok'))}</span>`}</div></button>`).join('')}</div></section>`;
  /* 2. historique vs positions */
  out+=`<section class="card" style="margin-top:16px"><div class="ch"><div><h2>${esc(t('rc.histT'))}</h2><p>${esc(t('rc.histSub'))}</p></div></div>${R.gaps.length?`<div class="tw cards"><table class="tbl"><thead><tr><th>${esc(t('inv.colName'))}</th><th>${esc(t('f.account'))}</th><th>${esc(t('rc.hist'))}</th><th>${esc(t('rc.decl'))}</th><th>${esc(t('rc.gap'))}</th><th></th></tr></thead><tbody>${R.gaps.map(g=>`<tr><td><b>${esc(g.name)}</b><div class="note" style="font-size:12px">${esc(g.isin||'')}</div></td><td data-l="${esc(t('f.account'))}">${esc(g.a.name)}</td><td data-l="${esc(t('rc.hist'))}">${esc(qtyT(g.hist))}</td><td data-l="${esc(t('rc.decl'))}">${esc(qtyT(g.decl))}</td><td data-l="${esc(t('rc.gap'))}" class="bad">${esc(qtyT(g.decl-g.hist))}</td><td>${g.a.fid?`<span class="note">${esc(t('rc.finWins'))}</span>`:`<button class="btn ghost sm" data-a="recalc" data-v="${g.a.id}">${esc(t(S.ui.confirm==='rc'+g.a.id?'ti.recalcConfirm':'rc.adopt'))}</button>`}</td></tr>`).join('')}</tbody></table></div><p class="note">${esc(t('rc.histNote'))}</p>`:`<div class="demo-band okb" style="margin:0">${ico('check')}<div>${esc(t((D().iops||[]).length?'rc.histOk':'rc.histNone'))}</div></div>`}</section>`;
  /* 3. cours */
  out+=`<section class="card" style="margin-top:16px"><div class="ch"><div><h2>${esc(t('rc.pxT'))}</h2><p>${esc(t('rc.pxSub'))}</p></div></div>${R.noPx.length?`<div class="list">${R.noPx.map(x=>`<button class="row btnrow" data-a="editHold" data-v="${x.a.id}|${x.h.id}"><span class="av sm" style="--c:var(${x.why==='none'?'--bad':'--warn'})">${ico('alert')}</span><div class="m"><b>${esc(x.h.name)}</b><span>${esc(x.a.name)} · ${esc(t('rc.px.'+x.why,{d:x.h.liveAt?dateT(x.h.liveAt.slice(0,10)):''}))}</span></div><div class="r"><b>${esc(moneyT(+x.h.price||0,2,x.h.cur||x.a.cur))}</b></div></button>`).join('')}</div>`:`<div class="demo-band okb" style="margin:0">${ico('check')}<div>${esc(t('rc.pxOk'))}</div></div>`}</section>`;
  /* 4. comptes non relevés et budget */
  out+=`<div class="grid g2" style="margin-top:16px"><section class="card"><div class="ch"><div><h2>${esc(t('rc.staleT'))}</h2><p>${esc(t('rc.staleSub'))}</p></div></div>${R.stale.length?`<div class="list">${R.stale.map(a=>`<button class="row btnrow" data-a="acc" data-v="${a.id}">${accAvatar(a,1)}<div class="m"><b>${esc(a.name)}</b><span>${esc(t('rc.since',{d:dateT((a.balAt||a.updatedAt||today()).slice(0,10))}))}</span></div><div class="r"><b>${money(accGross(a),2)}</b></div></button>`).join('')}</div>`:`<p class="note">${esc(t('rc.staleOk'))}</p>`}</section>
    <section class="card"><div class="ch"><div><h2>${esc(t('rc.budT'))}</h2><p>${esc(t('rc.budSub'))}</p></div></div><div class="list"><button class="row btnrow" data-a="go" data-v="budget"><span class="av sm" style="--c:var(--warn)">${ico('question')}</span><div class="m"><b>${esc(t('rc.unc',{n:R.unc.length}))}</b><span>${esc(t('rc.uncS'))}</span></div></button><div class="row"><span class="av sm" style="--c:var(--k6)">${ico('swap')}</span><div class="m"><b>${esc(t('rc.dups',{n:R.dups.length}))}</b><span>${esc(R.dups.slice(0,3).map(g=>dateT(g[0].d,'short')+' '+g[0].l.slice(0,24)+' '+moneyT(g[0].a,2)).join(' · ')||t('rc.dupsNone'))}</span></div></div></div></section></div>`;
  return out;
}

/* ---------- méthode ---------- */
const METHOD=[
 ['val',[['m.acc','compte à positions = Σ quantité × cours × change + espèces\ncompte bancaire = dernier solde (Finary ou relevé)\npatrimoine net = Σ actifs − Σ dettes'],['m.pru','achat : coût += quantité × prix + frais + taxes\nvente : coût −= coût × quantité vendue / quantité\nPRU = coût / quantité'],['m.pv','latente = Σ (valeur − coût des lignes détenues)\nréalisée = Σ (produit net de vente − coût sorti)\ntotale = valeur − versements nets'],['m.xirr','Σ CFₖ · (1 + r)^(−jours/365) = 0\nversements < 0, retraits > 0, valeur du jour > 0'],['m.conc','HHI = Σ poids²\nlignes effectives = 1 / HHI']]],
 ['flow',[['m.score','score = 40·R + 35·A + 25·C\nR = 1 − mois sans versement / mois écoulés\nA = min(1, Σ versé / Σ objectif)\nC = max(0, 1 − écart-type / moyenne)'],['m.flux','versements = dépôts sur les enveloppes (PEA, AV…)\n+ achats nets des comptes sans espèces propres\n+ virements « épargne » du budget'],['m.inc','rendement d’une ligne = dividendes par part sur 12 mois\n× quantité actuelle / valeur\n(extrapolé selon la fréquence de distribution)'],['m.mc','v ← (v + versement) · exp(μ − σ²/2 + σ·Z), chaque mois\nμ = ln(1 + rendement − inflation) / 12 ; σ = volatilité / √12\n1 500 trajectoires, euros d’aujourd’hui → P10 / P50 / P90'],['m.fi','capital visé = rente mensuelle × 12 / taux de retrait']]],
 ['data',[['m.sync','Finary : comptes, positions, PRU, cours, opérations\nles comptes synchronisés font foi ; les autres sont saisis ou importés'],['m.check','Σ comptes synchronisés (Vigie) ≟ patrimoine brut Finary\nécart toléré : 0,5 % ou 1 €'],['m.recon','historique rejoué ≟ positions déclarées, ligne par ligne\ncours absent ou ancien (> 7 jours) signalé, jamais estimé']]]
];
function methodView(){
  return `<p class="lead">${esc(t('m.lead'))}</p><div class="grid g3m">${METHOD.map(([g,items])=>`<section class="card"><div class="ch"><h2>${esc(t('m.g.'+g))}</h2></div>${items.map(([k,f])=>`<div class="mth"><h3>${esc(t(k+'.t'))}</h3><pre>${esc(t(k+'.f')===k+'.f'?f:t(k+'.f'))}</pre><p class="note">${esc(t(k+'.n'))}</p></div>`).join('')}</section>`).join('')}</div>
  <section class="card" style="margin-top:16px"><div class="ch"><h2>${esc(t('m.refuseT'))}</h2></div><ul class="notes">${['m.r1','m.r2','m.r3','m.r4'].map(k=>`<li>${esc(t(k))}</li>`).join('')}</ul></section>`;
}
