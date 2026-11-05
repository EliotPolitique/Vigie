/* ================= V4 — historique reconstitué du patrimoine ================= */
/* Principe (affiché dans l'app) :
   - comptes avec opérations bancaires : solde recalculé à rebours depuis le solde actuel ;
   - portefeuilles avec journal d'opérations : quantités et espèces rejouées jour par jour, cours interpolés
     entre les cours réellement payés lors des achats et ventes, et le cours actuel ;
   - autres comptes : valeur actuelle, à partir de leur date d'ouverture quand elle est connue ;
   - prêts avec échéancier : capital restant dû à chaque date. */
const HB={key:'',res:null};
function hbKey(){const d=D();return [d.txs.length,(d.iops||[]).length,d.accounts.length,d.accounts.reduce((s,a)=>s+(+accValue(a)||0),0).toFixed(2),histOpenSig(),today()].join('|')}
function histOpenSig(){return D().accounts.map(a=>a.opened?a.id+':'+a.opened:'').filter(Boolean).join(',')}
function hbDays(from,to){const out=[];let d=from;while(d<=to){out.push(d);d=dAdd(d,1)}return out}
/* courbe de cours d'une ligne : observations datées, interpolation linéaire */
function pxCurve(obs){obs=obs.filter(o=>o.v>0).sort((a,b)=>a.d.localeCompare(b.d));
  const m=new Map();obs.forEach(o=>m.set(o.d,o.v));const pts=[...m.entries()].map(([d,v])=>({d,t:Date.parse(d+'T12:00:00Z'),v}));
  return d=>{if(!pts.length)return 0;const t=Date.parse(d+'T12:00:00Z');if(t<=pts[0].t)return pts[0].v;const L=pts[pts.length-1];if(t>=L.t)return L.v;
    let lo=0,hi=pts.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(pts[mid].t<=t)lo=mid;else hi=mid}const a=pts[lo],b=pts[hi];return a.v+(b.v-a.v)*(t-a.t)/(b.t-a.t)}}
function holdFor(a,key){return (a.holdings||[]).find(h=>(h.isin&&h.isin===key)||(h.ticker&&(h.ticker===key||pfRoot(h.ticker)===key))||norm(h.name||'')===key)}
/* séries quotidiennes par compte, en devise d'affichage */
function histEngine(){
  const k=hbKey();if(HB.key===k&&HB.res)return HB.res;
  const d=D();const td=today();
  let start=td;d.txs.forEach(x=>{if(x.d<start)start=x.d});(d.iops||[]).forEach(o=>{if(o.d<start)start=o.d});
  const days=hbDays(start,td);const N=days.length;const idx=new Map(days.map((x,i)=>[x,i]));
  const series={};const how={};
  /* compte espèces partagé (ex. Trade Republic) : les achats et ventes d'un compte-titres sans versements propres passent par le compte courant du même établissement */
  const inj=new Map();const instK=a=>norm(a.inst||a.name||'').split(' ')[0];
  d.accounts.filter(a=>a.include!==false&&(TYP[a.type]||{}).h).forEach(a=>{const ops=iopsOf(a.id);if(!ops.length||ops.some(o=>o.t==='dep'||o.t==='wd'))return;
    const twin=d.accounts.find(c=>c.include!==false&&c.type==='checking'&&instK(c)&&instK(c)===instK(a));if(!twin)return;
    const tx=d.txs.filter(x=>x.acc===twin.id);const used=new Set();
    ops.forEach(o=>{if(!['buy','sell','div','int','fee','tax','pl','other'].includes(o.t))return;const v=iopNet(o);if(!v)return;
      const m=tx.find(x=>!used.has(x)&&Math.abs(x.a-v)<0.02&&Math.abs(daysBetween(x.d,o.d))<=3);if(m){used.add(m);return}
      const L=inj.get(twin.id)||[];L.push({d:o.d,a:conv(v,o.cur||a.cur)});inj.set(twin.id,L)})});
  d.accounts.filter(a=>a.include!==false).forEach(a=>{
    const ty=TYP[a.type]||{};const cls=accCls(a);const cur=accValue(a);const arr=new Float64Array(N);
    const from=a.opened&&a.opened>start?a.opened:start;
    const ops=ty.h?iopsOf(a.id):[];const txs=d.txs.filter(x=>x.acc===a.id);
    if(ty.h&&ops.length){
      /* rejouer le portefeuille */
      const seq=[...ops].sort((x,y)=>x.d.localeCompare(y.d)||(x.s||0)-(y.s||0));const own=seq.some(o=>o.t==='dep'||o.t==='wd');
      const obs={};const curOf={};
      seq.forEach(o=>{const kk=iopKey(o);if(!kk)return;if((o.t==='buy'||o.t==='sell')&&+o.px>0)(obs[kk]=obs[kk]||[]).push({d:o.d,v:+o.px});if(o.cur)curOf[kk]=o.cur});
      const curves={};const qty={};let cash=0;let j=0;
      const curveOf=kk=>{if(curves[kk])return curves[kk];const h=holdFor(a,kk);const L=(obs[kk]||[]).slice();if(h&&+h.price>0){L.push({d:td,v:+h.price});if(+h.prevPx>0)L.push({d:dAdd(td,-1),v:+h.prevPx});if(h.cur)curOf[kk]=h.cur}return curves[kk]=pxCurve(L)};
      for(let i=0;i<N;i++){const day=days[i];
        while(j<seq.length&&seq[j].d<=day){const o=seq[j++];const kk=iopKey(o);const q=Math.abs(+o.q||0);cash+=iopNet(o);
          if(kk&&(o.t==='buy'||o.t==='in'))qty[kk]=(qty[kk]||0)+q;else if(kk&&(o.t==='sell'||o.t==='out'))qty[kk]=Math.max(0,(qty[kk]||0)-q)}
        let v=own?cash:0;for(const kk in qty){if(qty[kk]>1e-9)v+=conv(qty[kk]*curveOf(kk)(day),curOf[kk]||a.cur)}
        arr[i]=v}
      /* raccord au solde réel du jour (positions synchronisées, frais non journalisés…) */
      const gap=cur-arr[N-1];how[a.id]={m:'replay',gap};
      if(Math.abs(gap)>0.005){let firstOp=idx.get(seq[0].d)??0;const span=Math.max(1,N-1-firstOp);for(let i=firstOp;i<N;i++)arr[i]+=gap*(i-firstOp)/span}
    }else if((txs.length||inj.has(a.id))&&!ty.h&&cls!=='debt'&&a.type!=='card'){
      /* solde bancaire à rebours (une carte de paiement type PayPal est alimentée au fil de l'eau : valeur actuelle) */
      const byDay=new Map();txs.forEach(x=>byDay.set(x.d,(byDay.get(x.d)||0)+conv(+x.a||0,a.cur)));(inj.get(a.id)||[]).forEach(x=>byDay.set(x.d,(byDay.get(x.d)||0)+x.a));
      let b=cur;for(let i=N-1;i>=0;i--){arr[i]=b;b-=byDay.get(days[i])||0}
      how[a.id]={m:'back',neg:Math.min(0,...arr)}
    }else if(a.ls&&+a.ls.p>0&&typeof loanSchedule==='function'){
      const R=loanSchedule(a.ls).rows;let p=0,bal=+a.ls.p||0;for(let i=0;i<N;i++){const day=days[i];while(p<R.length&&R[p].d<=day){bal=R[p].bal;p++}arr[i]=day<(a.ls.start||'')?0:-Math.abs(bal)}how[a.id]={m:'loan'}
    }else{
      for(let i=0;i<N;i++)arr[i]=days[i]>=from?cur:0;how[a.id]={m:'const',from}
    }
    /* rien avant la date d'ouverture déclarée du compte */
    if(a.opened&&a.opened>start){for(let i=0;i<N&&days[i]<a.opened;i++)arr[i]=0;if(how[a.id])how[a.id].opened=a.opened}
    series[a.id]={cls,arr}});
  HB.key=k;HB.res={days,series,how,start};return HB.res;
}
/* lignes d'historique (mêmes colonnes que les instantanés réels) */
function histRows(){const E=histEngine();const rows=[];const N=E.days.length;
  const keep=i=>i>=N-200||i%7===0||i===0;/* quotidien sur ~6 mois, hebdomadaire avant */
  for(let i=0;i<N;i++){if(!keep(i))continue;const r={d:E.days[i]};CLASSES.forEach(c=>r[c.k]=0);let g=0,db=0;
    for(const id in E.series){const S=E.series[id];const v=S.arr[i];if(S.cls==='debt'){db+=-v;r.debt+=v}else{g+=v;r[S.cls]=(r[S.cls]||0)+v}}
    CLASSES.forEach(c=>r[c.k]=r2(r[c.k]));r.g=r2(g);r.db=r2(Math.abs(db));r.nw=r2(g-Math.abs(db));rows.push(r)}
  return rows}
function histRebuild(manual){
  const d=D();if(!d||S.demo&&!manual)return 0;if(!d.txs.length&&!(d.iops||[]).length){if(manual)toast(t('hb.none'),true);return 0}
  const real=(d.history||[]).filter(h=>!h.r);const firstReal=real.length?real[0].d:today();
  const rows=histRows().filter(r=>r.d<firstReal).map(r=>Object.assign(r,{r:1}));
  d.history=[...rows,...real].sort((a,b)=>a.d.localeCompare(b.d));
  ST().histRebuild={at:new Date().toISOString(),n:rows.length,from:rows.length?rows[0].d:null,to:firstReal,sig:histOpenSig()};
  save();if(manual){render();toast(t('hb.done',{n:rows.length,d:rows.length?dateT(rows[0].d):'—'}))}
  return rows.length}
/* les lignes reconstituées sont marquées (colonne r) ; anciennes données sans marque : reconstruction à la demande */
EXT.boot.push(d=>{(d.history||[]).forEach(h=>{if(h.r==null)h.r=0})});
EXT.A.histRebuild=()=>histRebuild(true);
/* première ouverture de la V4 : reconstitution automatique si l'historique est quasi vide */
EXT.boot.push(d=>setTimeout(()=>{try{if(S.phase==='app'&&!S.demo&&D()===d&&!ST().histRebuild&&(d.history||[]).length<20&&(d.txs.length||(d.iops||[]).length)){histRebuild(false);render()}}catch(e){console.warn(e)}},1500));

/* série d'un compte ou d'un groupe de comptes (pour les pages d'enveloppe et de compte) */
function accHist(ids,step){const E=histEngine();const N=E.days.length;const out=[];step=step||1;
  for(let i=0;i<N;i++){if(i%step&&i!==N-1)continue;let v=0;ids.forEach(id=>{const S=E.series[id];if(S)v+=S.arr[i]});out.push({d:E.days[i],v:r2(v)})}
  /* on retire la période antérieure à la première valeur non nulle */
  const f=out.findIndex(p=>Math.abs(p.v)>0.004);return f>0?out.slice(Math.max(0,f-1)):out}
function histChartCard(ids,title){const pts=accHist(ids,1);if(pts.length<3)return '';
  const sp=pts.length>400?pts.filter((p,i)=>i%3===0||i===pts.length-1):pts;
  return `<div class="card"><div class="ch"><div><h2>${esc(title||t('hb.accT'))}</h2><p>${esc(t('hb.accS',{d:dateT(sp[0].d)}))}</p></div></div>${chart({h:190,series:[{pts:sp,c:'var(--accent)'}],xl:i=>dateT(sp[i].d,'my'),tip:i=>richTip(sp,i,2)})}</div>`}

/* ---------- comparaison avec le Livret A ---------- */
/* mêmes versements nets placés au Livret A (taux historiques, intérêts mensualisés : approximation des quinzaines) */
function livretBench(ids){const ops=ids.flatMap(id=>iopsOf(id)).filter(o=>o.t==='dep'||o.t==='wd').sort((a,b)=>a.d.localeCompare(b.d));if(!ops.length)return null;
  let bal=0,net=0;let m=ops[0].d.slice(0,7);const end=today().slice(0,7);let j=0;
  while(m<=end){while(j<ops.length&&ops[j].d.slice(0,7)===m){const v=iopNet(ops[j]);bal+=v;net+=v;j++}
    const r=livretAAt(m+'-15')/100;if(m<end)bal*=1+r/12;m=ymAdd(m,1)}
  return {bal:r2(bal),net:r2(net),from:ops[0].d}}
function benchCard(ids){const B=livretBench(ids);if(!B)return '';const val=sum(ids.map(id=>{const a=D().accounts.find(x=>x.id===id);return a?accValue(a):0}));const diff=val-B.bal;
  return `<div class="card"><div class="ch"><div><h2>${esc(t('hb.benchT'))}</h2><p>${esc(t('hb.benchS',{d:dateT(B.from)}))}</p></div></div>
  <div class="wkv"><div><span>${esc(t('hb.benchNet'))}</span><b>${money(B.net,2)}</b></div><div><span>${esc(t('hb.benchYou'))}</span><b>${money(val,2)}</b></div><div><span>${esc(t('hb.benchLA'))}</span><b>${money(B.bal,2)}</b></div><div><span>${esc(t('hb.benchDiff'))}</span><b class="${cls(diff)}">${moneyS(diff,2)}</b></div></div>
  <p class="note" style="margin-top:10px">${esc(t('hb.benchNote'))}</p></div>`}

/* ---------- intégration ---------- */
/* Performance : historique de la valeur investie et comparaison Livret A */
const _pfv=perfView;perfView=function(){const h=_pfv();const ids=invAccs().map(a=>a.id);if(!ids.length)return h;
  return h+`<div class="grid g2" style="margin-top:16px">${histChartCard(ids,t('hb.invT'))||'<div></div>'}${benchCard(ids)||'<div></div>'}</div>`+histInfoCard()};
function histInfoCard(){const H=ST().histRebuild;
  return `<div class="card" style="margin-top:16px"><div class="ch"><div><h2>${esc(t('hb.t'))}</h2><p>${esc(H&&H.n?t('hb.s',{n:H.n,d:dateT(H.from),r:dateT(H.to)}):t('hb.s0'))}</p></div><button class="btn sec sm" data-a="histRebuild">${ico('refresh')}${esc(t('hb.btn'))}</button></div><p class="note" style="margin:0">${esc(t('hb.how'))}</p></div>`}
/* une date d'ouverture ajoutée ou modifiée : l'historique reconstitué est refait */
function histOpenCheck(){try{const d=D();if(!d||S.demo||S.phase!=='app'||!ST().histRebuild)return;if((ST().histRebuild.sig||'')===histOpenSig())return;if(!(d.history||[]).some(h=>h.r))return;histRebuild(false);render()}catch(e){console.warn(e)}}
EXT.boot.push(d=>setTimeout(()=>{if(D()===d)histOpenCheck()},2500));
EXT.accSave.push(()=>{setTimeout(histOpenCheck,300)});
EXT.boot.push(d=>{if(!STORE.patched)return;STORE.patched=0;setTimeout(()=>{if(S.data!==d)return;save();Promise.resolve(typeof flush==='function'?flush():0).then(()=>STORE.db.doc(P('patch')).delete()).catch(()=>{})},1000)});
