/* ================= V5.6 — Point marché (matin et soir) =================
   Deux fois par jour (vers 9 h 20 après l'ouverture de Paris, vers 22 h 15 après la clôture de New York),
   la tâche planifiée « Vigie · point marché » lit tes positions et les cours, recherche l'actualité sourcée,
   explique ce qui a fait bouger chaque ligne (marché, nouvelle propre au titre, devise) et dépose une note ici :
   index  data/users/me/brief          {last, items:[{id,slot,at,title,p,eur}]}
   note   data/users/me/b-AAAAMMJJ-am  (ou -pm) : voir BR_FIELDS ci-dessous.
   L'application ne fait qu'afficher : aucun calcul de cause ici, aucune recommandation. */
const BR={idx:null,docs:{},loading:{},timer:null,unsub:null,at:0};
const BR_CAUSE={marche:'acc',specifique:'warn',devise:'',mixte:'',aucune:'',inconnue:''};
const brOk=u=>/^https:\/\/[^\s"'<>]+$/.test(String(u||''));
const brSeen=()=>{const s=ST();return s.brSeen||''};
function brItems(){const L=BR.idx&&Array.isArray(BR.idx.items)?BR.idx.items:[];return L.filter(x=>x&&/^b-\d{8}-(am|pm)$/.test(x.id||'')).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')))}
function brLatest(){return brItems()[0]||null}
async function brLoadDoc(id){if(!id||BR.docs[id]||BR.loading[id]||!STORE.db||!STORE.uid)return BR.docs[id]||null;BR.loading[id]=1;
  try{const s=await STORE.db.doc(P(id)).get();if(s.exists)BR.docs[id]=s.data()||null}catch(e){}BR.loading[id]=0;
  if(S.phase==='app'&&!S.ui.ovl&&(S.ui.view==='brief'||S.ui.view==='home'||S.ui.view==='sec'))render();return BR.docs[id]||null}
function brOnIdx(v){const prev=BR.idx&&BR.idx.last;BR.idx=v||null;BR.at=Date.now();const L=brLatest();if(!L)return;
  if(L.id!==prev)delete BR.docs[L.id];brLoadDoc(L.id);
  const s=ST();if(s.brNotified!==L.id&&prev!==undefined&&!S.demo){s.brNotified=L.id;try{pushNotif('info',L.title||t('br.h'),t(L.slot==='am'?'br.am':'br.pm')+' · '+brWhen(L.at),'go','brief')}catch(e){}}
  if(S.phase==='app'&&!S.ui.ovl)render()}
async function brStart(){if(BR.timer||S.demo||!STORE.db||!STORE.uid)return;
  const pull=async()=>{try{const s=await STORE.db.doc(P('brief')).get();const v=s.exists?s.data():null;if(!BR.idx||!v||v.last!==BR.idx.last)brOnIdx(v)}catch(e){}};
  let live=false;try{const ref=STORE.db.doc(P('brief'));if(typeof ref.onSnapshot==='function'){BR.unsub=ref.onSnapshot(s=>{const v=s&&s.exists?s.data():null;if(!BR.idx||!v||v.last!==BR.idx.last)brOnIdx(v)},()=>{});live=true}}catch(e){}
  await pull();BR.timer=setInterval(pull,live?15*60000:4*60000)}
EXT.boot.push(d=>{const s=d.settings||{};
  /* la carte « Point marché » prend la tête de l'accueil (une seule fois) */
  if(Array.isArray(s.widgets)&&!s.brief1&&!s.widgets.some(x=>x&&x.k==='brief'))s.widgets.unshift({k:'brief',on:true});s.brief1=1;
  setTimeout(()=>{if(S.data===d)brStart()},2500)});
function brWhen(iso){if(!iso)return '—';const d=new Date(iso);if(isNaN(d))return '—';
  try{return d.toLocaleString(locTag(),{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'})}catch(e){return iso.slice(0,16).replace('T',' ')}}
const locTag=()=>({fr:'fr-FR',en:'en-GB',es:'es-ES',de:'de-DE'})[lang()]||'fr-FR';
const brP=v=>v==null||!isFinite(+v)?'—':pctS(+v,2);
const brCls=v=>!isFinite(+v)||Math.abs(+v)<0.00005?'':+v>0?'good':'bad';
function brSrc(B,refs){const S0=Array.isArray(B&&B.sources)?B.sources:[];const R=(Array.isArray(refs)?refs:[]).map(n=>S0.find(s=>+s.n===+n)).filter(Boolean);
  return R.length?` <span class="brs">${R.map(s=>brOk(s.u)?`<a href="${esc(s.u)}" target="_blank" rel="noopener" title="${esc((s.src||'')+' · '+(s.t||''))}">${esc(String(s.n))}</a>`:`<span>${esc(String(s.n))}</span>`).join('')}</span>`:''}
const brCauseL=c=>t('br.c.'+(BR_CAUSE[c]!==undefined?c:'inconnue'));
function brLineHTML(B,l,open){const h={name:l.n,isin:l.isin,ticker:l.tk,kind:l.kind||'stock'};
  return `<details class="brl"${open?' open':''}><summary class="row" style="align-items:center">${holdAvatar(h)}<div class="m"><b>${esc(l.n||'—')}</b><span>${esc([l.acc,isFinite(+l.val)?moneyT(+l.val,0):''].filter(Boolean).join(' · '))}</span></div>
    <span class="pill brpd ${BR_CAUSE[l.cause]||''}">${esc(brCauseL(l.cause))}</span><div class="r"><b class="${brCls(l.p)}">${esc(brP(l.p))}</b><span class="${brCls(l.eur)}">${isFinite(+l.eur)?moneyS(+l.eur,2):'—'}</span></div></summary>
    <div class="brb"><span class="pill brpm ${BR_CAUSE[l.cause]||''}" style="margin-bottom:6px">${esc(brCauseL(l.cause))}</span>
    ${l.why?`<p>${esc(l.why)}${brSrc(B,l.s)}</p>`:''}${l.fx?`<p class="muted">${ico('swap')} ${esc(l.fx)}</p>`:''}
    ${isFinite(+l.ps)&&l.ps!==null?`<p class="note">${esc(t('br.since',{p:brP(l.ps)}))}</p>`:''}${l.next?`<p><b>${esc(t('br.watch'))} </b>${esc(l.next)}</p>`:''}</div></details>`}
function brPage(){const L=brItems();const head=(B,sel)=>`<div class="pghead" style="margin-bottom:14px"><span class="av" style="--c:var(--accent)">${ico('globe')}</span><div class="m"><div class="eyebrow">${esc(B?t(B.slot==='am'?'br.am':'br.pm')+' · '+brWhen(B.at):t('br.eye'))}</div><h2>${esc(B&&B.title||t('br.h'))}</h2></div>${sel||''}</div>`;
  if(!L.length)return head(null)+emptyBlock(t('br.none'),t('br.noneS'));
  const id=(S.ui.brId&&L.some(x=>x.id===S.ui.brId))?S.ui.brId:L[0].id;const B=BR.docs[id];if(!B){brLoadDoc(id);return head(null)+`<div class="card"><p class="muted">${esc(t('br.loading'))}</p></div>`}
  if(id===L[0].id&&ST().brSeen!==id){ST().brSeen=id;setTimeout(save,50)}
  const sel=`<div class="act"><select class="inp sm" data-f="brPick" aria-label="${esc(t('br.hist'))}">${L.slice(0,40).map(x=>`<option value="${esc(x.id)}"${x.id===id?' selected':''}>${esc(t(x.slot==='am'?'br.am':'br.pm')+' · '+brWhen(x.at))}${isFinite(+x.p)?' · '+esc(brP(x.p)):''}</option>`).join('')}</select></div>`;
  const pt=B.port||{};const lines=(Array.isArray(B.lines)?B.lines:[]).slice().sort((a,b)=>Math.abs(+b.eur||0)-Math.abs(+a.eur||0));
  const kpi=(l,v,s,c)=>`<div class="kpi"><div class="l">${esc(l)}</div><div class="v ${c||''}">${v}</div>${s?`<div class="s">${esc(s)}</div>`:''}</div>`;
  const kpis=`<div class="kpis brkp" style="margin-top:12px">${kpi(t('br.k.val'),isFinite(+pt.val)?esc(moneyT(+pt.val,0)):'—',t('br.k.valS'))}${kpi(t(B.slot==='am'?'br.k.dayAm':'br.k.day'),isFinite(+pt.eur)?moneyS(+pt.eur,2):'—',brP(pt.p),brCls(pt.eur))}${pt.since&&isFinite(+pt.since.eur)?kpi(t('br.k.since'),moneyS(+pt.since.eur,2),brP(pt.since.p),brCls(pt.since.eur)):''}</div>`;
  const ess=`<div class="card"><div class="ch"><div><h2>${esc(t('br.ess'))}</h2></div></div>${B.lead?`<p class="brlead">${esc(B.lead)}${brSrc(B,B.leadS)}</p>`:''}${kpis}</div>`;
  const linesC=lines.length?`<div class="card"><div class="ch"><div><h2>${esc(t('br.lines'))}</h2><p>${esc(t('br.linesS'))}</p></div></div><div class="list brlist">${lines.map((l,i)=>brLineHTML(B,l,i<3)).join('')}</div></div>`:'';
  const M=Array.isArray(B.markets)?B.markets:[];
  const mk=M.length?`<div class="card"><div class="ch"><div><h2>${esc(t('br.mk'))}</h2><p>${esc(t('br.mkS'))}</p></div></div><div class="list">${M.map(m=>`<div class="row" style="align-items:flex-start"><div class="m"><b style="white-space:normal">${esc(m.l||m.k||'')}</b>${m.why?`<span style="white-space:normal">${esc(m.why)}${brSrc(B,m.s)}</span>`:''}</div><div class="r"><b>${esc(m.v||'')}</b><span class="${brCls(m.p)}">${esc(brP(m.p))}</span></div></div>`).join('')}</div></div>`:'';
  const T=Array.isArray(B.themes)?B.themes:[];
  const th=T.length?`<div class="card"><div class="ch"><div><h2>${esc(t('br.th'))}</h2></div></div>${T.map(x=>`<div class="brt"><h3>${esc(x.t||'')}</h3>${x.body?`<p>${esc(x.body)}${brSrc(B,x.s)}</p>`:''}${x.imp?`<p class="brimp">${ico('invest')} ${esc(x.imp)}</p>`:''}</div>`).join('')}</div>`:'';
  const A=Array.isArray(B.agenda)?B.agenda:[];
  const ag=A.length?`<div class="card"><div class="ch"><div><h2>${esc(t('br.ag'))}</h2></div></div><div class="list">${A.map(x=>`<div class="row" style="align-items:flex-start"><span class="av sm" style="--c:var(--k3)">${ico('cal')}</span><div class="m"><b style="white-space:normal">${esc(x.t||'')}</b><span style="white-space:normal">${esc([x.d?dateT(x.d,'long'):'',x.h||''].filter(Boolean).join(' · '))}${x.why?' — '+esc(x.why):''}${brSrc(B,x.s)}</span></div></div>`).join('')}</div></div>`:'';
  const lr=B.learn&&B.learn.body?`<div class="card brlearn"><div class="ch"><div><h2>${ico('book')} ${esc(t('br.learn'))}${B.learn.t?' · '+esc(B.learn.t):''}</h2></div></div><p>${esc(B.learn.body)}${brSrc(B,B.learn.s)}</p></div>`:'';
  const SR=Array.isArray(B.sources)?B.sources:[];
  const src=SR.length?`<div class="card"><div class="ch"><div><h2>${esc(t('br.src'))}</h2><p>${esc(t('br.srcS',{n:SR.length}))}</p></div></div><ol class="brsrc">${SR.map(s=>`<li value="${esc(String(s.n))}">${brOk(s.u)?`<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.t||s.u)}</a>`:esc(s.t||'')}<span class="muted"> · ${esc([s.src,s.d].filter(Boolean).join(' · '))}</span></li>`).join('')}</ol></div>`:'';
  const note=`<p class="note" style="margin:4px 2px 0">${esc(t('br.disc'))}${B.note?' '+esc(B.note):''}</p>`;
  return head(B,sel)+`<div class="grid g-21 brgrid"><div>${ess}${linesC}${th}</div><div>${mk}${ag}${lr}${src}</div></div>`+note}
/* la version autonome (sans base Claude) n'a pas de point marché : entrée masquée */
VIEWS.splice(VIEWS.findIndex(v=>v.k==='wealth'),0,{k:'brief',g:'pilot',ic:'globe',hide:!(window.claude)});
EXT.V.brief=brPage;
if(typeof W_DEFAULT!=='undefined'&&Array.isArray(W_DEFAULT)&&!W_DEFAULT.includes('brief'))W_DEFAULT.unshift('brief');
EXT.field.brPick=(el,v)=>{S.ui.brId=v;brLoadDoc(v);render()};
/* carte d'accueil */
WIDGETS.brief={s:'l',r:()=>{const L=brLatest();if(!L&&(S.demo||STORE.mode!=='cloud'))return '';
  if(!L)return wCard(t('br.h'),t('br.noneS'),`<div class="wempty">${ico('globe')}<p>${esc(t('br.none'))}</p></div>`);
  const B=BR.docs[L.id];if(!B)brLoadDoc(L.id);const nw=ST().brSeen!==L.id;
  const top=B&&Array.isArray(B.lines)?B.lines.slice().sort((a,b)=>Math.abs(+b.eur||0)-Math.abs(+a.eur||0)).slice(0,3):[];
  const pt=(B&&B.port)||{};
  return `<div class="card brw"><div class="ch"><div><h2>${ico('globe')} ${esc(t('br.h'))}${nw?` <span class="pill acc">${esc(t('br.new'))}</span>`:''}</h2><p>${esc(t(L.slot==='am'?'br.am':'br.pm')+' · '+brWhen(L.at))}</p></div><button class="btn sm" data-a="go" data-v="brief">${esc(t('br.read'))}${ico('chev')}</button></div>
    <h3 class="brwt">${esc(L.title||'')}</h3>${B&&B.lead?`<p class="brwl">${esc(B.lead)}</p>`:''}
    ${isFinite(+pt.eur)?`<div class="hrow" style="gap:14px;flex-wrap:wrap;margin:8px 0 4px"><span class="muted">${esc(t(L.slot==='am'?'br.k.dayAm':'br.k.day'))}</span><b class="${brCls(pt.eur)}">${moneyS(+pt.eur,2)} · ${esc(brP(pt.p))}</b></div>`:''}
    ${top.length?`<div class="list">${top.map(l=>`<button class="row btnrow" data-a="go" data-v="brief">${holdAvatar({name:l.n,isin:l.isin,ticker:l.tk,kind:l.kind||'stock'})}<div class="m"><b>${esc(l.n||'')}</b><span>${esc(brCauseL(l.cause))}${l.why?' — '+esc(String(l.why).slice(0,140))+(String(l.why).length>140?'…':''):''}</span></div><div class="r"><b class="${brCls(l.p)}">${esc(brP(l.p))}</b></div></button>`).join('')}</div>`:''}</div>`}};
/* fiche d'une position : « pourquoi ça bouge » d'après le dernier point qui la cite */
{const _sp=EXT.V.sec;EXT.V.sec=function(){const html=_sp();try{const p=positions().find(x=>x.key===S.ui.posKey);if(!p)return html;
  const L=brItems().slice(0,6);let B=null,l=null;for(const x of L){const D0=BR.docs[x.id];if(!D0){if(x===L[0])brLoadDoc(x.id);continue}
    l=(D0.lines||[]).find(y=>(p.isin&&y.isin&&String(y.isin).toUpperCase()===String(p.isin).toUpperCase())||(p.ticker&&y.tk&&String(y.tk).toUpperCase()===String(p.ticker).toUpperCase()));if(l){B=D0;break}}
  if(!l)return html;
  const card=`<div class="card"><div class="ch"><div><h2>${ico('globe')} ${esc(t('br.why'))}</h2><p>${esc(t(B.slot==='am'?'br.am':'br.pm')+' · '+brWhen(B.at))}</p></div><button class="btn ghost sm" data-a="go" data-v="brief">${esc(t('br.read'))}</button></div><div class="list">${brLineHTML(B,l,true)}</div></div>`;
  return html.replace('<div class="pgside">','<div class="pgside">'+card)}catch(e){return html}}}
