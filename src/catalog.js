/* ================= V4.2 — catalogue d'actifs automatisé =================
   Collection « catalog » (un document par ISIN) tenue à jour chaque jour par une tâche planifiée :
   cours, historique des dividendes versés (dates de détachement et de paiement, montant brut par titre),
   calendrier attendu par mois de paiement (sched, 12 montants par titre), nature (action, ETF, fonds),
   capitalisation (acc), pays ou zone, secteur, frais courants, sources de recoupement et statut de vérification.
   Ces données priment sur les estimations ; un rendement saisi à la main ne prime que s'il est « forcé ». */
const ACAT={map:new Map(),tk:new Map(),at:0,unsub:null};
function startCatalog(){const db=S.cap.db;if(!db||ACAT.unsub)return;
  try{ACAT.unsub=db.collection('catalog').onSnapshot(snap=>{ACAT.map.clear();ACAT.tk.clear();let at=0;
    snap.docs.forEach(d=>{const c=d.data()||{};const k=String(c.isin||d.id).toUpperCase();ACAT.map.set(k,c);if(c.ticker)ACAT.tk.set(String(c.ticker).toUpperCase(),c);const u=Date.parse(c.upd||c.histDate||0)||0;if(u>at)at=u});
    ACAT.at=at;applyCatalog()},()=>{ACAT.unsub=null})}catch(e){ACAT.unsub=null}}
{const _sb=startBase;startBase=function(){_sb();startCatalog()}}
function catOf(h){if(!h||!ACAT.map.size||h.kind==='fe'||h.kind==='crypto'||h.kind==='metal')return null;
  const i=String(h.isin||'').toUpperCase();if(i&&ACAT.map.has(i))return ACAT.map.get(i);
  if(!i&&h.ticker){const c=ACAT.tk.get(String(h.ticker).toUpperCase());if(c)return c}return null}
const catSched=c=>(Array.isArray(c&&c.sched)?c.sched:[]).map(x=>+x||0);
const catPending=c=>!c||c.status==='pending';
/* rythme des versements (en mois) d'après l'écart médian entre paiements récents */
function catPays(c){return (c&&c.history||[]).filter(p=>!p.special&&+p.amt>0&&(p.pay||p.ex)<=dAdd(today(),45)).map(p=>({d:p.pay||p.ex,amt:+p.amt})).sort((a,b)=>b.d.localeCompare(a.d))}
function catCadence(c){const P=catPays(c).slice(0,13);if(P.length<2)return 0;const g=[];for(let i=1;i<P.length;i++)g.push(daysBetween(P[i].d,P[i-1].d));g.sort((a,b)=>a-b);const m=g[g.length>>1];return m<45?1:m<120?3:m<240?6:12}
function catProj(c){const P=catPays(c),k=catCadence(c);return !!(k&&P.length&&catSched(c).filter(x=>x>0).length<12/k&&P[P.length-1].d>dAdd(today(),-330))}
function catFreq(c){const k=catCadence(c);return k?12/k:(catPays(c).length?1:0)}
function catUpcoming(c){return (c&&c.history||[]).filter(p=>(p.pay||p.ex)>=today()).sort((a,b)=>(a.pay||a.ex).localeCompare(b.pay||b.ex))}
/* rendement d'une ligne d'après le catalogue */
function catDiv(h,a,c){
  if(!c||catPending(c))return null;
  if(c.acc)return {div:0,months:[],src:'cat',acc:1};
  let s=catSched(c),proj=0;
  /* historique plus court qu'un an (fonds qui vient de lancer ou de changer son rythme) : on prolonge le rythme observé sur 12 mois */
  const P=catPays(c),k=catCadence(c),nz=s.filter(x=>x>0).length;
  if(k&&P.length&&nz<12/k&&P[P.length-1].d>dAdd(today(),-330)){const avg=sum(P.slice(0,3).map(p=>p.amt))/Math.min(3,P.length);const m0=+P[0].d.slice(5,7);s=s.map((x,i)=>(((i+1-m0)%k)+k)%k===0?avg:0);proj=1}
  const tot=sum(s);
  if(!(tot>0))return (c.history||[]).length?null:{div:0,months:[],src:'cat'};
  const v=hVal(h,a);if(!(v>0))return null;
  const annual=conv(tot*(+h.qty||0),c.currency||h.cur||a.cur);
  const months=s.map((x,i)=>x>0?i+1:0).filter(Boolean);
  return {div:annual/v*100,months,w:s,src:'cat',est:'',proj,perShare:tot,cur:c.currency||'EUR'};
}
{const _hde=hDivEff;hDivEff=function(h,a){
  if(h.divForce&&+h.div>0)return {div:+h.div,months:h.months||[],src:'manual'};
  const r=catDiv(h,a,catOf(h));if(r)return r;return _hde(h,a)}}
{const _isd=isDistrib;isDistrib=function(h){const c=catOf(h);
  if(c&&!catPending(c)){if(c.acc)return false;if(sum(catSched(c))>0)return +h.qty>0;if(!(c.history||[]).length)return false}
  return _isd(h)}}
/* pays et secteurs du catalogue (libellés français) → codes de l'application */
let CTRYF=null;function ctryCode(name){const n=norm(name||'');if(!n)return null;
  if(!CTRYF){CTRYF=new Map();try{const f=new Intl.DisplayNames(['fr'],{type:'region'});const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ';for(const x of A)for(const y of A){const c=x+y;let l='';try{l=f.of(c)}catch(e){}if(l&&l!==c&&!CTRYF.has(norm(l)))CTRYF.set(norm(l),c)}}catch(e){}
    CTRYF.set('etats unis','US');CTRYF.set('royaume uni','GB');CTRYF.set('pays bas','NL');CTRYF.set('coree du sud','KR')}
  return CTRYF.get(n.replace(/[-’']/g,' ').replace(/\s+/g,' '))||CTRYF.get(n)||null}
const SECTF={'biens essentiels':'consumer','consommation cyclique':'consumer','consommation de base':'consumer','services publics':'utilities','sante':'health','communication':'telecom','telecommunications':'telecom','services financiers':'finance','finance':'finance','energie':'energy','immobilier':'realestate','technologie':'tech','industrie':'industry','materiaux':'materials'};
const ZONEF={'monde':'world','monde developpe':'world','etats unis':'us','marches emergents':'em','europe':'europe','zone euro':'europe','france':'france'};
{const _ex=expoOf;expoOf=function(h){const E=_ex(h);const c=catOf(h);if(!c||E.cls!=='eq')return E;
  if(E.stock){const cc=ctryCode(c.country);const s=SECTF[norm(c.sector||'')];return {...E,c:cc?{[cc]:100}:E.c,s:s?{[s]:100}:E.s,src:cc||s?'cat':E.src}}
  if(E.src==='approx'||E.src==='none'){const z=ZONEF[norm(c.country||'').replace(/-/g,' ')];
    const E2=_ex({...h,name:[h.name,c.name,c.index].filter(Boolean).join(' '),region:z||h.region});if(E2.src!=='none'&&(E2.src!=='approx'||E.src==='none'))return E2}
  return E}}
/* historique de cours du catalogue en secours de la base de cours */
{const _bh=baseHist;baseHist=function(h){const r=_bh(h);if(r.length)return r;const c=catOf(h);if(!c||!c.pxh)return [];
  return Object.entries(c.pxh).filter(([d,v])=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&+v>0).sort((x,y)=>x[0].localeCompare(y[0])).map(([d,v])=>({d,v:+v,cur:c.currency||'EUR'}))}}
/* enrichissement des lignes : frais courants, secteur d'une action, cours de secours hors comptes synchronisés */
function applyCatalog(){
  if(!S.data||!ACAT.map.size)return;let changed=false,px=false;const fx=ST().fx;
  D().accounts.forEach(a=>(a.holdings||[]).forEach(h=>{const c=catOf(h);if(!c)return;
    if(!(+h.ter>0)&&+c.ter>0&&c.ter<0.05){h.ter=+(c.ter*100).toFixed(3);changed=true}
    if(h.kind==='stock'&&(!h.sector||h.sector==='other'||h.sector==='diversified')){const s=SECTF[norm(c.sector||'')];if(s){h.sector=s;changed=true}}
    if(!a.fid&&+c.price>0&&c.priceDate&&!catPending(c)){const la=String(h.liveAt||'').slice(0,10);
      if(!la||la<c.priceDate){const cur=h.cur||a.cur||ST().cur;const p=+c.price*(fx[c.currency||'EUR']??1)/(fx[cur]??1);
        if(Math.abs((+h.price||0)-p)>1e-9){h.price=+p.toFixed(p<1?6:4);px=true}h.liveAt=c.priceDate+'T18:00:00';h.liveSrc='Catalogue · '+(c.source||'').replace(/\s*\(.*$/,'')}}
  }));
  if((changed||px)&&!S.demo)save();
  if(typeof liveDirty==='function')liveDirty();else render();
}
/* libellé de provenance d'un rendement */
function catSrcL(h){const c=catOf(h);if(!c)return '';const n=(c.divSources||[]).length;
  return (c.status==='check'?t('ct.check'):n>=2?t('ct.verN',{n}):n===1?t('ct.ver1',{s:c.divSources[0]}):t('ct.cat'))+(catProj(c)?' · '+t('ct.proj'):'')}
const freqL=f=>f?t('pi.f'+f):'—';
/* fiche du catalogue dans le formulaire d'une ligne */
EXT.holdForm.push((a,h)=>{const c=catOf(h);if(!c)return '';
  const E=catDiv(h,a,c);const up=catUpcoming(c).slice(0,3);const last=(c.history||[]).filter(p=>(p.pay||p.ex)<=today()).slice(0,4);
  const tag=x=>x?`<span class="tag">${esc(x)}</span>`:'';const cur=c.currency||'EUR';
  const amt=v=>new Intl.NumberFormat(loc(),{style:'currency',currency:cur,maximumFractionDigits:4}).format(v);
  return `<div class="f full sect"><span class="lab">${ico('book')} ${esc(t('ct.sec'))}</span></div>
  <div class="f full catf">
    <div class="hrow" style="flex-wrap:wrap;gap:6px">${tag(c.type)}${tag(c.country)}${tag(c.sector&&c.sector!=='À classer'?c.sector:'')}${+c.ter>0?tag(t('ct.ter',{p:pctT(c.ter,2)})):''}${c.acc?tag(t('ct.acc')):''}</div>
    ${c.index?`<p class="note" style="margin:8px 0 0">${esc(c.index)}</p>`:''}
    ${catPending(c)?`<p class="note" style="margin:8px 0 0">${esc(t('ct.pending'))}</p>`:c.acc?`<p class="note" style="margin:8px 0 0">${esc(t('ct.accP'))}</p>`:E&&E.perShare>0?`<div class="kpis k3" style="box-shadow:none;margin:10px 0 0">${kpi(t('ct.perShare'),esc(amt(E.perShare)),freqL(catFreq(c))+(E.proj?' · '+t('ct.proj'):''))}${kpi(t('ct.yield'),E?pctT(E.div/100,2):'—',t('ct.yieldS'))}${kpi(t('ct.line'),E?money(hVal(h,a)*E.div/100,2):'—',t('per.year'))}</div>`:''}
    ${up.length?`<div class="sec-t" style="margin-top:10px"><h2 style="font-size:13px">${esc(t('ct.next'))}</h2></div><div class="list">${up.map(p=>`<div class="row"><div class="m"><b>${esc(amt(+p.amt))} ${esc(t('ct.perSh'))}</b><span>${esc(t('ct.exPay',{e:dateT(p.ex),p:dateT(p.pay||p.ex)}))}</span></div><div class="r"><b>${esc(moneyT(conv(+p.amt*(+h.qty||0),cur),2))}</b></div></div>`).join('')}</div>`:''}
    ${last.length?`<div class="sec-t" style="margin-top:10px"><h2 style="font-size:13px">${esc(t('ct.last'))}</h2></div><div class="list">${last.map(p=>`<div class="row"><div class="m"><b>${esc(amt(+p.amt))} ${esc(t('ct.perSh'))}${p.special?' · '+esc(t('ct.special')):''}</b><span>${esc(t('ct.exPay',{e:dateT(p.ex),p:dateT(p.pay||p.ex)}))}</span></div></div>`).join('')}</div>`:''}
    ${c.status==='check'&&c.checkNote?`<div class="callout" style="margin-top:10px">${ico('alert')} ${esc(c.checkNote)}</div>`:''}
    ${c.note?`<p class="note" style="margin:10px 0 0">${esc(c.note)}</p>`:''}
    <p class="note" style="margin:8px 0 0">${esc(t('ct.src',{s:(c.divSources||[]).join(', ')||'—',d:c.histDate?dateT(c.histDate):'—',p:c.priceDate?dateT(c.priceDate):'—'}))}</p>
  </div>`});
/* revenus passifs : dividendes annoncés dans le détail d'un mois */
{const _pm=EXT.ovl.piMonth;EXT.ovl.piMonth=o=>{const r=_pm(o);const m=o.m;const cy=+today().slice(0,4),cmo=+today().slice(5,7);const y=m>=cmo?cy:cy+1;const ym=y+'-'+String(m).padStart(2,'0');
  const L=[];D().accounts.filter(a=>a.include!==false).forEach(a=>(a.holdings||[]).forEach(h=>{if(!(+h.qty>0))return;const c=catOf(h);if(!c)return;
    catUpcoming(c).filter(p=>String(p.pay||p.ex).slice(0,7)===ym).forEach(p=>L.push({h,a,p,v:conv(+p.amt*(+h.qty),c.currency||'EUR')}))}));
  if(!L.length)return r;
  const blk=`<div class="sec-t" style="margin-top:16px"><h2>${esc(t('ct.annT',{m:monthT(ym)}))}</h2></div><div class="list">${L.sort((x,z)=>(x.p.pay||x.p.ex).localeCompare(z.p.pay||z.p.ex)).map(x=>`<div class="row"><div class="m"><b>${esc(x.h.name)}</b><span>${esc(x.a.name)} · ${esc(t('ct.exPay',{e:dateT(x.p.ex),p:dateT(x.p.pay||x.p.ex)}))}</span></div><div class="r"><b>${esc(moneyT(x.v,2))}</b></div></div>`).join('')}</div>`;
  const i=r.html.indexOf('<div class="sec-t" style="margin-top:16px">');return {...r,html:i>0?r.html.slice(0,i)+blk+r.html.slice(i):r.html+blk}}}
/* un rendement tapé dans le formulaire d'une ligne couverte par le catalogue devient un rendement « forcé » */
EXT.holdSave.push((fd,o)=>{if(o.kind==='fe'||!catOf(o))return;if(+o.div>0)o.divForce=1;else{o.divForce=0;o.div=0}});

/* calendrier des dividendes : versements annoncés et mois de paiement du catalogue (plus fiables que l'estimation) */
{const _dc=divCalendar;divCalendar=function(days=365){const end=dAdd(today(),days);const td=today();const ev=[];const covered=new Set();
  investAccounts().forEach(a=>a.holdings.forEach(h=>{if(h.kind==='fe'||!(+h.qty>0)||(h.divForce&&+h.div>0))return;const c=catOf(h);if(!c||catPending(c)||c.acc)return;
    const E=catDiv(h,a,c);if(!E||!(E.perShare>0))return;covered.add(h);const cur=c.currency||'EUR';const ann=catUpcoming(c).filter(p=>(p.pay||p.ex)>td&&(p.pay||p.ex)<=end);const annM=new Set(ann.map(p=>(p.pay||p.ex).slice(0,7)));
    ann.forEach(p=>ev.push({d:p.pay||p.ex,name:h.name,a,h,amt:conv(+p.amt*(+h.qty),cur),est:false,src:'cat',ex:p.ex}));
    for(let k=0;k<13;k++){const dt=new Date(td+'T12:00:00');dt.setDate(1);dt.setMonth(dt.getMonth()+k);const m=dt.getMonth()+1;const w=E.w[m-1]||0;if(!(w>0))continue;const ym=dt.getFullYear()+'-'+String(m).padStart(2,'0');if(annM.has(ym))continue;
      const last=(c.history||[]).filter(p=>!p.special&&+(String(p.pay||p.ex).slice(5,7))===m).map(p=>+String(p.pay||p.ex).slice(8,10))[0]||15;const d=ym+'-'+String(Math.min(last,28)).padStart(2,'0');if(d>td&&d<=end)ev.push({d,name:h.name,a,h,amt:conv(w*(+h.qty),cur),est:true,src:'cat'})}}));
  return _dc(days).filter(e=>!covered.has(e.h)).concat(ev).sort((x,y)=>x.d.localeCompare(y.d))}}
