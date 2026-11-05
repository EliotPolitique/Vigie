/* ================= V3 — couche « Premium » : alertes, récaps, Live, courbe 24 h (offerte) ================= */
PERIODS['24H']=1;

/* ---------- courbe du patrimoine sur 24 heures ---------- */
let INTRA_SAVE=0;
function noteIntraday(){
  if(!S.data||S.demo)return;const d=D();if(!Array.isArray(d.intraday))d.intraday=[];const now=Date.now(),v=Math.round(totals().net*100)/100;
  const L=d.intraday;const last=L[L.length-1];
  if(last&&now-last.t<5*60e3){if(Math.abs(last.v-v)>0.004){last.v=v}return}
  L.push({t:now,v});const cut=now-48*3600e3;while(L.length&&L[0].t<cut)L.shift();if(L.length>400)L.splice(0,L.length-400);
  if(now-INTRA_SAVE>15*60e3){INTRA_SAVE=now;save()}
}
function intraday24(){
  const L=(D().intraday||[]).filter(x=>x.t>=Date.now()-24*3600e3);const fmt=new Intl.DateTimeFormat(loc(),{hour:'2-digit',minute:'2-digit'});
  const pts=L.map(x=>{const dt=new Date(x.t);return {d:isoOf(dt),tm:fmt.format(dt),v:x.v}});
  const v=totals().net;const dt=new Date();if(!pts.length||Math.abs(pts[pts.length-1].v-v)>0.004)pts.push({d:isoOf(dt),tm:fmt.format(dt),v});
  if(pts.length===1){const prev=[...D().history].reverse().find(x=>x.d<today());if(prev)pts.unshift({d:prev.d,tm:t('lv.yday'),v:prev.nw})}
  return pts;
}

/* ---------- notifications ---------- */
const notifs=()=>{const s=ST();if(!Array.isArray(s.notifs))s.notifs=[];return s.notifs};
function pushNotif(k,title,body,act,v){if(S.demo)return;const L=notifs();L.unshift({id:uid(),at:new Date().toISOString(),k,title,body,act:act||'',v:v||'',read:false});if(L.length>60)L.length=60;save()}
function bellBtn(){if(!S.data)return '';const n=notifs().filter(x=>!x.read).length;return `<button class="ib bell" data-a="notifs" aria-label="${esc(t('nt.title'))}${n?' ('+n+')':''}" title="${esc(t('nt.title'))}">${ico('bell')}${n?`<span class="bdot">${n>9?'9+':n}</span>`:''}</button>`}
EXT.A.notifs=()=>openOvl({k:'notifs'});
EXT.ovl.notifs=()=>{const L=notifs();const html=`<div class="ph"><div><div class="eyebrow">${esc(t('nt.count',{n:L.filter(x=>!x.read).length}))}</div><h2>${esc(t('nt.title'))}</h2></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  <div class="hrow" style="gap:8px;flex-wrap:wrap;margin-bottom:14px"><button class="btn sec sm" data-a="recap" data-v="day">${ico('cal')}${esc(t('rp.day'))}</button><button class="btn sec sm" data-a="recap" data-v="week">${ico('cal')}${esc(t('rp.week'))}</button><button class="btn sec sm" data-a="recap" data-v="month">${ico('cal')}${esc(t('rp.month'))}</button><span class="sp"></span>${L.length?`<button class="btn ghost sm" data-a="ntClear">${esc(t('nt.clear'))}</button>`:''}</div>
  <div class="list">${L.map(x=>`<button class="row btnrow${x.read?' dim':''}" data-a="ntOpen" data-v="${x.id}"><span class="av sm" style="--c:var(${x.k==='alert'?'--warn':x.k==='recap'?'--accent':x.k==='badge'?'--good':'--k2'})">${ico(x.k==='alert'?'bell':x.k==='recap'?'cal':x.k==='badge'?'medal':'info')}</span><div class="m"><b>${esc(x.title)}</b><span>${esc(x.body)}</span></div><div class="r"><span>${esc(agoT(x.at))}</span></div></button>`).join('')||`<div class="wempty">${ico('bell')}<p>${esc(t('nt.none'))}</p></div>`}</div>`;
  setTimeout(()=>{let ch=false;notifs().forEach(x=>{if(!x.read){x.read=true;ch=true}});if(ch){save();const b=$('.bell .bdot');if(b)b.remove()}},1200);
  return {html}};
EXT.A.ntClear=()=>{ST().notifs=[];save();renderOvl();render()};
EXT.A.ntOpen=v=>{const x=notifs().find(n=>n.id===v);if(!x)return;x.read=true;save();if(x.act&&A[x.act])A[x.act](x.v);else renderOvl()};
function agoT(iso){const s=(Date.now()-new Date(iso).getTime())/1000;if(s<90)return t('lv.now');if(s<3600)return t('lv.min',{n:Math.round(s/60)});if(s<86400)return t('lv.h',{n:Math.round(s/3600)});return dateT(iso.slice(0,10),'short')}
/* les nouveaux badges arrivent aussi dans les notifications */
const _badges=badges;badges=function(){const before=Object.assign({},ST().badges||{});const r=_badges();if(S.badgeInit)Object.keys(ST().badges||{}).forEach(k=>{if(!before[k]&&Object.keys(before).length)pushNotif('badge',t('bd.new',{n:t('bd.'+k+'.t')}),t('bd.'+k+'.p'),'badges','')});return r};

/* ---------- alertes de cours ---------- */
const alerts=()=>{const s=ST();if(!Array.isArray(s.alerts))s.alerts=[];return s.alerts};
function alertBtn(key){const has=alerts().some(a=>a.key===key&&a.on!==false);return `<button class="ib${has?' on':''}" data-a="alertNew" data-v="${esc(key)}" aria-label="${esc(t('al.new'))}" title="${esc(t('al.new'))}">${ico('bell')}</button>`}
EXT.A.alertNew=v=>openOvl({k:'alert',key:v,id:''});
EXT.A.alertEdit=v=>{const a=alerts().find(x=>x.id===v);if(a)openOvl({k:'alert',key:a.key,id:v})};
EXT.ovl.alert=o=>{const p=positions().find(x=>x.key===o.key);const a=alerts().find(x=>x.id===o.id)||{op:'above',val:p?+(p.price*1.05).toFixed(p.price<10?3:2):'',on:true};
  const name=p?p.name:(a.name||o.key);const cur=p?p.cur:ST().cur;
  return {html:`<div class="ph"><div><div class="eyebrow">${esc(name)}</div><h2>${esc(t(o.id?'al.editT':'al.newT'))}</h2></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  ${p?`<div class="card flat" style="margin-bottom:14px"><div class="row"><div class="m muted">${esc(t('al.cur'))}</div><div class="r"><b>${esc(moneyT(p.price,p.price<10?4:2,cur))}</b></div></div></div>`:''}
  <form data-form="alert" data-v="${esc(o.key)}|${o.id||''}" class="form">
    <div class="f full"><label for="al-op">${esc(t('al.op'))}</label><select id="al-op" name="op">${['above','below','chgUp','chgDown'].map(k=>`<option value="${k}"${a.op===k?' selected':''}>${esc(t('al.op.'+k))}</option>`).join('')}</select></div>
    <div class="f full"><label for="al-val">${esc(t('al.val'))}</label><input id="al-val" name="val" type="number" step="any" required value="${a.val??''}"></div>
    <div class="f full"><label class="inline"><input type="checkbox" name="on" ${a.on!==false?'checked':''}> ${esc(t('al.on'))}</label></div>
    <p class="note full">${esc(t('al.note'))}</p>
    <div class="pfoot full">${o.id?`<button type="button" class="btn ghost" data-a="alertDel" data-v="${o.id}">${ico('trash')}${esc(t('act.delete'))}</button>`:''}<span class="sp"></span><button type="button" class="btn ghost" data-a="close">${esc(t('act.cancel'))}</button><button class="btn">${esc(t('act.save'))}</button></div>
  </form>`}};
EXT.F.alert=(fd,v)=>{const [key,id]=v.split('|');const p=positions().find(x=>x.key===key);const o={key,name:p?p.name:key,op:fd.get('op'),val:+String(fd.get('val')).replace(',','.'),on:!!fd.get('on')};
  if(!isFinite(o.val)){toast(t('al.invalid'),true);return}
  if(id){const a=alerts().find(x=>x.id===id);Object.assign(a,o);delete a.last}else alerts().push(Object.assign({id:uid(),at:today()},o));
  save();closeOvl();render();toast(t('al.saved'));checkAlerts(true)};
EXT.A.alertDel=v=>{ST().alerts=alerts().filter(x=>x.id!==v);save();closeOvl();render()};
let ALERT_SIG='';
function checkAlerts(force){
  if(!S.data||S.demo)return;const L=alerts().filter(a=>a.on!==false);if(!L.length)return;
  const pos=positions();const sig=pos.map(p=>p.key+p.price).join('|');if(!force&&sig===ALERT_SIG)return;ALERT_SIG=sig;
  let hit=0;L.forEach(a=>{if(a.last===today())return;const p=pos.find(x=>x.key===a.key);if(!p||!(p.price>0))return;const dd=posDay(p);
    const ok=a.op==='above'?p.price>=a.val:a.op==='below'?p.price<=a.val:a.op==='chgUp'?(dd.known&&dd.pct*100>=a.val):(dd.known&&dd.pct*100<=-Math.abs(a.val));
    if(ok){a.last=today();hit++;const msg=a.op==='above'||a.op==='below'?t('al.msgPx',{n:p.name,p:moneyT(p.price,p.price<10?4:2,p.cur),v:moneyT(a.val,a.val<10?4:2,p.cur)}):t('al.msgChg',{n:p.name,c:pctS(dd.pct,2)});pushNotif('alert',t('al.hit.'+a.op),msg,'pos',p.key);toast(msg)}});
  if(hit)save();
}

/* ---------- récaps quotidiens, hebdomadaires, mensuels ---------- */
function recapRange(per){const td=today();if(per==='day'){const d=dAdd(td,-1);return [d,d]}if(per==='week'){const dt=new Date(td+'T12:00:00');const wd=(dt.getDay()+6)%7;const end=dAdd(td,-wd-1);return [dAdd(end,-6),end]}const d=new Date(td+'T12:00:00');d.setDate(1);const end=dAdd(isoOf(d),-1);return [end.slice(0,8)+'01',end]}
function recapModel(per){
  const [a,b]=recapRange(per);const H=D().history;const s0=[...H].reverse().find(x=>x.d<a)||H.find(x=>x.d>=a);const s1=[...H].reverse().find(x=>x.d<=b);
  const tx=D().txs.filter(x=>x.d>=a&&x.d<=b&&x.c!=='transfer');const g=aggTx(tx);const ex={};tx.forEach(x=>{if(x.a<0&&x.c!=='saving'&&x.c!=='uncat')ex[x.c]=(ex[x.c]||0)-x.a});const cats=Object.entries(ex).sort((x,y)=>y[1]-x[1]).slice(0,4);
  let div=0;D().txs.forEach(x=>{if(x.d>=a&&x.d<=b&&x.c==='investIncome'&&x.a>0)div+=x.a});(D().iops||[]).forEach(o=>{if(o.d>=a&&o.d<=b&&(o.t==='div'||o.t==='int')&&iopsOf(o.acc).some(z=>z.t==='dep'))div+=iopNet(o)});
  let flux=0;try{const F=fluxModel();Object.entries(F.by||{}).forEach(([m,v])=>{if(per==='month'&&m===a.slice(0,7))flux+=v})}catch(e){}
  const cls=s0&&s1?CLASSES.map(c=>({k:c.k,d:(s1[c.k]||0)-(s0[c.k]||0)})).filter(x=>Math.abs(x.d)>0.5).sort((x,y)=>Math.abs(y.d)-Math.abs(x.d)):[];
  const bd=Object.entries(ST().badges||{}).filter(([k,d])=>d>=a&&d<=b).map(([k])=>k);
  return {per,a,b,s0,s1,chg:s0&&s1?s1.nw-s0.nw:null,pct:s0&&s1&&s0.nw?(s1.nw-s0.nw)/Math.abs(s0.nw):null,g,cats,div,flux,cls,bd,n:tx.length};
}
EXT.A.recap=v=>openOvl({k:'recap',per:v||'week'});
EXT.ovl.recap=o=>{o.per=o.per||'week';const M=recapModel(o.per);const lbl=M.a===M.b?dateT(M.a):t('rp.range',{a:dateT(M.a,'short'),b:dateT(M.b,'short')});
  return {html:`<div class="ph"><div><div class="eyebrow">${esc(lbl)}</div><h2>${esc(t('rp.t.'+o.per))}</h2></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  <div style="margin-bottom:14px">${seg('recap',[['day',t('rp.day')],['week',t('rp.week')],['month',t('rp.month')]],o.per,'')}</div>
  <div class="card flat" style="margin-bottom:14px"><div class="lab">${esc(t('rp.nw'))}</div>${M.chg==null?`<p class="note">${esc(t('rp.noHist'))}</p>`:`<div class="wbig" style="margin-top:4px"><span class="${cls(M.chg)}">${moneyS(M.chg,2)}</span><small class="${cls(M.chg)}">${pctS(M.pct,2)}</small></div><p class="note" style="margin:4px 0 0">${esc(t('rp.from',{a:moneyT(M.s0.nw,0),b:moneyT(M.s1.nw,0)}))}</p>`}</div>
  ${M.cls.length?`<div class="sec-t"><h2>${esc(t('rp.byCls'))}</h2></div><div class="list" style="margin-bottom:14px">${M.cls.slice(0,5).map(x=>`<div class="row"><div class="m"><b>${esc(clsL(x.k))}</b></div><div class="r"><b class="${cls(x.d)}">${moneyS(x.d,0)}</b></div></div>`).join('')}</div>`:''}
  <div class="kpis k4" style="box-shadow:none;margin-bottom:14px">${kpi(t('b.income'),`<span class="good">${money(M.g.inc,0)}</span>`)}${kpi(t('b.expense'),money(M.g.exp,0))}${kpi(t('rp.div'),money(M.div,2))}${kpi(t('rp.ops'),String(M.n))}</div>
  ${M.cats.length?`<div class="sec-t"><h2>${esc(t('rp.topCats'))}</h2></div><div class="list" style="margin-bottom:14px">${M.cats.map(([k,v])=>`<div class="row"><span class="av sm" style="--c:${cvar((CAT[k]||{}).c||'--k3')}">${ico((CAT[k]||{}).ic||'cart')}</span><div class="m"><b>${esc(typeof catL==="function"?catL(k):t("cat."+k))}</b></div><div class="r"><b>${money(v,0)}</b></div></div>`).join('')}</div>`:''}
  ${M.bd.length?`<div class="sec-t"><h2>${esc(t('rp.badges'))}</h2></div><div class="list">${M.bd.map(k=>`<div class="row"><span class="av sm" style="--c:var(--good)">${ico(badgeIco(k))}</span><div class="m"><b>${esc(t('bd.'+k+'.t'))}</b></div></div>`).join('')}</div>`:''}`}};
function recapCheck(){
  if(!S.data||S.demo)return;const s=ST();s.recaps=s.recaps||{};let n=0;
  ['day','week','month'].forEach(per=>{const [a,b]=recapRange(per);if(s.recaps[per]===b)return;const first=!s.recaps[per];s.recaps[per]=b;if(first&&per!=='day')return;
    const M=recapModel(per);if(M.chg==null&&!M.n)return;pushNotif('recap',t('rp.ready.'+per),M.chg==null?t('rp.readyOps',{n:M.n}):t('rp.readyNw',{c:(M.chg>=0?'+':'−')+moneyT(Math.abs(M.chg),0)}),'recap',per);n++});
  if(n)save();
}

/* ---------- marchés ouverts ? ---------- */
function tzParts(tz){const p=new Intl.DateTimeFormat('en-GB',{timeZone:tz,weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());const g=k=>(p.find(x=>x.type===k)||{}).value;return {wd:g('weekday'),m:(+g('hour'))*60+(+g('minute'))}}
function mkOpen(tz,o,c){const x=tzParts(tz);return !['Sat','Sun'].includes(x.wd)&&x.m>=o&&x.m<c}
function markets(){return [['euronext',mkOpen('Europe/Paris',540,1050)],['xetra',mkOpen('Europe/Berlin',540,1050)],['nyse',mkOpen('America/New_York',570,960)],['crypto',true]]}

/* ---------- écran Live ---------- */
let LIVE_TICK=null;
function liveView(){
  const tt=totals();const nd=nwDay();const pts=intraday24();const pos=positions().map(p=>({p,...posDay(p)}));const mk=markets();
  const src=p=>{const h=p.lines[0].h;return h.liveAt?(h.liveSrc||'')+' · '+agoT(String(h.liveAt)):t('lv.manual')};
  if(!LIVE_TICK)LIVE_TICK=setInterval(()=>{if(S.ui.view!=='live'||S.ui.ovl||document.hidden){if(S.ui.view!=='live'){clearInterval(LIVE_TICK);LIVE_TICK=null}return}render()},60000);
  return `<div class="grid g-hero"><div class="card"><div class="ch"><div><div class="eyebrow"><span class="pulse-dot"></span>${esc(t('lv.title'))}</div></div><span class="note">${esc(t('lv.refresh'))}</span></div>
    <div class="hero-v">${heroMoney(tt.net)}</div><div class="hrow">${nd?`<span class="delta ${nd.chg>=0?'up':'dn'}">${nd.chg>=0?'▲':'▼'} ${moneyS(nd.chg,2)} · ${pctS(nd.pct,2)}</span><span class="muted" style="font-size:13px">${esc(t('w.today.from',{d:dateT(nd.from,'short')}))}</span>`:`<span class="muted">${esc(t('w.today.none'))}</span>`}</div>
    ${chart({h:220,series:[{pts,c:'var(--accent)'}],xl:i=>pts[i].tm||'',tip:i=>`<b>${esc(moneyT(pts[i].v,2))}</b><br>${esc(pts[i].tm||'')}`,label:t('lv.curve'),empty:t('lv.curveEmpty')})}</div>
  <div class="card"><div class="ch"><div><h2>${esc(t('lv.markets'))}</h2><p>${esc(t('lv.marketsS'))}</p></div></div><div class="list">${mk.map(([k,o])=>`<div class="row"><span class="mkdot ${o?'on':''}"></span><div class="m"><b>${esc(t('lv.mk.'+k))}</b><span>${esc(t('lv.mkh.'+k))}</span></div><div class="r"><b class="${o?'good':'muted'}">${esc(t(o?'lv.open':'lv.closed'))}</b></div></div>`).join('')}</div>
    <div class="ch" style="margin-top:16px"><div><h2>${esc(t('al.title'))}</h2><p>${esc(t('al.sub',{n:alerts().filter(a=>a.on!==false).length}))}</p></div></div>
    <div class="list">${alerts().map(a=>`<button class="row btnrow${a.on===false?' dim':''}" data-a="alertEdit" data-v="${a.id}"><span class="av sm" style="--c:var(${a.last===today()?'--warn':'--k2'})">${ico('bell')}</span><div class="m"><b>${esc(a.name)}</b><span>${esc(t('al.op.'+a.op))} ${esc(a.op==='chgUp'||a.op==='chgDown'?numT(a.val,2)+' %':numT(a.val,4))}${a.last===today()?' · '+esc(t('al.hitToday')):''}</span></div></button>`).join('')||`<p class="note">${esc(t('al.none'))}</p>`}</div></div></div>
  <div class="card" style="margin-top:16px"><div class="ch"><div><h2>${esc(t('lv.pos'))}</h2><p>${esc(t('lv.posS'))}</p></div></div>
    <div class="tw cards"><table class="tbl"><thead><tr><th>${esc(t('w.since.line'))}</th><th>${esc(t('f.price'))}</th><th>${esc(t('lv.day'))}</th><th>${esc(t('inv.value'))}</th><th>${esc(t('lv.src'))}</th><th></th></tr></thead><tbody>
    ${pos.map(x=>`<tr class="click" data-a="pos" data-v="${esc(x.p.key)}"><td><b>${esc(x.p.name)}</b></td><td data-l="${esc(t('f.price'))}">${esc(moneyT(x.p.price,x.p.price<10?4:2,x.p.cur))}</td><td data-l="${esc(t('lv.day'))}" class="${x.known?cls(x.pct):''}">${x.known?`${pctS(x.pct,2)} <span class="muted">${moneyS(x.chg,2)}</span>`:'—'}</td><td data-l="${esc(t('inv.value'))}"><b>${money(x.p.value,2)}</b></td><td data-l="${esc(t('lv.src'))}"><span class="muted">${esc(src(x.p))}</span></td><td>${alertBtn(x.p.key)}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">${esc(t('lv.note'))}</p></div>`;
}

/* ---------- branchement : à chaque rendu ---------- */
let PREM_T=0;
const _render=render;render=function(){_render();if(S.phase!=='app'||!S.data)return;const now=Date.now();if(now-PREM_T<20000)return;PREM_T=now;setTimeout(()=>{try{noteIntraday();checkAlerts();recapCheck()}catch(e){console.warn(e)}},50)};
