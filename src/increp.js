/* ================= V5.2 — rapports de revenus (intérêts, dividendes) : brut, prélèvements, taux ================= */
/* Lit les « rapports d'intérêts » et avis de « dividende en espèces » (Trade Republic) — en PDF importé, déposé dans le dossier Drive,
   ou transmis en texte par la tâche mensuelle — et complète l'opération correspondante déjà présente (montant net) avec
   le montant brut, les prélèvements sociaux, l'impôt retenu à l'étranger et le taux. Jamais de doublon : un rapport sans
   opération correspondante attend (l'export CSV peut arriver plus tard) ; un intérêt toujours sans opération 10 jours
   après sa date est ajouté. */
const incNum=s=>{s=String(s||'').replace(/[\s  ]/g,'').replace('−','-');const c=s.lastIndexOf(','),d=s.lastIndexOf('.');if(c>d)s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'');const v=parseFloat(s);return isFinite(v)?v:NaN};
const incDate=s=>{const m=String(s||'').match(/(\d{2})[\/.](\d{2})[\/.](\d{4})/);return m?m[3]+'-'+m[2]+'-'+m[1]:null};
const incR2=v=>Math.round(v*100)/100;
function incParse(text,name){
  const T=String(text||'');if(!/trade\s*republic/i.test(T))return null;
  const L=T.split(/\r?\n/).map(l=>l.replace(/[\s  ]+/g,' ').trim()).filter(Boolean);
  const N='(-?[\\d.,]+)';const amt=(re,cur)=>{for(const l of L){const m=l.match(re);if(m){const v=incNum(m[1]);if(isFinite(v))return v}}return NaN};
  const after=(re,re2)=>{const i=L.findIndex(l=>re.test(l));if(i<0)return null;for(let j=i;j<Math.min(L.length,i+4);j++){const m=L[j].match(re2);if(m)return m}return null};
  const doc=String(name||'').slice(0,80);
  /* ---- rapport d'intérêts (compte espèces) ---- */
  if(/RAPPORT D.INT[ÉE]R[ÊE]TS/i.test(T)){
    const rates=[];L.forEach(l=>{const m=l.match(/(\d{1,2}[.,]\d{1,3}) ?% (\d{2}\/\d{2}\/\d{4}) ?- ?(\d{2}\/\d{2}\/\d{4})/);if(m)rates.push([incNum(m[1]),incDate(m[2]),incDate(m[3])])});
    let brut=amt(new RegExp('Base fiscale '+N+' ?EUR','i'));if(!isFinite(brut))brut=amt(new RegExp('^Esp[èe]ces Int[ée]r[êe]ts.*? '+N+' ?EUR$','i'));
    const ps=Math.abs(amt(new RegExp('Pr[ée]l[èe]vements sociaux '+N+' ?EUR','i'))||0);
    const ir=Math.abs(amt(new RegExp('(?:Pr[ée]l[èe]vement forfaitaire|Imp[ôo]t sur le revenu|Acompte d.imp[ôo]t)[^\\d-]*'+N+' ?EUR','i'))||0);
    const m=after(/DATE D.EFFET/i,/(\d{2}\/\d{2}\/\d{4}) (-?[\d.,]+) ?EUR$/);
    const d=m?incDate(m[1]):incDate((T.match(/DATE (\d{2}\/\d{2}\/\d{4})/)||[])[1]);let net=m?incNum(m[2]):NaN;
    if(!isFinite(brut)||!d)return null;if(!isFinite(net))net=incR2(brut-ps-ir);
    const per=rates.length?[rates[0][1],rates[rates.length-1][2]]:null;
    return {k:'int',bank:'Trade Republic',d,b:incR2(brut),ps:incR2(ps||0),ir:incR2(ir||0),w:0,n:incR2(net),rt:rates,per,doc}}
  /* ---- dividende / distribution en espèces (compte-titres, PEA) ---- */
  if(/\b(DIVIDENDE|DISTRIBUTION)\b/.test(T)&&/R[ÉE]CAPITULATIF/.test(T)&&/POSITION/.test(T)){
    const isin=(T.match(/\b([A-Z]{2}[A-Z0-9]{9}\d)\b/)||[])[1]||'';
    const hi=L.findIndex(l=>/^POSITION .*QUANTIT[ÉE]/i.test(l));let nm='',g0=NaN,c0='EUR';
    if(hi>=0){const m=(L[hi+1]||'').match(/^(.*\S) ([\d.,]+) ([A-Z]{3})$/);if(m){nm=m[1].replace(/ [\d.,]+ (?:titre\(s\)|unit\.?).*$/i,'').trim();g0=incNum(m[2]);c0=m[3]}}
    const q=T.match(/([\d.,]+) ?(?:unit\.?|titre\(s\)) ?([\d.,]+) ([A-Z]{3})/i);
    if(!isFinite(g0)){const m=T.match(/TOTAL ([\d.,]+) ([A-Z]{3})/);if(m){g0=incNum(m[1]);c0=m[2]}}
    const fxm=T.match(/([\d.,]+) (?:([A-Z]{3})\/EUR|EUR\/([A-Z]{3}))\b/);const fx=fxm&&(fxm[2]||fxm[3])===c0?incNum(fxm[1]):(c0==='EUR'?1:NaN);
    let w=0;L.forEach(l=>{const m=l.match(/^(?:(?:Imp[ôo]t|Imposition|Retenue) (?:à|a) la source|Quellensteuer)[^\d-]*?(-?[\d.,]+) ([A-Z]{3})$/i);if(m){const v=Math.abs(incNum(m[1]));w+=m[2]==='EUR'?v:(isFinite(fx)&&fx>0?v/fx:NaN)}});
    const ps=Math.abs(amt(/Pr[ée]l[èe]vements sociaux.*? (-?[\d.,]+) ?EUR$/i)||0);
    const ir=Math.abs(amt(/(?:Pr[ée]l[èe]vement forfaitaire|Imp[ôo]t sur le revenu|Acompte d.imp[ôo]t)[^\d-]*?(-?[\d.,]+) ?EUR$/i)||0);
    const pm=after(/DATE DE (?:PAIEMENT|VALEUR)/i,/(\d{2}[.\/]\d{2}[.\/]\d{4}) (-?[\d.,]+) ?EUR$/);const d=pm?incDate(pm[1]):null;const net=pm?incNum(pm[2]):NaN;
    const ex=incDate((T.match(/(?:date d.ex[ée]cution au|à la date du) -?(\d{2}[.\/]\d{2}[.\/]\d{4})/i)||[])[1]);
    if(!d||!isFinite(net)||!isFinite(g0))return null;
    const b=c0==='EUR'?g0:(isFinite(fx)&&fx>0?g0/fx:NaN);if(!isFinite(b))return null;
    /* retenue étrangère en euros : écart entre le brut converti et le sous-total en euros après retenue */
    const subE=L.map(l=>l.match(/^Sous-total.*? (-?[\d.,]+) ?EUR$/i)).filter(Boolean).map(m=>incNum(m[1])).pop();if(w>0&&isFinite(subE)&&subE<=b)w=b-subE;
    return {k:'div',bank:'Trade Republic',d,ex,isin,name:nm,qty:q?incNum(q[1]):null,unit:q?incNum(q[2]):null,c0,g0:incR2(g0),fx:c0==='EUR'?null:fx,
      b:incR2(b),w:incR2(isFinite(w)?w:0),ps:incR2(ps),ir:incR2(ir),n:incR2(net),doc}}
  return null}

/* ---------- rapprochement avec les opérations de Vigie ---------- */
const incKey=r=>r.k+'|'+r.d+'|'+r.n.toFixed(2)+'|'+(r.isin||'');
const incCfg=()=>{const s=ST();if(!s.incRep||typeof s.incRep!=='object')s.incRep={};const c=s.incRep;if(!Array.isArray(c.wait))c.wait=[];if(!Array.isArray(c.miss))c.miss=[];delete c.done;return c};
const incSlim=r=>{const o={b:r.b,ps:r.ps,ir:r.ir,w:r.w,n:r.n,doc:r.doc};if(r.rt&&r.rt.length)o.rt=r.rt;if(r.per)o.per=r.per;if(r.fx)o.fx=r.fx;if(r.c0&&r.c0!=='EUR'){o.c0=r.c0;o.g0=r.g0}if(r.qty)o.q=r.qty;if(r.unit)o.u=r.unit;return o};
function incCashAcc(bank){const re=new RegExp(bank.replace(/\s+/g,' ?'),'i');return D().accounts.find(a=>(a.type==='checking'||a.type==='savings')&&re.test((a.inst||'')+' '+a.name)&&!isClosed(a))||D().accounts.find(a=>(a.type==='checking'||a.type==='savings')&&re.test((a.inst||'')+' '+a.name))}
function incMatch(r){
  const near=(d,k)=>Math.abs(daysBetween(d,r.d))<=k;
  if(r.k==='int'){const a=incCashAcc(r.bank);if(!a)return null;
    const c=D().txs.filter(x=>x.acc===a.id&&x.a>0&&Math.abs(x.a-r.n)<0.006&&near(x.d,3)&&(!x.rep||x.rep.doc===r.doc||incKey({k:'int',d:x.d,n:x.rep.n})===incKey(r)));
    c.sort((x,y)=>Math.abs(daysBetween(x.d,r.d))-Math.abs(daysBetween(y.d,r.d))||(/interest|int[eé]r/i.test(y.l)-/interest|int[eé]r/i.test(x.l)));return c[0]?{tx:c[0],acc:a}:{acc:a}}
  const nm=norm(r.name||'');
  const io=(D().iops||[]).filter(o=>o.t==='div'&&((r.isin&&o.isin===r.isin)||(nm&&norm(o.n||'')===nm))&&(near(o.d,7)||(r.ex&&Math.abs(daysBetween(o.d,r.ex))<=3))&&(Math.abs(iopNet(o)-r.n)<0.021||Math.abs((+o.amt||0)-(r.b-r.w))<0.021));
  io.sort((x,y)=>Math.abs(iopNet(x)-r.n)-Math.abs(iopNet(y)-r.n));if(io[0])return {io:io[0]};
  const tx=D().txs.filter(x=>x.a>0&&x.c==='investIncome'&&Math.abs(x.a-r.n)<0.011&&near(x.d,7)&&!x.rep);if(tx[0])return {tx:tx[0]};
  return null}
/* applique une liste de rapports ; renvoie le nombre d'opérations complétées, ajoutées, en attente */
function incApply(reps){const C=incCfg();let upd=0,add=0,same=0;const keep=[];const now=today();
  const all=[...C.wait,...reps];const seen=new Set();
  all.forEach(r=>{if(!r||!r.k||!r.d||!isFinite(r.n))return;const k=incKey(r);if(seen.has(k))return;seen.add(k);
    const m=incMatch(r);const s=incSlim(r);
    if(m&&m.io){const before=JSON.stringify(m.io.rep||null);m.io.rep=s;if(before===JSON.stringify(s))same++;else upd++;return}
    if(m&&m.tx){const before=JSON.stringify(m.tx.rep||null);m.tx.rep=s;if(m.tx.c==='uncat'||!m.tx.c)m.tx.c='investIncome';if(before===JSON.stringify(s))same++;else upd++;return}
    if(r.k==='int'&&m&&m.acc&&daysBetween(r.d,now)>=10){D().txs.push({id:'rep-'+m.acc.id.slice(-5)+'-'+r.d.replace(/-/g,''),d:r.d,a:r.n,l:t('ir.txL',{b:r.bank}),c:'investIncome',acc:m.acc.id,rep:s,src:'pdf'});add++;return}
    if(daysBetween(r.d,now)>45){if(!C.miss.some(x=>incKey(x)===k))C.miss.push(r);return}
    keep.push(r)});
  C.wait=keep.slice(-80);C.miss=C.miss.slice(-30);
  if(upd||add)C.at=new Date().toISOString();
  return {upd,add,same,wait:C.wait.length,miss:C.miss.length}}
let incToastT=null,incAcc={upd:0,add:0,same:0,n:0};
function incApplyUI(reps){const r=incApply(reps);['upd','add','same'].forEach(k=>incAcc[k]+=r[k]);incAcc.n+=reps.length;incAcc.wait=r.wait;save();
  clearTimeout(incToastT);incToastT=setTimeout(()=>{const a=incAcc;incAcc={upd:0,add:0,same:0,n:0};toast(t('ir.done',{n:a.n,u:a.upd+a.same,a:a.add,w:a.wait||0}));render()},500)}

/* ---------- PDF importés (bouton Importer, dossier Drive « Vigie — dépôt ») ---------- */
const INC_CACHE=new WeakMap();
{const _rp=readPdf;readPdf=async function(file,password){const c=INC_CACHE.get(file);if(c&&(c.pwd||'')===(password||'')){INC_CACHE.delete(file);return c}return _rp(file,password)}}
{const _ni=nextImport;nextImport=async function(f0){const I=S.ui.imp;if(!I)return _ni(f0);const f=f0||I.queue[0];
  if(!f||!(/\.pdf$/i.test(f.name||'')||f.type==='application/pdf')||f.size>15e6)return _ni(f0);
  let r=null;try{r=await readPdf(f,f0?I.pwd:'')}catch(e){return _ni(f0)}
  let rep=null;try{rep=incParse(r.text,f.name)}catch(e){}
  if(!rep){INC_CACHE.set(f,r);return _ni(f0)}
  if(!f0)I.queue.shift();incApplyUI([rep]);return nextImport()}}

/* ---------- textes transmis par la tâche mensuelle (patch.incTxt) ---------- */
/* lus tout de suite et mis en attente dans les réglages (le document patch est supprimé une seconde après l'ouverture), puis rapprochés */
EXT.boot.push(d=>{if(S.demo)return;const L=STORE.incPend;STORE.incPend=null;let n=0;
  if(Array.isArray(L)&&L.length){const C=incCfg();const ks=new Set(C.wait.map(incKey));L.forEach(x=>{try{const r=incParse(x.t,x.n);if(r&&!ks.has(incKey(r))){C.wait.push(r);ks.add(incKey(r));n++}}catch(e){}})}
  setTimeout(()=>{if(S.data!==d)return;const C=incCfg();if(!C.wait.length)return;
    try{const r=incApply([]);save();if(n||r.upd||r.add)toast(t('ir.done',{n:n||r.upd+r.add,u:r.upd+r.same,a:r.add,w:r.wait}))}catch(e){console.error(e)}},4000)});

/* ---------- affichage ---------- */
/* complément d'une ligne de revenu : brut, retenues, taux */
function incRepTxt(rep){if(!rep)return '';const p=[t('ir.brut',{v:moneyT(rep.b,2)})];const ret=(rep.ps||0)+(rep.ir||0)+(rep.w||0);
  if(ret>0.004)p.push(t('ir.ret',{v:moneyT(ret,2)}));if(rep.rt&&rep.rt.length)p.push(t('ir.rate',{r:numT(rep.rt[rep.rt.length-1][0],2)}));return p.join(' · ')}
{const _rl=receivedList;receivedList=function(from,to){const out=_rl(from,to);
  /* retrouve le rapport attaché à chaque revenu (opération de portefeuille ou bancaire) */
  const io=(D().iops||[]).filter(o=>o.rep&&o.d>=from&&o.d<=to),tx=D().txs.filter(x=>x.rep&&x.d>=from&&x.d<=to);
  out.forEach(r=>{const o=io.find(o=>o.d===r.d&&Math.abs(conv(iopNet(o),o.cur||(r.acc||{}).cur)-r.v)<0.011)||tx.find(x=>x.d===r.d&&Math.abs(x.a-r.v)<0.011);if(o)r.rep=o.rep;
    /* libellé technique de la banque (« Interest payment for payout collection … ») remplacé par un nom lisible */
    if(r.type==='int'&&/^interest payment|^zinszahlung/i.test(r.name)&&r.acc)r.name=t('ir.intN',{a:r.acc.name})});return out}}
/* bilan des 12 derniers mois : brut, prélèvements sociaux, impôt étranger */
function incSum(L){const k=L.filter(r=>r.rep);return {n:k.length,all:L.length,b:sum(k.map(r=>r.rep.b)),net:sum(k.map(r=>r.rep.n)),ps:sum(k.map(r=>r.rep.ps||0)),w:sum(k.map(r=>r.rep.w||0)),ir:sum(k.map(r=>r.rep.ir||0))}}
function incSumHTML(L){const s=incSum(L);if(!s.n)return '';
  return `<p class="note" style="margin:8px 0 0">${esc(t('ir.sum',{n:s.n,all:s.all,b:moneyT(s.b,2),net:moneyT(s.net,2),ps:moneyT(s.ps,2)}))}${s.w>0.004?' '+esc(t('ir.sumW',{w:moneyT(s.w,2)})):''}</p>`}
