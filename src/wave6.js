/* ================= V4.8 — fiabilité, automatisations, fiscalité, confort =================
   Comptes clos archivés · intérêts courus du fonds euros · comptes à l'étranger (3916) · plafonds des livrets ·
   sauvegarde hebdomadaire sur Google Drive · actualités de tes lignes · import des exports Trade Republic déposés
   par la tâche mensuelle · clôture du mois guidée · catégorisation qui apprend · projection d'indépendance financière. */

/* ---------- 1. comptes clos ---------- */
const isClosed=a=>!!(a&&a.closed);
EXT.accForm.push((k,ty,a,f)=>a&&a.id?`<div class="f"><label for="af-closed">${esc(t('w6.closed'))}</label><input id="af-closed" name="closed" type="date" value="${esc(a.closed||'')}"></div>`:'');
EXT.accSave.push((fd,o)=>{if(fd.has('closed')){const v=fd.get('closed');if(v)o.closed=v;else delete o.closed}});
function withOpen(fn){const d=D();const all=d.accounts;d.accounts=all.filter(a=>!isClosed(a));try{return fn()}finally{d.accounts=all}}
{const _wv=wealthView;wealthView=function(){const n=D().accounts.filter(isClosed).length;if(!n)return _wv();if(S.ui.showClosed)return _wv()+`<div style="margin-top:12px"><button class="btn ghost sm" data-a="showClosed">${esc(t('w6.hideClosed'))}</button></div>`;
  return withOpen(_wv)+`<div class="card" style="margin-top:12px"><div class="row"><span class="av sm" style="--c:var(--k6)">${ico('lock')}</span><div class="m"><b>${esc(t('w6.closedN',{n}))}</b><span>${esc(D().accounts.filter(isClosed).map(a=>a.name).join(' · '))}</span></div><button class="btn ghost sm" data-a="showClosed">${esc(t('w6.showClosed'))}</button></div></div>`}}
EXT.A.showClosed=()=>{S.ui.showClosed=!S.ui.showClosed;render()};
{const _hc=healthChecks;healthChecks=function(){return withOpen(_hc)}}
{const _sv=sourcesView;EXT.V.sources=sourcesView=function(){return withOpen(_sv)+w6BackupCard()}}

/* ---------- 2. intérêts courus du fonds euros ---------- */
EXT.holdForm.push((a,h,f,num)=>`<div class="f full sect kf kf-fe"${h.kind==='fe'?'':' hidden'}><span class="lab">${esc(t('w6.fe'))}</span><p class="note" style="margin:0">${esc(t('w6.feP'))}</p></div>
  <div class="f kf kf-fe"${h.kind==='fe'?'':' hidden'}><label for="hf-feRate">${esc(t('w6.feRate'))}</label>${num('feRate',h.feRate)}</div>
  <div class="f kf kf-fe"${h.kind==='fe'?'':' hidden'}><label for="hf-feFrom">${esc(t('w6.feFrom'))}</label><input id="hf-feFrom" name="feFrom" type="date" value="${esc(h.feFrom||'')}"></div>`);
EXT.holdSave.push((fd,o)=>{if(o.kind!=='fe')return;const r=+String(fd.get('feRate')||'').replace(',','.');if(isFinite(r)&&r>0)o.feRate=r;else delete o.feRate;const d=fd.get('feFrom');if(d)o.feFrom=d;else delete o.feFrom});
function feAccrued(h,a){if(!h||h.kind!=='fe'||!(+h.feRate>0))return 0;const from=h.feFrom||(a&&a.opened)||null;if(!from)return 0;
  /* intérêts simples depuis la date de départ, plafonnés au 31/12 : le contrat les crédite une fois par an */
  const end=today()<from.slice(0,4)+'-12-31'?today():from.slice(0,4)+'-12-31';const days=Math.max(0,daysBetween(from,end));return (+h.qty||0)*(+h.price||0)*(+h.feRate/100)*days/365}
{const _hv=hVal;hVal=function(h,a){const v=_hv(h,a);return h&&h.kind==='fe'&&+h.feRate>0?v+conv(feAccrued(h,a),h.cur||(a&&a.cur)):v}}

/* ---------- 3. fiscalité : comptes à l'étranger (3916 / 3916-bis) ---------- */
const W6_FOREIGN=[[/trade ?republic/i,'Allemagne'],[/revolut/i,'Lituanie'],[/paypal/i,'Luxembourg'],[/n26/i,'Allemagne'],[/interactive brokers/i,'Irlande'],[/degiro/i,'Pays-Bas'],[/wise/i,'Belgique'],[/binance/i,'actifs numériques'],[/crypto\.com/i,'actifs numériques'],[/kraken|coinbase|bitpanda/i,'actifs numériques']];
function w6Foreign(){return D().accounts.map(a=>{const s=(a.inst||'')+' '+a.name;const m=W6_FOREIGN.find(([re])=>re.test(s));if(!m)return null;if(/livret a|axa/i.test(s)&&/livret/i.test(a.type))return null;if(a.type==='pea'||a.type==='peapme')return null;return {a,c:m[1],dig:m[1]==='actifs numériques'||accCls(a)==='crypto'}}).filter(Boolean)}
function w6ForeignCard(){const L=w6Foreign();if(!L.length)return '';const y=+today().slice(0,4)-1;
  return `<div class="card" style="margin-top:16px"><div class="ch"><div><h2>${esc(t('w6.f.t'))}</h2><p>${esc(t('w6.f.s',{y}))}</p></div></div><div class="list">${L.map(({a,c,dig})=>`<div class="row">${accAvatar(a,1)}<div class="m"><b>${esc(a.name)}</b><span>${esc([a.inst,c,a.opened?t('w6.f.op',{d:dateT(a.opened,'short')}):'',a.closed?t('w6.f.cl',{d:dateT(a.closed,'short')}):''].filter(Boolean).join(' · '))}</span></div><span class="pill ${dig?'acc':''}">${esc(dig?'3916-bis':'3916')}</span></div>`).join('')}</div>
  <p class="note" style="margin:10px 0 0">${esc(t('w6.f.note'))}</p></div>`}
{const _tv=taxView;taxView=function(){return _tv()+w6ForeignCard()}}

/* ---------- 4. plafonds des livrets ---------- */
{const _wi6=watchItems;watchItems=function(){const L=_wi6();try{
  D().accounts.filter(a=>!isClosed(a)&&a.include!==false&&(TYP[a.type]||{}).cls==='savings'&&(TYP[a.type]||{}).cap).forEach(a=>{const cap=TYP[a.type].cap,b=+a.balance||0;if(b/cap>=0.9)L.push({lvl:b>=cap?'warn':'info',ic:'savings',l:t('w6.cap',{a:a.name,p:pctT(b/cap,0)}),s:t('w6.capS',{v:moneyT(Math.max(0,cap-b),0)}),act:'acc',v:a.id,prio:5})});
  w6NewsItems().forEach(n=>L.push({lvl:'warn',ic:'alert',l:n.n+' : '+n.t,s:n.s||'',act:'go',v:'news',prio:7}));
  const pm=ymAdd(today().slice(0,7),-1);const dd=+today().slice(8,10);if(dd<=12&&!(ST().closedMonths||{})[pm]&&D().txs.some(x=>ymOf(x.d)===pm))L.push({lvl:'info',ic:'check',l:t('w6.cl.w',{m:monthT(pm)}),s:t('w6.cl.ws'),act:'closeMonth',v:pm,prio:4});
  if(W6.bk.err)L.push({lvl:'warn',ic:'download',l:t('w6.bk.errW'),s:t('w6.bk.e.'+W6.bk.err),act:'go',v:'sources',prio:6});
  L.sort((a,b)=>b.prio-a.prio)}catch(e){}return L}}

/* ---------- 5. documents annexes lus au démarrage : actualités, journal des relevés ---------- */
const W6={news:null,stmt:null,bk:{busy:false,err:null,msg:''},loaded:false};
async function w6Load(){if(W6.loaded||!S.data||S.demo||!STORE.db||!STORE.uid)return;W6.loaded=true;
  for(const k of ['news','stmtlog']){try{const s=await STORE.db.doc(P(k)).get();if(s.exists)W6[k==='news'?'news':'stmt']=s.data()||null}catch(e){}}
  if(S.phase==='app'&&!S.ui.ovl)render()}
function w6NewsItems(){const n=W6.news;if(!n||!Array.isArray(n.items))return [];const from=dAdd(today(),-7);return n.items.filter(x=>x&&x.sev==='major'&&x.d>=from).slice(0,3)}
VIEWS.push({k:'news',g:'ana',ic:'book',hide:1});
EXT.V.news=()=>{const n=W6.news;const items=(n&&Array.isArray(n.items)?n.items:[]).filter(x=>x&&x.t);
  const head=`<div class="pghead" style="margin-bottom:14px"><span class="av" style="--c:var(--accent)">${ico('book')}</span><div class="m"><div class="eyebrow">${esc(t('w6.n.eye'))}</div><h2>${esc(t('w6.n.h'))}</h2></div></div>${n&&n.summary?`<p class="note" style="margin:-4px 0 14px">${esc(n.summary)}${n.lastRun?' · '+esc(dateT(new Date(+n.lastRun).toISOString().slice(0,10),'short')):''}</p>`:''}`;
  if(!items.length)return head+emptyBlock(t('w6.n.none'),t('w6.n.noneS'));
  return head+`<div class="card"><div class="list">${items.map(x=>`<div class="row" style="align-items:flex-start"><span class="av sm" style="--c:var(${x.sev==='major'?'--warn':'--k1'})">${ico(x.sev==='major'?'alert':'book')}</span><div class="m"><b style="white-space:normal">${esc(x.n)} · ${esc(x.t)}</b><span style="white-space:normal">${esc(x.s||'')}</span><span>${esc(dateT(x.d,'short'))}${x.src?' · '+esc(x.src):''}${/^https:\/\//.test(x.u||'')?` · <a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(t('w6.n.src'))}</a>`:''}</span></div></div>`).join('')}</div>
  <p class="note" style="margin:10px 0 0">${esc(t('w6.n.note'))}</p></div>`};
WIDGETS.news={s:'m',r:()=>{const n=W6.news;const items=(n&&Array.isArray(n.items)?n.items:[]).slice(0,4);return wCard(t('w6.n.h'),items.length?t('w6.n.s',{n:items.length}):t('w6.n.none'),items.length?`<div class="list">${items.map(x=>`<button class="row btnrow" data-a="go" data-v="news"><div class="m"><b>${esc(x.n)}</b><span>${esc(x.t)}</span></div><div class="r"><span class="pill ${x.sev==='major'?'warn':''}">${esc(dateT(x.d,'short'))}</span></div></button>`).join('')}</div>`:`<div class="wempty">${ico('book')}<p>${esc(t('w6.n.noneS'))}</p></div>`)}};
EXT.boot.push(d=>{const s=d.settings||{};if(Array.isArray(s.widgets)&&!s.dash3){if(!s.widgets.some(x=>x.k==='news')){const j=s.widgets.findIndex(x=>x.k==='alerts');s.widgets.splice(j>=0?j+1:3,0,{k:'news',on:true})}}s.dash3=1;setTimeout(()=>{w6Load();w6BackupAuto()},4000)});

/* ---------- 6. import des exports Trade Republic déposés par la tâche mensuelle (patch.trCsv) ---------- */
/* CSV ré-enregistré par un tableur : chaque ligne entière entre guillemets, guillemets internes doublés */
function csvUnwrap(text){const s=String(text||'').replace(/^\uFEFF/,'');const L=s.split(/\r?\n/).filter(x=>x.trim());if(L.length<2||!L.slice(0,3).every(l=>/^"/.test(l)&&/""/.test(l)))return s;
  const rows=parseCSVText(s,',');if(!rows.length||rows.some(r=>r.length>2&&r.slice(1).some(c=>String(c).trim())))return s;return rows.map(r=>r[0]).join('\n')}
{const _tf=tiFromCsv;tiFromCsv=function(text,name){return _tf(csvUnwrap(text),name)}}
function w6TrApply(texts){let nOps=0,nCash=0,skip=0;const fx=[];
  texts.forEach(txt=>{const s=String(txt||'').replace(/^﻿/,'');const first=s.split(/\r?\n/)[0]||'';const sep=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
    const rows=parseCSVText(s,sep);if(rows.length<2||!isTrCsv(rows[0]))return;const R=parseTrCsv(rows[0],rows.slice(1));
    R.groups.forEach(g=>{
      if(g.kind==='cash'){const a=D().accounts.find(x=>x.type==='checking'&&/trade ?republic/i.test((x.inst||'')+' '+x.name)&&!isClosed(x));if(!a){skip+=g.cash.length;return}
        const ex=new Map();D().txs.filter(x=>x.acc===a.id).forEach(x=>{const k=x.d+'|'+(+x.a).toFixed(2);ex.set(k,(ex.get(k)||0)+1)});const seen=new Map();const extS=new Set(D().txs.filter(x=>x.acc===a.id&&x.ext).map(x=>x.ext));
        g.cash.forEach(o=>{if(o.ext&&extS.has(o.ext))return;const k=o.d+'|'+o.a.toFixed(2);seen.set(k,(seen.get(k)||0)+1);if(seen.get(k)<=(ex.get(k)||0))return;
          D().txs.push({id:uid(),d:o.d,a:o.a,l:o.l,c:tiCat(o,a.id),acc:a.id,ext:o.ext||undefined,src:'trcsv'});nCash++});return}
      const src=g.key==='pea'?'pea':g.key==='cto'?'cto':null;if(!src){skip+=g.ops.length;return}const a=gsyInvAcc(src);if(!a){skip+=g.ops.length;return}
      const have=iopsOf(a.id);const ext=new Set(have.map(o=>o.ext).filter(Boolean));const sig=new Map();have.forEach(o=>{const k=iopSig(o);sig.set(k,(sig.get(k)||0)+1)});const seen=new Map();let s0=Math.max(0,...have.map(x=>+x.s||0));
      g.ops.forEach(o=>{if(o.ext&&ext.has(o.ext))return;const k=iopSig({...o,acc:a.id});seen.set(k,(seen.get(k)||0)+1);if(seen.get(k)<=(sig.get(k)||0))return;
        if(!Array.isArray(D().iops))D().iops=[];D().iops.push({...o,id:uid(),acc:a.id,s:++s0,src:'trcsv'});nOps++});
    })});
  ST().trImp={at:new Date().toISOString(),ops:nOps,cash:nCash,skip};return {nOps,nCash,skip}}
EXT.boot.push(d=>{const L=STORE.trPend;if(!Array.isArray(L)||!L.length)return;STORE.trPend=null;setTimeout(()=>{if(S.data!==d)return;try{const r=w6TrApply(L);save();if(r.nOps||r.nCash)toast(t('w6.tr.done',{o:r.nOps,c:r.nCash}));if(typeof gsySync==='function')setTimeout(()=>gsySync(false),1500)}catch(e){console.error(e)}},800)});

/* ---------- 7. sauvegarde hebdomadaire sur Google Drive ---------- */
const bkCfg=()=>{const s=ST();if(!s.backup||typeof s.backup!=='object')s.backup={};if(!Array.isArray(s.backup.list))s.backup.list=[];return s.backup};
async function w6Gzip(text){const cs=new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));const u8=new Uint8Array(await new Response(cs).arrayBuffer());let b='';for(let i=0;i<u8.length;i+=0x8000)b+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000));return {b64:btoa(b),n:u8.length}}
const w6Id=r=>{let p=r&&r.payload;if(typeof p==='string'){try{p=JSON.parse(p)}catch(e){p=null}}if(!p&&r&&Array.isArray(r.content)){const b=r.content.find(x=>x.type==='text');if(b){try{p=JSON.parse(b.text)}catch(e){}}}return p&&p.id||null};
async function w6Backup(manual){const mcp=S.cap.mcp;if(!mcp||!S.data||S.demo||W6.bk.busy)return;if(typeof CompressionStream==='undefined'){W6.bk.err='nozip';return}
  const B=bkCfg();W6.bk.busy=true;W6.bk.err=null;if(manual)render();
  try{
    if(!B.folder){const r=await mcp.callTool(GS_SERVER,'create_file',{title:APP.name+' — sauvegardes',contentMimeType:'application/vnd.google-apps.folder'});B.folder=w6Id(r);if(!B.folder)throw {code:'format'}}
    const d=today();const {b64,n}=await w6Gzip(JSON.stringify(S.data));
    const r=await mcp.callTool(GS_SERVER,'create_file',{title:'vigie-'+d+'.json.gz',contentMimeType:'application/gzip',base64Content:b64,parentId:B.folder,disableConversionToGoogleType:true});
    const id=w6Id(r);if(!id)throw {code:'format'};B.list.push({id,d,n});B.at=new Date().toISOString();
    while(B.list.length>8){const old=B.list.shift();try{await mcp.callTool(GS_SERVER,'trash_file',{fileId:old.id})}catch(e){}}
    save();W6.bk.msg=t('w6.bk.done',{s:(n/1024).toFixed(0)});
  }catch(e){W6.bk.err=e&&LIVE_AUTH.includes(e.code)?'auth':'fail'}
  W6.bk.busy=false;if(manual||W6.bk.err)render()}
function w6BackupAuto(){const B=bkCfg();const last=B.at?Date.parse(B.at):0;if(Date.now()-last>=7*864e5-36e5)w6Backup(false)}
EXT.A.bkNow=()=>w6Backup(true);
function w6BackupCard(){const B=bkCfg();const last=B.list[B.list.length-1];
  return `<div class="card" style="margin-top:16px"><div class="ch"><div><h2>${esc(t('w6.bk.t'))}</h2><p>${esc(t('w6.bk.s'))}</p></div><div class="act">${B.folder?`<a class="btn ghost sm" href="https://drive.google.com/drive/folders/${esc(B.folder)}" target="_blank" rel="noopener">${esc(t('w6.bk.open'))}</a>`:''}<button class="btn sm" data-a="bkNow" ${W6.bk.busy||!S.cap.mcp?'disabled':''}>${ico('download')}${esc(t(W6.bk.busy?'w6.bk.busy':'w6.bk.now'))}</button></div></div>
  <div class="row"><span class="av sm" style="--c:var(${W6.bk.err?'--warn':last?'--good':'--k6'})">${ico('download')}</span><div class="m"><b>${esc(last?t('w6.bk.last',{d:dateT(last.d,'short'),n:B.list.length}):t('w6.bk.never'))}</b><span>${esc(W6.bk.err?t('w6.bk.e.'+W6.bk.err):W6.bk.msg||t('w6.bk.how'))}</span></div></div></div>`}
/* restauration d'une sauvegarde compressée (.json.gz) */
{const _rj=readJsonFile;readJsonFile=function(file){if(!/\.gz$/i.test(file.name||'')||typeof DecompressionStream==='undefined')return _rj(file);
  (async()=>{try{const txt=await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text();_rj(new File([txt],file.name.replace(/\.gz$/i,''),{type:'application/json'}))}catch(e){toast(t('err.form2'),true)}})()}}
document.addEventListener('DOMContentLoaded',()=>{});

/* ---------- 8. clôture du mois guidée ---------- */
VIEWS.push({k:'close',g:'pilot',ic:'check',hide:1});
EXT.A.closeMonth=v=>{S.ui.closeYm=v||ymAdd(today().slice(0,7),-1);go('close')};
function w6Suggest(x){const p=norm(cleanLabel(x.l)).split(' ').slice(0,2).join(' ');if(!p)return null;const c={};D().txs.forEach(y=>{if(y.id!==x.id&&y.c&&y.c!=='uncat'&&(' '+norm(cleanLabel(y.l))).startsWith(' '+p))c[y.c]=(c[y.c]||0)+1});const best=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];return best?best[0]:null}
function closeView(){const ym=S.ui.closeYm||ymAdd(today().slice(0,7),-1);const end=ymAdd(ym,1)+'-01';const done=(ST().closedMonths||{})[ym];
  const cash=D().accounts.filter(a=>!isClosed(a)&&a.include!==false&&accCls(a)==='cash');
  const lastTx=a=>D().txs.filter(x=>x.acc===a.id).reduce((m,x)=>x.d>m?x.d:m,'');
  const s1=cash.map(a=>{const l=lastTx(a);const st=W6.stmt||{};const chk=Array.isArray(st.check)?st.check:[];const ok=(l&&l>=dAdd(end,-10))||(typeof st.at==='string'&&st.at.slice(0,10)>end&&!chk.some(c=>c&&c.acc===a.id));return `<div class="row">${accAvatar(a,1)}<div class="m"><b>${esc(a.name)}</b><span>${esc(l?t('w6.cl.last',{d:dateT(l,'short')}):t('w6.cl.noTx'))}</span></div><span class="pill ${ok?'good':'warn'}">${esc(t(ok?'w6.cl.ok':'w6.cl.todo'))}</span></div>`}).join('');
  const unc=monthTx(ym).filter(x=>x.c==='uncat'||!x.c);
  const s2=unc.length?`<div class="list">${unc.slice(0,30).map(x=>{const sg=w6Suggest(x);return `<div class="row" style="flex-wrap:wrap"><div class="m" style="min-width:180px"><b style="white-space:normal">${esc(cleanLabel(x.l))}</b><span>${esc(dateT(x.d,'short'))} · ${esc(moneyT(x.a,2))}${sg?' · '+esc(t('w6.cl.sugg',{c:catL(sg)})):''}</span></div><select data-f="w6cat" data-v="${x.id}" style="width:auto;min-height:34px" aria-label="${esc(t('w6.cl.pick'))}"><option value="">${esc(t('w6.cl.pick'))}</option>${CATS.map(c=>`<option value="${c.k}"${sg===c.k?' data-sg="1"':''}>${esc(catL(c.k))}</option>`).join('')}</select></div>`}).join('')}</div>${unc.some(w6Suggest)?`<div style="margin-top:10px"><button class="btn sec sm" data-a="w6sugg" data-v="${ym}">${ico('check')}${esc(t('w6.cl.applyS'))}</button></div>`:''}`:`<p class="note" style="margin:0">${esc(t('w6.cl.allCat'))}</p>`;
  const s3=`<div class="list">${cash.map(a=>`<button class="row btnrow" data-a="acc" data-v="${a.id}">${accAvatar(a,1)}<div class="m"><b>${esc(a.name)}</b><span>${esc(a.gsAt?t('gsy.upd',{d:dateT(a.gsAt,'short')}):typL(a.type))}</span></div><div class="r"><b>${money(accValue(a),2)}</b></div></button>`).join('')}</div><p class="note" style="margin:8px 0 0">${esc(t('w6.cl.balN'))}</p>`;
  const G=aggTx(monthTx(ym));
  const step=(n,title,sub,body,ok)=>`<div class="card"><div class="ch"><div><h2><span class="pill ${ok?'good':''}" style="margin-right:8px">${n}</span>${esc(title)}</h2><p>${esc(sub)}</p></div></div>${body}</div>`;
  const months=txMonths().slice(-6).reverse().filter(m=>m<today().slice(0,7));
  return `<div class="pghead" style="margin-bottom:14px"><span class="av" style="--c:var(--accent)">${ico('check')}</span><div class="m"><div class="eyebrow">${esc(t('w6.cl.eye'))}</div><h2>${esc(t('w6.cl.h',{m:monthT(ym)}))}</h2></div><div class="act">${seg('closeYm',months.map(m=>[m,monthT(m,1)]),ym,t('a11y.period'))}</div></div>
  <div class="kpis k4" style="margin-bottom:16px">${[[t('w6.cl.inc'),money(G.inc,0)],[t('w6.cl.exp'),money(G.exp,0)],[t('w6.cl.unc'),String(unc.length)],[t('w6.cl.state'),esc(done?t('w6.cl.doneOn',{d:dateT(done,'short')}):t('w6.cl.open'))]].map(([l,v])=>`<div class="kpi"><div class="eyebrow">${esc(l)}</div><div class="hero-v" style="font-size:20px">${v}</div></div>`).join('')}</div>
  <div class="grid" style="gap:16px">${step(1,t('w6.cl.s1'),t('w6.cl.s1s'),`<div class="list">${s1}</div><div style="margin-top:10px"><button class="btn sec sm" data-a="import">${ico('upload')}${esc(t('b.import'))}</button></div>`,cash.every(a=>{const l=lastTx(a);return l&&l>=dAdd(end,-10)}))}
  ${step(2,t('w6.cl.s2'),t('w6.cl.s2s'),s2,!unc.length)}
  ${step(3,t('w6.cl.s3'),t('w6.cl.s3s'),s3,!!done)}
  <div class="hrow" style="justify-content:flex-end;gap:8px">${done?`<button class="btn ghost sm" data-a="w6reopen" data-v="${ym}">${esc(t('w6.cl.reopen'))}</button>`:`<button class="btn" data-a="w6close" data-v="${ym}">${ico('check')}${esc(t('w6.cl.do',{m:monthT(ym)}))}</button>`}<button class="btn sec sm" data-a="go" data-v="review">${esc(t('nav.review'))}</button></div></div>`}
EXT.V.close=closeView;
EXT.A.closeYm=v=>{S.ui.closeYm=v;render()};
EXT.A.w6close=v=>{const s=ST();if(!s.closedMonths||typeof s.closedMonths!=='object')s.closedMonths={};s.closedMonths[v]=today();save();toast(t('w6.cl.closedT',{m:monthT(v)}));render()};
EXT.A.w6reopen=v=>{const s=ST();if(s.closedMonths)delete s.closedMonths[v];save();render()};
EXT.field.w6cat=(el,v)=>{const x=D().txs.find(y=>y.id===el.dataset.v);if(!x||!v)return;x.c=v;x.mc=1;w6Learn(x);save();render()};
EXT.A.w6sugg=ym=>{let n=0;monthTx(ym).filter(x=>x.c==='uncat'||!x.c).forEach(x=>{const sg=w6Suggest(x);if(sg){x.c=sg;n++}});save();toast(t('w6.cl.applied',{n}));render()};
/* catégorisation qui apprend : une catégorie choisie à la main devient une règle dès qu'au moins une autre opération porte le même libellé */
function w6Learn(x){const p=norm(cleanLabel(x.l)).split(' ').slice(0,2).join(' ');if(!p||p.length<3)return;const d=D();const peers=d.txs.filter(y=>y.id!==x.id&&(' '+norm(cleanLabel(y.l))).startsWith(' '+p));if(!peers.length)return;
  d.rules=(d.rules||[]).filter(r=>r.p!==p);d.rules.push({p,c:x.c,auto:1});let n=0;peers.forEach(y=>{if(y.c==='uncat'||!y.c){y.c=x.c;n++}});if(n)toast(t('w6.learn',{p,n}))}

/* ---------- 9. projection d'indépendance financière (données réelles) ---------- */
function fiModel(){const cur=today().slice(0,7);const ms=[6,5,4,3,2,1].map(k=>ymAdd(cur,-k));const G=ms.map(m=>aggTx(monthTx(m)));const n=G.filter(g=>g.n).length||1;
  const inc=sum(G.map(g=>g.inc))/n,exp=sum(G.map(g=>g.exp))/n;const save=inc-exp;
  const tt=totals();const capital=(tt.by.invest||0)+(tt.by.savings||0)+(tt.by.crypto||0);
  let pi=0;try{const P=passiveIncome();pi=P&&P.total!=null?P.total:sum((P.months||[]).map(m=>(m.div||0)+(m.int||0)+(m.rent||0)))}catch(e){}
  const swr=(+ST().swr||4)/100;const target=exp*12/swr;
  const years=(r)=>{if(capital>=target)return 0;let c=capital;const m=Math.pow(1+r,1/12)-1;const s=Math.max(0,save);for(let i=1;i<=12*80;i++){c=c*(1+m)+s;if(c>=target)return i/12}return null};
  return {inc,exp,save,rate:inc>0?save/inc:null,capital,pi,swr,target,cov:exp>0?(capital*swr/12)/exp:null,sc:[[0.02,years(0.02)],[0.04,years(0.04)],[0.06,years(0.06)]],n}}
function fiCard(){const F=fiModel();if(!(F.exp>0))return '';const yr=v=>v==null?t('w6.fi.never'):v===0?t('w6.fi.done'):t('w6.fi.y',{n:v<1?numT(v*12,0)+' '+t('w6.fi.mo'):numT(v,1)});
  return `<div class="card" style="margin-top:16px"><div class="ch"><div><h2>${esc(t('w6.fi.t'))}</h2><p>${esc(t('w6.fi.s',{n:F.n}))}</p></div></div>
  <div class="kpis k4" style="box-shadow:none;margin-bottom:14px">${[[t('w6.fi.exp'),money(F.exp,0)],[t('w6.fi.save'),`<span class="${cls(F.save)}">${money(F.save,0)}</span>`+(F.rate!=null?` <span class="note">${esc(pctT(F.rate,0))}</span>`:'')],[t('w6.fi.target',{r:pctT(F.swr,1)}),money(F.target,0)],[t('w6.fi.cov'),esc(F.cov!=null?pctT(F.cov,1):'—')]].map(([l,v])=>`<div class="kpi"><div class="eyebrow">${esc(l)}</div><div class="hero-v" style="font-size:20px">${v}</div></div>`).join('')}</div>
  <div class="list">${F.sc.map(([r,y])=>`<div class="row"><div class="m"><b>${esc(t('w6.fi.sc',{r:pctT(r,0)}))}</b><span>${esc(t('w6.fi.scS',{s:moneyT(Math.max(0,F.save),0)}))}</span></div><div class="r"><b>${esc(yr(y))}</b></div></div>`).join('')}</div>
  <p class="note" style="margin:10px 0 0">${esc(t('w6.fi.note'))}</p></div>`}
{const _pv6=projView;projView=function(){return _pv6()+fiCard()}}
