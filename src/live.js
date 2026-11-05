/* ================= cours en direct (connecteur Crypto.com de l'utilisateur) ================= */
const LIVE_SERVER='Crypto.com',LIVE_TOOL='get_ticker';
const LIVE={st:'idle',code:null,at:null,watches:new Map(),probing:new Set(),pending:false,lastSave:0,bad:new Set()};
const LIVE_AUTH=['server_not_connected','not_in_manifest','not_granted','needs_reauth','blocked_by_policy','capability_disabled','capability_removed','selection_required','consent_required','server_not_found'];
function liveHoldings(){const out=[];if(!S.data)return out;D().accounts.forEach(a=>{if(!(TYP[a.type]||{}).h)return;a.holdings.forEach(h=>{if(!h.fin&&(h.kind==='crypto'||h.kind==='metal'&&h.metal==='gold')&&h.ticker&&/^[A-Z0-9]{2,10}$/.test(h.ticker))out.push({a,h})})});return out}
function parseTicker(res){
  let p=res&&res.payload;
  if(p==null&&res&&Array.isArray(res.content)){const b=res.content.find(x=>x.type==='text');p=b&&b.text}
  if(typeof p==='string'){const s0=p,i=s0.indexOf('{'),j=s0.lastIndexOf('}');p=null;if(i>-1&&j>i){try{p=JSON.parse(s0.slice(i,j+1))}catch(e){p=null}}}
  if(p&&p.result&&Array.isArray(p.result.data))p=p.result.data[0];
  if(p&&p.instrument_name&&isFinite(+p.last)&&+p.last>0)return {pair:p.instrument_name,last:+p.last,chg:+p.change||0,ts:p.timestamp||new Date().toISOString()};
  return null;
}
function parseAny(res){const r=parseTicker(res);if(r)return r;const b=res&&Array.isArray(res.content)&&res.content.find(x=>x.type==='text');if(b){const s=b.text,i=s.indexOf('{'),j=s.lastIndexOf('}');if(i>-1&&j>i)try{const p=JSON.parse(s.slice(i,j+1));return parseTicker({payload:p})}catch(e){}}return null}
function pairQuote(pair){const q=pair.split('_')[1]||'USD';return q==='USDT'||q==='USDC'?'USD':q}
function applyQuote(q){
  const base=q.pair.split('_')[0],quote=pairQuote(q.pair);let changed=false;
  liveHoldings().forEach(({a,h})=>{if(h.ticker!==base)return;const fx=ST().fx;const cur=h.cur||a.cur||ST().cur;const px=q.last*(fx[quote]??1)/(fx[cur]??1)*(h.kind==='metal'?metalMul(h):1);
    if(Math.abs((+h.price||0)-px)>1e-9)changed=true;h.price=+px.toFixed(px<1?6:2);h.chg=q.chg;h.liveAt=q.ts;h.livePair=q.pair;h.liveSrc=LIVE_SERVER});
  LIVE.at=Date.now();LIVE.st='ok';LIVE.code=null;
  if(changed)liveDirty();else liveRepaintBadge();
}
let liveQT=null;
function liveDirty(){clearTimeout(liveQT);liveQT=setTimeout(()=>{
  if(!S.demo&&Date.now()-LIVE.lastSave>600000){LIVE.lastSave=Date.now();save()}else if(S.data)recordSnapshot();
  const ae=document.activeElement;const typing=ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
  if(S.phase==='app'&&!S.ui.ovl&&!typing)render();else LIVE.pending=true;
},400)}
function liveFail(err){
  const code=err&&err.code||'upstream_error';
  if(LIVE_AUTH.includes(code)){LIVE.st='off';LIVE.code=code;stopLive()}
  else if(LIVE.st!=='ok'){LIVE.st='err';LIVE.code=code}
  liveRepaintBadge();
}
function stopLive(){if(GS.unsub){try{GS.unsub()}catch(e){}GS.unsub=null;GS.id=null}if(GS.st!=='off')GS.st='idle';for(const u of LIVE.watches.values())try{u()}catch(e){}LIVE.watches.clear();if(FV.unsub){try{FV.unsub()}catch(e){}FV.unsub=null}if(FV.st!=='off')FV.st='idle'}
async function probePair(base,cur){
  const mcp=S.cap.mcp;const tries=[...new Set([base+'_'+(cur==='USD'?'USD':'EUR'),base+'_EUR',base+'_USD',base+'_USDT'])];
  for(const pair of tries){if(LIVE.bad.has(pair))continue;
    try{const res=await mcp.callTool(LIVE_SERVER,LIVE_TOOL,{instrument_name:pair},{cache:{staleTime:30000,gcTime:600000}});const q=parseAny(res);if(q){applyQuote(q);return pair}LIVE.bad.add(pair)}
    catch(e){if(e&&e.code==='tool_error'){LIVE.bad.add(pair);continue}liveFail(e);return null}
  }
  return null;
}
async function syncLive(){
  startFinary();
  if(QB.map.size)applyBase();const mcp=S.cap.mcp;if(!mcp||!S.data)return;startFV();startGS();if(LIVE.st==='off')return;
  const hs=liveHoldings();const want=new Map();
  for(const {a,h} of hs){if(want.has(h.ticker))continue;want.set(h.ticker,{pair:h.livePair&&h.livePair.startsWith(h.ticker+'_')?h.livePair:null,cur:h.cur||a.cur})}
  for(const [pair,u] of LIVE.watches){const b=pair.split('_')[0];if(!want.has(b)||want.get(b).pair&&want.get(b).pair!==pair){try{u()}catch(e){}LIVE.watches.delete(pair)}}
  if(!want.size){LIVE.st='idle';return}
  if(LIVE.st==='idle')LIVE.st='busy';liveRepaintBadge();
  for(const [base,w] of want){
    let pair=w.pair;
    if(!pair){if(LIVE.probing.has(base))continue;LIVE.probing.add(base);pair=await probePair(base,w.cur);LIVE.probing.delete(base);if(LIVE.st==='off')return;if(!pair)continue}
    if(LIVE.watches.has(pair))continue;
    const unsub=mcp.watchTool(LIVE_SERVER,LIVE_TOOL,{instrument_name:pair},ev=>{
      if(ev.type==='data'){const q=parseAny(ev.result);if(q)applyQuote(q)}
      else liveFail(ev.error);
    },{cache:{staleTime:30000,gcTime:600000},refetchInterval:60000});
    LIVE.watches.set(pair,unsub);
  }
  if(LIVE.st==='busy'&&!LIVE.watches.size&&!LIVE.probing.size){LIVE.st='err';LIVE.code='nopair'}
  liveRepaintBadge();
}
async function liveRefresh(){
  const mcp=S.cap.mcp;if(!mcp)return;
  if(LIVE.st==='off'){LIVE.st='idle';LIVE.code=null}
  if(FV.st==='off'||FV.st==='err'){FV.st='idle';FV.code=null}
  LIVE.bad.clear();
  try{await mcp.invalidate(FV_SERVER,FV_TOOL)}catch(e){}
  if(GS.st==='off'||GS.st==='err'){GS.st='idle';GS.code=null}
  try{await mcp.invalidate(GS_SERVER,GS_TOOL)}catch(e){}
  if(GS.unsub){const id=gsheetId();try{const r=await mcp.callTool(GS_SERVER,GS_TOOL,{fileId:id,exportMimeType:'text/csv'},{cache:{staleTime:30000,gcTime:600000,refresh:true}});gsHandle(r)}catch(e){gsFail(e)}}else startGS();
  if(FV.unsub){try{const r=await mcp.callTool(FV_SERVER,FV_TOOL,FV_IN,{cache:{staleTime:30000,gcTime:600000,refresh:true}});const l=fvLines(r);if(l)applyFV(l,r)}catch(e){fvFail(e)}}else startFV();
  try{await mcp.invalidate(LIVE_SERVER,LIVE_TOOL)}catch(e){}
  if(!LIVE.watches.size)await syncLive();
  else for(const pair of LIVE.watches.keys()){try{const r=await mcp.callTool(LIVE_SERVER,LIVE_TOOL,{instrument_name:pair},{cache:{staleTime:30000,gcTime:600000,refresh:true}});const q=parseAny(r);if(q)applyQuote(q)}catch(e){liveFail(e)}}
  render();
}
function liveAgo(){if(!LIVE.at)return '';const m=Math.floor((Date.now()-LIVE.at)/60000);return m<1?t('live.now'):t('live.min',{n:m})}
/* ---------- Finvygo : cours des titres présents dans le portefeuille Finvygo de l'utilisateur ---------- */
const FV_SERVER='Finvygo',FV_TOOL='list_holdings',FV_IN={limit:100};
const FV={st:'idle',code:null,at:null,unsub:null,matched:0,trunc:false};
function fvCandidates(){const out=[];if(!S.data)return out;D().accounts.forEach(a=>{if(!(TYP[a.type]||{}).h)return;a.holdings.forEach(h=>{if(!h.fin&&h.kind!=='fe'&&(h.ticker||h.isin||h.name))out.push({a,h})})});return out}
function fvLines(res){let p=res&&res.payload;if(p==null&&res&&Array.isArray(res.content)){const b=res.content.find(x=>x.type==='text');p=b&&b.text}
  if(typeof p==='string'){const s0=p;p=null;try{p=JSON.parse(s0)}catch(e){const i=s0.indexOf('{'),j=s0.lastIndexOf('}');if(i>-1&&j>i)try{p=JSON.parse(s0.slice(i,j+1))}catch(e2){p=null}}}
  return p&&Array.isArray(p.holdings)?p:null}
function fvMatch(h,lines){
  const isin=String(h.isin||'').toUpperCase(),tk=String(h.ticker||'').toUpperCase(),nm=norm(h.name);
  const sym=f=>String(f.symbol||'').toUpperCase();
  return (isin&&lines.find(f=>sym(f)===isin))
    ||(tk&&lines.find(f=>sym(f)===tk))
    ||(tk&&h.kind==='crypto'&&lines.find(f=>f.assetTypeCode==='crypto'&&sym(f).split(/[-.]/)[0]===tk))
    ||(nm&&nm.length>3&&lines.find(f=>!['cash','savings','other','debt'].includes(f.assetTypeCode)&&norm(f.name)===nm))
    ||(h.kind!=='crypto'&&nameMatch(h.name,lines.filter(f=>!['cash','savings','other','debt','crypto'].includes(f.assetTypeCode)),f=>f.name))||null;
}
function applyFV(p){
  const lines=p.holdings.filter(f=>f.priced&&!f.pricedAtCost&&+f.unitPrice>0&&f.quoteCurrency&&!f.isNegative);
  let changed=false,n=0;const fx=ST().fx;
  fvCandidates().forEach(({a,h})=>{
    if(h.liveSrc==='Crypto.com'&&LIVE.st==='ok')return;
    if(h.liveSrc==='Google Finance'&&GS.st==='ok')return;
    const f=fvMatch(h,lines);if(!f)return;
    if(String(h.liveSrc||'').startsWith('Base')&&(Date.parse(h.liveAt)||0)>(Date.parse(f.priceAsOf)||0)){n++;return}
    const cur=h.cur||a.cur||ST().cur;const px=+f.unitPrice*(fx[f.quoteCurrency]??1)/(fx[cur]??1);
    if(Math.abs((+h.price||0)-px)>1e-9)changed=true;
    h.price=+px.toFixed(px<1?6:4);h.liveSrc=FV_SERVER;h.liveAt=f.priceAsOf||new Date().toISOString();if(h.livePair&&!String(h.livePair).includes('_'))h.livePair=null;delete h.chg;n++;
  });
  FV.matched=n;FV.trunc=!!p.truncated;FV.at=Date.now();FV.st='ok';FV.code=null;
  if(changed)liveDirty();else liveRepaintBadge();
}
function fvFail(err){const code=err&&err.code||'upstream_error';if(LIVE_AUTH.includes(code)){FV.st='off';FV.code=code;if(FV.unsub){try{FV.unsub()}catch(e){}FV.unsub=null}}else if(FV.st!=='ok'){FV.st='err';FV.code=code}liveRepaintBadge()}
function startFV(){
  const mcp=S.cap.mcp;if(!mcp||FV.unsub||FV.st==='off'||!fvCandidates().length)return;
  FV.st='busy';
  FV.unsub=mcp.watchTool(FV_SERVER,FV_TOOL,FV_IN,ev=>{if(ev.type==='data'){const p=fvLines(ev.result);if(p)applyFV(p);else{FV.st='err';FV.code='format';liveRepaintBadge()}}else fvFail(ev.error)},{cache:{staleTime:30000,gcTime:600000},refetchInterval:60000});
}
function liveBadgeHTML(){
  const cands=fvCandidates();if(!cands.length)return '';
  const cc=cands.filter(x=>x.h.liveSrc==='Crypto.com').length,fv=cands.filter(x=>x.h.liveSrc===FV_SERVER).length,bs=cands.filter(x=>String(x.h.liveSrc||'').startsWith('Base')).length,gs=cands.filter(x=>x.h.liveSrc==='Google Finance').length,miss=cands.length-cc-fv-bs-gs;
  const at=Math.max(LIVE.at||0,FV.at||0,GS.at||0,bs?QB.at:0);
  let dot,txt,parts=[],btn=!!S.cap.mcp;
  if(cc||fv||bs||gs){dot='var(--good)';txt=t('live.onAll');if(gs)parts.push(t('live.gs',{n:gs}));if(cc)parts.push(t('live.cc',{n:cc}));if(fv)parts.push(t('live.fv',{n:fv}));if(bs)parts.push(t('live.base',{n:bs}));parts.push(t('live.upd',{t:liveAgoAt(at)}));if(miss)parts.push(t(GS.st==='ok'?'live.missingGs':'live.missing',{n:miss}));if(FV.trunc)parts.push(t('live.trunc'))}
  else if(S.cap.mcp===null){dot='var(--faint)';txt=t('live.manual');parts=[t('live.unavailP')];btn=false}
  else if(FV.st==='busy'||LIVE.st==='busy'){dot='var(--warn)';txt=t('live.busy');btn=false}
  else if(FV.st==='off'&&(LIVE.st==='off'||!liveHoldings().length)){dot='var(--bad)';txt=t('live.offAll');parts=[t(FV.code==='not_in_manifest'||FV.code==='consent_required'?'live.deniedAll':'live.offAllP')]}
  else if(FV.st==='ok'||LIVE.st==='ok'){dot='var(--warn)';txt=t('live.noMatchT');parts=[t('live.noMatchP')]}
  else{dot='var(--warn)';txt=t('live.errT');parts=[t('live.errP')]}
  return `<div class="livebar" id="livebar"><i class="ldot${cc||fv||bs||gs?' pulse':''}" style="--c:${dot}"></i><div class="m"><b>${esc(txt)}</b><span>${esc(parts.join(' · '))}</span></div>${btn?`<button class="btn sec sm" data-a="liveRefresh">${ico('refresh')}${esc(t('live.refresh'))}</button>`:''}</div>`;
}
function liveAgoAt(at){if(!at)return '';const m=Math.floor((Date.now()-at)/60000);return m<1?t('live.now'):t('live.min',{n:m})}
/* ---------- Google Finance via une feuille Google Sheets (connecteur Google Drive) ---------- */
const GS_SERVER='Google Drive',GS_TOOL='download_file_content';
const GS={st:'idle',code:null,at:null,unsub:null,id:null,rows:0,busy:false,msg:''};
function gsheetId(){const own=S.data&&ST().gsheet;return own||(S.isOwner&&QB.gsheet)||''}
function gsIdFrom(v){v=String(v||'').trim();const m=v.match(/\/d\/([A-Za-z0-9_-]{20,})/);if(m)return m[1];return /^[A-Za-z0-9_-]{20,}$/.test(v)?v:''}
function gsText(res){let p=res&&res.payload;if(typeof p==='string'){try{p=JSON.parse(p)}catch(e){p=null}}
  let b64=p&&p.content;if(!b64&&res&&Array.isArray(res.content)){const b=res.content.find(x=>x.type==='text');if(b){try{b64=JSON.parse(b.text).content}catch(e){}}}
  if(!b64||typeof b64!=='string')return null;try{const bin=atob(b64.replace(/\s/g,''));return new TextDecoder('utf-8').decode(Uint8Array.from(bin,c=>c.charCodeAt(0)))}catch(e){return null}}
function gsParse(text){
  const rows=parseCSVText(String(text).replace(/^﻿/,''),',');if(rows.length<2)return null;
  const h=rows[0].map(x=>norm(x).replace(/[^a-z0-9]/g,''));const ix=(...k)=>{for(const x of k){const i=h.indexOf(x);if(i>-1)return i}return -1};
  /* format Vigie (key, isin, gsym, cur, price…) ou « Moteur de cotations » (ISIN, Code Google, Devise cotée, Prix coté, Date du cours) */
  const iK=ix('key','symbole','ticker'),iI=ix('isin'),iG=ix('gsym','codegoogle'),iC=ix('cur','devisecotee','devise'),iP=ix('price','prixcote','prix','cours'),iX=ix('changepct','variation','variationpct'),iT=ix('tradetime','datducours','dateducours','date');
  if(iP<0)return null;
  const tt=v=>{const s=String(v||'').trim();const nx=+s.replace(",",".");if(/^\d{5}([.,]\d+)?$/.test(s)&&nx>30000&&nx<80000){const ms=Math.round((nx-25569)*86400000);return new Date(ms).toISOString().slice(0,19)}const d=parseDate(s);const m=s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);return d?d+'T'+(m?pad(+m[1])+':'+m[2]+':'+(m[3]||'00'):'12:00:00'):null};
  return rows.slice(1).map(r=>({key:String(r[iK]??'').trim().toUpperCase(),isin:String(r[iI]??'').trim().toUpperCase(),gsym:String(r[iG]??'').trim().toUpperCase(),cur:String(r[iC]??'').trim().toUpperCase(),price:parseAmount(r[iP]),chg:iX>-1?parseAmount(r[iX]):NaN,at:iT>-1?tt(r[iT]):null,err:/#N\/A|#ERROR|#REF|#VALUE|#NAME/i.test(String(r[iP]))})).filter(x=>x.key||x.isin||x.gsym);
}
function gsMatch(h,rows){
  const isin=String(h.isin||'').toUpperCase(),tk=String(h.ticker||'').toUpperCase(),g=String(h.gsym||'').toUpperCase();
  return (g&&rows.find(r=>r.gsym===g))||(isin&&rows.find(r=>r.isin===isin))||(tk&&rows.find(r=>r.key===tk||r.gsym.split(':').pop()===tk))||null;
}
function gsHandle(res){
  if(!S.data)return;
  const text=gsText(res);const rows=text&&gsParse(text);
  if(!rows){GS.st='err';GS.code='format';liveRepaintBadge();return}
  const ok=rows.filter(r=>!r.err&&isFinite(r.price)&&r.price>0);GS.rows=ok.length;GS.errRows=rows.length-ok.length;
  let changed=false;const fx=ST().fx;
  fvCandidates().forEach(({a,h})=>{if(h.kind==='crypto'&&LIVE.st==='ok')return;const r=gsMatch(h,ok);if(!r)return;
    const cur=h.cur||a.cur||ST().cur;const qc=r.cur||cur;const px=r.price*(fx[qc]??1)/(fx[cur]??1);
    if(Math.abs((+h.price||0)-px)>1e-9)changed=true;h.price=+px.toFixed(px<1?6:4);h.liveSrc='Google Finance';h.liveAt=r.at||new Date().toISOString();if(isFinite(r.chg))h.chg=r.chg/100;else delete h.chg});
  GS.at=Date.now();GS.st='ok';GS.code=null;
  if(changed)liveDirty();else liveRepaintBadge();
}
function gsFail(err){const code=err&&err.code||'upstream_error';if(LIVE_AUTH.includes(code)||code==='tool_error'){GS.st='off';GS.code=code;if(GS.unsub){try{GS.unsub()}catch(e){}GS.unsub=null;GS.id=null}}else if(GS.st!=='ok'){GS.st='err';GS.code=code}liveRepaintBadge()}
function startGS(){
  const mcp=S.cap.mcp,id=gsheetId();
  if(GS.unsub&&GS.id!==id){try{GS.unsub()}catch(e){}GS.unsub=null;GS.id=null}
  if(!S.data||!mcp||!id||GS.unsub||GS.st==='off')return;
  GS.st='busy';GS.id=id;
  GS.unsub=mcp.watchTool(GS_SERVER,GS_TOOL,{fileId:id,exportMimeType:'text/csv'},ev=>{if(ev.type==='data')gsHandle(ev.result);else gsFail(ev.error)},{cache:{staleTime:30000,gcTime:600000},refetchInterval:60000});
}
function gsSymbolFor(h){
  if(h.gsym)return h.gsym.toUpperCase();const tk=String(h.ticker||'').toUpperCase();if(!tk)return '';const isin=String(h.isin||'').toUpperCase(),cur=h.cur||'EUR';
  const pre={FR:'EPA',NL:'AMS',BE:'EBR',PT:'ELI',IE:'EPA',LU:'EPA',DE:'ETR',ES:'BME',IT:'BIT',GB:'LON',CH:'SWX'}[isin.slice(0,2)];
  if(isin.startsWith('US')||cur==='USD')return tk;
  if(pre)return pre+':'+tk;
  return cur==='EUR'?'EPA:'+tk:tk;
}
function gsCsv(sep){
  const seen=new Set();const lines=['key,isin,gsym,cur,price,changepct,tradetime'];let n=1;
  fvCandidates().forEach(({a,h})=>{if(h.kind==='crypto'||h.kind==='fe')return;const g=gsSymbolFor(h);if(!g||seen.has(g))return;seen.add(g);n++;
    const q=s=>'"'+String(s).replace(/"/g,'""')+'"';const f=attr=>q(`=GOOGLEFINANCE(C${n}${sep}"${attr}")`);
    lines.push([q(String(h.ticker||'').toUpperCase()),q(String(h.isin||'').toUpperCase()),q(g),q(h.cur||a.cur||'EUR'),f('price'),f('changepct'),f('tradetime')].join(','))});
  return {csv:lines.join('\n')+'\n',n:n-1};
}
async function gsCreate(){
  const mcp=S.cap.mcp;if(!mcp||GS.busy)return;GS.busy=true;GS.msg=t('gs.creating');render();
  try{
    let id=null,ok=false;
    for(const sep of [';',',']){
      const {csv,n}=gsCsv(sep);if(!n){GS.msg=t('gs.noPos');break}
      const r=await mcp.callTool(GS_SERVER,'create_file',{title:APP.name+' — '+t('gs.title'),contentMimeType:'text/csv',textContent:csv});
      let p=r.payload;if(typeof p==='string'){try{p=JSON.parse(p)}catch(e){}}id=p&&p.id;if(!id)throw {code:'format'};
      const d=await mcp.callTool(GS_SERVER,GS_TOOL,{fileId:id,exportMimeType:'text/csv'},{cache:false});const txt=gsText(d)||'';
      if(/#ERROR!/.test(txt)){try{await mcp.callTool(GS_SERVER,'trash_file',{fileId:id})}catch(e){}id=null;continue}
      ok=true;break;
    }
    if(ok&&id){ST().gsheet=id;save();GS.st='idle';GS.code=null;startGS();GS.msg=t('gs.created')}
    else if(!GS.msg)GS.msg=t('gs.failed');
  }catch(e){GS.msg=e&&LIVE_AUTH.includes(e.code)?t('gs.noDrive'):t('gs.failed')}
  GS.busy=false;render();
}
function gsLink(v){const id=gsIdFrom(v);if(!id){GS.msg=t('gs.badId');render();return}ST().gsheet=id;save();if(GS.st==='off')GS.st='idle';startGS();GS.msg=t('gs.linked');render()}
function gsUnlink(){ST().gsheet='';save();if(GS.unsub){try{GS.unsub()}catch(e){}GS.unsub=null;GS.id=null}GS.st='idle';GS.msg='';render()}
function gsPrefsHTML(){
  const id=gsheetId();const own=S.data&&ST().gsheet;
  const status=!S.cap.mcp?t('gs.needClaude'):!id?t('gs.none'):GS.st==='ok'?t('gs.ok',{n:GS.rows,t:liveAgoAt(GS.at)})+(GS.errRows?' · '+t('gs.errRows',{n:GS.errRows}):''):GS.st==='off'?t('gs.off'):GS.st==='err'?t('live.errP'):t('live.busy');
  return `<p class="note" style="margin:0 0 10px">${esc(t('gs.intro'))}</p>
  <div class="row" style="flex-wrap:wrap"><div class="m" style="min-width:200px"><b style="font-weight:500;white-space:normal">${esc(t('gs.status'))}</b><span style="white-space:normal">${esc(status)}</span></div>${id?`<a class="btn sec sm" href="https://docs.google.com/spreadsheets/d/${esc(id)}/edit" target="_blank" rel="noopener">${esc(t('gs.open'))}</a>`:''}</div>
  ${S.cap.mcp?`<div class="hrow" style="flex-wrap:wrap;gap:8px;margin-top:10px"><button class="btn sm" data-a="gsCreate" ${GS.busy?'disabled':''}>${ico('plus')}${esc(t(own?'gs.recreate':'gs.create'))}</button>${own?`<button class="btn ghost sm" data-a="gsUnlink">${esc(t('gs.unlink'))}</button>`:''}</div>
  <form class="inline" data-form="gsLink" style="margin-top:10px"><input id="gs-id" name="v" placeholder="${esc(t('gs.linkPh'))}" aria-label="${esc(t('gs.linkPh'))}"><button class="btn sec sm">${esc(t('gs.link'))}</button></form>`:''}
  ${GS.msg?`<p class="note" style="margin:10px 0 0">${esc(GS.msg)}</p>`:''}
  <p class="note" style="margin:10px 0 0">${esc(t('gs.legal'))}</p>`;
}
/* ---------- base de cours partagée (collection « quotes », alimentée par une tâche planifiée) ---------- */
const QB={map:new Map(),at:0,unsub:null};
function startBase(){const db=S.cap.db;if(!db||QB.unsub)return;try{QB.unsub=db.collection('quotes').onSnapshot(snap=>{QB.map.clear();let at=0;snap.docs.forEach(d=>{const q=d.data()||{};if(d.id==='META-GSHEET'){QB.gsheet=q.id||'';return}if(+q.price>0){QB.map.set(d.id,q);const u=Date.parse(q.upd||q.asOf||0)||0;if(u>at)at=u}});QB.at=at;applyBase();startGS()},()=>{QB.unsub=null})}catch(e){QB.unsub=null}}
/* rapprochement par le nom quand ni l'ISIN ni le symbole ne correspondent (ex. « MSCI World Swap PEA EUR (Acc) » ↔ « iShares MSCI World Swap PEA UCITS ETF ») */
const NM_STOP=new Set(['ucits','etf','etc','acc','dist','distributing','accumulating','eur','usd','gbp','the','fund','sa','se','inc','corp','plc','ag','nv','class','share','shares','registered','inh','eo','dl','de','du','la','le','et','and','of','dis','c','d','a','b']);
const nmTok=s=>new Set(norm(s).replace(/[()]/g,' ').split(/[^a-z0-9&]+/).filter(w=>w.length>1&&!NM_STOP.has(w)));
function nameMatch(name,items,getName){
  const A=nmTok(name);if(A.size<3)return null;let best=null,bs=0,tie=false;
  for(const it of items){const B=nmTok(getName(it));let k=0;A.forEach(w=>{if(B.has(w))k++});const sc=k>=3?k/A.size:0;if(sc>bs+1e-9){best=it;bs=sc;tie=false}else if(sc>0&&Math.abs(sc-bs)<1e-9)tie=true}
  return bs>=0.75&&!tie?best:null;
}
function baseMatch(h){
  const isin=String(h.isin||'').toUpperCase(),tk=String(h.ticker||'').toUpperCase();let hit=null;
  for(const q of QB.map.values()){if(q.kind==='fx')continue;const sym=String(q.sym||'').toUpperCase(),qi=String(q.isin||'').toUpperCase();
    if(isin&&(qi===isin||sym===isin))return q;
    if(!hit&&tk&&(h.kind==='crypto'?(q.kind==='crypto'&&sym===tk):(q.kind!=='crypto'&&sym===tk)))hit=q}
  if(hit||h.kind==='crypto')return hit;
  const sec=[...QB.map.values()].filter(q=>q.kind==='security');const nm=norm(h.name);
  hit=(nm.length>3&&sec.find(q=>norm(q.name)===nm))||nameMatch(h.name,sec,q=>q.name);
  if(hit&&!h.ticker&&hit.sym&&!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(hit.sym))h.ticker=String(hit.sym).toUpperCase();
  return hit;
}
function applyBase(){
  if(!S.data||!QB.map.size)return;let changed=false;const fx=ST().fx;
  for(const q of QB.map.values()){if(q.kind==='fx'&&/^[A-Z]{3}$/.test(q.sym||'')&&q.sym!=='EUR'&&+q.price>0&&!(ST().fxUser||{})[q.sym]){const v=+(+q.price).toFixed(6);if(fx[q.sym]!==v){fx[q.sym]=v;changed=true}}}
  if(changed&&!S.demo)save();
  fvCandidates().forEach(({a,h})=>{const q=baseMatch(h);if(!q)return;
    const tq=Date.parse(q.asOf||q.upd)||0;
    if(h.liveAt&&h.liveSrc&&!String(h.liveSrc).startsWith('Base')&&(Date.parse(h.liveAt)||0)>=tq&&(LIVE.st==='ok'||FV.st==='ok'||GS.st==='ok'))return;
    const cur=h.cur||a.cur||ST().cur;const px=+q.price*(fx[q.cur||'EUR']??1)/(fx[cur]??1);
    if(Math.abs((+h.price||0)-px)>1e-9)changed=true;
    h.price=+px.toFixed(px<1?6:4);h.liveAt=q.asOf||q.upd;h.liveSrc='Base · '+(q.src||'');if(isFinite(q.chg))h.chg=+q.chg;else delete h.chg;
  });
  if(changed)liveDirty();else liveRepaintBadge();
}
function baseHist(h){const q=baseMatch(h);if(!q||!q.hist)return [];return Object.entries(q.hist).filter(([d,v])=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&+v>0).sort((x,y)=>x[0].localeCompare(y[0])).map(([d,v])=>({d,v:+v,cur:q.cur||'EUR'}))}
function liveRepaintBadge(){const el=document.getElementById('livebar');if(!el)return;const w=document.createElement('div');w.innerHTML=liveBadgeHTML();if(w.firstElementChild)el.replaceWith(w.firstElementChild)}
setInterval(()=>{if(LIVE.st==='ok'||FV.st==='ok')liveRepaintBadge()},30000);
