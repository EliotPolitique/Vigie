/* ================= V4.7 — Marchés : tes feuilles « Marches_v3_elargie » et « Cours des cryptos » =================
   Les deux classeurs sont lus en CSV (premier onglet) par le connecteur Google Drive. Rien n'est stocké dans tes données
   hormis la liste des lignes que tu suis. « Cours des cryptos » sert aussi de cours de secours pour tes cryptos. */
const MK={rows:[],cry:[],at:0,cat:0};
/* nombres du CSV Google en français : virgule décimale, pas de séparateur de milliers */
const mkNum=v=>{const s=String(v??'').replace(/[\s\u00a0\u202f%€]/g,'').replace(/^−/,'-');if(/^-?\d+(,\d+)?$/.test(s))return +s.replace(',','.');if(/^-?\d+(\.\d+)?$/.test(s))return +s;return NaN};
function mkCsv(text){const rows=parseCSVText(String(text).replace(/^\uFEFF/,''),',');if(rows.length<2)return null;const h=rows[0].map(gsyK);return {h,rows:rows.slice(1),ix:k=>h.indexOf(k)}}
const mkSerial=v=>{const n=mkNum(v);return isFinite(n)&&n>20000&&n<80000?new Date(Math.round((n-25569)*864e5)).toISOString().slice(0,16):null};
function mkParseMarkets(text){const C=mkCsv(text);if(!C)return null;const i=C.ix;if(i('codegoogle')<0||i('cours')<0)return null;
  const N=v=>{const n=mkNum(v);return isFinite(n)?n:null};
  return C.rows.filter(r=>r[i('codegoogle')]).map(r=>{const px=N(r[i('cours')]);const m1=N(r[i('coursilya1mois')]),y1=N(r[i('coursilya1an')]),hi=N(r[i('haut52semaines')]),lo=N(r[i('bas52semaines')]);
    return {g:String(r[i('codegoogle')]).trim(),n:String(r[i('nom')]||r[i('nomgoogle')]||r[i('codegoogle')]).trim(),cls:gsyK(r[i('classe')]||''),clsL:String(r[i('classe')]||'').trim(),zone:String(r[i('zone')]||'').trim(),th:String(r[i('themeousecteur')]||'').trim(),cur:String(r[i('devisedecotation')]||'').trim(),
      px,d:N(r[i('jour')]),hi,lo,r1m:px&&m1?px/m1-1:null,r1y:px&&y1?px/y1-1:null,pos:px!=null&&hi!=null&&lo!=null&&hi>lo?clamp((px-lo)/(hi-lo),0,1):null,at:mkSerial(r[i('heuredecotation')]),cap:N(r[i('capitalisation')]),per:N(r[i('percoursbenefice')])}}).filter(x=>x.px!=null)}
function mkParseCrypto(text){const C=mkCsv(text);if(!C)return null;const i=C.ix;if(i('symbole')<0)return null;const kp=['coursretenueur','coursgooglefinanceeur','coursmanueleur'].map(i).find(x=>x>=0);if(kp==null)return null;
  const out=[];for(const r of C.rows){const sym=String(r[i('symbole')]||'').trim().toUpperCase();if(!sym||!/^[A-Z0-9]{2,10}$/.test(sym))continue;const px=mkNum(r[kp]);if(!(px>0))continue;out.push({sym,n:String(r[i('nom')]||sym).trim(),g:String(r[i('codegoogle')]||'').trim(),px,src:String(r[i('sourceducours')]||'').trim()})}return out}
async function mkLoad(src,id,fresh){const r=await S.cap.mcp.callTool(GS_SERVER,GS_TOOL,{fileId:id,exportMimeType:'text/csv'},fresh?{cache:false}:{cache:{staleTime:600000,gcTime:1800000}});
  let p=r&&r.payload;if(typeof p==='string'){try{p=JSON.parse(p)}catch(e){p=null}}if(p&&p.title)GSY.titles[src]=p.title;
  const text=gsText(r);if(!text)throw {code:'format'};
  if(src==='mkt'){const L=mkParseMarkets(text);if(!L||!L.length)throw {code:'format'};MK.rows=L;MK.at=Date.now()}
  else{const L=mkParseCrypto(text);if(!L)throw {code:'format'};MK.cry=L;MK.cat=Date.now();mkCryApply()}}
/* cours de secours pour les cryptos : seulement si aucun cours récent n'est connu */
function mkCryApply(){if(!S.data||!MK.cry.length)return;const fx=ST().fx;let ch=false;
  D().accounts.forEach(a=>(a.holdings||[]).forEach(h=>{if(h.kind!=='crypto')return;const sym=String(h.ticker||'').toUpperCase().replace(/[-_/].*$/,'');const c=MK.cry.find(x=>x.sym===sym);if(!c)return;
    const fresh=h.liveAt&&h.liveSrc&&!/^Feuille/.test(h.liveSrc)&&Date.now()-(Date.parse(h.liveAt)||0)<6*3600e3;if(fresh)return;
    const px=+(c.px/(fx[h.cur||a.cur||'EUR']??1)).toFixed(c.px<1?6:4);if(Math.abs((+h.price||0)-px)>1e-9){h.price=px;ch=true}h.liveSrc='Feuille · Cours des cryptos';h.liveAt=new Date(MK.cat).toISOString()}));
  if(ch&&typeof liveDirty==='function')liveDirty()}

/* ---------- écran Marchés ---------- */
VIEWS.push({k:'markets',g:'ana',ic:'globe'});
const MK_CLS=[['indice','mk.c.idx'],['devise','mk.c.fx'],['matierepremiere','mk.c.com'],['etf','mk.c.etf'],['action','mk.c.stk'],['crypto','mk.c.cry'],['fav','mk.c.fav']];
const mkFavs=()=>{const s=ST();if(!Array.isArray(s.mkFav))s.mkFav=[];return s.mkFav};
function mkHeld(){const S1=new Set();D().accounts.forEach(a=>(a.holdings||[]).forEach(h=>{if(!(+h.qty>0))return;if(h.gsym)S1.add(String(h.gsym).toUpperCase());if(h.ticker)S1.add(pfRoot(String(h.ticker)).toUpperCase())}));return S1}
function mkAll(){return MK.rows.concat(MK.cry.map(c=>({g:'C:'+c.sym,n:c.n,cls:'crypto',clsL:'Crypto',zone:'',th:c.sym,cur:'EUR',px:c.px,d:null,hi:null,lo:null,r1m:null,r1y:null,pos:null,at:MK.cat?new Date(MK.cat).toISOString().slice(0,16):null})))}
function mkPx(x){const dec=x.cls==='devise'?4:x.px<1?4:2;return x.cls==='indice'?numT(x.px,2):moneyT(x.px,dec,x.cur&&/^[A-Z]{3}$/.test(x.cur)?(x.cur==='GBX'?'GBP':x.cur):'EUR')}
function marketsView(){
  const g=gsyCfg();const linked=g.files.mkt||g.files.cry;
  const head=`<div class="pghead" style="margin-bottom:14px"><span class="av" style="--c:var(--accent)">${ico('globe')}</span><div class="m"><div class="eyebrow">${esc(t('mk.eyebrow'))}</div><h2>${esc(t('mk.h'))}</h2></div><div class="act">${linked?`<button class="btn sec sm" data-a="gsySync" ${GSY.busy||!S.cap.mcp?'disabled':''}>${ico('refresh')}${esc(t(GSY.busy?'gsy.busy':'gsy.now'))}</button>`:''}<button class="btn ghost sm" data-a="go" data-v="sources">${ico('sheet')}${esc(t('nav.sources'))}</button></div></div>`;
  if(!MK.rows.length&&!MK.cry.length)return head+emptyBlock(t(linked?(GSY.busy?'gsy.busy':'mk.wait'):'mk.none'),t('mk.noneS'),t('nav.sources'),'goSources');
  const all=mkAll();const favs=mkFavs();const held=mkHeld();
  const cnt=k=>k==='fav'?all.filter(x=>favs.includes(x.g)).length:all.filter(x=>x.cls===k).length;
  const tabs=MK_CLS.filter(([k])=>cnt(k)>0||k==='fav');let cls=S.ui.mkCls&&tabs.some(([k])=>k===S.ui.mkCls)?S.ui.mkCls:(tabs[0]||['indice'])[0];
  let L=cls==='fav'?all.filter(x=>favs.includes(x.g)):all.filter(x=>x.cls===cls);
  const zones=[...new Set(L.map(x=>x.zone).filter(Boolean))].sort((a,b)=>a.localeCompare(b));const zone=S.ui.mkZone&&zones.includes(S.ui.mkZone)?S.ui.mkZone:'';
  if(zone)L=L.filter(x=>x.zone===zone);
  const q=norm(S.ui.mkQ||'');if(q)L=L.filter(x=>norm(x.n+' '+x.g+' '+x.th).includes(q));
  const sort=S.ui.mkSort||'d';const sv=x=>sort==='d'?x.d:sort==='m'?x.r1m:sort==='y'?x.r1y:sort==='hi'?x.pos:null;
  if(sort==='n')L=[...L].sort((a,b)=>a.n.localeCompare(b.n));else L=[...L].sort((a,b)=>{const va=sv(a),vb=sv(b);if(va==null&&vb==null)return a.n.localeCompare(b.n);if(va==null)return 1;if(vb==null)return -1;return S.ui.mkAsc?va-vb:vb-va});
  const withD=L.filter(x=>x.d!=null);const up=withD.filter(x=>x.d>0).length,dn=withD.filter(x=>x.d<0).length;const med=withD.length?[...withD].sort((a,b)=>a.d-b.d)[Math.floor(withD.length/2)].d:null;
  const top=[...withD].sort((a,b)=>b.d-a.d).slice(0,3),bot=[...withD].sort((a,b)=>a.d-b.d).slice(0,3);
  const pc=v=>v==null?'<span class="muted">—</span>':`<span class="${v>0?'good':v<0?'bad':''}">${esc(pctS(v,2))}</span>`;
  const kp=withD.length?`<div class="kpis k4" style="margin-bottom:16px">${[[t('mk.k.up'),String(up),'good'],[t('mk.k.dn'),String(dn),'bad'],[t('mk.k.med'),med==null?'—':pctS(med/100,2),med>0?'good':med<0?'bad':''],[t('mk.k.at'),MK.at?liveAgoAt(MK.at):'—','']].map(([l,v,c])=>`<div class="kpi"><div class="eyebrow">${esc(l)}</div><div class="hero-v" style="font-size:22px"><span class="${c}">${esc(v)}</span></div></div>`).join('')}</div>
    <div class="grid g2" style="margin-bottom:16px">${[[t('mk.top'),top],[t('mk.bot'),bot]].map(([title,arr])=>`<div class="card"><div class="ch"><div><h2>${esc(title)}</h2><p>${esc(t('mk.cls',{c:t(MK_CLS.find(x=>x[0]===cls)[1])}))}</p></div></div><div class="list">${arr.map(x=>`<div class="row"><div class="m"><b>${esc(x.n)}</b><span>${esc([x.g,x.zone].filter(Boolean).join(' · '))}</span></div><div class="r"><b>${pc(x.d/100)}</b><span>${esc(mkPx(x))}</span></div></div>`).join('')}</div></div>`).join('')}</div>`:'';
  const lim=S.ui.mkAll?L.length:60;
  const th=(k,l)=>`<th><button class="thb" data-a="mkSort" data-v="${k}">${esc(l)}${sort===k?(S.ui.mkAsc?' ↑':' ↓'):''}</button></th>`;
  const table=`<div class="card"><div class="ch"><div><h2>${esc(t(MK_CLS.find(x=>x[0]===cls)[1]))}</h2><p>${esc(t('mk.n',{n:L.length}))}</p></div><div class="act"><input data-f="mkQ" value="${esc(S.ui.mkQ||'')}" placeholder="${esc(t('mk.search'))}" aria-label="${esc(t('mk.search'))}" style="width:180px;min-height:34px">${zones.length>1?`<select data-f="mkZone" style="width:auto;min-height:34px" aria-label="${esc(t('mk.zone'))}"><option value="">${esc(t('mk.zoneAll'))}</option>${zones.map(z=>`<option${z===zone?' selected':''}>${esc(z)}</option>`).join('')}</select>`:''}</div></div>
    <div class="tw"><table class="tbl mk"><thead><tr>${th('n',t('mk.col.n'))}<th>${esc(t('mk.col.px'))}</th>${th('d',t('mk.col.d'))}${th('m',t('mk.col.m'))}${th('y',t('mk.col.y'))}${th('hi',t('mk.col.r'))}<th></th></tr></thead><tbody>
    ${L.slice(0,lim).map(x=>{const fav=favs.includes(x.g);const h=held.has(String(x.g).toUpperCase())||held.has(String(x.g).split(':').pop().toUpperCase())&&x.cls!=='indice'&&x.cls!=='devise';
      return `<tr><td><b>${esc(x.n)}</b>${h?` <span class="pill acc">${esc(t('mk.held'))}</span>`:''}<br><span class="note">${esc([x.g.replace(/^C:/,''),x.th,x.zone].filter(Boolean).join(' · '))}</span></td><td class="mono">${esc(mkPx(x))}</td><td>${pc(x.d==null?null:x.d/100)}</td><td>${pc(x.r1m)}</td><td>${pc(x.r1y)}</td>
      <td>${x.pos==null?'<span class="muted">—</span>':`<span class="rng" title="${esc(t('mk.rngT',{lo:mkPx({...x,px:x.lo}),hi:mkPx({...x,px:x.hi})}))}"><i style="left:${(x.pos*100).toFixed(1)}%"></i></span> <span class="note">${esc(pctT(x.pos,0))}</span>`}</td>
      <td><button class="ib" data-a="mkFav" data-v="${esc(x.g)}" aria-pressed="${fav}" aria-label="${esc(t(fav?'mk.unfav':'mk.fav'))}" title="${esc(t(fav?'mk.unfav':'mk.fav'))}" style="color:${fav?'var(--warn)':'var(--muted)'}">${fav?'★':'☆'}</button></td></tr>`}).join('')}
    </tbody></table></div>${L.length>lim?`<div style="margin-top:10px"><button class="btn ghost sm" data-a="mkAll">${esc(t('mk.more',{n:L.length-lim}))}</button></div>`:''}
    <p class="note" style="margin:10px 0 0">${esc(t('mk.note'))}</p></div>`;
  return head+`<div class="hrow mkseg" style="gap:8px;margin-bottom:14px">${seg('mkCls',tabs.map(([k,l])=>[k,t(l)+' · '+cnt(k)]),cls,t('mk.h'))}</div>`+kp+table;
}
EXT.V.markets=marketsView;
EXT.A.mkCls=v=>{S.ui.mkCls=v;S.ui.mkZone='';S.ui.mkAll=false;render()};
EXT.A.mkSort=v=>{if(S.ui.mkSort===v)S.ui.mkAsc=!S.ui.mkAsc;else{S.ui.mkSort=v;S.ui.mkAsc=v==='n'}render()};
EXT.A.mkAll=()=>{S.ui.mkAll=true;render()};
EXT.A.mkFav=v=>{const f=mkFavs();const i=f.indexOf(v);if(i>=0)f.splice(i,1);else f.push(v);save();render()};
EXT.field.mkQ=(el,v,later)=>{S.ui.mkQ=v;later(()=>{render();const e=document.querySelector('[data-f="mkQ"]');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length)}})};
EXT.field.mkZone=(el,v)=>{S.ui.mkZone=v;render()};
/* l'écran Marchés charge les feuilles s'il est ouvert avant la première lecture */
{const _mv=marketsView;EXT.V.markets=function(){const g=gsyCfg();if(!MK.rows.length&&!MK.cry.length&&(g.files.mkt||g.files.cry)&&!GSY.busy&&S.cap.mcp&&!MK.tried){MK.tried=1;setTimeout(()=>gsySync(false),50)}return _mv()}}
EXT.A.goSources=()=>go('sources');
