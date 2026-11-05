/* ================= relevés PDF (repris du Carnet de budget) =================
 * scrubLabel : jamais d'IBAN, de numéro de carte ni de longue suite de chiffres */
function scrubLabel(raw){
  let s=String(raw||'').replace(/\s+/g,' ').trim();
  s=s.replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g,m=>{const c=m.replace(/\s/g,'');return c.length>=15&&(c.match(/\d/g)||[]).length/c.length>=0.6&&!isinOk(c.slice(0,12))?'':m});/* IBAN, mais pas un ISIN (12 caractères) */
  s=s.replace(/\bcarte\s+[x*]+\s?\d{2,4}\b/ig,'').replace(/\b[x*]{2,}\d{2,4}\b/ig,'').replace(/\*+\d{2,4}\b/g,'');
  s=s.replace(/(?<![.,\d])\b\d{6,}\b(?![.,]\d)/g,'').replace(/\b(bic|iban|rib)\b\s*:?\s*\S*/ig,'');
  return s.replace(/\(\s*\)/g,'').replace(/\s+/g,' ').replace(/^[\s\-–:,]+|[\s\-–:,]+$/g,'').slice(0,140)||'Opération';
}
const MRE={janv:1,jan:1,fevr:2,fev:2,feb:2,mars:3,mar:3,avr:4,apr:4,mai:5,may:5,juin:6,jun:6,juil:7,jul:7,aout:8,aug:8,sept:9,sep:9,oct:10,nov:11,dec:12};
function parseDateH(v,yearHint){
  const s=noAcc(String(v??'').trim());if(!s)return null;
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return validISO(+m[1],+m[2],+m[3]);
  m=s.match(/^(\d{4})(\d{2})(\d{2})/);if(m)return validISO(+m[1],+m[2],+m[3]);
  m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);if(m){let y=+m[3];if(y<100)y+=2000;return validISO(y,+m[2],+m[1])}
  m=s.match(/^(\d{1,2})\s+([a-z]+)\.?\s*(\d{4})?/);if(m){const w=m[2],mo=MRE[w]||MRE[w.slice(0,4)]||MRE[w.slice(0,3)];const y=m[3]?+m[3]:yearHint;if(mo&&y)return validISO(y,mo,+m[1])}
  m=s.match(/^(\d{1,2})[\/.](\d{1,2})$/);if(m&&yearHint)return validISO(yearHint,+m[2],+m[1]);
  return null;
}

/* ---------- PDF : lignes reconstruites depuis les positions du texte ---------- */
const AMT_RE=/^[-−+]?\s?(?:€|eur)?\s?(?:\d{1,3}(?:[\s  .,']\d{3})+|\d+)[.,]\d{2}\s?(?:€|eur)?\s?[-−]?$/i;
const DATE_START=/^(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?(?!\d)|^(\d{1,2})\s+(janv|fevr|fev|mars|avr|mai|juin|juil|aout|sept|oct|nov|dec)[a-z]*\.?\s*(\d{4})?/;
const BAL_START=/ancien solde|solde precedent|solde de debut|solde initial|solde d ouverture|solde au debut|opening balance|solde reporte|report du solde|solde crediteur au|solde debiteur au|solde au\s*:?\s*\d/;
const BAL_END=/nouveau solde|solde final|solde de fin|solde de cloture|closing balance|solde en fin de periode/;
const HDR_DEB=/^(debit|debits|debit \(|sortie|sorties|argent sortant|sorties d argent|sortie d argent|retraits?|montant debite|paid out|money out|ausgang|soll)\b/;
const HDR_CRE=/^(credit|credits|credit \(|entree|entrees|argent entrant|entree d argent|entrees d argent|versements?|montant credite|paid in|money in|eingang|haben)\b/;
const DATE_ANY=/(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}|\d{1,2}\s+(?:janv|fevr|fev|mars|avr|mai|juin|juil|aout|sept|oct|nov|dec)[a-z]*\.?\s+\d{4})/;
/* lignes reconstituées (items regroupés par ordonnée, fragments recollés) */
function pdfLines(pages){
  const all=[];
  pages.forEach((items,pi)=>{
    let its=items.filter(it=>it.str&&it.str.trim()).map(it=>({...it,str:it.str.trim()}));
    /* deux montants dans un même fragment (« 404,22 € 160,79 € ») : on les sépare, abscisse au prorata */
    its=its.flatMap(it=>{const m=it.str.match(/^([-−]?[\d\s\u00a0\u202f.,']+[.,]\d{2}\s?(?:€|EUR))\s+([-−]?[\d\s\u00a0\u202f.,']+[.,]\d{2}\s?(?:€|EUR))$/i);if(!m)return [it];
      const k=(it.w||0)/it.str.length,o=it.str.indexOf(m[2],m[1].length);return [{...it,str:m[1],w:m[1].length*k},{...it,str:m[2],x:it.x+o*k,w:m[2].length*k}]});
    its.sort((a,b)=>b.y-a.y||a.x-b.x);
    const lines=[];
    for(const it of its){let L=lines.find(l=>Math.abs(l.y-it.y)<2.6);if(!L){L={y:it.y,items:[],p:pi};lines.push(L)}L.items.push(it)}
    lines.sort((a,b)=>b.y-a.y).forEach(L=>{
      L.items.sort((a,b)=>a.x-b.x);
      /* recolle les fragments : lettres collées (D|ébit) et milliers séparés (1|234,56) */
      const m=[];for(const it of L.items){const p=m[m.length-1];const gap=p?it.x-(p.x+(p.w||0)):99;
        if(p&&gap<1.3&&gap>-2){p.str+=it.str;p.w=(it.x+(it.w||0))-p.x;continue}
        if(p&&gap<7&&/^[-−]?\d{1,3}$/.test(p.str)&&/^\d{3}(?:[.,]\d{2})?\s?(?:€|eur)?$/i.test(it.str)){p.str+=' '+it.str;p.w=(it.x+(it.w||0))-p.x;continue}
        m.push({...it})}
      L.items=m;L.str=m.map(i=>i.str).join(' ').replace(/\s+/g,' ')});
    /* lignes « en bande » : date sur deux lignes (« 01 sept. » au-dessus, « 2026 » en dessous, ex. Trade Republic)
       -> toutes les lignes entre la date et l'année forment une seule opération */
    const pl=lines.sort((a,b)=>b.y-a.y);const DM=/^\d{1,2}\s+[a-zéû]{3,5}\.?$|^\d{1,2}[\/.]\d{1,2}$/i;
    for(let i=0;i<pl.length;i++){const L=pl[i];const f=L.items[0];if(!f||!DM.test(f.str))continue;
      let j=-1;for(let k=i+1;k<pl.length&&L.y-pl[k].y<=14;k++){const g=pl[k].items[0];if(g&&/^(19|20)\d{2}$/.test(g.str)&&Math.abs(g.x-f.x)<5){j=k;break}}
      if(j<0)continue;
      const band=pl.slice(i,j+1);const yr=pl[j].items[0];
      let its=band.flatMap(B=>B.items.map(it=>({...it,yy:B.y}))).filter(it=>it!==undefined);
      its=its.filter(it=>!(it.str===yr.str&&Math.abs(it.x-yr.x)<1&&it.yy===pl[j].y));
      const d=its.find(it=>it.str===f.str&&Math.abs(it.x-f.x)<1&&it.yy===L.y);d.str=f.str+' '+yr.str;
      /* ordre : colonnes de gauche à droite, et de haut en bas dans une même colonne */
      its.sort((a,b)=>a.x-b.x);const cl=[];its.forEach(it=>{const c=cl.find(c=>Math.abs(c.x-it.x)<6);if(c)c.its.push(it);else cl.push({x:it.x,its:[it]})});
      const merged=cl.flatMap(c=>c.its.sort((a,b)=>b.yy-a.yy)).map(({yy,...it})=>it);
      const NL={y:L.y,p:L.p,items:merged,str:merged.map(x=>x.str).join(' ').replace(/\s+/g,' '),band:1};
      pl.splice(i,j-i+1,NL);
    }
    pl.forEach(L=>all.push(L));
  });
  return all;
}
function pdfLinesToOps(pages){
  /* pages : [[{x,y,w,str}...]] ; renvoie {ops,warn,startBal,endBal,curBal,period,text} */
  const all=pdfLines(pages);const text=all.map(L=>L.str);
  const full=text.join('\n'),nfull=noAcc(full);
  /* période et année */
  let endY=null,endM=null,period=null;
  const D1='(\\d{1,2}[\\/.]\\d{1,2}[\\/.]\\d{2,4}|\\d{1,2}(?:er)?\\s+[a-z]{3,9}\\.?\\s+\\d{4})';
  const pm=nfull.match(new RegExp('du\\s+'+D1+'\\s+au\\s+'+D1))||nfull.match(new RegExp('entre\\s+le\\s+'+D1+'\\s+et\\s+le\\s+'+D1))||nfull.match(new RegExp('periode\\s*:?\\s*'+D1+'\\s*[-–a]+\\s*'+D1))||nfull.match(new RegExp('\\bde\\s+'+D1+'\\s+a\\s+'+D1))||nfull.match(new RegExp(D1+'\\s+[-–]\\s+'+D1));
  if(pm){const a=parseDateH(pm[1].replace(/(\d)er\b/,'$1')),b=parseDateH(pm[2].replace(/(\d)er\b/,'$1'));if(a&&b&&a<=b){period={from:a,to:b};endY=+b.slice(0,4);endM=+b.slice(5,7)}}
  if(!endY){const ys={};(nfull.match(/\b20\d{2}\b/g)||[]).forEach(y=>ys[y]=(ys[y]||0)+1);const top=Object.entries(ys).sort((a,b)=>b[1]-a[1])[0];if(top)endY=+top[0]}
  const yearFor=(d,mo)=>{if(!endY)return null;if(endM&&mo>endM)return endY-1;return endY};
  const isAmt=it=>{const s=it.str.trim();return AMT_RE.test(s)&&!(/^\d{1,2}[.\/]\d{1,2}$/.test(s))};
  const hdr=L=>{let d=null,c=null;for(const it of L.items){const t=noAcc(it.str);const cx=it.x+(it.w||0)/2;if(d===null&&HDR_DEB.test(t))d=cx;if(c===null&&HDR_CRE.test(t))c=cx}return d!==null&&c!==null?{d,c}:null};
  const docHasHeader=all.some(L=>hdr(L));
  const isDateHdr=t=>/^date(\s|$)/.test(t)&&!DATE_ANY.test(t);
  const moneyHdr=t=>/debit|credit|entrant|sortant|montant|mouvement|amount|operation|libelle|description/.test(t)&&!/unites|symbole|gross|prix unitaire|valeur de l achat|interest/.test(t);
  const anyDateHdr=all.some(L=>isDateHdr(noAcc(L.str)));
  /* relevés à montants signés (une seule colonne, sorties précédées de « - ») */
  const signedMode=!docHasHeader&&all.some(L=>DATE_START.test(noAcc(L.str))&&L.items.some(it=>isAmt(it)&&/^[-−]/.test(it.str)));
  const SUM_S=/^solde (au |de )?debut|^solde d.?ouverture|^solde initial|^opening balance|^solde precedent/,SUM_E=/^solde (de |en )?fin|^solde de cloture|^closing balance|^nouveau solde|^solde final/;
  const nk=it=>noAcc(it.str).replace(/[’']/g,' ');
  const isSum=L=>L.items.some(it=>SUM_S.test(nk(it)))&&L.items.some(it=>SUM_E.test(nk(it)))&&!L.items.some(isAmt);
  const scan=lines=>{
    let dX=null,cX=null,inTable=!docHasHeader&&!anyDateHdr;
    const ops=[];let startBal=null,endBal=null,curBal=null,last=null,prevBal=null,unsure=0,name='';
    const signedByCol=(it,v)=>{if(dX!==null&&cX!==null){const cx=it.x+(it.w||0)/2;return Math.abs(cx-dX)<=Math.abs(cx-cX)?-Math.abs(v):Math.abs(v)}return null};
    let curPage=-1,sumHdr=null;
    for(const L of lines){
      if(L.p!==curPage){curPage=L.p;last=null}
      const t=noAcc(L.str).replace(/[’']/g,' ');
      /* tableau de synthèse : « Solde début de période … Solde fin de période » puis une ligne de montants */
      {const si=L.items.find(it=>/^solde (au |de )?debut|^solde d.?ouverture|^solde initial|^opening balance|^solde precedent/.test(noAcc(it.str).replace(/[’']/g,' '))),ei=L.items.find(it=>/^solde (de |en )?fin|^solde de cloture|^closing balance|^nouveau solde|^solde final/.test(noAcc(it.str).replace(/[’']/g,' ')));
        if(si&&ei&&!L.items.some(isAmt)){sumHdr={s:si.x+(si.w||0)/2,e:ei.x+(ei.w||0)/2,n:0};const h2=hdr(L);if(h2){dX=h2.d;cX=h2.c}continue}}
      if(sumHdr){sumHdr.n++;const am=L.items.filter(isAmt);if(am.length>=2){const near=x=>am.reduce((b,it)=>Math.abs(it.x+(it.w||0)/2-x)<Math.abs(b.x+(b.w||0)/2-x)?it:b);if(startBal===null){startBal=parseAmount(near(sumHdr.s).str);prevBal=startBal}if(endBal===null)endBal=parseAmount(near(sumHdr.e).str);if(!name)name=L.items.filter(it=>!isAmt(it)).map(it=>it.str).join(' ').slice(0,40);sumHdr=null;continue}if(sumHdr.n>3)sumHdr=null}
      const h=hdr(L);if(h){dX=h.d;cX=h.c;inTable=true;last=null;continue}
      if(isDateHdr(t)){inTable=moneyHdr(t)&&(!docHasHeader||inTable);if(!moneyHdr(t)){dX=dX;}last=null;continue}
      const amts=L.items.filter(isAmt);
      const isEnd=BAL_END.test(t),isStart=BAL_START.test(t);
      if((isEnd||isStart)&&amts.length){const it=amts[amts.length-1];let v=parseAmount(it.str);const s=signedByCol(it,v);if(s!==null&&!/[-−]/.test(it.str))v=s;if(/debiteur/.test(t))v=-Math.abs(v);
        const dm=t.match(DATE_ANY);const bd=dm?parseDateH(dm[1]):null;
        if(bd&&period){if(bd>dAdd(period.to,3))curBal={d:bd,v};else if(bd>=dAdd(period.to,-1))endBal=v;else if(bd<=dAdd(period.from,1)){if(startBal===null){startBal=v;prevBal=v}}else if(isEnd)endBal=v;else if(startBal===null){startBal=v;prevBal=v}}
        else if(isEnd||(startBal!==null&&ops.length))endBal=v;else if(startBal===null){startBal=v;prevBal=v}
        last=null;continue}
      if(/\btotal\b|\breport\b|total des operations|sous total/.test(t)){last=null;continue}
      const dm=t.match(DATE_START);
      if(dm&&amts.length&&inTable){
        let d;
        if(dm[1]){const mo=+dm[2];let y=dm[3]?+dm[3]:yearFor(+dm[1],mo);if(y&&y<100)y+=2000;d=y?validISO(y,mo,+dm[1]):null}
        else{const mo=MRE[dm[5]]||MRE[dm[5].slice(0,4)]||MRE[dm[5].slice(0,3)];const y=dm[6]?+dm[6]:yearFor(+dm[4],mo);d=y&&mo?validISO(y,mo,+dm[4]):null}
        if(!d){last=null;continue}
        /* libellé : entre les dates de tête et le premier montant */
        const firstAmtX=amts[0].x;
        let lab=L.items.filter(it=>it.x<firstAmtX&&!isAmt(it)).map(i=>i.str.trim()).join(' ');
        lab=lab.replace(/^(\d{1,2}[\/.]\d{1,2}(?:[\/.]\d{2,4})?\s*){1,2}/,'').replace(/^(\d{1,2}\s+[a-zéûè]{3,9}\.?\s*(\d{4})?\s*){1,2}/i,'').replace(/(\s\d{1,2}[\/.]\d{1,2}(?:[\/.]\d{2,4})?)+$/,'').trim();
        let it=amts[0],v=parseAmount(it.str),sgn=signedByCol(it,v);
        if(/^[-−+]/.test(it.str.trim())||/[-−]\s?(?:€|eur)?$/i.test(it.str.trim()))sgn=v;
        let bal=null;if(amts.length>=2){const b=parseAmount(amts[amts.length-1].str);if(isFinite(b))bal=b}
        if(sgn===null&&bal!==null&&prevBal!==null){const delta=r2(bal-prevBal);if(Math.abs(Math.abs(delta)-Math.abs(v))<0.011)sgn=delta}
        if(sgn===null&&signedMode)sgn=v;
        if(sgn===null){sgn=-Math.abs(v);unsure++}
        if(bal!==null)prevBal=bal;
        if(!isFinite(sgn)||sgn===0){last=null;continue}
        const op={d,a:r2(sgn),l:lab};ops.push(op);last=op;continue;
      }
      /* suite du libellé sur la ligne suivante */
      if(last&&!amts.length&&!dm&&L.str.length<70&&!/page|solde|total|iban|bic|titulaire|agence|releve|www|tel|sauf erreur/.test(t)&&last.l.length<90){last.l+=' '+L.str;last._c=(last._c||0)+1;if(last._c>=2)last=null;continue}
      last=null;
    }
    return {ops,startBal,endBal,curBal,unsure,name};
  };
  /* relevé multi-comptes (ex. Trade Republic : compte courant puis compte PEA, chacun avec sa synthèse) */
  const hIdx=all.map((L,i)=>isSum(L)?i:-1).filter(i=>i>=0);
  const chunks=hIdx.length>=2?hIdx.map((h,k)=>all.slice(k===0?0:h,k+1<hIdx.length?hIdx[k+1]:all.length)):[all];
  const secs=chunks.map(scan).filter((x,i)=>i===0||x.ops.length||x.startBal!==null);
  const {ops,startBal,endBal,curBal,unsure}=secs[0];const warn=[];
  secs.forEach(x=>x.ops.forEach(o=>{o.l=scrubLabel(o.l.replace(/\b(Rèf|Ref|REF|REFDO|REFBEN)\s*:?\s*\S+/g,''));delete o._c}));
  if(unsure)warn.push({k:'unsure',n:unsure});
  let holder=null;for(const L of all.slice(0,60)){const m=noAcc(L.str).match(/^(?:m\.?|mr\.?|mme|monsieur|madame|mlle|mademoiselle)\s+([a-z][a-z'\- ]{3,60})$/);if(m){const tk=m[1].split(/[\s\-]+/).filter(w=>w.length>1&&!/^(et|ou|ep|epouse|ne|nee)$/.test(w)).slice(0,4);if(tk.length>=2){holder=tk;break}}}
  const hi=all.findIndex(L=>hdr(L));const head=(hi>0?all.slice(0,hi):all.slice(0,25)).map(L=>L.str).join('\n');
  const r={ops,warn,kind:'pdf',startBal,endBal,curBal,period,text:full,head,holder,chars:full.replace(/\s/g,'').length,name:secs[0].name};if(secs.length>1)r.sections=secs.map(x=>({name:x.name,ops:x.ops,startBal:x.startBal,endBal:x.endBal,curBal:x.curBal}));Object.defineProperty(r,'lines',{value:all,enumerable:false});return r;
}

/* ---------- contrôle de solde ---------- */
function balanceCheck(res){
  if(res.startBal==null||res.endBal==null||!res.ops.length)return null;
  const calc=r2(res.startBal+sum(res.ops.map(o=>o.a)));const diff=r2(res.endBal-calc);
  return {ok:Math.abs(diff)<0.011,diff,calc,start:res.startBal,end:res.endBal};
}

/* ---------- banque détectée ---------- */
const BANKS=[['BoursoBank',/boursobank|boursorama/],['Hello bank!',/hello ?bank/],['BNP Paribas',/bnp paribas/],['Revolut',/revolut/],['Trade Republic',/trade republic/],['Crédit Coopératif',/credit cooperatif/],['Fortuneo',/fortuneo/],['Société Générale',/societe generale/],['Crédit Agricole',/credit agricole/],['LCL',/\blcl\b|credit lyonnais/],['La Banque Postale',/banque postale/],['Caisse d’Épargne',/caisse d.epargne/],['Banque Populaire',/banque populaire/],['Crédit Mutuel',/credit mutuel/],['CIC',/\bcic\b/],['N26',/\bn26\b/],['Nickel',/\bnickel\b/],['Qonto',/qonto/],['Shine',/\bshine\b/],['ING',/\bing\b/],['Lydia',/lydia|sumeria/],['PayPal',/paypal/],['XTB',/\bxtb\b|xstation/],['Bourse Direct',/bourse direct/],['Binance',/binance/],['Crypto.com',/crypto\.com/]];
function detectBank(text,name){const t=noAcc((name||'')+' '+String(text||'').slice(0,6000));for(const [b,re] of BANKS)if(re.test(t))return b;return ''}
const FOREIGN=/revolut|trade republic|n26|binance|crypto\.com|xtb|paypal|wise|degiro|interactive brokers|bunq|vivid|lydia|sumeria/i;

/* ---------- chargement de pdf.js (cdnjs) et lecture ---------- */
let pdfReady=null;
function loadScript(src){return new Promise((ok,ko)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>ko(new Error('script'));document.head.appendChild(s)})}
function loadPdf(){
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  if(!pdfReady)pdfReady=(async()=>{const base='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';await loadScript(base+'pdf.min.js');await loadScript(base+'pdf.worker.min.js');window.pdfjsLib.GlobalWorkerOptions.workerSrc=base+'pdf.worker.min.js';return window.pdfjsLib})().catch(e=>{pdfReady=null;throw e});
  return pdfReady;
}
async function openPdf(file,password){const lib=await loadPdf();const o={data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false};if(password)o.password=password;
  try{return await lib.getDocument(o).promise}catch(e){if(e&&e.name==='PasswordException')throw {code:'pwd',bad:!!password};throw e}}
async function readPdf(file,password){
  const doc=await openPdf(file,password);const pages=[];
  for(let p=1;p<=doc.numPages;p++){const pg=await doc.getPage(p);const tc=await pg.getTextContent();pages.push(tc.items.map(it=>({str:it.str,x:it.transform[4],y:it.transform[5],w:it.width||0})))}
  const r=pdfLinesToOps(pages);r.pages=doc.numPages;r.bank=detectBank(r.head||r.text,file.name);
  if(r.bank==='Trade Republic')(r.sections||[{ops:r.ops}]).flatMap(x=>x.ops).forEach(o=>{o.l=o.l.replace(/^(Avoir|Virement|Exécution d.ordre|Transaction par carte|Intérêts|Prélèvement|Récompense|Rendement|Bonus|Parrainage)\s+(?=\S)/i,'')});r.pf=pdfPositions(r.lines,r);r.pwd=password||'';return r;
}
/* pages rendues en images, pour la lecture d'un relevé scanné par Claude */
async function pdfImages(file,max=4,password){
  const doc=await openPdf(file,password);const out=[];
  for(let p=1;p<=Math.min(doc.numPages,max);p++){const pg=await doc.getPage(p);const vp=pg.getViewport({scale:1.6});const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;out.push(await new Promise(r=>c.toBlob(r,'image/jpeg',.82)))}
  return out.filter(Boolean);
}

/* ================= relevés de portefeuille (positions) ================= */
/* contrôle de la clé ISIN (Luhn sur les chiffres obtenus en convertissant les lettres) */
function isinOk(s){if(!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(s))return false;const d=s.split('').map(c=>/\d/.test(c)?c:String(c.charCodeAt(0)-55)).join('');let sum=0,alt=false;for(let i=d.length-1;i>=0;i--){let n=+d[i];if(alt){n*=2;if(n>9)n-=9}sum+=n;alt=!alt}return sum%10===0}
const ISIN_G=/\b([A-Z]{2}[A-Z0-9]{9}\d)\b/g;
const SYM_CUR={US:'USD',FR:'EUR',DE:'EUR',NL:'EUR',BE:'EUR',IT:'EUR',ES:'EUR',PT:'EUR',IE:'EUR',FI:'EUR',AT:'EUR',UK:'GBP',CH:'CHF',DK:'DKK',SE:'SEK',NO:'NOK',PL:'PLN',CZ:'CZK',JP:'JPY',HK:'HKD',CA:'CAD',AU:'AUD'};
const CRYPTO_SYM=/^(BTC|ETH|SOL|XRP|ADA|DOT|DOGE|LTC|BNB|AVAX|MATIC|POL|LINK|ATOM|XLM|TRX|SHIB|UNI|USDT|USDC|EURC|CRO|NEAR|ALGO|TON|SUI|PEPE|APT|ARB|OP)$/;
/* titres de section : type d'enveloppe ou section à ignorer (historiques, mouvements, synthèses) */
function pfSection(t){
  if(/open position|positions ouvertes|repartition du portefeuille|portefeuille de titres|releve de portefeuille|etat des titres|inventaire|detail des positions|vos positions|composition/.test(t))return {mode:'pos'};
  if(/closed position|positions (fermees|cloturees)|pending order|ordres en attente|cash operation|historique des (operations|transactions|mouvements)|^transactions$|^operations$|mouvements|recompenses|staking|resume du (compte|solde)|etat du patrimoine|synthese|recapitulatif|^repartition$/.test(t))return {mode:'skip'};
  if(/pea.?pme/.test(t))return {mode:'pos',type:'peapme'};
  if(/plan d.?epargne en actions|^pea\b/.test(t))return {mode:'pos',type:'pea'};
  if(/compte.?titres|^cto\b|securities account|depot titres/.test(t))return {mode:'pos',type:'cto'};
  if(/assurance.?vie|contrat d.?assurance|epargne assurance/.test(t))return {mode:'pos',type:'av'};
  if(/plan d.?epargne retraite|^per\b/.test(t))return {mode:'pos',type:'per'};
  if(/crypto/.test(t))return {mode:'pos',type:'wallet'};
  if(/^(especes|liquidites|cash|compte (courant|especes)|solde especes)$/.test(t))return {mode:'cash'};
  return null;
}
/* colonne d'en-tête -> rôle */
function pfHdr(t){
  t=t.replace(/[’']/g,' ').trim();
  if(!t||t.length>40)return null;
  if(/\+\/-|plus.?value|p\/l|gain|perf|variation|%|frais|commission|swap|rollover|margin|marge|sl$|^tp$|comment|^type$|^date|time|heure|^position$|^id$|^sens$|^side$/.test(t))return 'x';
  if(/prix de revient|^pru\b|prix moyen|^pam$|open price|cout moyen|average price|avg price|prix d.?achat moyen|cours d.?achat|cours moyen|^purchase price/.test(t))return 'pru';
  if(/purchase value|^purchase$|valeur d.?achat|montant investi|^investi|cout total|prix de revient total|cost basis/.test(t))return 'cost';
  if(/quantite|^qte|^qty|quantity|volume|^nombre|^nb\b|pieces|^parts$|nombre de parts|^units?$|unites|nominal/.test(t))return 'qty';
  if(/^cours|prix par piece|prix unitaire|^prix$|market price|current price|^price$|valeur liquidative|^vl\b|dernier cours|cotation|close price/.test(t))return /close price/.test(t)?'x':'price';
  if(/valorisation|valeur en|^valeur$|market value|^value$|evaluation|montant en eur|valeur actuelle|valeur de marche|encours|epargne atteinte/.test(t))return 'value';
  if(/^montant$/.test(t))return 'amt';
  if(/symbol|ticker|mnemo|code$/.test(t))return 'sym';
  if(/nom du titre|libelle|designation|instrument|^titre|support|^actif|asset|^name$|^nom$|produit|valeur mobiliere|fonds/.test(t))return 'name';
  if(/isin/.test(t))return 'isin';
  return null;
}
function pdfPositions(lines,res){
  res=res||{};const txt=lines.map(L=>L.str).join('\n');const ntxt=noAcc(txt);
  /* séparateur décimal du document */
  const dc=(txt.match(/\d,\d{2}(?!\d)/g)||[]).length,dd=(txt.match(/\d\.\d{2}(?!\d)/g)||[]).length-(txt.match(/\d{1,2}\.\d{2}\.\d{2,4}/g)||[]).length*2;
  const comma=dc>=dd;
  const num=s=>{s=String(s).replace(/[\s  ']/g,'').replace('−','-');const hc=s.includes(','),hd=s.includes('.');
    if(hc&&hd){if(s.lastIndexOf(',')>s.lastIndexOf('.'))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'')}
    else if(hc){if(!comma&&/^-?\d{1,3}(,\d{3})+$/.test(s))s=s.replace(/,/g,'');else s=s.replace(',','.')}
    else if(hd&&comma&&/^-?\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
    return +s};
  const DATE_T=/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}(\s+\d{1,2}:\d{2}(:\d{2})?)?$|^\d{4}-\d{2}-\d{2}/;
  /* jeton numérique : nombre éventuellement entouré d'une devise ou d'une unité */
  const tok=it=>{const s=it.str.trim();if(DATE_T.test(s)||/^\d{1,2}:\d{2}/.test(s))return null;
    const m=s.match(/^([-−+]?)\s?([€$£]?)\s?(\d[\d  .,']*)\s?([A-Za-zÀ-ÿ€$£%]{0,9}\.?)$/);if(!m)return null;
    const raw=m[3].trim();if(/^\d{7,}$/.test(raw))return null;
    const u=(m[2]||m[4]||'').trim();if(u==='%')return null;
    if(u&&!/^(€|\$|£|eur|usd|gbp|chf|pieces?|pièces?|pcs?|parts?|units?|unites?|unités?|titres?|actions?|shares?|[A-Z]{2,5})$/i.test(u))return null;
    const v=num((m[1]==='-'||m[1]==='−'?'-':'')+raw);if(!isFinite(v))return null;
    const cu=/^€|eur$/i.test(u)?'EUR':/^\$|usd$/i.test(u)?'USD':/^£|gbp$/i.test(u)?'GBP':/^chf$/i.test(u)?'CHF':null;
    return {v,u,cu,x:it.x,x2:it.x+(it.w||0),dec:/[.,]\d+$/.test(raw)?raw.split(/[.,]/).pop().length:0,unit:/^(pieces?|pièces?|pcs?|parts?|units?|unites?|unités?|titres?|actions?|shares?)$/i.test(u)?'qty':(cu?'money':(u&&/^[A-Z]{2,5}$/.test(u)?'asset':''))}};
  const sym=s=>/^[A-Z0-9]{1,6}(?:\.[A-Z]{1,3})?$/.test(s)&&/[A-Z]/.test(s)&&!/^(EUR|USD|GBP|CHF|BUY|SELL|ISIN|TOTAL|DATE|PEA|CTO|ETF)$/.test(s);
  const docType=/pea.?pme/.test(ntxt)?'peapme':/plan d.?epargne en actions|\bpea\b/.test(ntxt)?'pea':/assurance.?vie/.test(ntxt)?'av':/plan d.?epargne retraite/.test(ntxt)?'per':/crypto|bitcoin|blockchain|wallet/.test(ntxt)?'wallet':'cto';
  const groups=[];let G=null,mode='pos',cols=null,last=null;const newG=(title,type,kind)=>{G={title:title||'',type:type||docType,kind:kind||'pos',positions:[],cash:null,total:null};groups.push(G);last=null;return G};
  let docCash=null;const dates=[];
  const colOf=it=>{if(!cols)return null;const x1=it.x,x2=it.x+(it.w||0);let best=null,bo=0;for(const c of cols){const o=Math.min(x2,c.x2)-Math.max(x1,c.x);if(o>bo){bo=o;best=c}}
    if(!best){let bd=28;for(const c of cols){const d=Math.min(Math.abs(x1-c.x),Math.abs(x2-c.x2));if(d<bd){bd=d;best=c}}}return best?best.r:null};
  for(let i=0;i<lines.length;i++){
    const L=lines[i];const t=noAcc(L.str).replace(/[’']/g,' ').replace(/\s+/g,' ').trim();
    const toks=L.items.map(tok);const nums=toks.filter(Boolean);
    /* ISIN (et date de cours) sur les lignes de suite d'une position */
    if(last&&L.p===last.p&&nums.length<2){const im=[...L.str.matchAll(ISIN_G)].map(m=>m[1]).find(isinOk);if(im){if(!last.isin)last.isin=im;const dm=L.str.match(/\d{1,2}[\/.]\d{1,2}[\/.]\d{4}/);if(dm)dates.push(dm[0]);continue}
      const dm=L.str.match(/^\S.*?(\d{1,2}[\/.]\d{1,2}[\/.]\d{4})$/);if(dm&&!nums.length)dates.push(dm[1])}
    /* titre de section */
    if(!nums.length&&t.length<70){const sc=pfSection(t);if(sc){mode=sc.mode;cols=null;last=null;if(mode==='pos')newG(L.str.trim(),sc.type,'pos');else if(mode==='cash')newG(L.str.trim(),'cash','cash');continue}}
    /* clé/valeur sur deux lignes : Balance / Solde espèces au-dessus de la valeur */
    if(!nums.length&&lines[i+1]&&lines[i+1].p===L.p){const kv=L.items.find(it=>/^(balance|solde|solde especes|especes|liquidites|cash|cash balance)$/.test(noAcc(it.str)));if(kv){const nx=lines[i+1].items.map(tok);const k=nx.findIndex(x=>x&&x.x<=kv.x+(kv.w||0)+4&&x.x2>=kv.x-4);if(k>-1&&docCash===null)docCash=nx[k].v}}
    /* en-tête de tableau */
    if(!nums.length){const roles=L.items.map(it=>({it,r:pfHdr(noAcc(it.str))}));const good=roles.filter(r=>r.r&&r.r!=='x');const kinds=new Set(good.map(r=>r.r));
      if(good.length>=2&&(kinds.has('qty')||kinds.has('amt'))&&(kinds.has('price')||kinds.has('value')||kinds.has('cost')||kinds.has('amt'))){
        cols=roles.filter(r=>r.r).map(r=>({r:r.r,x:r.it.x,x2:r.it.x+(r.it.w||0)}));
        if(cols.some(c=>c.r==='amt')){const hasV=cols.some(c=>c.r==='value'),hasQ=cols.some(c=>c.r==='qty');cols.forEach(c=>{if(c.r==='amt')c.r=hasV&&!hasQ?'qty':(!hasV?'value':'x')})}
        if(mode==='skip'){last=null;continue}
        if(!G)newG('',null,'pos');last=null;continue}}
    if(mode==='skip')continue;
    if(!G)newG('',null,'pos');
    /* totaux de section */
    if(/\btotal\b|nombre de positions|^: ?\d+\b|sous.?total|valeur totale/.test(t)&&nums.length){const m=nums.filter(x=>(x.dec>=2||x.cu)&&x.v>0);if(m.length&&!/p\/l|gross|profit|gain/.test(t))G.total=m[m.length-1].v;last=null;continue}
    /* espèces */
    if(nums.length===1&&/^(especes|liquidites|cash|compte courant|solde especes|solde disponible|disponible|solde)\b/.test(t)){G.cash=nums[0].v;last=null;continue}
    if(G.kind==='cash'){if(nums.length===1&&nums[0].dec>=2){G.cash=(G.cash||0)+nums[0].v}continue}
    /* fonds en euros : un seul montant (quantité = montant, cours = 1) */
    const FE_RE=/fonds? (en )?euros?|fonds euro|actif general|euro.?croissance|support euro/;
    if(nums.length===1&&nums[0].v>0&&nums[0].dec>=2&&FE_RE.test(t)){const nm=L.items.filter((it,k)=>!toks[k]).map(it=>it.str.trim()).join(' ').replace(/\s+/g,' ').slice(0,80);
      const P={p:L.p,name:nm,isin:null,sym:null,qty:nums[0].v,price:1,value:nums[0].v,pru:1,cost:null,cur:nums[0].cu||'EUR',vcur:nums[0].cu,fe:true};G.positions.push(P);last=P;continue}
    if(nums.length<2)continue;
    /* rôles des nombres */
    const P={p:L.p,name:'',isin:null,sym:null,qty:null,price:null,value:null,pru:null,cost:null,cur:null,vcur:null};
    let texts=[];
    L.items.forEach((it,k)=>{const n=toks[k];const r=colOf(it);
      if(n){if(r&&['qty','price','value','pru','cost'].includes(r)&&P[r]===null){P[r]=n.v;if(r==='value'&&n.cu)P.vcur=n.cu;if((r==='price'||r==='pru')&&n.cu)P.cur=n.cu;if(r==='qty'&&n.unit==='asset')P.sym=P.sym||n.u.toUpperCase()}else if(!cols)texts.push({n,it})}
      else{const s=it.str.trim();const im=[...s.matchAll(ISIN_G)].map(m=>m[1]).find(isinOk);if(im){P.isin=im;return}
        if(r==='x'||DATE_T.test(s))return;
        if(r==='sym'||(!P.sym&&sym(s)&&(r==='name'||r===null)&&s.length<=10)){P.sym=P.sym||s;if(r==='sym')return}
        if(/^(buy|sell|achat|vente|long|short)$/i.test(s))return;
        if(!cols||r==='name'||r===null)P.name+=(P.name?' ':'')+s.replace(/^(isin\s*:?\s*)/i,'')}});
    /* sans en-tête : triplet quantité × cours ≈ valeur */
    if(!cols){const ns=texts.map(x=>x.n);let best=null;
      for(let a=0;a<ns.length;a++)for(let b=0;b<ns.length;b++)for(let c=0;c<ns.length;c++){if(a===b||b===c||a===c)continue;const q=ns[a].v,p=ns[b].v,v=ns[c].v;if(q<=0||p<=0||v<=0)continue;if(ns[a].unit==='money'||ns[b].unit==='qty')continue;
        const err=Math.abs(q*p-v);if(err<=Math.max(0.02,v*0.006)){const sc=err/v+(a<b&&b<c?0:0.01)+(ns[a].unit==='qty'||ns[a].unit==='asset'?-0.02:0)+(q===1||p===1?0.02:0);if(!best||sc<best.sc)best={sc,a,b,c}}}
      if(!best)continue;
      if((ns[best.a].v===1||ns[best.b].v===1)&&!P.isin&&!/qty|asset/.test(ns[best.a].unit))continue;
      if(/\btel\b|orias|siren|siret|\brcs\b|capital (social )?de|iban|\bbic\b|page \d/.test(t))continue;
      P.qty=ns[best.a].v;P.price=ns[best.b].v;P.value=ns[best.c].v;P.vcur=ns[best.c].cu;P.cur=ns[best.b].cu;if(ns[best.a].unit==='asset')P.sym=P.sym||ns[best.a].u.toUpperCase()}
    if(!(P.qty>0))continue;
    if(P.price===null&&P.value!==null)P.price=P.value/P.qty;
    if(P.price===null||!(P.price>=0))continue;
    P.name=P.name.replace(/\s+/g,' ').replace(/^[:\-–\s]+|[:\-–\s]+$/g,'').slice(0,80);
    if(!P.name&&!P.sym&&!P.isin)continue;
    /* devise : symbole suffixé (.US), devise explicite, sinon celle du document */
    if(!P.cur){const sx=P.sym&&P.sym.match(/\.([A-Z]{2,3})$/);if(sx&&SYM_CUR[sx[1]])P.cur=SYM_CUR[sx[1]]}
    if(P.value===null)P.value=P.qty*P.price;
    if(!P.cur)P.cur=P.vcur&&Math.abs(P.qty*P.price-P.value)<=Math.max(0.05,P.value*0.01)?P.vcur:(P.vcur||'EUR');
    P.crypto=G.type==='wallet'||!!(P.sym&&CRYPTO_SYM.test(P.sym));
    if(!P.name)P.name=P.sym||P.isin;
    G.positions.push(P);last=P;
  }
  /* regroupe les lignes d'un même titre (plusieurs lots) */
  groups.forEach(g=>{const m=new Map();g.positions.forEach(p=>{const k=p.isin||p.sym||norm(p.name);const o=m.get(k);if(!o){m.set(k,p);return}
    const q=o.qty+p.qty;const pru=(o.pru!=null&&p.pru!=null)?(o.qty*o.pru+p.qty*p.pru)/q:(o.pru??p.pru);o.cost=o.cost!=null||p.cost!=null?(o.cost||0)+(p.cost||0):null;o.value=(o.value||0)+(p.value||0);o.qty=q;o.pru=pru});g.positions=[...m.values()];
    g.positions.forEach(p=>{p.qty=+p.qty.toFixed(8);p.price=+(+p.price).toFixed(p.price<1?6:4);if(p.pru!=null)p.pru=+(+p.pru).toFixed(4);p.value=r2(p.value)});
    const allEur=g.positions.every(p=>(p.vcur||p.cur)==='EUR');
    g.sum=r2(sum(g.positions.map(p=>p.value)));g.check=g.total!=null&&g.positions.length&&allEur?{ok:Math.abs(g.sum-g.total)<=Math.max(0.05,g.total*0.002),total:g.total,sum:g.sum}:null});
  const out=groups.filter(g=>g.positions.length||g.cash!=null);
  if(docCash!=null&&!out.some(g=>g.kind==='cash')){const g=out.find(g=>g.kind==='pos');if(g&&g.cash==null)g.cash=docCash}
  /* date du relevé : dates portées sur les lignes de positions, sinon « au JJ/MM/AAAA », sinon fin de période */
  let date=null;const cnt={};dates.map(d=>parseDateH(d)).filter(Boolean).forEach(d=>cnt[d]=(cnt[d]||0)+1);const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];if(top)date=top[0];
  if(!date){const m=ntxt.match(/\b(?:au|arrete au|en date du|situation au|valorisation au|as of)\s+(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}|\d{1,2}(?:er)?\s+[a-z]{3,9}\.?\s+\d{4})/);if(m)date=parseDateH(m[1].replace(/(\d)er\b/,'$1'))}
  if(!date&&res.period)date=res.period.to;
  return {groups:out,date,n:sum(out.map(g=>g.positions.length))};
}
