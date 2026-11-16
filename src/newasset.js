/* ================= V5.4 — un nouvel actif a tout de suite son cours =================
   1. Les cours en direct lisent deux feuilles : ta feuille de cotations (Paramètres) et la feuille
      « Vigie — cotations Google Finance » de la base de cours.
   2. Une position détenue qui n'a de cours dans aucune des deux est ajoutée automatiquement à la seconde
      (formules GOOGLEFINANCE) : son cours arrive à la lecture suivante (une minute environ).
   3. Fiche de dividendes et logo : documentés par la tâche planifiée « Vigie · nouvelles positions »
      (toutes les deux heures) ; en attendant, la position est signalée comme « fiche en préparation ». */
const GS2={id:null,unsub:null,rows:[],at:0,st:'idle'};let GS_LAST=null;const GSA={busy:false,at:0,msg:''};
function gs2Id(){const a=gsheetId(),b=QB.gsheet||'';return b&&b!==a?b:''}
/* cotation en pence (GBX) ramenée en livres */
{const _gp=gsParse;gsParse=function(txt){const R=_gp(txt);if(R)R.forEach(r=>{if(r.cur==='GBX'||r.cur==='GBP.'){r.cur='GBP';if(isFinite(r.price))r.price=r.price/100}});return R}}
{const _gm=gsMatch;gsMatch=function(h,rows){return _gm(h,rows)||(GS2.rows.length&&rows!==GS2.rows?_gm(h,GS2.rows):null)}}
{const _gh=gsHandle;gsHandle=function(res){GS_LAST=res;_gh(res);setTimeout(gsEnsure,1500)}}
function gs2Start(){const mcp=S.cap.mcp,id=gs2Id();
  if(GS2.unsub&&GS2.id!==id){try{GS2.unsub()}catch(e){}GS2.unsub=null;GS2.id=null;GS2.rows=[]}
  if(!S.data||!mcp||!id||GS2.unsub)return;GS2.id=id;
  GS2.unsub=mcp.watchTool(GS_SERVER,GS_TOOL,{fileId:id,exportMimeType:'text/csv'},ev=>{if(ev.type!=='data')return;
    const txt=gsText(ev.result);const rows=txt&&gsParse(txt);if(!rows)return;GS2.rows=rows.filter(r=>!r.err&&isFinite(r.price)&&r.price>0);GS2.all=rows;GS2.at=Date.now();GS2.st='ok';
    if(GS_LAST)gsHandle(GS_LAST);else setTimeout(gsEnsure,1500)},{cache:{staleTime:30000,gcTime:600000},refetchInterval:60000})}
{const _sg=startGS;startGS=function(){_sg();try{gs2Start()}catch(e){}}}
{const _sl=stopLive;stopLive=function(){_sl();if(GS2.unsub){try{GS2.unsub()}catch(e){}GS2.unsub=null;GS2.id=null}}}
/* positions détenues sans cours dans les feuilles */
function gsMissing(){const seen=new Set();const out=[];const all=[...(GS2.all||[])];
  fvCandidates().forEach(({a,h})=>{if(!(+h.qty>0)||['crypto','fe','metal'].includes(h.kind)||isClosed(a)||a.include===false)return;
    const g=gsSymbolFor(h);if(!g||seen.has(g))return;
    if(h.kind==='fund'&&!h.gsym)return;/* fonds non cotés en Bourse : pas de GOOGLEFINANCE */
    const inSheet=all.some(r=>r.gsym===g||(h.isin&&r.isin===String(h.isin).toUpperCase()));if(inSheet)return;
    if(gsMatch(h,[]))return;if(h.liveSrc==='Google Finance'&&h.liveAt&&String(h.liveAt).slice(0,10)>=dAdd(today(),-4))return;seen.add(g);out.push({h,a,g})});return out}
async function gsEnsure(){const mcp=S.cap.mcp,id=GS2.id||'';if(!mcp||!id||!S.data||S.demo||GSA.busy||!GS2.at)return;if(Date.now()-GSA.at<5*60000)return;
  const tried=(ST().gsAdd=ST().gsAdd&&typeof ST().gsAdd==='object'?ST().gsAdd:{});
  const L=gsMissing().filter(x=>!tried[x.g]||tried[x.g]<dAdd(today(),-7)).slice(0,10);if(!L.length)return;
  GSA.busy=true;GSA.at=Date.now();
  try{const r=await mcp.callTool(SH_SERVER,'get_values',{spreadsheetId:id,range:'A1:C2000'});
    let p=r&&r.payload;if(typeof p==='string'){try{p=JSON.parse(p)}catch(e){p=null}}if(!p&&r&&Array.isArray(r.content)){const b=r.content.find(x=>x.type==='text');if(b){try{p=JSON.parse(b.text)}catch(e){}}}
    const vals=(p&&(p.values||(p.content&&p.content.values)))||[];const tab=String((p&&(p.range||(p.content&&p.content.range)))||'').split('!')[0].replace(/^'|'$/g,'');
    const have=new Set(vals.map(v=>String(v[2]||'').toUpperCase()));const n0=Math.max(vals.length,1);
    const add=L.filter(x=>!have.has(x.g));if(!add.length){L.forEach(x=>tried[x.g]=today());save();GSA.busy=false;return}
    const rows=add.map((x,i)=>{const n=n0+1+i;const f=k=>`=GOOGLEFINANCE(C${n};"${k}")`;return [String(x.h.ticker&&!/^\d/.test(x.h.ticker)?x.h.ticker:x.g.split(':').pop()).toUpperCase(),String(x.h.isin||'').toUpperCase(),x.g,f('currency'),f('price'),f('changepct'),f('tradetime')]});
    const q=tab?(/[^A-Za-z0-9_]/.test(tab)?`'${tab}'!`:tab+'!'):'';
    await mcp.callTool(SH_SERVER,'update_values',{spreadsheetId:id,range:`${q}A${n0+1}:G${n0+add.length}`,values:rows});
    add.forEach(x=>tried[x.g]=today());save();GSA.msg=t('na.added',{n:add.length,l:add.map(x=>x.h.name).join(', ')});
    toast(GSA.msg)}catch(e){GSA.err=e&&e.code||'fail'}
  GSA.busy=false}

/* positions qui attendent leur fiche (dividendes) ou leur logo */
function naPending(){const out=[];invAccs().filter(a=>!isClosed(a)).forEach(a=>(a.holdings||[]).forEach(h=>{if(!(+h.qty>0)||['crypto','fe','metal'].includes(h.kind)||!h.isin)return;
  const c=catOf(h);const lg=holdLogo(h);if(!c||!lg)out.push({h,a,cat:!c,logo:!lg})}));return out}
{const _dc=dcCardHTML;dcCardHTML=function(fa){const html=_dc(fa);try{const P=naPending().filter(x=>x.cat&&(!fa||fa==='all'||x.a.id===fa));if(!P.length||!ACAT.map.size)return html;
  const note=`<p class="note" style="margin:-4px 0 12px">${ico('info')} ${esc(t('na.pend',{n:P.length,l:P.map(x=>x.h.name).join(', ')}))}</p>`;
  return html.replace('<div class="kpis"',note+'<div class="kpis"')}catch(e){return html}}}
/* monogramme : un symbole de place commençant par un chiffre (2AR à Francfort) n'est pas parlant → initiales du nom */
{const _ha=holdAvatar;holdAvatar=function(h,cls){if(h&&h.ticker&&/^\d/.test(h.ticker))h=Object.assign({},h,{ticker:''});return _ha(h,cls)}}
