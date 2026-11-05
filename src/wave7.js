/* ================= V5.0 — dix automatisations =================
   1 dossier de dépôt Drive · 2 écriture dans les feuilles · 3 rattrapage de l'historique · 4 catégorisation par Claude
   5 contrôle des dividendes · 6 intérêts des livrets à la quinzaine · 7 veille des abonnements · 8 budget proposé
   9 journal d'erreurs et mode sans échec · 10 affectation automatique de l'épargne aux objectifs.
   Tout est réglable dans la page « Automatisations » ; chaque automatisme est isolé (try/catch) pour ne jamais bloquer l'application. */

/* ---------- réglages ---------- */
const W7_DEF={drop:true,sheetAuto:false,gap:true,budAuto:false,budRoll:true,goalAuto:false};
function w7(){const s=ST();if(!s.auto||typeof s.auto!=='object')s.auto={};const A=s.auto;Object.keys(W7_DEF).forEach(k=>{if(typeof A[k]!=='boolean')A[k]=W7_DEF[k]});return A}
const W7={drop:{busy:false,err:null,pend:[],at:null,last:null},sheet:{busy:false,res:null,err:null,msg:''},gap:0,ai:{busy:false},errs:[],safe:false};
const w7safe=fn=>{try{return fn()}catch(e){w7Log(e,'auto');return null}};
function w7P(res){let p=res&&res.payload;if(typeof p==='string'){try{p=JSON.parse(p)}catch(e){}}
  if(p==null&&res&&Array.isArray(res.content)){const b=res.content.find(x=>x.type==='text');if(b){try{p=JSON.parse(b.text)}catch(e){p=b.text}}}return p}

/* ================= 9. journal d'erreurs et mode sans échec ================= */
const W7_BOOT='vigie:boot';
{let n=0;try{n=+(localStorage.getItem(W7_BOOT)||0)||0;localStorage.setItem(W7_BOOT,String(n+1))}catch(e){}W7.safe=n>=2}
function w7Log(e,where){try{if(e&&(e.code==='needs_reauth'||e.code==='not_granted'))return;const m=String(e&&(e.message||e.reason&&e.reason.message||e.reason)||e||'').slice(0,300);if(!m||/ResizeObserver|Script error/.test(m))return;
  const row={at:new Date().toISOString(),w:String(where||'').slice(0,30),m,v:(S.ui&&S.ui.view)||'',ver:typeof APP==='object'?(APP.ver||''):''};
  if(W7.errs.length&&W7.errs[W7.errs.length-1].m===m)return;W7.errs.push(row);if(W7.errs.length>50)W7.errs.shift();clearTimeout(W7.errT);W7.errT=setTimeout(w7ErrFlush,5000)}catch(x){}}
async function w7ErrFlush(){if(STORE.mode!=='cloud'||!STORE.db||S.demo)return;try{const ref=STORE.db.doc(P('errlog'));let rows=[];try{const s=await ref.get();if(s.exists)rows=(s.data()||{}).rows||[]}catch(e){}
  const seen=new Set(rows.map(r=>r.at+r.m));W7.errs.forEach(r=>{if(!seen.has(r.at+r.m))rows.push(r)});rows=rows.slice(-50);await ref.set({rows,at:new Date().toISOString()})}catch(e){}}
window.addEventListener('error',e=>w7Log(e.error||e.message,'window'));
window.addEventListener('unhandledrejection',e=>w7Log(e.reason,'promise'));
/* rendu protégé : une vue en erreur n'écrase plus l'application */
{const _r=render;render=function(){try{return _r.apply(this,arguments)}catch(e){w7Log(e,'render:'+((S.ui&&S.ui.view)||''));
  if(S.ui&&S.ui.view&&S.ui.view!=='home'&&!W7.rFail){W7.rFail=1;S.ui.view='home';S.ui.ovl=null;try{_r()}catch(e2){w7Fatal(e2)}W7.rFail=0;try{toast(t('w7.err.view'),true)}catch(x){}return}
  w7Fatal(e)}}}
function w7Fatal(e){const app=document.getElementById('app');if(!app)return;
  app.innerHTML=`<div style="max-width:560px;margin:60px auto;padding:24px;font:15px/1.5 system-ui"><h2 style="margin:0 0 8px">${esc(t('w7.fatal.h'))}</h2><p>${esc(t('w7.fatal.p'))}</p><p style="color:#888;font-size:13px">${esc(String(e&&e.message||e).slice(0,200))}</p><p><button class="btn" onclick="location.reload()">${esc(t('w7.fatal.reload'))}</button> <button class="btn sec" onclick="try{localStorage.setItem('vigie:boot','5')}catch(e){};location.reload()">${esc(t('w7.fatal.safe'))}</button></p></div>`}
/* mode sans échec : design par défaut, automatismes suspendus ; activé après deux démarrages interrompus */
{const _d=design;design=function(){return W7.safe?{skin:'inst',ui:'full',density:'normal',fs:'m'}:_d()}}
EXT.boot.push(d=>{setTimeout(()=>{try{localStorage.setItem(W7_BOOT,'0')}catch(e){}},10000)});
EXT.A.w7safeOff=()=>{W7.safe=false;try{localStorage.setItem(W7_BOOT,'0')}catch(e){}render();toast(t('w7.safe.off'))};
EXT.A.w7errClear=async()=>{W7.errs=[];try{if(STORE.db)await STORE.db.doc(P('errlog')).delete()}catch(e){}W7.errDoc=[];render()};
async function w7ErrLoad(){try{if(!STORE.db)return;const s=await STORE.db.doc(P('errlog')).get();W7.errDoc=s.exists?((s.data()||{}).rows||[]):[]}catch(e){W7.errDoc=[]}}

/* ================= 1. dossier de dépôt Google Drive ================= */
const W7_DROP_NAME=()=>APP.name+' — dépôt';
function w7DropCfg(){const s=ST();if(!s.drop||typeof s.drop!=='object')s.drop={};const D0=s.drop;if(!D0.seen||typeof D0.seen!=='object')D0.seen={};if(!Array.isArray(D0.pend))D0.pend=[];return D0}
async function w7DropScan(manual){const mcp=S.cap.mcp;if(!mcp||S.demo||W7.safe||!w7().drop||W7.drop.busy)return;W7.drop.busy=true;W7.drop.err=null;if(manual)render();
  try{const C=w7DropCfg();
    if(!C.folder){const q=`title = '${W7_DROP_NAME().replace(/'/g,"\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const f=w7P(await mcp.callTool(GS_SERVER,'search_files',{query:q,pageSize:5,excludeContentSnippets:true},{cache:false}));const hit=f&&Array.isArray(f.files)&&f.files[0];
      if(hit&&hit.id)C.folder=hit.id;else{const r=await mcp.callTool(GS_SERVER,'create_file',{title:W7_DROP_NAME(),contentMimeType:'application/vnd.google-apps.folder'});C.folder=w6Id(r);if(!C.folder)throw {code:'format'}}save()}
    const L=w7P(await mcp.callTool(GS_SERVER,'search_files',{query:`parentId = '${C.folder}' and trashed = false`,pageSize:50,excludeContentSnippets:true},{cache:false}));
    const files=(L&&Array.isArray(L.files)?L.files:[]).filter(f=>f&&f.id&&!/folder$/.test(f.mimeType||''));let nOps=0,nCash=0,nNew=0;
    for(const f of files){const sig=f.modifiedTime||f.etag||'1';if(C.seen[f.id]===sig)continue;const nm=String(f.title||'');const ext=(nm.split('.').pop()||'').toLowerCase();
      if(ext==='csv'||/csv/.test(f.mimeType||'')){const txt=await w7DropText(f.id);const first=(txt.replace(/^﻿/,'').split(/\r?\n/)[0]||'');const sep=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
        let tr=false;try{tr=isTrCsv(parseCSVText(first,sep)[0]||[])}catch(e){}
        if(tr){const r=w6TrApply([txt]);nOps+=r.nOps;nCash+=r.nCash;C.seen[f.id]=sig;continue}}
      if(['csv','pdf','ofx','qif','xlsx','xls','json'].includes(ext)||/pdf|csv|sheet|excel/.test(f.mimeType||'')){if(!C.pend.some(p=>p.id===f.id)){C.pend.push({id:f.id,n:nm.slice(0,120),mt:f.mimeType||'',sig});nNew++}}
      else C.seen[f.id]=sig}
    C.at=new Date().toISOString();W7.drop.last={ops:nOps,cash:nCash,pend:C.pend.length,files:files.length};save();
    if(nOps||nCash){toast(t('w6.tr.done',{o:nOps,c:nCash}));if(typeof gsySync==='function')setTimeout(()=>gsySync(false),1500);setTimeout(()=>w7SheetCheck(false),4000)}
    else if(manual)toast(t('w7.drop.scanned',{n:files.length,p:C.pend.length}));
  }catch(e){W7.drop.err=e&&e.code==='not_granted'?'denied':(e&&e.code)||'net';w7Log(e,'drop')}
  W7.drop.busy=false;render()}
function w7B64(res){const p=w7P(res);if(p&&typeof p.content==='string')return p.content;if(p&&typeof p.base64Content==='string')return p.base64Content;return null}
async function w7DropBytes(id){const r=await S.cap.mcp.callTool(GS_SERVER,GS_TOOL,{fileId:id},{cache:false});const b=w7B64(r);
  if(b){const s=atob(b);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u}
  const txt=gsText(r);if(typeof txt==='string')return new TextEncoder().encode(txt);throw {code:'format'}}
async function w7DropText(id){const u=await w7DropBytes(id);let s=new TextDecoder('utf-8').decode(u);if(s.includes('\uFFFD'))s=new TextDecoder('windows-1252').decode(u);return s}
EXT.A.w7dropScan=()=>w7DropScan(true);
EXT.A.w7dropImp=async()=>{const C=w7DropCfg();if(!C.pend.length||W7.drop.busy)return;W7.drop.busy=true;render();const files=[];
  try{for(const p of C.pend.slice(0,10)){try{const u=await w7DropBytes(p.id);const ext=(p.n.split('.').pop()||'').toLowerCase();
      files.push(new File([u],p.n,{type:ext==='pdf'?'application/pdf':ext==='csv'?'text/csv':p.mt||'application/octet-stream'}));C.seen[p.id]=p.sig}catch(e){w7Log(e,'drop-dl')}}
    C.pend=C.pend.filter(p=>C.seen[p.id]!==p.sig);save()}finally{W7.drop.busy=false}
  if(files.length)startImport(files);else{toast(t('w7.drop.dlFail'),true);render()}};
EXT.A.w7dropSkip=id=>{const C=w7DropCfg();const p=C.pend.find(x=>x.id===id);if(p)C.seen[p.id]=p.sig;C.pend=C.pend.filter(x=>x.id!==id);save();render()};

/* ================= 2. écriture des opérations dans tes feuilles (Carnet d'ordres) ================= */
const SH_SERVER='Google Sheets';
const W7_TY={buy:'Achat',sell:'Vente',div:'Dividende',int:'Intérêts'};
const xlSerial=d=>Math.round((Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))-Date.UTC(1899,11,30))/86400000);
async function w7SheetMissing(src){const g=gsyCfg();const id=g.files[src];if(!id)return null;const a=gsyInvAcc(src);if(!a)return null;
  const x=await gsyFetch(id,true);const B=await xlBook(x.b64);const R=await gsyParseInv(B);if(!R)return {src,a,id,miss:[],err:'format'};const O=R.orders||[];const ops=iopsOf(a.id);
  const first=O.reduce((m,o)=>!m||o.d<m?o.d:m,'');const from=[first||'0000-00-00',dAdd(today(),-180)].sort().pop();
  const used=new Set();const miss=[];
  ops.filter(o=>['buy','sell','div','int'].includes(o.t)&&o.src!=='gsheet'&&o.d>=from&&o.d<=today()).sort((x,y)=>x.d.localeCompare(y.d)).forEach(o=>{
    const net=Math.abs(o.t==='buy'||o.t==='sell'?(+o.q||0):iopNet(o));
    const i=O.findIndex((s,j)=>!used.has(j)&&s.t===o.t&&Math.abs(daysBetween(s.d,o.d))<=3&&(o.t==='buy'||o.t==='sell'?Math.abs(s.q-net)<=Math.max(1e-6,net*0.005):Math.abs(Math.abs(s.tot||s.q*s.px-s.fee-s.tax)-net)<=Math.max(0.02,net*0.02)));
    if(i>-1){used.add(i);return}
    const isin=o.isin||'';const ref=O.find(s=>isin&&gsyIsin(a,s.n,s.g,ops)===isin);const h=(a.holdings||[]).find(x=>isin&&x.isin===isin);
    const name=ref?ref.n:(h&&h.name)||o.n||isin;const code=ref?ref.g:(h&&(h.gsym||''))||'';
    const q=o.t==='buy'||o.t==='sell'?+o.q:1;const px=o.t==='buy'||o.t==='sell'?(+o.px||Math.abs(+o.amt||0)/(+o.q||1)):Math.abs(+o.amt||0);
    miss.push({id:o.id,t:o.t,d:o.d,n:name,g:code,q:+(+q).toFixed(8),px:+(+px).toFixed(4),fee:r2(Math.abs(+o.fee||0)),tax:r2(Math.abs(+o.tax||0))})});
  return {src,a,id,miss}}
async function w7SheetCheck(manual){const mcp=S.cap.mcp;if(!mcp||S.demo||W7.safe||W7.sheet.busy)return;const g=gsyCfg();const srcs=['pea','cto'].filter(k=>g.files[k]);if(!srcs.length)return;
  W7.sheet.busy=true;W7.sheet.err=null;if(manual)render();
  try{const out=[];for(const s of srcs){try{const r=await w7SheetMissing(s);if(r)out.push(r)}catch(e){w7Log(e,'sheet-'+s)}}W7.sheet.res={at:new Date().toISOString(),list:out};
    if(w7().sheetAuto&&out.some(r=>r.miss.length)){W7.sheet.busy=false;await w7SheetWrite(false);return}}
  catch(e){W7.sheet.err=(e&&e.code)||'net'}W7.sheet.busy=false;render()}
async function w7SheetWrite(manual){const mcp=S.cap.mcp;const R=W7.sheet.res;if(!mcp||!R||W7.sheet.busy)return;W7.sheet.busy=true;render();let n=0;
  try{for(const r of R.list){if(!r.miss.length)continue;
      const meta=w7P(await mcp.callTool(SH_SERVER,'get_spreadsheet',{spreadsheetId:r.id,fields:['sheets.properties.title']},{cache:false}));
      const titles=(meta&&Array.isArray(meta.sheets)?meta.sheets:[]).map(s=>s&&s.properties&&s.properties.title).filter(Boolean);const sh=titles.find(x=>gsyK(x).includes('carnet'));if(!sh)throw {code:'nosheet'};
      const q="'"+sh.replace(/'/g,"''")+"'";const top=w7P(await mcp.callTool(SH_SERVER,'get_values',{spreadsheetId:r.id,range:q+'!A1:AI15'},{cache:false}));const rows=(top&&top.values)||[];
      const hi=rows.findIndex(row=>(row||[]).some(c=>gsyK(c)==='achatvente'));if(hi<0)throw {code:'nohdr'};const H={};(rows[hi]||[]).forEach((c,j)=>{const k=gsyK(c);if(k&&H[k]==null)H[k]=j});
      const need=['achatvente','nometfaction','codegoogle','qte','date','cours','frais','impots'];if(['achatvente','qte','date','cours'].some(k=>H[k]==null))throw {code:'nohdr'};
      const col=j=>{let s='';j++;while(j>0){const m=(j-1)%26;s=String.fromCharCode(65+m)+s;j=Math.floor((j-1)/26)}return s};
      const ct=col(H.achatvente);const vals=w7P(await mcp.callTool(SH_SERVER,'get_values',{spreadsheetId:r.id,range:`${q}!${ct}${hi+2}:${ct}3000`},{cache:false}));
      const filled=((vals&&vals.values)||[]);let last=-1;filled.forEach((v,i)=>{if(v&&String(v[0]??'').trim())last=i});const row0=hi+2+last+1;
      const cs=need.map(k=>H[k]).filter(v=>v!=null);const c0=Math.min(...cs),c1=Math.max(...cs);
      const data=r.miss.map(m=>{const line=new Array(c1-c0+1).fill(null);const put=(k,v)=>{if(H[k]!=null)line[H[k]-c0]=v};
        put('achatvente',W7_TY[m.t]);put('nometfaction',m.n);put('codegoogle',m.g||'');put('qte',m.q);put('date',xlSerial(m.d));put('cours',m.px);put('frais',m.fee||'');put('impots',m.tax||'');return line});
      await mcp.callTool(SH_SERVER,'update_values',{spreadsheetId:r.id,range:`${q}!${col(c0)}${row0}:${col(c1)}${row0+data.length-1}`,values:data});n+=data.length;r.miss=[]}
    W7.sheet.msg=t('w7.sh.done',{n});toast(W7.sheet.msg);if(typeof gsySync==='function')setTimeout(()=>gsySync(true),2500)}
  catch(e){W7.sheet.err=e&&e.code==='not_granted'?'denied':(e&&e.code)||'net';w7Log(e,'sheet-write');toast(t('w7.sh.fail'),true)}
  W7.sheet.busy=false;render()}
EXT.A.w7shCheck=()=>w7SheetCheck(true);
EXT.A.w7shWrite=()=>w7SheetWrite(true);
function w7SheetMissN(){const R=W7.sheet.res;return R?sum(R.list.map(r=>r.miss.length)):0}

/* ================= 3. rattrapage de l'historique (jours où Vigie n'a pas été ouverte) ================= */
function w7GapFill(){if(!w7().gap||S.demo||W7.safe)return 0;const d=D();const H=d.history||[];const real=H.filter(h=>!h.r);if(real.length<1)return 0;
  if(ST().gapAt===today())return 0;
  const have=new Set(H.map(h=>h.d));const from=[real[0].d,dAdd(today(),-180)].sort().pop();const to=dAdd(today(),-1);if(from>to)return 0;
  const miss=[];for(let x=dAdd(from,1);x<=to;x=dAdd(x,1))if(!have.has(x))miss.push(x);if(!miss.length){ST().gapAt=today();return 0}
  const E=new Map(histRows().map(r=>[r.d,r]));const keys=['nw','g','db',...CLASSES.map(c=>c.k)];
  const sorted=[...H].sort((a,b)=>a.d.localeCompare(b.d));const add=[];
  miss.forEach(x=>{const e=E.get(x);if(!e)return;const prev=[...sorted].reverse().find(h=>h.d<x);const next=sorted.find(h=>h.d>x);
    const off=(h)=>{const eh=h&&E.get(h.d);if(!h||!eh)return null;const o={};keys.forEach(k=>o[k]=(+h[k]||0)-(+eh[k]||0));return o};
    const o0=off(prev),o1=off(next);const fr=prev&&next?daysBetween(prev.d,x)/Math.max(1,daysBetween(prev.d,next.d)):0;
    const row={d:x,r:1};keys.forEach(k=>{const a=o0?o0[k]:(o1?o1[k]:0),b=o1?o1[k]:a;row[k]=r2((+e[k]||0)+a+(b-a)*fr)});add.push(row)});
  if(!add.length){ST().gapAt=today();return 0}
  d.history=[...H,...add].sort((a,b)=>a.d.localeCompare(b.d));if(d.history.length>1500)d.history.splice(0,d.history.length-1500);
  ST().gapAt=today();ST().gapN=(+ST().gapN||0)+add.length;W7.gap=add.length;return add.length}

/* ================= 4. catégorisation par Claude ================= */
async function w7AiCat(scope){const sample=S.cap.sample;if(!sample||W7.ai.busy)return;
  const L=D().txs.filter(x=>(x.c==='uncat'||!x.c)&&x.d>=dAdd(today(),-400)&&(!scope||ymOf(x.d)===scope)).slice(-80);if(!L.length){toast(t('w7.ai.none'));return}
  W7.ai.busy=true;render();
  try{const cats=CATS.filter(c=>c.kind!=='nc').map(c=>`${c.k} = ${catL(c.k)}`).join('\n');
    const lines=L.map((x,i)=>`${i}\t${x.a<0?'débit':'crédit'}\t${Math.abs(+x.a).toFixed(2)}\t${cleanLabel(x.l).slice(0,70)}`).join('\n');
    const prompt=`Tu classes des opérations bancaires françaises d'un particulier (étudiant) dans des catégories de budget.\nCatégories autorisées (clé = libellé) :\n${cats}\n\nRègles : « transfer » pour un virement entre ses propres comptes (y compris vers un courtier, un livret ou une plateforme crypto à son nom) ; « saving » pour un versement d'épargne programmé ; un crédit ne peut pas être une catégorie de dépense, un débit ne peut pas être une catégorie de revenu. Si tu n'es pas raisonnablement sûr, réponds « uncat ».\nRéponds uniquement par un objet JSON {"<numéro>":"<clé>"} couvrant chaque ligne.\n\nOpérations (numéro, sens, montant €, libellé) :\n${lines}`;
    const j=await sample.json(prompt,{modelTier:'default'});let n=0;const keys=new Set(CATS.map(c=>c.k));
    L.forEach((x,i)=>{const c=j&&j[i]!=null?String(j[i]):j&&j[String(i)];if(!c||!keys.has(c)||c==='uncat')return;const k=(CAT[c]||{}).kind;if(x.a<0&&k==='in')return;if(x.a>0&&k==='out'&&c!=='refunds')return;
      x.c=c;x.aic=1;n++;try{w6Learn(x)}catch(e){}});
    save();toast(t('w7.ai.done',{n,m:L.length}))}
  catch(e){const c=e&&e.code;toast(t(c==='not_granted'?'cp.denied':c==='rate_limited'?'cp.rate':'w7.ai.fail'),true);if(c==='not_granted')S.cap.sample=null}
  W7.ai.busy=false;render()}
EXT.A.w7ai=v=>w7AiCat(v||null);

/* ================= 5. contrôle des dividendes ================= */
function w7DivRecv(){const R=[];(D().iops||[]).forEach(o=>{if(o.t==='div'&&o.isin)R.push({isin:o.isin,d:o.d})});
  D().txs.forEach(x=>{if(x.c==='investIncome'&&x.a>0){const m=String(x.l).match(/\b([A-Z]{2}[A-Z0-9]{9}\d)\b/);if(m)R.push({isin:m[1],d:x.d})}});return R}
function w7DivMissing(){const td=today();const R=w7DivRecv();const ack=ST().divAck||{};const out=new Map();
  const held=[];D().accounts.filter(a=>a.include!==false&&!isClosed(a)&&(TYP[a.type]||{}).h).forEach(a=>(a.holdings||[]).forEach(h=>{if(h.isin&&+h.qty>0&&h.kind!=='fe')held.push({a,h})}));
  const firstBuy=(a,isin)=>iopsOf(a.id).filter(o=>o.isin===isin&&o.t==='buy').reduce((m,o)=>!m||o.d<m?o.d:m,'');
  const got=(isin,from)=>R.some(r=>r.isin===isin&&r.d>=from&&r.d<=td);
  const push=(a,h,exp,why)=>{const k=h.isin+'|'+exp.slice(0,7);if(ack[k]||out.has(h.isin))return;out.set(h.isin,{k,a,h,exp,why})};
  held.forEach(({a,h})=>{const fb=firstBuy(a,h.isin);
    R.filter(r=>r.isin===h.isin&&r.d>=dAdd(td,-400)&&r.d<=dAdd(td,-300)).forEach(r=>{const exp=dAdd(r.d,365);if(daysBetween(exp,td)>=21&&daysBetween(exp,td)<=150&&(!fb||fb<dAdd(exp,-30))&&!got(h.isin,dAdd(exp,-45)))push(a,h,exp,'hist')});
    if(+h.div>0&&Array.isArray(h.months))h.months.forEach(m=>{const exp=td.slice(0,4)+'-'+String(m).padStart(2,'0')+'-15';const g=daysBetween(exp,td);if(g>=25&&g<=120&&(!fb||fb<dAdd(exp,-30))&&!got(h.isin,dAdd(exp,-45)))push(a,h,exp,'cal')})});
  return [...out.values()]}
EXT.A.w7divAck=k=>{const s=ST();if(!s.divAck||typeof s.divAck!=='object')s.divAck={};s.divAck[k]=today();save();render()};

/* ================= 6. intérêts des livrets à la quinzaine ================= */
function w7Quinz(y){const Q=[];for(let m=1;m<=12;m++){const mm=String(m).padStart(2,'0');const last=new Date(Date.UTC(y,m,0)).getUTCDate();Q.push([`${y}-${mm}-01`,`${y}-${mm}-15`],[`${y}-${mm}-16`,`${y}-${mm}-${last}`])}return Q}
function w7LivRate(a){const ty=TYP[a.type]||{};return (+a.rate)||(ty.rate?(ST().rates||{})[ty.rate]:0)||0}
function w7LivInt(a,y){const rate=w7LivRate(a);if(!(rate>0))return null;const td=today();const tx=D().txs.filter(x=>x.acc===a.id&&!x.est).sort((p,q)=>p.d.localeCompare(q.d));
  const bal=d=>(+a.balance||0)-sum(tx.filter(x=>x.d>d).map(x=>+x.a||0));const open=a.opened||'';
  let earned=0,proj=0;w7Quinz(y).forEach(([s,e])=>{if(open&&e<open)return;let base=bal(dAdd(s,-1))+sum(tx.filter(x=>x.d>=s&&x.d<=e&&x.a<0).map(x=>+x.a));if(open&&s<=open&&open<=e)base=0;base=Math.max(0,base);
    const v=base*rate/100/24;if(e<td)earned+=v;else proj+=v});
  return {rate,earned:r2(earned),proj:r2(earned+proj)}}
function w7LivAccs(){return D().accounts.filter(a=>a.include!==false&&!isClosed(a)&&(TYP[a.type]||{}).cls==='savings'&&w7LivRate(a)>0)}
const W7_INT_RE=/int[eé]r[eê]ts?|r[eé]mun[eé]ration|capitalisation/i;
function w7LivPost(){if(S.demo||W7.safe)return 0;const y=+today().slice(0,4)-1;const s=ST();if(!s.livPost||typeof s.livPost!=='object')s.livPost={};let n=0;
  D().accounts.filter(a=>(TYP[a.type]||{}).cls==='savings'&&w7LivRate(a)>0).forEach(a=>{const key=a.id+':'+y;
    const real=D().txs.find(x=>x.acc===a.id&&!x.est&&x.a>0&&x.d>=y+'-12-15'&&x.d<=(y+1)+'-02-15'&&W7_INT_RE.test(x.l||''));
    const est=D().txs.find(x=>x.acc===a.id&&x.est&&x.d===y+'-12-31');
    if(real&&est){D().txs=D().txs.filter(x=>x!==est);n++;return}
    if(s.livPost[key]||real||est)return;if(a.closed&&a.closed<y+'-12-31')return;
    const I=w7LivInt(a,y);if(!I||!(I.earned>0.01)){s.livPost[key]='0';return}
    D().txs.push({id:uid(),d:y+'-12-31',a:I.earned,l:t('w7.liv.lab',{y}),c:'investIncome',acc:a.id,est:1,src:'vigie'});if(a.src!=='gsheet')a.balance=r2((+a.balance||0)+I.earned);
    const yy=String(y);if(STORE.txYears&&!STORE.txYears.includes(yy))STORE.txYears.push(yy);s.livPost[key]=today();n++});
  return n}
EXT.accDrawer.push(a=>{const ty=TYP[a.type]||{};if(ty.cls!=='savings'||!(w7LivRate(a)>0))return '';const y=+today().slice(0,4);const I=w7LivInt(a,y);if(!I)return '';
  return `<div class="card flat" style="margin:0 0 16px"><div class="hrow" style="justify-content:space-between;flex-wrap:wrap;gap:6px"><b>${esc(t('w7.liv.t',{y}))}</b><span class="pill good">${esc(t('w7.liv.rate',{r:String(I.rate).replace('.',',')}))}</span></div>
  <div class="wkv" style="margin-top:8px"><div><span>${esc(t('w7.liv.earned'))}</span><b>${money(I.earned,2)}</b></div><div><span>${esc(t('w7.liv.proj'))}</span><b>${money(I.proj,2)}</b></div></div><p class="note" style="margin:8px 0 0">${esc(t('w7.liv.note'))}</p></div>`});

/* ================= 7. veille des abonnements ================= */
function w7Subs(){const td=today();const from=dAdd(td,-400);const G={};const ack=ST().subAck||{};
  D().txs.filter(x=>x.a<0&&x.d>=from&&!x.est&&(CAT[x.c]||{}).kind==='out').forEach(x=>{const k=norm(cleanLabel(x.l)).split(' ').filter(w=>w.length>1&&!/^\d+$/.test(w)).slice(0,2).join(' ');if(!k)return;(G[k]=G[k]||[]).push(x)});
  const out=[];Object.entries(G).forEach(([k,g])=>{const bm={};g.forEach(x=>{const m=ymOf(x.d);bm[m]=(bm[m]||0)-x.a});const ms=Object.keys(bm).sort();if(ms.length<2)return;
    const am=ms.map(m=>bm[m]);const lastM=ms[ms.length-1];if(lastM<ymOf(dAdd(td,-45)))return;const L=g.filter(x=>ymOf(x.d)===lastM).map(x=>x.l)[0];
    const prev=am.slice(0,-1).slice(-4).sort((a,b)=>a-b);const med=prev[prev.length>>1];const last=am[am.length-1];
    const stable=prev.length>=2&&prev[prev.length-1]/Math.max(0.01,prev[0])<=1.25;
    if(stable&&last>med*1.03&&last-med>=0.5){const key=k+'|up|'+lastM;if(!ack[key])out.push({key,kind:'up',k,l:cleanLabel(L),from:r2(med),to:r2(last),m:lastM})}
    const firstM=ms[0];const consec=ms.every((m,i)=>!i||m===ymAdd(ms[i-1],1));const amp=Math.max(...am)/Math.max(0.01,Math.min(...am));
    if(firstM>=ymOf(dAdd(td,-100))&&consec&&ms.length>=2&&amp<=1.3){const key=k+'|new';if(!ack[key])out.push({key,kind:'new',k,l:cleanLabel(L),to:r2(last),m:firstM})}});
  return out.sort((a,b)=>(b.to||0)-(a.to||0)).slice(0,12)}
EXT.A.w7subAck=k=>{const s=ST();if(!s.subAck||typeof s.subAck!=='object')s.subAck={};s.subAck[k]=today();save();render()};

/* ================= 8. budget proposé chaque mois ================= */
function w7BudProp(){const cur=today().slice(0,7);const ms=[1,2,3,4,5,6].map(i=>ymAdd(cur,-i));const G=ms.map(m=>aggTx(monthTx(m))).filter(g=>g.n);if(!G.length)return null;
  const prev=aggTx(monthTx(ymAdd(cur,-1)));const B=D().budgets||{};const roll=w7().budRoll;const out={};
  CATS.filter(c=>c.kind==='out').forEach(c=>{const avg=sum(G.map(g=>g.cat[c.k]||0))/G.length;if(avg<4)return;const base=Math.ceil(avg/5)*5;
    let carry=0;if(roll&&+B[c.k]>0)carry=Math.min(base*0.5,Math.max(0,+B[c.k]-(prev.cat[c.k]||0)));out[c.k]={base,carry:r2(carry),v:Math.ceil((base+carry)/5)*5,avg:r2(avg),cur:+B[c.k]||0}});
  return {ym:cur,cats:out,total:sum(Object.values(out).map(x=>x.v)),n:G.length}}
function w7BudApply(){const P=w7BudProp();if(!P)return false;const B=D().budgets;Object.keys(B).forEach(k=>{if((CAT[k]||{}).kind==='out')delete B[k]});Object.entries(P.cats).forEach(([k,x])=>B[k]=x.v);
  const s=ST();s.budAutoYm=P.ym;save();return true}
EXT.A.w7budApply=()=>{if(w7BudApply()){toast(t('w7.bud.applied',{m:monthT(today().slice(0,7))}));render()}};
function w7BudPending(){return !ST().budAutoYm||ST().budAutoYm!==today().slice(0,7)}

/* ================= 10. affectation automatique de l'épargne aux objectifs ================= */
function w7GoalAlloc(){const gs=D().goals||[];const rem=new Map();D().accounts.forEach(a=>rem.set(a.id,Math.max(0,accValue(a))));const out=new Map();
  gs.forEach(g=>{const tg=+g.target||0;if(!g.accounts||!g.accounts.length){out.set(g.id,+g.manual||0);return}let need=tg>0?tg:Infinity;let got=0;
    g.accounts.forEach(id=>{if(need<=0)return;const r=rem.get(id)||0;const take=Math.min(r,need);rem.set(id,r-take);got+=take;need-=take});out.set(g.id,r2(got))});
  const cur=today().slice(0,7);const ms=[1,2,3,4,5,6].map(i=>ymAdd(cur,-i));const G=ms.map(m=>aggTx(monthTx(m))).filter(g=>g.n);
  let save6=G.length?Math.max(0,sum(G.map(g=>(g.inc||0)-(g.exp||0)))/G.length):0;const monthly=new Map();
  gs.forEach(g=>{const c=out.get(g.id)||0;const left=Math.max(0,(+g.target||0)-c);let n=g.date?Math.max(1,Math.round(daysBetween(today(),g.date)/30.4)):24;const need=left/n;const m=Math.min(save6,need);save6-=m;monthly.set(g.id,r2(m))});
  return {cur:out,monthly}}
{const _gc=goalCurrent;goalCurrent=function(g){if(!S.data||!w7().goalAuto||W7.safe)return _gc(g);try{const A=W7.galloc&&W7.galloc.key===w7GoalKey()?W7.galloc.v:(W7.galloc={key:w7GoalKey(),v:w7GoalAlloc()}).v;return A.cur.has(g.id)?A.cur.get(g.id):_gc(g)}catch(e){return _gc(g)}}}
function w7GoalKey(){return [(D().goals||[]).map(g=>g.id+':'+g.target+':'+(g.accounts||[]).join(',')).join('|'),D().accounts.reduce((s,a)=>s+(+accValue(a)||0),0).toFixed(2),D().txs.length,today()].join('#')}
function w7GoalMonthly(){if(!w7().goalAuto)return;const A=w7GoalAlloc();(D().goals||[]).forEach(g=>{if(g.monthlyMan==null)g.monthlyMan=+g.monthly||0;g.monthly=A.monthly.get(g.id)||0;g.autoM=1})}
function w7GoalRestore(){(D().goals||[]).forEach(g=>{if(g.autoM){if(g.monthlyMan!=null)g.monthly=g.monthlyMan;delete g.monthlyMan;delete g.autoM}})}
EXT.A.w7goalUp=id=>{const L=D().goals;const i=L.findIndex(g=>g.id===id);if(i>0){[L[i-1],L[i]]=[L[i],L[i-1]];W7.galloc=null;w7GoalMonthly();save();render()}};
EXT.A.w7goalDn=id=>{const L=D().goals;const i=L.findIndex(g=>g.id===id);if(i>-1&&i<L.length-1){[L[i+1],L[i]]=[L[i],L[i+1]];W7.galloc=null;w7GoalMonthly();save();render()}};

/* ---------- réglages : bascules ---------- */
EXT.A.w7tog=v=>{const [k,on]=String(v).split(':');if(!(k in W7_DEF))return;const A=w7();A[k]=on==='1';
  if(k==='goalAuto'){W7.galloc=null;if(A[k])w7GoalMonthly();else w7GoalRestore()}
  if(k==='drop'&&A[k])setTimeout(()=>w7DropScan(true),200);if(k==='gap'&&A[k]){ST().gapAt='';w7GapFill()}
  if(k==='budAuto'&&A[k]&&w7BudPending())w7BudApply();save();render()};

/* ================= page « Automatisations » ================= */
VIEWS.push({k:'auto',g:'data',ic:'spark'});
function w7Tog(k,lab,hint){const on=w7()[k];return `<div class="row" style="flex-wrap:wrap"><div class="m" style="min-width:180px"><b style="font-weight:500;white-space:normal">${esc(lab)}</b>${hint?`<span style="white-space:normal">${esc(hint)}</span>`:''}</div>${seg('w7tog',[[k+':1',t('w7.on')],[k+':0',t('w7.off')]],k+':'+(on?'1':'0'),lab)}</div>`}
function w7Sec(n,ic,title,sub,status,body){return `<section class="card"><div class="ch"><div style="display:flex;gap:12px;align-items:flex-start"><span class="av sm" style="--c:var(--accent)">${ico(ic)}</span><div><h2>${n}. ${esc(title)}</h2><p>${esc(sub)}</p></div></div>${status||''}</div>${body}</section>`}
const w7Pill=(ok,txt)=>`<span class="pill ${ok===true?'good':ok===false?'warn':''}" style="flex-shrink:0">${esc(txt)}</span>`;
function autoView(){const A=w7();const C=w7DropCfg();const mcpOk=!!S.cap.mcp;const parts=[];
  /* 1 */
  const dropBody=`${w7Tog('drop',t('w7.drop.tog'),t('w7.drop.togH'))}
    <div class="row" style="flex-wrap:wrap"><div class="m"><b style="font-weight:500">${esc(t('w7.drop.folder'))}</b><span>${esc(C.folder?W7_DROP_NAME():t('w7.drop.noFolder'))}${C.at?' · '+esc(t('w7.lastRun',{d:dateT(C.at.slice(0,10),'short')})):''}</span></div>${C.folder?`<a class="btn ghost sm" href="https://drive.google.com/drive/folders/${esc(C.folder)}" target="_blank" rel="noopener">${ico('ext')}${esc(t('w7.open'))}</a>`:''}<button class="btn sec sm" data-a="w7dropScan" ${W7.drop.busy||!mcpOk||!A.drop?'disabled':''}>${ico('refresh')}${esc(t(W7.drop.busy?'w7.busy':'w7.drop.scan'))}</button></div>
    ${C.pend.length?`<div class="list">${C.pend.map(p=>`<div class="row"><span class="av sm" style="--c:var(--k1)">${ico('upload')}</span><div class="m"><b>${esc(p.n)}</b><span>${esc(t('w7.drop.toImp'))}</span></div><button class="link" data-a="w7dropSkip" data-v="${esc(p.id)}">${esc(t('w7.ignore'))}</button></div>`).join('')}</div><div style="margin-top:10px"><button class="btn sm" data-a="w7dropImp" ${W7.drop.busy?'disabled':''}>${ico('upload')}${esc(t('w7.drop.impN',{n:C.pend.length}))}</button></div>`:''}
    ${W7.drop.err?`<p class="note" style="color:var(--warn)">${esc(t('w7.err.'+(W7.drop.err==='denied'?'denied':'net')))}</p>`:''}<p class="note" style="margin:8px 0 0">${esc(t('w7.drop.note'))}</p>`;
  parts.push(w7Sec(1,'upload',t('w7.drop.h'),t('w7.drop.s'),C.pend.length?w7Pill(false,t('w7.drop.pend',{n:C.pend.length})):w7Pill(A.drop&&!!C.folder,A.drop?(C.folder?t('w7.active'):t('w7.waiting')):t('w7.off')),dropBody));
  /* 2 */
  const R=W7.sheet.res;const nm=w7SheetMissN();const g=gsyCfg();const hasSheets=['pea','cto'].some(k=>g.files[k]);
  const shBody=`${w7Tog('sheetAuto',t('w7.sh.tog'),t('w7.sh.togH'))}
    ${R?R.list.map(r=>`<div class="row"><div class="m"><b style="font-weight:500">${esc(t('gsy.src.'+r.src))}</b><span>${esc(r.miss.length?t('w7.sh.miss',{n:r.miss.length}):t('w7.sh.ok'))}</span></div></div>${r.miss.length?`<div class="list" style="margin:0 0 6px 14px">${r.miss.slice(0,12).map(m=>`<div class="row" style="padding:5px 0"><div class="m"><span>${esc(dateT(m.d,'short'))} · ${esc(W7_TY[m.t])} · ${esc(m.n)}${m.t==='buy'||m.t==='sell'?' · '+esc(String(m.q).replace('.',','))+' × '+esc(moneyT(m.px,2)):' · '+esc(moneyT(m.px,2))}</span></div></div>`).join('')}</div>`:''}`).join(''):`<p class="note">${esc(t(hasSheets?'w7.sh.notYet':'w7.sh.noSheets'))}</p>`}
    <div class="hrow" style="gap:8px;margin-top:8px"><button class="btn sec sm" data-a="w7shCheck" ${W7.sheet.busy||!mcpOk||!hasSheets?'disabled':''}>${ico('refresh')}${esc(t(W7.sheet.busy?'w7.busy':'w7.sh.check'))}</button>${nm?`<button class="btn sm" data-a="w7shWrite" ${W7.sheet.busy?'disabled':''}>${ico('sheet')}${esc(t('w7.sh.write',{n:nm}))}</button>`:''}</div>
    ${W7.sheet.err?`<p class="note" style="color:var(--warn)">${esc(t('w7.sh.err.'+(['denied','nosheet','nohdr'].includes(W7.sheet.err)?W7.sheet.err:'net')))}</p>`:''}<p class="note" style="margin:8px 0 0">${esc(t('w7.sh.note'))}</p>`;
  parts.push(w7Sec(2,'sheet',t('w7.sh.h'),t('w7.sh.s'),nm?w7Pill(false,t('w7.sh.missP',{n:nm})):w7Pill(R?true:null,R?t('w7.sh.okP'):t('w7.sh.unk')),shBody));
  /* 3 */
  const H=D().history||[];const nr=H.filter(h=>h.r&&h.d>=dAdd(today(),-180)).length;
  parts.push(w7Sec(3,'bars',t('w7.gap.h'),t('w7.gap.s'),w7Pill(A.gap?true:null,A.gap?t('w7.active'):t('w7.off')),`${w7Tog('gap',t('w7.gap.tog'),t('w7.gap.togH'))}<p class="note" style="margin:8px 0 0">${esc(t('w7.gap.stat',{n:+ST().gapN||0,r:nr}))}</p>`));
  /* 4 */
  const unc=D().txs.filter(x=>(x.c==='uncat'||!x.c)&&x.d>=dAdd(today(),-400)).length;const aiN=D().txs.filter(x=>x.aic).length;
  parts.push(w7Sec(4,'copilot',t('w7.ai.h'),t('w7.ai.s'),w7Pill(unc?false:true,unc?t('w7.ai.unc',{n:unc}):t('w7.ai.zero')),`<div class="row" style="flex-wrap:wrap"><div class="m"><b style="font-weight:500">${esc(t('w7.ai.stat',{n:aiN}))}</b><span>${esc(t('w7.ai.how'))}</span></div><button class="btn sm" data-a="w7ai" ${!S.cap.sample||!unc||W7.ai.busy?'disabled':''}>${ico('copilot')}${esc(t(W7.ai.busy?'w7.busy':'w7.ai.btn'))}</button></div>${S.cap.sample?'':`<p class="note">${esc(t('w7.ai.noCap'))}</p>`}`));
  /* 5 */
  const dm=w7safe(w7DivMissing)||[];
  parts.push(w7Sec(5,'coins',t('w7.div.h'),t('w7.div.s'),w7Pill(!dm.length,dm.length?t('w7.div.n',{n:dm.length}):t('w7.div.ok')),dm.length?`<div class="list">${dm.map(x=>`<div class="row" style="flex-wrap:wrap"><div class="m" style="min-width:200px"><b style="white-space:normal">${esc(x.h.name)}</b><span>${esc(t('w7.div.exp',{d:dateT(x.exp,'short'),a:x.a.name}))} · ${esc(t('w7.div.why.'+x.why))}</span></div><button class="link" data-a="w7divAck" data-v="${esc(x.k)}">${esc(t('w7.div.ack'))}</button></div>`).join('')}</div>`:`<p class="note">${esc(t('w7.div.none'))}</p>`));
  /* 6 */
  const LA=w7LivAccs();const y=+today().slice(0,4);
  parts.push(w7Sec(6,'savings',t('w7.liv.h'),t('w7.liv.s'),w7Pill(true,t('w7.active')),LA.length?`<div class="list">${LA.map(a=>{const I=w7LivInt(a,y)||{earned:0,proj:0,rate:0};return `<button class="row btnrow" data-a="acc" data-v="${a.id}">${accAvatar(a,1)}<div class="m"><b>${esc(a.name)}</b><span>${esc(t('w7.liv.line',{r:String(I.rate).replace('.',','),e:moneyT(I.earned,2)}))}</span></div><div class="r"><b>${money(I.proj,2)}</b><span class="muted" style="font-size:12px">${esc(t('w7.liv.at',{y}))}</span></div></button>`}).join('')}</div><p class="note" style="margin:8px 0 0">${esc(t('w7.liv.post'))}</p>`:`<p class="note">${esc(t('w7.liv.noAcc'))}</p>`));
  /* 7 */
  const sb=w7safe(w7Subs)||[];
  parts.push(w7Sec(7,'phone',t('w7.sub.h'),t('w7.sub.s'),w7Pill(!sb.length,sb.length?t('w7.sub.n',{n:sb.length}):t('w7.sub.ok')),sb.length?`<div class="list">${sb.map(x=>`<div class="row" style="flex-wrap:wrap"><span class="av sm" style="--c:var(${x.kind==='up'?'--warn':'--k1'})">${ico(x.kind==='up'?'alert':'plus')}</span><div class="m" style="min-width:200px"><b style="white-space:normal">${esc(x.l)}</b><span>${esc(x.kind==='up'?t('w7.sub.up',{a:moneyT(x.from,2),b:moneyT(x.to,2),m:monthT(x.m)}):t('w7.sub.new',{a:moneyT(x.to,2),m:monthT(x.m)}))}</span></div><button class="link" data-a="w7subAck" data-v="${esc(x.key)}">${esc(t('w7.seen'))}</button></div>`).join('')}</div>`:`<p class="note">${esc(t('w7.sub.none'))}</p>`));
  /* 8 */
  const BP=w7safe(w7BudProp);const pend=w7BudPending();
  parts.push(w7Sec(8,'budget',t('w7.bud.h'),t('w7.bud.s'),w7Pill(!pend,pend?t('w7.bud.pend'):t('w7.bud.done',{m:monthT(ST().budAutoYm)})),`${w7Tog('budAuto',t('w7.bud.tog'),t('w7.bud.togH'))}${w7Tog('budRoll',t('w7.bud.roll'),t('w7.bud.rollH'))}
    ${BP?`<div class="list">${Object.entries(BP.cats).sort((a,b)=>b[1].v-a[1].v).slice(0,10).map(([k,x])=>`<div class="row"><span class="av sm" style="--c:var(${(CAT[k]||{}).c||'--k6'})">${ico((CAT[k]||{}).ic||'more')}</span><div class="m"><b>${esc(catL(k))}</b><span>${esc(t('w7.bud.line',{a:moneyT(x.avg,0),c:moneyT(x.carry,0),n:BP.n}))}</span></div><div class="r"><b>${money(x.v,0)}</b>${x.cur?`<span class="muted" style="font-size:12px">${esc(t('w7.bud.now',{v:moneyT(x.cur,0)}))}</span>`:''}</div></div>`).join('')}</div>
    <div class="hrow" style="justify-content:space-between;margin-top:10px;flex-wrap:wrap;gap:8px"><b>${esc(t('w7.bud.tot',{v:moneyT(BP.total,0)}))}</b><button class="btn sm" data-a="w7budApply">${ico('check')}${esc(t('w7.bud.apply',{m:monthT(BP.ym)}))}</button></div>`:`<p class="note">${esc(t('w7.bud.noData'))}</p>`}`));
  /* 9 */
  const EL=[...(W7.errDoc||[]),...W7.errs].filter((r,i,arr)=>arr.findIndex(z=>z.at===r.at&&z.m===r.m)===i).slice(-10).reverse();
  parts.push(w7Sec(9,'shield',t('w7.err.h'),t('w7.err.s'),w7Pill(!EL.length,EL.length?t('w7.err.n',{n:EL.length}):t('w7.err.zero')),`${W7.safe?`<div class="demo-band" style="margin:0 0 10px">${ico('shield')}<div><b>${esc(t('w7.safe.on'))}</b> ${esc(t('w7.safe.onS'))}</div><button class="btn sm" data-a="w7safeOff">${esc(t('w7.safe.quit'))}</button></div>`:''}
    ${EL.length?`<div class="list">${EL.map(r=>`<div class="row"><div class="m"><b style="white-space:normal;font-weight:500">${esc(r.m)}</b><span>${esc(dateT(String(r.at).slice(0,10),'short'))} · ${esc(r.w||'')}${r.v?' · '+esc(r.v):''}</span></div></div>`).join('')}</div><div style="margin-top:8px"><button class="btn ghost sm" data-a="w7errClear">${ico('trash')}${esc(t('w7.err.clear'))}</button></div>`:`<p class="note">${esc(t('w7.err.none'))}</p>`}<p class="note" style="margin:8px 0 0">${esc(t('w7.err.note'))}</p>`));
  /* 10 */
  const gs=D().goals||[];const GA=gs.length?w7safe(w7GoalAlloc):null;
  parts.push(w7Sec(10,'goals',t('w7.goal.h'),t('w7.goal.s'),w7Pill(A.goalAuto?true:null,A.goalAuto?t('w7.active'):t('w7.off')),`${w7Tog('goalAuto',t('w7.goal.tog'),t('w7.goal.togH'))}
    ${gs.length&&GA?`<div class="list">${gs.map((g,i)=>`<div class="row"><span class="pill">${i+1}</span><div class="m"><b>${esc(g.name)}</b><span>${esc(t('w7.goal.line',{c:moneyT(GA.cur.get(g.id)||0,0),t:moneyT(+g.target||0,0),m:moneyT(GA.monthly.get(g.id)||0,0)}))}</span></div><div class="hrow" style="gap:4px"><button class="ib" data-a="w7goalUp" data-v="${g.id}" aria-label="${esc(t('w7.goal.up'))}" ${i?'':'disabled'}>${ico('up')}</button><button class="ib" data-a="w7goalDn" data-v="${g.id}" aria-label="${esc(t('w7.goal.down'))}" ${i<gs.length-1?'':'disabled'}>${ico('down')}</button></div></div>`).join('')}</div>`:`<p class="note">${esc(t('w7.goal.none'))}</p>`}`));
  return `<div class="pghead" style="margin-bottom:14px"><span class="av" style="--c:var(--accent)">${ico('spark')}</span><div class="m"><div class="eyebrow">${esc(t('w7.eye'))}</div><h2>${esc(t('w7.title'))}</h2></div></div><p class="note" style="margin:-4px 0 16px">${esc(t('w7.intro'))}</p><div class="grid g2" style="align-items:start">${parts.join('')}</div>`}
EXT.V.auto=autoView;

/* ---------- « À surveiller » ---------- */
{const _wi7=watchItems;watchItems=function(){const L=_wi7();try{if(S.demo)return L;
  if(W7.safe)L.unshift({lvl:'warn',ic:'shield',l:t('w7.safe.on'),s:t('w7.safe.onS'),act:'w7safeOff',v:'',prio:9});
  const C=w7DropCfg();if(C.pend.length)L.push({lvl:'info',ic:'upload',l:t('w7.drop.w',{n:C.pend.length}),s:C.pend.slice(0,2).map(p=>p.n).join(' · '),act:'w7dropImp',v:'',prio:6});
  const nm=w7SheetMissN();if(nm&&!w7().sheetAuto)L.push({lvl:'info',ic:'sheet',l:t('w7.sh.w',{n:nm}),s:t('w7.sh.ws'),act:'go',v:'auto',prio:5});
  const dm=w7DivMissing();if(dm.length)L.push({lvl:'warn',ic:'coins',l:t('w7.div.w',{n:dm.length}),s:dm.slice(0,2).map(x=>x.h.name).join(' · '),act:'go',v:'auto',prio:6});
  const sb=w7Subs();if(sb.length)L.push({lvl:sb.some(x=>x.kind==='up')?'warn':'info',ic:'phone',l:t('w7.sub.w',{n:sb.length}),s:sb.slice(0,2).map(x=>x.l).join(' · '),act:'go',v:'auto',prio:5});
  if(!w7().budAuto&&w7BudPending()&&+today().slice(8,10)<=10&&D().txs.length)L.push({lvl:'info',ic:'budget',l:t('w7.bud.w',{m:monthT(today().slice(0,7))}),s:t('w7.bud.ws'),act:'go',v:'auto',prio:3});
  L.sort((a,b)=>b.prio-a.prio)}catch(e){w7Log(e,'watch')}return L}}

/* ---------- lien depuis Paramètres et Sources ---------- */
{const _pv7=prefsView;prefsView=function(){const h=_pv7();const card=`<section class="card" style="grid-column:1/-1"><div class="ch"><div><h2>${esc(t('w7.title'))}</h2><p>${esc(t('w7.prefS'))}</p></div><button class="btn sec sm" data-a="go" data-v="auto">${ico('spark')}${esc(t('w7.open'))}</button></div></section>`;
  const i=h.indexOf('<section class="card dsec"');if(i<0)return card+h;const j=h.indexOf('</section>',i)+10;return h.slice(0,j)+card+h.slice(j)}}
{const _cv7=closeView;closeView=function(){const h=_cv7();if(!S.cap.sample)return h;const ym=S.ui.closeYm||ymAdd(today().slice(0,7),-1);const n=monthTx(ym).filter(x=>x.c==='uncat'||!x.c).length;if(!n)return h;
  const btn=`<div class="demo-band" style="margin:0 0 14px">${ico('copilot')}<div><b>${esc(t('w7.ai.h'))}</b> ${esc(t('w7.ai.cl',{n}))}</div><button class="btn sm" data-a="w7ai" data-v="${ym}" ${W7.ai.busy?'disabled':''}>${esc(t(W7.ai.busy?'w7.busy':'w7.ai.btn'))}</button></div>`;
  const i=h.indexOf('<div class="grid" style="gap:16px">');return i<0?btn+h:h.slice(0,i)+btn+h.slice(i)}}

/* ---------- démarrage ---------- */
EXT.boot.push(d=>{setTimeout(()=>{if(S.data!==d||S.demo)return;
  w7ErrLoad();if(W7.safe){render();return}
  let ch=false;
  if(w7safe(w7LivPost))ch=true;
  if(w7safe(w7GapFill))ch=true;
  if(w7().budAuto&&w7BudPending()&&w7safe(w7BudApply))toast(t('w7.bud.applied',{m:monthT(today().slice(0,7))}));
  if(w7().goalAuto)w7safe(w7GoalMonthly);
  if(ch)save();render();
  setTimeout(()=>w7DropScan(false),2500);setTimeout(()=>w7SheetCheck(false),9000);
  clearInterval(W7.tick);W7.tick=setInterval(()=>{if(S.data===d&&document.visibilityState!=='hidden'){w7DropScan(false)}},30*60000)},5000)});
IC.ext='<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>';
