/* ================= V4.6 — Indépendance : tes feuilles Google comme source de données =================
   La page télécharge chaque classeur (export .xlsx par le connecteur Google Drive), le décompresse elle-même
   et lit les onglets utiles : Portefeuille et Carnet d'ordres (PEA, compte-titres), Transactions (livrets),
   première feuille (dettes). Rien n'est envoyé ailleurs ; seuls les identifiants des fichiers sont gardés dans tes réglages.
   Règles retenues :
   - positions : la quantité de la feuille fait foi ; le PRU vient au choix du journal (méthode du prix moyen pondéré) ou de la feuille ;
   - ordres : seuls les achats et ventes récents absents du journal y sont ajoutés (le journal garde tout l'historique) ;
   - livrets : solde = versements + intérêts − retraits ; dernier « changement de taux » ; mouvements ajoutés sans doublon ;
   - dettes : jamais créées d'office, seulement après rattachement explicite. */
IC.sheet='<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>';
const XLSX_MT='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const GSY={busy:false,at:0,msg:'',err:{},res:{},rep:null,titles:{},started:false};
const GSY_SRC=['pea','cto','liv','debt','mkt','cry'];const GSY_CSV=['mkt','cry'];
function gsyCfg(){const s=ST();if(!s.gsync||typeof s.gsync!=='object')s.gsync={};const g=s.gsync;['files','map','pru'].forEach(k=>{if(!g[k]||typeof g[k]!=='object')g[k]={}});return g}
const gsyK=s=>norm(s).replace(/[^a-z0-9]/g,'');

/* ---------- lecteur .xlsx minimal (zip + XML) ---------- */
const xUn=s=>String(s).replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi,(m,c)=>{const k=c.toLowerCase();return k==='lt'?'<':k==='gt'?'>':k==='amp'?'&':k==='quot'?'"':k==='apos'?"'":k[1]==='x'?String.fromCodePoint(parseInt(k.slice(2),16)):String.fromCodePoint(+k.slice(1))});
const xAttr=(a,k)=>{const m=a.match(new RegExp('(?:^|\\s)'+k.replace(':','\\:')+'="([^"]*)"'));return m?m[1]:null};
async function xlInflate(u8){if(typeof DecompressionStream==='undefined')throw {code:'nozip'};const s=new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));return new Uint8Array(await new Response(s).arrayBuffer())}
async function xlUnzip(u8,want){
  const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);let e=-1;
  for(let i=u8.length-22;i>=Math.max(0,u8.length-65557);i--){if(dv.getUint32(i,true)===0x06054b50){e=i;break}}
  if(e<0)throw {code:'format'};
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const out=new Map();const td=new TextDecoder('utf-8');
  for(let k=0;k<n;k++){
    if(dv.getUint32(p,true)!==0x02014b50)break;
    const m=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true);
    const name=td.decode(u8.subarray(p+46,p+46+nl));p+=46+nl+xl+cl;if(!want(name))continue;
    const ln=dv.getUint16(lo+26,true),lx=dv.getUint16(lo+28,true);const st=lo+30+ln+lx;const raw=u8.subarray(st,st+cs);
    const data=m===0?raw:m===8?await xlInflate(raw):null;if(data)out.set(name,td.decode(data));
  }
  return out;
}
const xlCol=ref=>{let n=0;for(const ch of String(ref).replace(/\d+$/,''))n=n*26+(ch.charCodeAt(0)-64);return n-1};
async function xlBook(b64){
  const bin=atob(String(b64).replace(/\s/g,''));const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  const meta=await xlUnzip(u8,n=>n==='xl/workbook.xml'||n==='xl/_rels/workbook.xml.rels'||n==='xl/sharedStrings.xml');
  const wb=meta.get('xl/workbook.xml')||'',rels=meta.get('xl/_rels/workbook.xml.rels')||'';
  const R={};rels.replace(/<Relationship\b([^>]*)\/?>/g,(m,a)=>{const id=xAttr(a,'Id'),tg=xAttr(a,'Target');if(id&&tg)R[id]=tg.replace(/^\//,'').replace(/^(?!xl\/)/,'xl/');return m});
  const sheets=[];wb.replace(/<sheet\b([^>]*)\/?>/g,(m,a)=>{sheets.push({name:xUn(xAttr(a,'name')||''),path:R[xAttr(a,'r:id')]});return m});
  const ss=[];(meta.get('xl/sharedStrings.xml')||'').replace(/<si>([\s\S]*?)<\/si>/g,(m,b)=>{let s='';b.replace(/<rPh\b[\s\S]*?<\/rPh>/g,'').replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g,(x,tx)=>{s+=tx;return x});ss.push(xUn(s));return m});
  if(!sheets.length)throw {code:'format'};
  return {u8,sheets,ss};
}
async function xlSheet(B,test){
  const sh=B.sheets.find(s=>test(gsyK(s.name)));if(!sh||!sh.path)return null;
  const m=await xlUnzip(B.u8,n=>n===sh.path);const x=m.get(sh.path)||'';const rows=[];
  x.replace(/<row\b[^>]*>([\s\S]*?)<\/row>/g,(m0,body)=>{const row=[];
    body.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,(m1,a,inner)=>{const col=xlCol(xAttr(a,'r')||'A');const tp=xAttr(a,'t');let v=null;inner=inner||'';
      if(tp==='inlineStr'){const mt=inner.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/);v=mt?xUn(mt[1]):''}
      else{const mv=inner.match(/<v>([\s\S]*?)<\/v>/);if(mv){const s=mv[1];v=tp==='s'?(B.ss[+s]??''):(tp==='str'||tp==='e')?xUn(s):tp==='b'?s==='1':+s}}
      if(v!==null&&v!==''&&col>=0)row[col]=v;return m1});
    rows.push(row);return m0});
  return {name:sh.name,rows};
}

/* ---------- lecture des onglets ---------- */
const xNum=v=>typeof v==='number'?v:typeof v==='string'&&v.trim()?parseAmount(v):NaN;
const xDate=v=>{if(typeof v==='number'&&v>20000&&v<80000)return new Date(Math.round((v-25569)*864e5)).toISOString().slice(0,10);const d=v?parseDate(String(v)):null;return d||null};
function gsyHdr(rows,need){for(let i=0;i<Math.min(rows.length,60);i++){const r=rows[i]||[];const m={};r.forEach((v,j)=>{if(typeof v==='string'){const k=gsyK(v);if(k&&m[k]===undefined)m[k]=j}});if(need.every(k=>m[k]!==undefined))return {i,m}}return null}
function gsyRight(rows,test){for(const r of rows){if(!r)continue;for(let j=0;j<r.length;j++){if(typeof r[j]==='string'&&test(gsyK(r[j]))){for(let k=j+1;k<Math.min(r.length,j+4);k++){const n=xNum(r[k]);if(isFinite(n))return n}}}}return null}
function gsyOrders(S1){if(!S1)return null;const H=gsyHdr(S1.rows,['achatvente','qte','date']);if(!H)return null;const c=k=>H.m[k];const out=[];
  for(let i=H.i+1;i<S1.rows.length;i++){const r=S1.rows[i]||[];const ty=gsyK(r[c('achatvente')]||'');const d=xDate(r[c('date')]);if(!ty||!d)continue;
    const tp=/^(achat|roundup|saveback|buy|arrondi)/.test(ty)?'buy':/^(vente|sell)/.test(ty)?'sell':/^divid/.test(ty)?'div':/^int[e]?r/.test(ty)?'int':null;if(!tp)continue;
    const q=Math.abs(xNum(r[c('qte')]));if(!(q>0))continue;
    out.push({t:tp,n:String(r[c('nometfaction')]??'').trim(),g:String(r[c('codegoogle')]??'').trim().toUpperCase(),q,d,px:Math.abs(xNum(r[c('cours')]))||0,fee:Math.abs(xNum(r[c('frais')]))||0,tax:Math.abs(xNum(r[c('impots')]))||0,tot:xNum(r[c('montanttotalen')])})}
  return out}
function gsyPos(S1){if(!S1)return null;const H=gsyHdr(S1.rows,['nometfaction','qte','prufrais']);if(!H)return null;const c=k=>H.m[k];const pos=[];
  for(let i=H.i+1;i<S1.rows.length;i++){const r=S1.rows[i]||[];const n=String(r[c('nometfaction')]??'').trim();const q=xNum(r[c('qte')]);if(!n||!(q>0))continue;
    pos.push({n,type:String(r[c('type')]??''),g:String(r[c('codegoogle')]??'').trim().toUpperCase(),q,pru:xNum(r[c('prufrais')]),px:xNum(r[c('coursactuel')]),val:xNum(r[c('valoactuelle')]),cur:String(r[c('devise')]??'').trim().toUpperCase()})}
  const cash=gsyRight(S1.rows,k=>/^especes(sur|$)/.test(k));
  return {pos,cash:cash!=null&&isFinite(cash)?cash:null}}
async function gsyParseInv(B){const P=gsyPos(await xlSheet(B,k=>k==='portefeuille'||k.startsWith('portefeuille')));if(!P)return null;const O=gsyOrders(await xlSheet(B,k=>k.includes('carnet')))||[];return {...P,orders:O}}
async function gsyParseLiv(B){const S1=await xlSheet(B,k=>k==='transactions')||await xlSheet(B,k=>k.includes('transaction'));if(!S1)return null;
  const H=gsyHdr(S1.rows,['livret','typedetransaction','date','montant']);if(!H)return null;const c=k=>H.m[k];const out=[];
  for(let i=H.i+1;i<S1.rows.length;i++){const r=S1.rows[i]||[];const l=String(r[c('livret')]??'').trim();const ty=gsyK(r[c('typedetransaction')]||'');const d=xDate(r[c('date')]);const a=xNum(r[c('montant')]);if(!l||!ty||!d||!isFinite(a))continue;out.push({l,ty,d,a})}
  return {rows:out}}
async function gsyParseDebt(B){
  for(const sh of B.sheets){const S1=await xlSheet(B,k=>k===gsyK(sh.name));if(!S1)continue;const H=gsyHdr(S1.rows,['date','motif','montant']);if(!H)continue;
    const c=k=>H.m[k];const mv=[];for(let i=H.i+1;i<S1.rows.length;i++){const r=S1.rows[i]||[];const d=xDate(r[c('date')]);const a=xNum(r[c('montant')]);if(d&&isFinite(a))mv.push({d,a,l:String(r[c('motif')]??'').trim()})}
    const init=gsyRight(S1.rows,k=>k==='montantinitial');const due=gsyRight(S1.rows,k=>k==='montantapayer'||k==='resteapayer'||k==='montantdu');
    const main=isFinite(due)&&due!=null?due:(init!=null?init+sum(mv.map(x=>x.a)):null);
    const extra=[];const hr=S1.rows[H.i]||[];hr.forEach((v,j)=>{if(typeof v!=='string')return;const k=gsyK(v);if(!/^dette.+/.test(k)||k==='dettes')return;let last=null;for(let i=H.i+1;i<S1.rows.length;i++){const r=S1.rows[i]||[];const d=xDate(r[j-1]);const a=xNum(r[j]);if(d&&isFinite(a))last={d,a}}if(last)extra.push({k:'debt:'+k,l:v.trim(),v:Math.max(0,last.a),d:last.d})});
    return {main,mv,extra}}
  return null}
const GSY_PARSE={pea:gsyParseInv,cto:gsyParseInv,liv:gsyParseLiv,debt:gsyParseDebt};

/* ---------- téléchargement ---------- */
function gsyB64(res){let p=res&&res.payload;if(typeof p==='string'){try{p=JSON.parse(p)}catch(e){p=null}}
  if(!p&&res&&Array.isArray(res.content)){const b=res.content.find(x=>x.type==='text');if(b){try{p=JSON.parse(b.text)}catch(e){}}}
  return p&&typeof p.content==='string'?{b64:p.content,title:p.title||''}:null}
async function gsyFetch(id,fresh){const r=await S.cap.mcp.callTool(GS_SERVER,GS_TOOL,{fileId:id,exportMimeType:XLSX_MT},fresh?{cache:false}:{cache:{staleTime:600000,gcTime:1800000}});const x=gsyB64(r);if(!x)throw {code:'format'};return x}

/* ---------- rapprochement avec tes comptes ---------- */
function gsyDetach(a){const F=finSet();if(a.fid){F.map[a.fid]='__skip';delete a.fid;delete a.fsync;delete a.fwarn}
  (a.holdings||[]).forEach(h=>{delete h.fin;delete h.fhid;if(h.liveSrc==='Finary'){delete h.liveSrc;delete h.liveAt}});a.src='gsheet';a.gsAt=today()}
function gsyInvAcc(src){const g=gsyCfg();const id=g.map[src];let a=id&&D().accounts.find(x=>x.id===id);if(a)return a;
  const L=D().accounts.filter(x=>x.type===(src==='pea'?'pea':'cto'));a=L.find(x=>x.src==='gsheet')||L.find(x=>/trade ?republic/i.test((x.inst||'')+' '+x.name))||L[0]||null;if(a)g.map[src]=a.id;return a}
const gsyTok=s=>new Set(norm(s).split(' ').filter(w=>w.length>1&&!['ucits','etf','the','de','du','la'].includes(w)));
function gsyIsin(a,n,g,ops){const nn=norm(n);if(!nn&&!g)return '';
  let o=ops.find(o=>o.isin&&norm(o.n||'')===nn);if(o)return o.isin;
  let h=(a.holdings||[]).find(h=>h.isin&&norm(h.name)===nn);if(h)return h.isin;
  const sym=g.includes(':')?g.split(':').pop():g;
  if(sym){h=(a.holdings||[]).find(h=>h.isin&&(String(h.gsym||'').toUpperCase()===g||(h.ticker&&pfRoot(h.ticker)===pfRoot(sym))));if(h)return h.isin;
    for(const q of QB.map.values()){if(q.isin&&q.kind!=='crypto'&&q.kind!=='fx'&&String(q.sym||'').toUpperCase()===sym)return String(q.isin).toUpperCase()}
    const c=ACAT.tk&&ACAT.tk.get(sym);if(c&&c.isin)return String(c.isin).toUpperCase()}
  /* noms proches (« MSCI World Swap PEA UCITS ETF EUR (Acc) » ↔ « MSCI World Swap PEA EUR (Acc) ») */
  const T=gsyTok(n);let best=null,bs=0;const cand=[...ops.filter(o=>o.isin&&o.n).map(o=>[o.n,o.isin]),...(a.holdings||[]).filter(h=>h.isin).map(h=>[h.name,h.isin])];
  cand.forEach(([nm,is])=>{const U=gsyTok(nm);let i=0;T.forEach(w=>{if(U.has(w))i++});const j=i/(T.size+U.size-i||1);if(j>bs){bs=j;best=is}});
  return bs>=0.6?best:'';
}
function gsyOrdersApply(a,orders,rep){
  const ops=iopsOf(a.id);const last=ops.reduce((m,o)=>o.d>m?o.d:m,'');const from=last?dAdd(last,-10):'0000-00-00';let s0=Math.max(0,...ops.map(x=>+x.s||0));let n=0;
  orders.filter(o=>(o.t==='buy'||o.t==='sell')&&o.d>=from&&o.d<=today()).forEach(o=>{
    const isin=gsyIsin(a,o.n,o.g,ops);const nn=norm(o.n);
    const twin=ops.find(x=>x.t===o.t&&Math.abs(daysBetween(x.d,o.d))<=3&&((isin&&x.isin===isin)||(!isin&&norm(x.n||'')===nn))&&Math.abs((+x.q||0)-o.q)<=Math.max(1e-6,o.q*0.005));if(twin)return;
    const ext='gs:'+hash([a.id,o.d,o.t,isin||nn,o.q.toFixed(6)].join('|'));if(ops.some(x=>x.ext===ext))return;
    if(!isin&&!nn)return;
    const ref=ops.find(x=>isin&&x.isin===isin)||{};
    const op={id:uid(),acc:a.id,d:o.d,t:o.t,isin:isin||'',n:ref.n||o.n,q:+o.q.toFixed(8),px:o.px,amt:r2((o.t==='buy'?-1:1)*o.q*o.px),fee:r2(o.fee),tax:r2(o.tax),cur:'EUR',cls:ref.cls||'',ext,s:++s0,src:'gsheet'};
    if(!Array.isArray(D().iops))D().iops=[];D().iops.push(op);ops.push(op);n++;rep.ops.push({a:a.name,d:o.d,t:o.t,n:op.n,q:op.q,px:op.px});
  });
  return n;
}
function gsyPosApply(src,a,P,rep){
  const g=gsyCfg();const ops=iopsOf(a.id);const L=replayOps(ops);const mode=g.pru[a.id]||'ledger';const seen=new Set();const fx=ST().fx;const acur=a.cur||'EUR';
  P.pos.forEach(p=>{
    const isin=gsyIsin(a,p.n,p.g,ops);const sym=p.g?p.g.split(':').pop():'';
    let h=pfMatch(a,{isin:isin||null,name:p.n,sym:sym||null});
    if(!h){const kind=/etf|tracker|fonds|fund/i.test(p.type)?'etf':/action|stock|share/i.test(p.type)?'stock':pfKind({name:p.n,isin,sym},{type:a.type});
      h={id:uid(),name:p.n,isin:isin||'',ticker:sym,gsym:p.g||'',kind,cur:acur,qty:0,price:isFinite(p.px)&&p.px>0?p.px:0,pru:0,ter:0,div:0,region:pfRegion({name:p.n,isin,sym},kind),sector:kind==='stock'?'other':'diversified',months:[],src:'gsheet'};a.holdings.push(h);rep.created.push(a.name+' · '+p.n)}
    seen.add(h.id);if(!h.isin&&isin)h.isin=isin;if(!h.gsym&&p.g)h.gsym=p.g;
    const hc=h.cur||acur;const lp=L.open.find(x=>(isin&&x.isin===isin)||(h.isin&&x.isin===h.isin));
    const lpru=lp?(hc!==acur&&lp.pruPx>0&&(lp.cur||acur)===hc?lp.pruPx:lp.pru*((fx[acur]??1)/(fx[hc]??1))):null;
    const spru=isFinite(p.pru)&&p.pru>0?p.pru/(fx[hc]??1):null;
    const pru=mode==='sheet'?(spru??lpru):(lpru??spru);
    const q0=+h.qty||0,p0=+h.pru||0;h.qty=p.q;if(pru!=null&&isFinite(pru))h.pru=+pru.toFixed(4);
    if(!(+h.price>0)&&isFinite(p.px)&&p.px>0)h.price=+(p.px/(fx[hc]??1)).toFixed(4);
    if(Math.abs(q0-h.qty)>1e-8||Math.abs(p0-(+h.pru||0))>1e-4)rep.pos.push({a:a.name,n:h.name,q0,q1:h.qty,p0,p1:+h.pru||0});
    rep.gap.push({a:a.name,acc:a.id,n:h.name,sq:p.q,sp:spru,lq:lp?lp.qty:0,lp:lpru});
  });
  const before=a.holdings.filter(h=>!seen.has(h.id)&&h.kind!=='fe'&&+h.qty>0);
  if(P.pos.length){before.forEach(h=>rep.rm.push(a.name+' · '+h.name));a.holdings=a.holdings.filter(h=>seen.has(h.id)||h.kind==='fe'||!(+h.qty>0))}
  if(P.cash!=null)a.cash=r2(P.cash/(fx[acur]??1));
  gsyDetach(a);a.updatedAt=today();
}
const LIV_T={livreta:'livretA',ldds:'ldds',livretdeveloppementdurableetsolidaire:'ldds',livretjeune:'livretJeune',lep:'lep',livretepargnepopulaire:'lep'};
function gsyLivApply(R,rep){const g=gsyCfg();const by={};R.rows.forEach(r=>{const k=gsyK(r.l);(by[k]=by[k]||{l:r.l,rows:[]}).rows.push(r)});
  Object.entries(by).forEach(([k,B])=>{const type=LIV_T[k];if(!type)return;let bal=0,rate=null;const mv=[];
    B.rows.sort((x,y)=>x.d.localeCompare(y.d)).forEach(r=>{if(/^changement/.test(r.ty)){rate=r.a;return}const v=(/^retrait/.test(r.ty)?-1:1)*Math.abs(r.a);bal+=v;mv.push({d:r.d,a:r2(v),int:/^interet/.test(r.ty)})});
    const mk='liv:'+k;let a=g.map[mk]&&D().accounts.find(x=>x.id===g.map[mk]);if(!a)a=D().accounts.find(x=>x.type===type&&x.include!==false);
    if(!a){if(!mv.length||Math.abs(bal)<0.005)return;a={id:uid(),name:B.l,inst:'',type,cur:'EUR',balance:0,holdings:[],include:true,createdAt:today(),updatedAt:today(),opened:mv[0].d};D().accounts.push(a);rep.created.push(a.name)}
    g.map[mk]=a.id;const b0=+a.balance||0;a.balance=r2(bal);
    if(rate!=null&&isFinite(rate)){const pr=Math.abs(rate)<0.5?rate*100:rate;a.rate=+pr.toFixed(3)}
    const used=new Set();let added=0;
    mv.forEach((m,i)=>{const twin=D().txs.find(x=>x.acc===a.id&&!used.has(x.id)&&Math.abs(x.a-m.a)<0.005&&Math.abs(daysBetween(x.d,m.d))<=3);if(twin){used.add(twin.id);return}
      const id='gs-'+hash(a.id+'|'+m.d+'|'+m.a+'|'+i);if(D().txs.some(x=>x.id===id))return;
      D().txs.push({id,d:m.d,a:m.a,l:m.int?t('gsy.txInt',{l:B.l}):t(m.a>=0?'gsy.txDep':'gsy.txWd',{l:B.l}),c:m.int?'investIncome':'transfer',acc:a.id,mc:1,src:'gsheet'});used.add(id);added++});
    gsyDetach(a);a.updatedAt=today();rep.liv.push({n:a.name,b0,b1:a.balance,tx:added});
  });
}
function gsyDebtApply(R,rep){const g=gsyCfg();const L=[{k:'debt:main',l:GSY.titles.debt||t('gsy.debt'),v:R.main},...R.extra];GSY.debts=L.filter(x=>x.v!=null&&isFinite(x.v));
  GSY.debts.forEach(x=>{const id=g.map[x.k];const a=id&&D().accounts.find(y=>y.id===id);if(!a)return;const b0=+a.balance||0;a.balance=r2(Math.abs(x.v));if(Math.abs(b0-a.balance)>0.004)rep.liv.push({n:a.name,b0,b1:a.balance,tx:0});gsyDetach(a);a.updatedAt=today()})}
function gsyApply(R){const rep={ops:[],pos:[],rm:[],created:[],liv:[],gap:[]};
  ['pea','cto'].forEach(src=>{const P=R[src];if(!P||!P.pos)return;const a=gsyInvAcc(src);if(!a){GSY.err[src]='noacc';return}gsyOrdersApply(a,P.orders||[],rep);gsyPosApply(src,a,P,rep)});
  if(R.liv)gsyLivApply(R.liv,rep);if(R.debt)gsyDebtApply(R.debt,rep);
  rep.changed=rep.ops.length+rep.pos.length+rep.rm.length+rep.created.length+rep.liv.filter(x=>Math.abs(x.b0-x.b1)>0.004||x.tx).length;return rep}

/* ---------- synchronisation ---------- */
async function gsySync(manual){
  if(GSY.busy||!S.data||S.demo)return;const mcp=S.cap.mcp;const g=gsyCfg();if(!mcp||!GSY_SRC.some(k=>g.files[k]))return;
  GSY.busy=true;GSY.msg='';if(manual)render();const R={};
  for(const src of GSY_SRC){const id=g.files[src];if(!id)continue;
    if(GSY_CSV.includes(src)){try{await mkLoad(src,id,manual);delete GSY.err[src]}catch(e){GSY.err[src]=e&&LIVE_AUTH.includes(e.code)?'auth':e&&e.code==='format'?'format':'fail'}continue}
    try{const x=await gsyFetch(id,manual);GSY.titles[src]=x.title;const B=await xlBook(x.b64);R[src]=await GSY_PARSE[src](B);if(R[src])delete GSY.err[src];else GSY.err[src]='format'}
    catch(e){GSY.err[src]=e&&LIVE_AUTH.includes(e.code)?'auth':e&&e.code==='nozip'?'nozip':'fail'}}
  let rep=null;try{rep=gsyApply(R)}catch(e){console.error(e);GSY.msg=t('gsy.applyErr')}
  GSY.res=R;GSY.rep=rep;GSY.at=Date.now();g.at=new Date().toISOString();
  if(rep&&rep.changed){g.last={at:g.at,ops:rep.ops.length,pos:rep.pos.length,rm:rep.rm.length,cr:rep.created.length,liv:rep.liv.length};save();if(typeof recordSnapshot==='function')try{recordSnapshot()}catch(e){}}
  else if(Object.keys(R).length)save();
  GSY.busy=false;if(manual)GSY.msg=rep?(rep.changed?t('gsy.done',{n:rep.changed}):t('gsy.same')):GSY.msg;
  if(S.phase==='app'&&!S.ui.ovl)render();
}
function gsyStart(){if(GSY.started)return;if(!S.data||!S.cap.mcp||S.phase!=='app'){if((GSY.tries=(GSY.tries||0)+1)<40)setTimeout(gsyStart,3000);return}if(S.demo)return;GSY.started=true;setTimeout(()=>gsySync(false),2500);setInterval(()=>{if(document.visibilityState==='visible')gsySync(false)},30*60000)}
{const _sb4=startBase;startBase=function(){_sb4();gsyStart()}}
/* Finvygo devient facultatif : les cours viennent de la base (Google Finance, Moteur de cotations, Crypto.com) */
{const _sfv=startFV;startFV=function(){if(S.data&&ST().fvOff)return;_sfv()}}
EXT.boot.push(d=>{const s=d.settings||{};if(s.fvOff===undefined)s.fvOff=true;setTimeout(gsyStart,1500)});

/* ---------- actions ---------- */
EXT.A.gsySync=()=>gsySync(true);
EXT.A.gsyUnlink=v=>{const g=gsyCfg();delete g.files[v];delete GSY.err[v];delete GSY.res[v];save();render()};
EXT.A.gsyPru=v=>{const [id,m]=String(v).split('|');gsyCfg().pru[id]=m==='sheet'?'sheet':'ledger';save();gsySync(true)};
EXT.A.gsyDebtNew=v=>{const x=(GSY.debts||[]).find(y=>y.k===v);if(!x)return;const a={id:uid(),name:x.l,inst:'',type:'consumer',cur:'EUR',balance:r2(Math.abs(x.v)),holdings:[],include:true,createdAt:today(),updatedAt:today(),src:'gsheet',gsAt:today()};D().accounts.push(a);gsyCfg().map[x.k]=a.id;save();toast(t('gsy.debtMade',{n:a.name}));render()};
EXT.A.gsyDetach=v=>{const a=D().accounts.find(x=>x.id===v);if(!a)return;if(S.ui.confirm!=='det:'+v){S.ui.confirm='det:'+v;render();return}S.ui.confirm=null;const F=finSet();if(a.fid){F.map[a.fid]='__skip';delete a.fid;delete a.fsync;delete a.fwarn}(a.holdings||[]).forEach(h=>{delete h.fin;delete h.fhid});a.src=a.src||'manual';save();toast(t('gsy.detached',{n:a.name}));render()};
EXT.F.gsyLink=(fd,src)=>{const id=gsIdFrom(fd.get('v'));if(!id||!GSY_SRC.includes(src)){toast(t('gs.badId'),true);return}gsyCfg().files[src]=id;save();gsySync(true)};
EXT.field.gsyMap=(el,v)=>{const k=el.dataset.k;const g=gsyCfg();if(v)g.map[k]=v;else delete g.map[k];save();gsySync(true)};
EXT.field.fvOn=(el,v)=>{ST().fvOff=!v;if(!v&&FV.unsub){try{FV.unsub()}catch(e){}FV.unsub=null;FV.st='idle'}else if(v)startFV();save();render()};

/* ---------- écran « Sources des données » ---------- */
VIEWS.push({k:'sources',g:'data',ic:'sheet'});
function srcOf(a){if(a.src==='gsheet')return ['gsheet','good'];if(a.fid)return ['finary','warn'];
  const ty=TYP[a.type]||{};if(ty.h&&iopsOf(a.id).length)return ['import','acc'];if(!ty.h&&D().txs.some(x=>x.acc===a.id&&!x.fid))return ['import','acc'];return ['manual','']}
function gsyErrT(k){return t('gsy.e.'+k)}
function sourcesView(){
  const g=gsyCfg();const has=GSY_SRC.some(k=>g.files[k]);const acc=D().accounts.filter(a=>a.include!==false);
  const nFin=acc.filter(a=>a.fid).length,nSh=acc.filter(a=>a.src==='gsheet').length;
  const kp=`<div class="kpis k4" style="margin-bottom:16px">${[[t('gsy.k.sheet'),nSh,'good'],[t('gsy.k.fin'),nFin,nFin?'warn':'good'],[t('gsy.k.acc'),acc.length,''],[t('gsy.k.last'),GSY.at?liveAgoAt(GSY.at):g.at?dateT(g.at.slice(0,10),'short'):'—','']].map(([l,v,c])=>`<div class="kpi"><div class="eyebrow">${esc(l)}</div><div class="hero-v" style="font-size:22px"><span class="${c==='good'?'good':c==='warn'?'warn':''}">${esc(String(v))}</span></div></div>`).join('')}</div>`;
  const stat=src=>{const id=g.files[src];if(!id)return t('gsy.unlinked');if(GSY.err[src])return gsyErrT(GSY.err[src]);if(src==='mkt')return MK.rows.length?t('gsy.st.mkt',{n:MK.rows.length}):GSY.busy?t('live.busy'):t('gsy.wait');if(src==='cry')return MK.cry.length?t('gsy.st.cry',{n:MK.cry.length}):GSY.busy?t('live.busy'):t('gsy.wait');const R=GSY.res[src];if(!R)return GSY.busy?t('live.busy'):t('gsy.wait');
    if(src==='liv')return t('gsy.st.liv',{n:R.rows.length});if(src==='debt')return t('gsy.st.debt',{n:(R.mv||[]).length});return t('gsy.st.inv',{p:R.pos.length,o:(R.orders||[]).length})};
  const accSel=(k,types,cur)=>`<select data-f="gsyMap" data-k="${esc(k)}" style="width:auto;max-width:240px;min-height:34px" aria-label="${esc(t('gsy.target'))}"><option value="">${esc(t(types.includes('*debt')?'gsy.none':'gsy.auto'))}</option>${D().accounts.filter(a=>types.includes(a.type)||(types.includes('*debt')&&accCls(a)==='debt')).map(a=>`<option value="${a.id}"${a.id===cur?' selected':''}>${esc(a.name)}</option>`).join('')}</select>`;
  const srcCard=src=>{const id=g.files[src];const title=GSY.titles[src];let extra='';
    if((src==='pea'||src==='cto')&&id){const a=gsyInvAcc(src);extra=`<div class="hrow" style="flex-wrap:wrap;gap:10px;margin-top:10px"><span class="note">${esc(t('gsy.target'))}</span>${accSel(src,[src==='pea'?'pea':'cto','peapme'],g.map[src])}${a?`<span class="note">${esc(t('gsy.pruL'))}</span>${seg('gsyPru',[[a.id+'|ledger',t('gsy.pru.ledger')],[a.id+'|sheet',t('gsy.pru.sheet')]],a.id+'|'+(g.pru[a.id]||'ledger'),t('gsy.pruL'))}`:''}</div>`}
    if(src==='liv'&&GSY.res.liv){const ks=[...new Set(GSY.res.liv.rows.map(r=>gsyK(r.l)))].filter(k=>LIV_T[k]);extra=ks.length?`<div class="list" style="margin-top:8px">${ks.map(k=>{const r=GSY.res.liv.rows.find(x=>gsyK(x.l)===k);return `<div class="row"><div class="m"><b>${esc(r.l)}</b><span>${esc(typL(LIV_T[k]))}</span></div>${accSel('liv:'+k,[LIV_T[k]],g.map['liv:'+k])}</div>`}).join('')}</div>`:''}
    if(src==='debt'&&GSY.debts&&GSY.debts.length){extra=`<div class="list" style="margin-top:8px">${GSY.debts.map(x=>{const linked=g.map[x.k]&&D().accounts.find(a=>a.id===g.map[x.k]);return `<div class="row" style="flex-wrap:wrap"><div class="m" style="min-width:180px"><b>${esc(x.l)}</b><span>${esc(moneyT(x.v,2))}${linked?' · '+esc(t('gsy.linkedTo',{n:linked.name})):''}</span></div><div class="hrow" style="gap:8px">${accSel(x.k,['*debt'],g.map[x.k])}${linked?'':`<button class="btn sec sm" data-a="gsyDebtNew" data-v="${esc(x.k)}">${ico('plus')}${esc(t('gsy.debtNew'))}</button>`}</div></div>`}).join('')}</div><p class="note" style="margin:8px 0 0">${esc(t('gsy.debtNote'))}</p>`}
    return `<div class="card"><div class="ch"><div><h2>${esc(t('gsy.src.'+src))}</h2><p>${esc(t('gsy.srcS.'+src))}</p></div><div class="act">${id?`<a class="btn ghost sm" href="https://docs.google.com/spreadsheets/d/${esc(id)}/edit" target="_blank" rel="noopener">${esc(t('gs.open'))}</a><button class="btn ghost sm" data-a="gsyUnlink" data-v="${src}">${esc(t('gs.unlink'))}</button>`:''}</div></div>
      <div class="row" style="flex-wrap:wrap"><span class="av sm" style="--c:var(${id&&!GSY.err[src]?'--good':id?'--warn':'--k6'})">${ico('sheet')}</span><div class="m" style="min-width:200px"><b style="white-space:normal">${esc(title||(id?t('gsy.linked'):t('gsy.unlinked')))}</b><span style="white-space:normal">${esc(stat(src))}</span></div></div>
      ${id?'':`<form class="inline" data-form="gsyLink" data-v="${src}" style="margin-top:10px"><input name="v" placeholder="${esc(t('gs.linkPh'))}" aria-label="${esc(t('gs.linkPh'))}"><button class="btn sec sm">${esc(t('gs.link'))}</button></form>`}${extra}</div>`};
  const rep=GSY.rep;
  const gaps=(rep&&rep.gap||[]).filter(x=>Math.abs(x.sq-x.lq)>Math.max(1e-6,x.sq*0.001)||(x.sp!=null&&x.lp!=null&&Math.abs(x.sp-x.lp)>Math.max(0.01,x.lp*0.02)));
  const gapC=rep?`<div class="card"><div class="ch"><div><h2>${esc(t('gsy.gapT'))}</h2><p>${esc(t(gaps.length?'gsy.gapS':'gsy.gap0'))}</p></div></div>${gaps.length?`<div class="list">${gaps.map(x=>{const qd=Math.abs(x.sq-x.lq)>Math.max(1e-6,x.sq*0.001);const pd=x.sp!=null&&x.lp!=null&&Math.abs(x.sp-x.lp)>Math.max(0.01,x.lp*0.02);const cell=(l,q,p)=>`<div style="min-width:120px"><div class="eyebrow">${esc(l)}</div><div class="${qd?'warn':''}">${esc(numT(q,6))}</div><div class="note ${pd?'warn':''}">${p!=null?esc(t('gsy.pruX',{v:moneyT(p,2)})):'—'}</div></div>`;return `<div class="row" style="flex-wrap:wrap;align-items:flex-start;gap:12px"><div class="m" style="min-width:180px;flex:1"><b style="white-space:normal">${esc(x.n)}</b><span>${esc(x.a)}</span></div>${cell(t('gsy.sheet'),x.sq,x.sp)}${cell(t('gsy.ledger'),x.lq,x.lp)}</div>`}).join('')}</div><p class="note" style="margin:8px 0 0">${esc(t('gsy.gapN'))}</p>`:''}</div>`:'';
  const logC=rep&&rep.changed?`<div class="card"><div class="ch"><div><h2>${esc(t('gsy.logT'))}</h2><p>${esc(t('gsy.done',{n:rep.changed}))}</p></div></div><div class="list">${[
    ...rep.ops.map(o=>[ico(o.t==='buy'?'plus':'swap'),t('gsy.l.op',{t:t('ti.t.'+o.t),n:o.n,q:numT(o.q,6),d:dateT(o.d,'short')}),o.a]),
    ...rep.pos.map(p=>[ico('bars'),Math.abs(p.q0-p.q1)>1e-8?t('gsy.l.pos',{n:p.n,q0:numT(p.q0,6),q1:numT(p.q1,6)}):p.n,p.a+(Math.abs(p.p0-p.p1)>1e-4?' · '+t('gsy.l.pru',{p0:moneyT(p.p0,2),p1:moneyT(p.p1,2)}):'')]),
    ...rep.rm.map(x=>[ico('trash'),t('gsy.l.rm',{n:x}),'']),...rep.created.map(x=>[ico('plus'),t('gsy.l.new',{n:x}),'']),
    ...rep.liv.filter(x=>Math.abs(x.b0-x.b1)>0.004||x.tx).map(x=>[ico('savings'),t('gsy.l.liv',{n:x.n,b0:moneyT(x.b0,2),b1:moneyT(x.b1,2)}),x.tx?t('gsy.l.tx',{n:x.tx}):''])
  ].slice(0,30).map(([ic,l,s])=>`<div class="row"><span class="av sm" style="--c:var(--k1)">${ic}</span><div class="m"><b style="white-space:normal">${esc(l)}</b>${s?`<span>${esc(s)}</span>`:''}</div></div>`).join('')}</div></div>`:'';
  const depC=`<div class="card"><div class="ch"><div><h2>${esc(t('gsy.depT'))}</h2><p>${esc(t('gsy.depS'))}</p></div></div><div class="list">${acc.map(a=>{const [k,c]=srcOf(a);const conf=S.ui.confirm==='det:'+a.id;return `<div class="row" style="flex-wrap:wrap">${accAvatar(a,1)}<div class="m" style="min-width:160px"><b>${esc(a.name)}</b><span>${esc(typL(a.type))}${a.gsAt?' · '+esc(t('gsy.upd',{d:dateT(a.gsAt,'short')})):''}</span></div><span class="pill ${c}">${esc(t('gsy.s.'+k))}</span>${a.fid?`<button class="btn ${conf?'danger':'ghost'} sm" data-a="gsyDetach" data-v="${a.id}">${esc(t(conf?'gsy.detachC':'gsy.detach'))}</button>`:''}</div>`}).join('')}</div>
    <div class="hr"></div><div class="row" style="flex-wrap:wrap"><div class="m" style="min-width:200px"><b style="font-weight:500;white-space:normal">${esc(t('fin.auto'))}</b><span style="white-space:normal">${esc(t('gsy.finAutoH'))}</span></div><label class="tgl"><input type="checkbox" data-f="finAuto" ${finSet().auto!==false?'checked':''} aria-label="${esc(t('fin.auto'))}"><i></i></label></div>
    <div class="row" style="flex-wrap:wrap"><div class="m" style="min-width:200px"><b style="font-weight:500;white-space:normal">${esc(t('gsy.fv'))}</b><span style="white-space:normal">${esc(t('gsy.fvH'))}</span></div><label class="tgl"><input type="checkbox" data-f="fvOn" ${ST().fvOff?'':'checked'} aria-label="${esc(t('gsy.fv'))}"><i></i></label></div></div>`;
  const head=`<div class="pghead" style="margin-bottom:14px"><span class="av" style="--c:var(--accent)">${ico('sheet')}</span><div class="m"><div class="eyebrow">${esc(t('gsy.eyebrow'))}</div><h2>${esc(t('gsy.h'))}</h2></div><div class="act"><button class="btn sm" data-a="gsySync" ${GSY.busy||!has||!S.cap.mcp?'disabled':''}>${ico('refresh')}${esc(t(GSY.busy?'gsy.busy':'gsy.now'))}</button></div></div>
    <p class="note" style="margin:-4px 0 14px;max-width:820px">${esc(t('gsy.intro'))}</p>${!S.cap.mcp?`<div class="callout" style="margin-bottom:14px">${esc(t('gs.needClaude'))}</div>`:''}${GSY.msg?`<div class="callout" style="margin-bottom:14px;border-left-color:var(--accent)">${esc(GSY.msg)}</div>`:''}`;
  return head+kp+`<div class="grid g2" style="align-items:start"><div class="grid" style="gap:16px">${GSY_SRC.map(srcCard).join('')}</div><div class="grid" style="gap:16px">${gapC}${logC}${depC}</div></div>`;
}
EXT.V.sources=sourcesView;
/* à surveiller : feuille illisible */
{const _wi=watchItems;watchItems=function(){const L=_wi();try{const g=gsyCfg();Object.keys(GSY.err).filter(k=>g.files[k]).forEach(k=>L.push({lvl:'warn',ic:'sheet',l:t('gsy.w',{s:t('gsy.src.'+k)}),s:gsyErrT(GSY.err[k]),act:'go',v:'sources',prio:6}));L.sort((a,b)=>b.prio-a.prio)}catch(e){}return L}}
/* le contrôle « total Finary » n'a plus de sens dès qu'un compte a été détaché de Finary */
{const _fc=finCheck;finCheck=function(){if(S.data&&D().accounts.some(a=>a.src==='gsheet'||(ST().finary&&Object.values(ST().finary.map||{}).includes('__skip')&&a.src)))return null;return _fc()}}
