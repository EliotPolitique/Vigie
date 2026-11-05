/* ================= Vigie autonome — remplace les services de Claude =================
   window.claude.use(name) reproduit l'interface utilisée par Vigie :
   - db        : stockage local (IndexedDB), synchronisé dans ton Google Drive (fichier « vigie-donnees.json.gz ») ;
   - user      : utilisateur unique « local » ;
   - mcp       : Google Drive et Google Sheets via les API Google (ton identifiant OAuth), Crypto.com via son API publique ;
   - sample    : Claude via ta clé API Anthropic (facultatif) ;
   - downloads : téléchargement direct d'un fichier.
   Aucune donnée ne quitte ton navigateur, sauf vers ton propre Google Drive et, si tu l'actives, vers l'API Claude. */
(function(){
'use strict';
const CFG_KEY='vigie:cfg';
const SA={cfg:{},token:null,tokenExp:0,tokenClient:null,gisReady:false,listeners:new Set(),sync:{st:'off',at:null,err:null,remoteAt:null,busy:false,dirty:false,conflict:null}};
window.VSA=SA;
function loadCfg(){try{SA.cfg=JSON.parse(localStorage.getItem(CFG_KEY)||'{}')||{}}catch(e){SA.cfg={}}}
SA.saveCfg=function(patch){Object.assign(SA.cfg,patch||{});try{localStorage.setItem(CFG_KEY,JSON.stringify(SA.cfg))}catch(e){}SA.emit()};
SA.emit=function(){SA.listeners.forEach(f=>{try{f()}catch(e){}})};
loadCfg();

/* ---------------- stockage local (IndexedDB) ---------------- */
const IDB={db:null};
function idb(){if(IDB.db)return Promise.resolve(IDB.db);return new Promise((res,rej)=>{const r=indexedDB.open('vigie',1);r.onupgradeneeded=()=>{r.result.createObjectStore('docs')};r.onsuccess=()=>{IDB.db=r.result;res(IDB.db)};r.onerror=()=>rej(r.error)})}
async function idbGet(k){const d=await idb();return new Promise((res,rej)=>{const r=d.transaction('docs').objectStore('docs').get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function idbPut(k,v){const d=await idb();return new Promise((res,rej)=>{const tx=d.transaction('docs','readwrite');v===undefined?tx.objectStore('docs').delete(k):tx.objectStore('docs').put(v,k);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
async function idbAll(){const d=await idb();return new Promise((res,rej)=>{const out={};const r=d.transaction('docs').objectStore('docs').openCursor();r.onsuccess=()=>{const c=r.result;if(c){out[c.key]=c.value;c.continue()}else res(out)};r.onerror=()=>rej(r.error)})}
async function idbClear(){const d=await idb();return new Promise((res,rej)=>{const tx=d.transaction('docs','readwrite');tx.objectStore('docs').clear();tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
SA.idbAll=idbAll;
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const isUserDoc=p=>/^data\/users\//.test(p);
const dbApi={
  doc(path){return {id:String(path).split('/').pop(),
    async get(){const v=await idbGet(path);return {exists:v!==undefined,id:String(path).split('/').pop(),data:()=>clone(v)}},
    async set(v){await idbPut(path,clone(v));if(isUserDoc(path))markDirty()},
    async update(v){const o=(await idbGet(path))||{};await idbPut(path,Object.assign(o,clone(v)));if(isUserDoc(path))markDirty()},
    async delete(){await idbPut(path,undefined);if(isUserDoc(path))markDirty()}}},
  collection(name){return {
    doc(id){return dbApi.doc(name+'/'+id)},
    onSnapshot(cb,err){(async()=>{try{const all=await idbAll();const pre=name+'/';const docs=Object.keys(all).filter(k=>k.startsWith(pre)&&!k.slice(pre.length).includes('/')).map(k=>({id:k.slice(pre.length),data:()=>clone(all[k])}));cb({docs})}catch(e){err&&err(e)}})();return ()=>{}}}}
};

/* ---------------- Google : autorisation ---------------- */
const G_SCOPES='https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets';
function loadGis(){if(SA.gisP)return SA.gisP;SA.gisP=new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=()=>{SA.gisReady=true;res()};s.onerror=()=>rej(new Error('gis'));document.head.appendChild(s)});return SA.gisP}
SA.googleConnect=async function(silent){if(!SA.cfg.gClientId)throw {code:'no_client_id'};await loadGis();
  return new Promise((res,rej)=>{SA.tokenClient=google.accounts.oauth2.initTokenClient({client_id:SA.cfg.gClientId,scope:G_SCOPES,prompt:silent?'':undefined,
    callback:r=>{if(r&&r.access_token){SA.token=r.access_token;SA.tokenExp=Date.now()+((+r.expires_in||3600)-120)*1000;SA.saveCfg({gLinked:true});SA.emit();res(SA.token)}else rej({code:'not_granted',message:r&&r.error})},
    error_callback:e=>rej({code:'not_granted',message:e&&e.type})});
    SA.tokenClient.requestAccessToken(silent?{prompt:''}:{})})};
SA.googleSignOut=function(){try{if(SA.token&&window.google)google.accounts.oauth2.revoke(SA.token,()=>{})}catch(e){}SA.token=null;SA.tokenExp=0;SA.saveCfg({gLinked:false});SA.emit()};
SA.googleOk=()=>!!SA.token&&Date.now()<SA.tokenExp;
async function gtoken(){if(SA.googleOk())return SA.token;throw {code:'needs_reauth',message:'google'}}
async function gfetch(url,opt={},raw){const tk=await gtoken();const r=await fetch(url,Object.assign({},opt,{headers:Object.assign({Authorization:'Bearer '+tk},opt.headers||{})}));
  if(r.status===401){SA.token=null;SA.emit();throw {code:'needs_reauth'}}if(r.status===403)throw {code:'not_granted',message:await r.text()};if(r.status===429)throw {code:'rate_limited',retryable:true};
  if(!r.ok)throw {code:'tool_error',message:(await r.text()).slice(0,300),retryable:r.status>=500};return raw?r:(r.status===204?null:r.json())}
const b64OfBuf=buf=>{const u=new Uint8Array(buf);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
const DRV='https://www.googleapis.com/drive/v3';

/* ---------------- connecteurs ---------------- */
function driveQuery(q){return String(q||'').replace(/\btitle\b/g,'name').replace(/parentId\s*=\s*'([^']+)'/g,"'$1' in parents").replace(/parentId\s*!=\s*'([^']+)'/g,"not '$1' in parents")}
const TOOLS={
 'Google Drive':{
  async download_file_content(i){const m=await gfetch(`${DRV}/files/${encodeURIComponent(i.fileId)}?fields=name,mimeType&supportsAllDrives=true`);
    const gapps=/^application\/vnd\.google-apps\./.test(m.mimeType||'');const ex=i.exportMimeType||(m.mimeType==='application/vnd.google-apps.spreadsheet'?'text/csv':m.mimeType==='application/vnd.google-apps.document'?'text/plain':null);
    const url=gapps?`${DRV}/files/${encodeURIComponent(i.fileId)}/export?mimeType=${encodeURIComponent(ex||'application/pdf')}`:`${DRV}/files/${encodeURIComponent(i.fileId)}?alt=media&supportsAllDrives=true`;
    const r=await gfetch(url,{},true);return {content:b64OfBuf(await r.arrayBuffer()),title:m.name,mimeType:gapps?ex:m.mimeType}},
  async create_file(i){const meta={name:i.title||'Sans titre'};if(i.parentId)meta.parents=[i.parentId];
    if(i.contentMimeType==='application/vnd.google-apps.folder'){meta.mimeType=i.contentMimeType;const r=await gfetch(`${DRV}/files?fields=id,name`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(meta)});return {id:r.id,title:r.name}}
    if(!i.disableConversionToGoogleType&&i.contentMimeType==='text/csv')meta.mimeType='application/vnd.google-apps.spreadsheet';
    const body=i.base64Content?Uint8Array.from(atob(i.base64Content),c=>c.charCodeAt(0)):new TextEncoder().encode(i.textContent||'');
    const bd='vigie'+Math.random().toString(36).slice(2);const enc=new TextEncoder();
    const parts=[enc.encode(`--${bd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${bd}\r\nContent-Type: ${i.contentMimeType||'application/octet-stream'}\r\n\r\n`),body,enc.encode(`\r\n--${bd}--`)];
    const r=await gfetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name`,{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+bd},body:new Blob(parts)});return {id:r.id,title:r.name}},
  async trash_file(i){await gfetch(`${DRV}/files/${encodeURIComponent(i.fileId)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})});return {ok:true}},
  async search_files(i){const q=driveQuery(i.query);const r=await gfetch(`${DRV}/files?q=${encodeURIComponent(q)}&pageSize=${Math.min(+i.pageSize||50,200)}&fields=files(id,name,mimeType,modifiedTime,createdTime,parents,size)&supportsAllDrives=true&includeItemsFromAllDrives=true`);
    return {files:(r.files||[]).map(f=>({id:f.id,title:f.name,mimeType:f.mimeType,modifiedTime:f.modifiedTime,createdTime:f.createdTime,parentId:(f.parents||[])[0],fileSize:f.size}))}}},
 'Google Sheets':{
  async get_spreadsheet(i){const f=Array.isArray(i.fields)?i.fields.join(','):(i.fields||'');return gfetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(i.spreadsheetId)}${f?'?fields='+encodeURIComponent(f):''}`)},
  async get_values(i){return gfetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(i.spreadsheetId)}/values/${encodeURIComponent(i.range)}`)},
  async update_values(i){return gfetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(i.spreadsheetId)}/values/${encodeURIComponent(i.range)}?valueInputOption=USER_ENTERED`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({range:i.range,majorDimension:'ROWS',values:i.values})})}},
 'Crypto.com':{
  async get_ticker(i){const r=await fetch('https://api.crypto.com/exchange/v1/public/get-tickers?instrument_name='+encodeURIComponent(i.instrument_name));if(!r.ok)throw {code:'tool_error',retryable:true};const j=await r.json();const x=j&&j.result&&(j.result.data||[])[0];
    if(!x)throw {code:'tool_error',message:'not found'};return {result:{data:[{instrument_name:x.i,last:x.a,change:x.c,high:x.h,low:x.l,timestamp:new Date(+x.t||Date.now()).toISOString()}]}}}}
};
const mcpApi={
  async callTool(server,tool,input){const S1=TOOLS[server];if(!S1||!S1[tool])throw {code:'server_not_connected',message:server};const payload=await S1[tool](input||{});return {payload,cache:{storedAt:Date.now()}}},
  watchTool(server,tool,input,handler,opts){let stop=false;const every=Math.max(30000,(opts&&opts.refetchInterval)||300000);
    const run=async()=>{if(stop)return;if(document.visibilityState==='hidden'&&run.n)return;run.n=1;try{const res=await mcpApi.callTool(server,tool,input);if(!stop)handler({type:'data',result:res})}catch(e){if(!stop)handler({type:'error',error:e})}};
    run();const t=setInterval(run,every);return ()=>{stop=true;clearInterval(t)}},
  async describeTool(){throw {code:'unsupported'}}
};

/* ---------------- Claude (facultatif, clé API Anthropic) ---------------- */
async function blobB64(b){return b64OfBuf(await b.arrayBuffer())}
async function askClaude(input,opts={}){const key=SA.cfg.aKey;if(!key)throw {code:'not_granted'};
  let msgs=typeof input==='string'?[{role:'user',content:input}]:input.map(m=>({role:m.role,content:m.content}));
  if(opts.images&&opts.images.length){const last=msgs[msgs.length-1];const blocks=[];for(const im of opts.images.slice(0,8))blocks.push({type:'image',source:{type:'base64',media_type:im.type||'image/png',data:await blobB64(im)}});blocks.push({type:'text',text:typeof last.content==='string'?last.content:''});last.content=blocks}
  const model=SA.cfg.aModel||(opts.modelTier==='quick'?'claude-haiku-5-5':'claude-sonnet-5-5');
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:opts.signal,headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model,max_tokens:opts.maxTokens||4096,messages:msgs})});
  if(r.status===401||r.status===403)throw {code:'not_granted'};if(r.status===429)throw {code:'rate_limited'};if(!r.ok)throw {code:'tool_error',message:(await r.text()).slice(0,300)};
  const j=await r.json();const text=(j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');if(opts.onText)try{opts.onText({text,delta:text})}catch(e){}
  return {text,truncated:j.stop_reason==='max_tokens',modelApplied:j.model}}
function makeSample(){const f=(input,opts)=>askClaude(input,opts);
  f.json=async(input,opts)=>{const ins=typeof input==='string'?input+'\n\nRéponds uniquement par du JSON valide, sans texte autour.':input;const r=await askClaude(ins,opts);const s=r.text;const i=Math.min(...['{','['].map(c=>{const k=s.indexOf(c);return k<0?1e9:k}));const j=Math.max(s.lastIndexOf('}'),s.lastIndexOf(']'));if(i>=1e9||j<i)throw {code:'tool_error',message:'json'};return JSON.parse(s.slice(i,j+1))};
  f.limits=async()=>({images:true});return f}

/* ---------------- téléchargements ---------------- */
const dlApi={async save({filename,data}){const b=data instanceof Blob?data:new Blob([data]);const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=filename||'vigie';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000)}};

/* ---------------- synchronisation Google Drive ---------------- */
const SYNC_NAME='vigie-donnees.json.gz',SYNC_FOLDER='Vigie';
let dirtyT=null;
function markDirty(){SA.sync.dirty=true;try{localStorage.setItem('vigie:dirtyAt',String(Date.now()))}catch(e){}clearTimeout(dirtyT);dirtyT=setTimeout(()=>{if(SA.googleOk()&&SA.cfg.sync!==false)SA.push().catch(()=>{})},8000)}
async function gz(str){const cs=new CompressionStream('gzip');const w=cs.writable.getWriter();w.write(new TextEncoder().encode(str));w.close();return new Uint8Array(await new Response(cs.readable).arrayBuffer())}
async function gunzip(buf){const ds=new DecompressionStream('gzip');const w=ds.writable.getWriter();w.write(buf);w.close();return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer())}
async function syncFile(){if(SA.cfg.syncFileId){try{const m=await gfetch(`${DRV}/files/${SA.cfg.syncFileId}?fields=id,modifiedTime,trashed`);if(!m.trashed)return m}catch(e){if(e.code==='needs_reauth')throw e}}
  const r=await gfetch(`${DRV}/files?q=${encodeURIComponent(`name = '${SYNC_NAME}' and trashed = false`)}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`);const f=(r.files||[])[0];if(f)SA.saveCfg({syncFileId:f.id});return f||null}
async function bundle(){const all=await idbAll();const docs={};Object.keys(all).forEach(k=>{if(isUserDoc(k))docs[k]=all[k]});return {v:1,app:'vigie',at:new Date().toISOString(),docs}}
SA.push=async function(force){if(SA.sync.busy)return;SA.sync.busy=true;SA.sync.err=null;SA.emit();
  try{const f=await syncFile();if(f&&!force&&SA.cfg.syncRemoteAt&&f.modifiedTime>SA.cfg.syncRemoteAt){SA.sync.conflict=f.modifiedTime;throw {code:'conflict'}}
    const data=await gz(JSON.stringify(await bundle()));const bd='vigie'+Math.random().toString(36).slice(2);const enc=new TextEncoder();
    let folder=SA.cfg.syncFolderId;if(!folder&&!f){const r=await gfetch(`${DRV}/files?fields=id`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:SYNC_FOLDER,mimeType:'application/vnd.google-apps.folder'})});folder=r.id;SA.saveCfg({syncFolderId:folder})}
    const meta=f?{}:{name:SYNC_NAME,parents:[folder]};
    const parts=[enc.encode(`--${bd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${bd}\r\nContent-Type: application/gzip\r\n\r\n`),data,enc.encode(`\r\n--${bd}--`)];
    const url=f?`https://www.googleapis.com/upload/drive/v3/files/${f.id}?uploadType=multipart&fields=id,modifiedTime`:`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime`;
    const r=await gfetch(url,{method:f?'PATCH':'POST',headers:{'Content-Type':'multipart/related; boundary='+bd},body:new Blob(parts)});
    SA.saveCfg({syncFileId:r.id,syncRemoteAt:r.modifiedTime});SA.sync.dirty=false;SA.sync.at=new Date().toISOString();SA.sync.conflict=null;try{localStorage.removeItem('vigie:dirtyAt')}catch(e){}}
  catch(e){SA.sync.err=e&&e.code||'net'}finally{SA.sync.busy=false;SA.emit()}};
/* récupère la version du Drive si elle est plus récente que ce que ce navigateur a déjà envoyé ou reçu */
SA.pull=async function(force){SA.sync.busy=true;SA.sync.err=null;SA.emit();
  try{const f=await syncFile();if(!f){SA.sync.busy=false;SA.emit();return 'none'}
    if(!force&&SA.cfg.syncRemoteAt&&f.modifiedTime<=SA.cfg.syncRemoteAt){SA.sync.busy=false;SA.emit();return 'same'}
    const localDirty=+(localStorage.getItem('vigie:dirtyAt')||0);if(!force&&localDirty&&SA.cfg.syncRemoteAt){SA.sync.conflict=f.modifiedTime;throw {code:'conflict'}}
    const r=await gfetch(`${DRV}/files/${f.id}?alt=media`,{},true);const j=JSON.parse(await gunzip(new Uint8Array(await r.arrayBuffer())));if(!j||j.app!=='vigie'||!j.docs)throw {code:'format'};
    const all=await idbAll();for(const k of Object.keys(all))if(isUserDoc(k))await idbPut(k,undefined);for(const [k,v] of Object.entries(j.docs))await idbPut(k,v);
    SA.saveCfg({syncFileId:f.id,syncRemoteAt:f.modifiedTime});try{localStorage.removeItem('vigie:dirtyAt')}catch(e){}SA.sync.conflict=null;SA.sync.busy=false;SA.emit();return 'pulled'}
  catch(e){SA.sync.err=e&&e.code||'net';SA.sync.busy=false;SA.emit();return 'err'}};

/* ---------------- window.claude ---------------- */
const userApi={async id(){return 'local'},async me(){return {id:'local',name:''}},async isOwner(){return true},async canEdit(){return true},async can(){return true},async profiles(){return {}}};
window.claude={use(name){switch(name){
  case 'db':return Promise.resolve(dbApi);
  case 'user':return Promise.resolve(userApi);
  case 'mcp':return Promise.resolve(mcpApi);
  case 'sample':return Promise.resolve(SA.cfg.aKey?makeSample():null);
  case 'downloads':return Promise.resolve(dlApi);
  default:return Promise.resolve(null)}}};
SA.clearAll=async()=>{await idbClear();try{localStorage.removeItem('vigie:dirtyAt')}catch(e){}};
/* hors ligne : mise en cache de l'application */
if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{})});
})();
