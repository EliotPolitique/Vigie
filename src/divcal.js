/* ================= V5.3 — détachements et versements de dividendes =================
   Pour chaque ligne détenue : dates de détachement (ex-dividende) et de versement, annoncées (catalogue)
   ou estimées d'après le rythme observé ; droit au dividende calculé d'après la quantité détenue
   la veille du détachement (quantité actuelle moins les achats/ventes faits depuis).
   Alertes : dans Vigie (« À surveiller », cloche, notification de l'appareil si autorisée) et, par le script
   Google « Vigie — tâches », sur Telegram, ntfy et Google Agenda, à partir du fichier Drive
   « vigie-agenda-dividendes.json » que Vigie tient à jour. */
const DC_FILE='vigie-agenda-dividendes.json',DC_AHEAD=120,DC_BACK=35;
const dcCfg=()=>{const s=ST();if(!s.dc||typeof s.dc!=='object')s.dc={};const c=s.dc;if(!c.sent||typeof c.sent!=='object')c.sent={};return c};
/* jour ouvré : un détachement tombant un samedi ou un dimanche passe au lundi */
function dcBiz(d){const w=new Date(d+'T12:00:00Z').getUTCDay();return w===6?dAdd(d,2):w===0?dAdd(d,1):d}
function dcAddMonths(d,k){const y=+d.slice(0,4),m=+d.slice(5,7)-1+k,dd=+d.slice(8,10);const Y=y+Math.floor(m/12),M=((m%12)+12)%12;const last=new Date(Date.UTC(Y,M+1,0)).getUTCDate();return Y+'-'+String(M+1).padStart(2,'0')+'-'+String(Math.min(dd,last)).padStart(2,'0')}
/* quantité détenue la veille de d : quantité actuelle moins les mouvements faits à partir de d */
function dcQtyBefore(a,h,d){const now=+h.qty||0;if(d>today())return now;
  const nn=norm(h.name||'');const ops=iopsOf(a.id).filter(o=>o.d>=d&&((h.isin&&o.isin===h.isin)||(!h.isin&&norm(o.n||'')===nn)));
  let q=now;ops.forEach(o=>{const x=Math.abs(+o.q||0);if(o.t==='buy'||o.t==='in')q-=x;else if(o.t==='sell'||o.t==='out')q+=x});return Math.max(0,+q.toFixed(8))}
/* versements d'une ligne : annoncés puis estimés, dans la fenêtre [aujourd'hui − 35 j ; aujourd'hui + 120 j] */
function dcRows(c){const from=dAdd(today(),-DC_BACK),to=dAdd(today(),DC_AHEAD);
  const H=(c&&c.history||[]).filter(p=>+p.amt>0&&(p.ex||p.pay)).map(p=>({ex:p.ex||null,pay:p.pay||p.ex,amt:+p.amt,sp:!!p.special,est:false})).sort((x,y)=>(x.ex||x.pay).localeCompare(y.ex||y.pay));
  const out=H.filter(p=>(p.ex&&p.ex>=from&&p.ex<=to)||(p.pay>=from&&p.pay<=to));
  const k=catCadence(c);const reg=H.filter(p=>!p.sp);
  if(k&&reg.length){const L=reg[reg.length-1];const gap=L.ex&&L.pay?Math.max(0,daysBetween(L.ex,L.pay)):0;
    const avg=sum(reg.slice(-3).map(p=>p.amt))/Math.min(3,reg.length);
    const seen=new Set(H.map(p=>(p.ex||p.pay).slice(0,7)));let base=L.ex||L.pay;
    for(let i=1;i<=Math.ceil(13/k);i++){const ex=dcBiz(dcAddMonths(base,k*i));if(ex>to)break;if(seen.has(ex.slice(0,7)))continue;
      const pay=dcBiz(dAdd(ex,gap));if(ex<today()&&pay<today())continue;out.push({ex,pay,amt:+avg.toFixed(6),sp:false,est:true})}}
  return out}
/* événements de toutes les lignes détenues */
function dcEvents(){if(!S.data||!ACAT.map.size)return [];const E=[];const td=today();
  invAccs().filter(a=>!isClosed(a)).forEach(a=>(a.holdings||[]).forEach(h=>{if(h.kind==='fe'||h.kind==='crypto'||h.kind==='metal')return;
    const c=catOf(h);if(!c||c.acc||catPending(c))return;const cur=c.currency||h.cur||a.cur||'EUR';
    dcRows(c).forEach(p=>{const exD=p.ex||p.pay;const q=dcQtyBefore(a,h,exD);if(!(q>0)&&!(+h.qty>0))return;
      const tot=p.amt*q,eur=conv(tot,cur);const base={isin:h.isin||'',name:h.name,tk:h.ticker||'',acc:a.id,accN:a.name,per:p.amt,cur,q,tot,eur,est:p.est,sp:p.sp,ex:p.ex,pay:p.pay,elig:q>0,h};
      if(p.ex)E.push(Object.assign({k:'ex',d:p.ex},base));if(p.pay)E.push(Object.assign({k:'pay',d:p.pay},base))})}));
  E.forEach(e=>e.id=[e.k,e.isin||norm(e.name),e.acc,e.d].join('|'));
  return E.sort((x,y)=>x.d.localeCompare(y.d)||(x.k==='ex'?-1:1)||x.name.localeCompare(y.name))}
const dcMoney=(v,cur)=>moneyT(v,2,cur);
function dcAmtTxt(e){const s=`${moneyT(e.per,e.per<1?4:2,e.cur)} × ${numT(e.q,e.q%1?4:0)} = ${dcMoney(e.tot,e.cur)}`;return e.cur!==(ST().cur||'EUR')?s+' (≈ '+moneyT(e.eur,2)+')':s}

/* ---------- carte « Détachements et versements » (Investissements → Dividendes) ---------- */
function dcCardHTML(fa){const E=dcEvents().filter(e=>!fa||fa==='all'||e.acc===fa);const td=today();
  const up=E.filter(e=>e.d>=td&&e.d<=dAdd(td,60)),past=E.filter(e=>e.d<td&&e.d>=dAdd(td,-14)).reverse();
  const nx=k=>E.find(e=>e.k===k&&e.d>=td&&e.elig);const nEx=nx('ex'),nPay=nx('pay');
  const row=e=>{const ex=e.k==='ex';const tag=`<span class="chip" style="--c:var(${ex?'--k4':'--good'});background:color-mix(in srgb,var(${ex?'--k4':'--good'}) 14%,transparent);color:var(${ex?'--k4':'--good'});font-weight:600">${ico(ex?'cal':'coins')}${esc(t(ex?'dc.ex':'dc.pay'))}</span>`;
    const st=[];if(e.est)st.push(t('dc.est'));if(!e.elig)st.push(t(ex?'dc.noRight':'dc.notDue'));if(e.sp)st.push(t('dc.special'));
    const other=ex?(e.pay?t('dc.payOn',{d:dateT(e.pay)}):''):(e.ex?t('dc.exOn',{d:dateT(e.ex)}):'');
    return `<div class="row${e.elig?'':' dim'}">${holdAvatar(e.h)}<div class="m"><b>${esc(e.name)}</b><span>${tag} ${esc(dateT(e.d))}${e.d===td?' · <b>'+esc(t('dc.today'))+'</b>':''} · ${esc(e.accN)}${other?' · '+esc(other):''}${st.length?' · <i>'+esc(st.join(' · '))+'</i>':''}</span></div><div class="r"><b class="${e.elig?'good':''}">${esc(e.elig?dcAmtTxt(e):'—')}</b></div></div>`};
  const perm=typeof Notification!=='undefined'?Notification.permission:'na';
  return `<div class="card" style="margin-bottom:16px"><div class="ch"><div><h2>${esc(t('dc.title'))}</h2><p>${esc(t('dc.sub'))}</p></div>${perm==='default'?`<button class="btn sec sm" data-a="dcPerm">${ico('bell')}${esc(t('dc.perm'))}</button>`:''}</div>
    ${ACAT.map.size?`<div class="kpis" style="margin-bottom:12px">${kpi(t('dc.nextEx'),nEx?esc(dateT(nEx.d)):'—',nEx?esc(nEx.name)+(nEx.est?' · '+esc(t('dc.est')):''):'')}${kpi(t('dc.nextPay'),nPay?esc(dateT(nPay.d)):'—',nPay?esc(nPay.name)+' · '+esc(moneyT(nPay.eur,2)):'')}</div>
    ${up.length?`<div class="list">${up.map(row).join('')}</div>`:`<p class="note">${esc(t('dc.none'))}</p>`}
    ${past.length?`<details style="margin-top:10px"><summary class="note">${esc(t('dc.past',{n:past.length}))}</summary><div class="list">${past.map(row).join('')}</div></details>`:''}
    <p class="note" style="margin-top:10px">${esc(t('dc.rule'))}</p>`:`<p class="note">${esc(t('dc.noCat'))}</p>`}</div>`}
EXT.A.dcPerm=async()=>{try{const r=await Notification.requestPermission();toast(t(r==='granted'?'dc.permOk':'dc.permNo'))}catch(e){toast(t('dc.permNo'))}render()};

/* ---------- alertes dans Vigie, le jour même ---------- */
{const _wi=watchItems;watchItems=function(){const L=_wi();try{const td=today();dcEvents().filter(e=>e.d===td&&e.elig).forEach(e=>L.push({lvl:'info',ic:e.k==='ex'?'cal':'coins',l:t(e.k==='ex'?'dc.wEx':'dc.wPay',{n:e.name}),s:dcAmtTxt(e)+(e.k==='ex'&&e.pay?' · '+t('dc.payOn',{d:dateT(e.pay)}):''),act:'go',v:'invest',prio:2}))}catch(e){}return L}}
function dcNotify(){if(!S.data||S.demo||!ACAT.map.size)return;const C=dcCfg();const td=today();let ch=false;
  Object.keys(C.sent).forEach(k=>{if(C.sent[k]<dAdd(td,-60)){delete C.sent[k];ch=true}});
  dcEvents().filter(e=>e.d===td&&e.elig&&!C.sent[e.id]).forEach(e=>{C.sent[e.id]=td;ch=true;
    const title=t(e.k==='ex'?'dc.nEx':'dc.nPay',{n:e.name}),body=dcAmtTxt(e)+(e.k==='ex'&&e.pay?' · '+t('dc.payOn',{d:dateT(e.pay)}):'');
    pushNotif('alert',title,body,'go','invest');
    try{if(typeof Notification!=='undefined'&&Notification.permission==='granted'){const o={body,icon:'icon-192.png',badge:'icon-192.png',tag:'vigie-'+e.id,renotify:false};
      if(navigator.serviceWorker&&navigator.serviceWorker.ready)navigator.serviceWorker.ready.then(r=>r.showNotification('Vigie · '+title,o)).catch(()=>{try{new Notification('Vigie · '+title,o)}catch(x){}});else new Notification('Vigie · '+title,o)}}catch(x){}});
  if(ch)save()}

/* ---------- agenda transmis au script Google (Drive) ---------- */
async function dcExport(force){const mcp=S.cap.mcp;if(!mcp||!S.data||S.demo||!ACAT.map.size)return;const C=dcCfg();
  const ev=dcEvents().filter(e=>e.d>=dAdd(today(),-3)).map(e=>({id:e.id,k:e.k,d:e.d,name:e.name,isin:e.isin,tk:e.tk,acc:e.accN,per:+e.per.toFixed(6),cur:e.cur,q:e.q,tot:+e.tot.toFixed(4),eur:+e.eur.toFixed(2),est:e.est,elig:e.elig,ex:e.ex,pay:e.pay}));
  const body=JSON.stringify({v:1,events:ev});const h=hash(body);
  if(!force&&C.h===h&&C.at&&Date.now()-Date.parse(C.at)<3*864e5)return;
  try{const r=await mcp.callTool(GS_SERVER,'create_file',{title:DC_FILE,contentMimeType:'application/json',textContent:JSON.stringify({v:1,at:new Date().toISOString(),events:ev}),disableConversionToGoogleType:true});
    const id=w6Id(r);if(!id)return;const old=C.fid;C.fid=id;C.h=h;C.at=new Date().toISOString();save();
    if(old&&old!==id){try{await mcp.callTool(GS_SERVER,'trash_file',{fileId:old})}catch(e){}}}catch(e){}}
EXT.boot.push(d=>{setTimeout(()=>{if(S.data!==d)return;try{dcNotify()}catch(e){}dcExport(false)},9000)});
setInterval(()=>{try{if(S.data&&!S.demo&&document.visibilityState==='visible')dcNotify()}catch(e){}},30*60*1000);
