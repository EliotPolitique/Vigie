/* ================= V5.5 — objectif « revenus passifs » =================
   Jauge des revenus passifs estimés (dividendes, coupons, intérêts des livrets et du compte espèces,
   fonds euros, loyers, financement participatif… : tout ce que compte passiveIncome()), exprimés par an,
   semestre, trimestre ou mois. Paliers de 10 € : dès qu'un palier est atteint, la jauge passe au suivant.
   Échelle jusqu'à la liberté financière : tes dépenses réelles (12 derniers mois) couvertes poste par poste,
   du plus petit au plus gros, jusqu'à 100 % de tes dépenses. */
const PIG_PER={year:12,half:6,quarter:3,month:1},PIG_STEP=10;
const pgCfg=()=>{const s=ST();if(!s.pig||typeof s.pig!=='object')s.pig={};const c=s.pig;if(!PIG_PER[c.per])c.per='month';if(!c.hist||typeof c.hist!=='object')c.hist={};return c};
/* dépenses mensuelles moyennes par poste, sur les 12 derniers mois complets */
function pgSpend(){const end=today().slice(0,7);const ms=[];for(let i=1;i<=12;i++)ms.push(ymAdd(end,-i));
  const list=D().txs.filter(x=>ms.includes(ymOf(x.d)));const nm=Math.max(1,new Set(list.map(x=>ymOf(x.d))).size);
  const cs=catSpend(list);return Object.entries(cs).map(([k,e])=>({k,v:e.v/nm})).filter(x=>x.v>0.5).sort((a,b)=>a.v-b.v)}
function pgModel(){const C=pgCfg();const f=PIG_PER[C.per];const pi=passiveIncome();
  const cur=pi.total*f/12;const rec=(()=>{try{const r=incomeReceived();return (r.total||0)*f/12}catch(e){return null}})();
  const sp=pgSpend();const free=sum(sp.map(x=>x.v))*f;
  const lvl=Math.floor(cur/PIG_STEP+1e-9)*PIG_STEP,target=lvl+PIG_STEP,inStep=(cur-lvl)/PIG_STEP;
  /* rendement moyen des placements qui rapportent, pour traduire l'écart en capital à investir */
  /* rendement moyen des seuls placements qui rapportent (lignes de passiveIncome), pour traduire l'écart en capital à investir */
  const base=sum(pi.lines.map(l=>{try{return l.h?hVal(l.h,l.acc):accGross(l.acc)}catch(e){return 0}}));
  const yld=base>0?pi.total/base:0;const gap=target-cur;const capGap=yld>0?gap*12/f/yld:null;
  let acc=0;const rungs=sp.map(x=>{acc+=x.v*f;return {k:x.k,v:acc,own:x.v*f}}).filter(r=>r.k!=='uncat'&&r.k!=='otherOut');
  return {per:C.per,f,cur,rec,lvl,target,inStep,free,freePct:free>0?cur/free:0,yld,capGap,gap,rungs,pi}}
/* paliers franchis : date du premier passage, notification la première fois */
function pgCheck(){if(!S.data||S.demo)return;const C=pgCfg();let M;try{M=pgModel()}catch(e){return}const H=C.hist[C.per]=C.hist[C.per]||{};let ch=false;const first=!Object.keys(H).length;
  for(let v=PIG_STEP;v<=M.lvl&&v<=100000;v+=PIG_STEP)if(!H[v]){H[v]=today();ch=true;if(!first&&v===M.lvl)pushNotif('badge',t('pg.nT',{v:moneyT(v,0),p:t('pg.u.'+C.per)}),t('pg.nB',{n:moneyT(v+PIG_STEP,0),p:t('pg.u.'+C.per)}),'go','goals')}
  if(ch)save()}
EXT.A.pigPer=v=>{if(!PIG_PER[v])return;pgCfg().per=v;save();pgCheck();render()};
function pgGauge(p,label,sub){const R=86,cx=110,cy=100,a0=Math.PI,a1=a0+Math.PI*clamp(p,0,1);const pt=a=>[cx+R*Math.cos(a),cy+R*Math.sin(a)];
  const [x0,y0]=pt(a0),[x1,y1]=pt(a1),[xe,ye]=pt(2*Math.PI);
  return `<svg viewBox="0 0 220 132" style="width:100%;max-width:300px;display:block;margin:0 auto" role="img" aria-label="${esc(label)}">
    <path d="M${x0} ${y0} A${R} ${R} 0 0 1 ${xe} ${ye}" fill="none" stroke="var(--surface3,#e5e7eb)" stroke-width="16" stroke-linecap="round"/>
    ${p>0.002?`<path d="M${x0} ${y0} A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}" fill="none" stroke="var(--good)" stroke-width="16" stroke-linecap="round"/>`:''}
    <text x="${cx}" y="${cy-12}" text-anchor="middle" style="font:700 28px var(--display,Inter);fill:var(--text)">${esc(label)}</text>
    <text x="${cx}" y="${cy+26}" text-anchor="middle" style="font:500 12px Inter;fill:var(--muted)">${esc(sub)}</text></svg>`}
function pgCardHTML(){let M;try{M=pgModel()}catch(e){return ''}const C=pgCfg();const H=C.hist[C.per]||{};const u=t('pg.u.'+C.per);const mt=v=>moneyT(v,v<100?2:0);
  const chips=seg('pigPer',Object.keys(PIG_PER).map(k=>[k,t('pg.p.'+k)]),C.per,t('pg.title'));
  /* échelle : paliers franchis récents, palier visé, paliers suivants, postes de dépenses couverts, liberté financière */
  const R=[];Object.keys(H).map(Number).sort((a,b)=>b-a).slice(0,3).forEach(v=>R.push({v,l:t('pg.step',{v:moneyT(v,0),p:u}),s:t('pg.done',{d:dateT(H[v])}),st:'done'}));
  R.push({v:M.target,l:t('pg.step',{v:moneyT(M.target,0),p:u}),s:t('pg.missing',{v:mt(M.gap)})+(M.capGap?' · '+t('pg.cap',{v:moneyT(M.capGap,0),y:pctT(M.yld,1)}):''),st:'cur'});
  for(let i=1;i<=2;i++)R.push({v:M.target+PIG_STEP*i,l:t('pg.step',{v:moneyT(M.target+PIG_STEP*i,0),p:u}),st:'next'});
  M.rungs.forEach((r,i)=>{if(i===M.rungs.length-1)return;R.push({v:r.v,l:t('pg.cover',{c:catL(r.k)}),s:t('pg.coverS',{v:mt(r.v),o:mt(r.own),p:u}),st:M.cur>=r.v?'done':'goal',ic:(CAT[r.k]||{}).ic})});
  if(M.free>0)R.push({v:M.free,l:t('pg.free'),s:t('pg.freeS',{v:mt(M.free),p:u}),st:M.cur>=M.free?'done':'top'});
  R.sort((a,b)=>b.v-a.v);
  const col={done:'var(--good)',cur:'var(--accent)',next:'var(--muted)',goal:'var(--k3)',top:'var(--warn)'};
  const ladder=`<div class="pgl">${R.map(r=>`<div class="pgr ${r.st}"><span class="pgd" style="--c:${col[r.st]}">${r.st==='done'?ico('check'):r.st==='top'?ico('spark'):r.ic?ico(r.ic):''}</span><div class="m"><b>${esc(r.l)}</b>${r.s?`<span>${esc(r.s)}</span>`:''}</div><div class="r">${esc(mt(r.v))}</div></div>`).join('')}</div>`;
  return `<div class="card" style="margin-bottom:16px"><div class="ch" style="flex-wrap:wrap;gap:10px"><div><h2>${ico('coins')} ${esc(t('pg.title'))}</h2><p>${esc(t('pg.sub'))}</p></div>${chips}</div>
   <div class="grid g2" style="align-items:start">
    <div>${pgGauge(M.inStep,mt(M.cur),t('pg.of',{v:moneyT(M.target,0),p:u}))}
      <div style="text-align:center;margin-top:6px"><b>${esc(pctT(M.inStep,0))}</b> <span class="muted">${esc(t('pg.toStep',{v:moneyT(M.target,0)}))}</span></div>
      <div style="margin-top:16px"><div class="hrow" style="justify-content:space-between"><span class="muted">${esc(t('pg.freeBar'))}</span><b>${esc(pctT(M.freePct,1))}</b></div>
        <div class="bar" style="height:10px;border-radius:6px;background:var(--surface3,#e5e7eb);overflow:hidden;margin-top:6px"><i style="display:block;height:100%;width:${(clamp(M.freePct,0,1)*100).toFixed(2)}%;background:var(--good)"></i></div>
        <p class="note" style="margin-top:8px">${esc(t('pg.note',{r:M.rec!=null?mt(M.rec):'—',p:u}))}</p></div></div>
    <div>${ladder}</div></div></div>`}
{const _gv=goalsView;goalsView=function(){try{pgCheck()}catch(e){}return pgCardHTML()+_gv()}}
EXT.boot.push(d=>{setTimeout(()=>{if(S.data===d)try{pgCheck()}catch(e){}},12000)});
