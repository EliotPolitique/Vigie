/* ================= V4 — fiabilité des données : bilan de santé, journal technique ================= */
/* journal technique : erreurs JavaScript, promesses rejetées, erreurs signalées par l'application */
const ERRS=[];
function errLog(kind,msg){try{const m=String(msg&&(msg.stack||msg.message)||msg||'').slice(0,400);if(!m)return;const last=ERRS[ERRS.length-1];if(last&&last.m===m){last.n++;return}
  ERRS.push({at:new Date().toISOString(),k:kind,m,n:1});if(ERRS.length>60)ERRS.shift();try{localStorage.setItem('vigie:errs',JSON.stringify(ERRS.slice(-30)))}catch(e){}}catch(e){}}
try{const old=JSON.parse(localStorage.getItem('vigie:errs')||'[]');if(Array.isArray(old))old.forEach(x=>ERRS.push(Object.assign(x,{old:1})))}catch(e){}
addEventListener('error',e=>errLog('js',e.error||e.message));
addEventListener('unhandledrejection',e=>errLog('promise',e.reason&&(e.reason.message||e.reason.code)||e.reason));
{const ce=console.error.bind(console);console.error=(...a)=>{errLog('app',a.map(x=>x&&x.message?x.message:typeof x==='object'?JSON.stringify(x):String(x)).join(' '));ce(...a)}}

/* ---------- contrôles ---------- */
function healthChecks(){
  const d=D();const out=[];const ign=new Set(ST().hIgnore||[]);const td=today();
  const accN=id=>(d.accounts.find(a=>a.id===id)||{}).name||'—';
  /* 1. doublons : même compte, même montant, 3 jours d'écart au plus, libellés proches ou une seule opération venue de Finary */
  const byAcc={};d.txs.forEach(x=>(byAcc[x.acc]=byAcc[x.acc]||[]).push(x));const dups=[];
  Object.values(byAcc).forEach(L=>{L.sort((a,b)=>a.d.localeCompare(b.d));for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length&&daysBetween(L[i].d,L[j].d)<=3;j++){const a=L[i],b=L[j];
    if(Math.abs(a.a-b.a)>0.005||!a.a)continue;/* une opération venue de Finary et une opération importée : les opérations répétées (arrondis, coffres quotidiens) ne sont pas des doublons */const mixed=!!a.fid!==!!b.fid;if(!mixed)continue;
    if(a.ext&&b.ext&&a.ext!==b.ext)continue;const key='dup:'+[a.id,b.id].sort().join('/');if(ign.has(key))continue;dups.push({key,a,b})}});
  /* doublons entre deux comptes du même établissement : opération Finary rattachée à un autre compte que l'import */
  const fids=d.txs.filter(x=>x.fid);const inst=id=>norm((d.accounts.find(a=>a.id===id)||{}).inst||'').split(' ')[0];
  fids.forEach(f=>{const m=d.txs.find(x=>!x.fid&&x.src!=='gsheet'&&x.acc!==f.acc&&inst(x.acc)&&inst(x.acc)===inst(f.acc)&&Math.abs(x.a-f.a)<0.005&&Math.abs(daysBetween(x.d,f.d))<=3);
    if(m){const key='dup:'+[m.id,f.id].sort().join('/');if(!ign.has(key)&&!dups.some(z=>z.key===key))dups.push({key,a:m,b:f,cross:1})}});
  if(dups.length)out.push({k:'dup',lvl:'warn',n:dups.length,items:dups.slice(0,40).map(z=>({key:z.key,l:`${dateT(z.a.d,'short')} · ${moneyT(z.a.a,2)} · ${cleanLabel(z.a.l).slice(0,40)}`,s:z.cross?`${accN(z.a.acc)} / ${accN(z.b.acc)}`:accN(z.a.acc),act:'hDup',v:z.a.id+'|'+z.b.id}))});
  /* 2. virements entre ses propres comptes comptés comme revenu ou dépense */
  const TR=/\b(vir|virement|transfer|versement|recharge|top up|topup|depuis|vers|to|from|envoye|recu|payment from|incoming|outgoing)\b/;const pairs=[];const seen=new Set();
  d.txs.forEach(x=>{if(x.mc||seen.has(x.id)||Math.abs(x.a)<5)return;const k=(CAT[x.c]||{}).kind;if(k==='move')return;
    const y=d.txs.find(z=>z.acc!==x.acc&&!seen.has(z.id)&&Math.abs(z.a+x.a)<0.01&&Math.abs(daysBetween(z.d,x.d))<=3&&TR.test(' '+norm(z.l)+' ')&&TR.test(' '+norm(x.l)+' '));
    if(!y||y.mc&&(CAT[y.c]||{}).kind!=='move')return;if(!['in','out','nc'].includes(k)&&!['in','out','nc'].includes((CAT[y.c]||{}).kind))return;
    const key='tr:'+[x.id,y.id].sort().join('/');if(ign.has(key))return;seen.add(x.id);seen.add(y.id);pairs.push({key,x,y})});
  if(pairs.length)out.push({k:'pair',lvl:'warn',n:pairs.length,items:pairs.slice(0,40).map(z=>({key:z.key,l:`${dateT(z.x.d,'short')} · ${moneyT(Math.abs(z.x.a),2)} · ${accN(z.x.a<0?z.x.acc:z.y.acc)} → ${accN(z.x.a<0?z.y.acc:z.x.acc)}`,s:`${catL(z.x.c)} / ${catL(z.y.c)}`,act:'hPair',v:z.x.id+'|'+z.y.id}))});
  /* 3. soldes reconstitués négatifs : relevé manquant probable */
  if(typeof histEngine==='function'){try{const E=histEngine();const neg=[];for(const id in E.how){const H=E.how[id];if(H.m!=='back')continue;const ar=E.series[id].arr;let mi=0;for(let i=1;i<ar.length;i++)if(ar[i]<ar[mi])mi=i;if(ar[mi]<-1){const a=d.accounts.find(x=>x.id===id);if(a&&a.type==='checking'&&!ign.has('neg:'+id)){let ln=-1;for(let i=0;i<ar.length;i++)if(ar[i]<-0.005)ln=i;const D=E.days[Math.min(ln+1,E.days.length-1)];neg.push({key:'neg:'+id,l:a.name,s:t('h.negS',{v:moneyT(ar[mi],2),d:dateT(E.days[mi])})+' '+t('h.negFix',{v:moneyT(-ar[mi],2),d:dateT(D)}),act:'import',v:id,act2:'hAdj',v2:id+'|'+D+'|'+r2(ar[mi])})}}}
    if(neg.length)out.push({k:'neg',lvl:'warn',n:neg.length,items:neg});
    const gaps=[];for(const id in E.how){const H=E.how[id];if(H.m==='replay'&&Math.abs(H.gap)>Math.max(10,0.05*Math.abs((d.accounts.find(a=>a.id===id)?accValue(d.accounts.find(a=>a.id===id)):0)))&&!ign.has('gap:'+id)){const a=d.accounts.find(x=>x.id===id);gaps.push({key:'gap:'+id,l:a.name,s:t('h.gapS',{v:moneyS(H.gap,2).replace(/<[^>]+>/g,'')}),act:'pimport',v:id})}}
    if(gaps.length)out.push({k:'gap',lvl:'info',n:gaps.length,items:gaps})}catch(e){console.warn(e)}}
  /* 4. comptes non mis à jour depuis plus d'un mois (hors comptes synchronisés) */
  const st=d.accounts.filter(a=>a.include!==false&&!a.fid&&!Object.values((ST().finary||{}).map||{}).includes(a.id)&&['cash','savings','invest','crypto'].includes(accCls(a))&&a.updatedAt&&daysBetween(a.updatedAt,td)>31&&!ign.has('old:'+a.id));
  if(st.length)out.push({k:'old',lvl:'info',n:st.length,items:st.map(a=>({key:'old:'+a.id,l:a.name,s:t('h.oldS',{d:dateT(a.updatedAt),n:daysBetween(a.updatedAt,td)}),act:'acc',v:a.id}))});
  /* 5. cours anciens */
  const px=[];d.accounts.filter(a=>a.include!==false).forEach(a=>(a.holdings||[]).forEach(h=>{if(!(+h.qty>0)||h.kind==='fe')return;const at=h.liveAt?String(h.liveAt).slice(0,10):a.updatedAt;if(at&&daysBetween(at,td)>7&&!ign.has('px:'+a.id+(h.isin||h.name)))px.push({key:'px:'+a.id+(h.isin||h.name),l:h.name,s:t('h.pxS',{d:dateT(at),a:a.name}),act:'prices',v:''})}));
  if(px.length)out.push({k:'px',lvl:'info',n:px.length,items:px.slice(0,30)});
  /* 6. opérations à catégoriser sur 3 mois */
  const from=dAdd(td,-92);const nc=d.txs.filter(x=>x.c==='uncat'&&x.d>=from).length;if(nc)out.push({k:'nc',lvl:'info',n:nc,items:[{key:'',l:t('h.ncL',{n:nc}),s:'',act:'ncGo',v:''}]});
  /* 7. synchronisation Finary et enregistrement */
  if(typeof FIN!=='undefined'&&['err','auth','part'].includes(FIN.st))out.push({k:'fin',lvl:'warn',n:1,items:[{key:'',l:t('h.finL'),s:FIN.lastErr?FIN.lastErr.tool+' · '+FIN.lastErr.code:'',act:'finOpen',v:''}]});
  if(typeof SAVE!=='undefined'&&SAVE.st==='err')out.push({k:'save',lvl:'bad',n:1,items:[{key:'',l:t('sv.errT'),s:(SAVE.doc||'')+' · '+(SAVE.code||''),act:'saveInfo',v:''}]});
  return out}
function healthScore(L){const w={bad:25,warn:5,info:2};const cap={bad:40,warn:20,info:8};return Math.max(0,100-sum(L.map(c=>Math.min(cap[c.lvl],w[c.lvl]*c.n))))}

/* ---------- actions ---------- */
EXT.A.hIgnore=v=>{const L=ST().hIgnore=ST().hIgnore||[];if(v&&!L.includes(v))L.push(v);if(L.length>500)L.splice(0,L.length-500);save();render()};
/* doublon : on garde l'opération venue de Finary (la synchronisation la reconnaît) et sa catégorie manuelle éventuelle */
EXT.A.hDup=v=>{const [a,b]=v.split('|');const d=D();const A0=d.txs.find(x=>x.id===a),B0=d.txs.find(x=>x.id===b);if(!A0||!B0)return;
  const keep=B0.fid&&!A0.fid?B0:A0,drop=keep===A0?B0:A0;if(drop.mc&&!keep.mc){keep.c=drop.c;if(drop.s)keep.s=drop.s;keep.mc=1}if(drop.note&&!keep.note)keep.note=drop.note;
  d.txs=d.txs.filter(x=>x!==drop);save();render();toast(t('h.dupDone'))};
EXT.A.hDupAll=()=>{const C=healthChecks().find(c=>c.k==='dup');if(!C)return;C.items.forEach(it=>EXT.A.hDup(it.v));};
EXT.A.hPair=v=>{const [a,b]=v.split('|');D().txs.forEach(x=>{if(x.id===a||x.id===b){x.c='transfer';x.s='internal';x.mc=1}});save();render();toast(t('h.pairDone'))};
EXT.A.hPairAll=()=>{const C=healthChecks().find(c=>c.k==='pair');if(!C)return;C.items.forEach(it=>{const [a,b]=it.v.split('|');D().txs.forEach(x=>{if(x.id===a||x.id===b){x.c='transfer';x.s='internal';x.mc=1}})});save();render();toast(t('h.pairDone'))};
EXT.A.finOpen=()=>openOvl({k:'fin'});
EXT.A.errCopy=()=>{const txt=ERRS.map(e=>`${e.at} [${e.k}]${e.n>1?' ×'+e.n:''} ${e.m}`).join('\n');try{navigator.clipboard.writeText(txt).then(()=>toast(t('toast.copied')),()=>openOvl({k:'errs'}))}catch(e){openOvl({k:'errs'})}};
EXT.A.errClear=()=>{ERRS.length=0;try{localStorage.removeItem('vigie:errs')}catch(e){}render()};
EXT.ovl.errs=()=>({html:`<div class="ph"><div><h2>${esc(t('h.errT'))}</h2><p>${esc(t('h.errCopy'))}</p></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div><textarea readonly rows="16" style="width:100%;font:12px ui-monospace,monospace">${esc(ERRS.map(e=>`${e.at} [${e.k}]${e.n>1?' ×'+e.n:''} ${e.m}`).join('\n'))}</textarea>`});

/* ---------- carte « Bilan de santé des données » ---------- */
function healthCard(){
  const L=healthChecks();const sc=healthScore(L);const col=sc>=85?'var(--good)':sc>=60?'var(--warn)':'var(--bad)';
  const btnAll={dup:'hDupAll',pair:'hPairAll'};
  const blocks=L.map(c=>`<details class="hck ${c.lvl}"${c.lvl!=='info'?' open':''}><summary><span class="hdot"></span><b>${esc(t('h.k.'+c.k,{n:c.n}))}</b><span class="muted">${esc(t('h.d.'+c.k))}</span></summary>
    ${btnAll[c.k]&&c.items.length>1?`<div class="hrow" style="justify-content:flex-end;margin:6px 0"><button class="btn sec sm" data-a="${btnAll[c.k]}">${esc(t('h.all.'+c.k,{n:c.items.length}))}</button></div>`:''}
    <div class="list">${c.items.map(it=>`<div class="row"><div class="m"><b>${esc(it.l)}</b>${it.s?`<span>${esc(it.s)}</span>`:''}</div><div class="r hrow" style="gap:6px;flex-wrap:nowrap">${it.act2?`<button class="btn sm" data-a="${it.act2}" data-v="${esc(it.v2||'')}">${esc(t('h.a2.'+c.k))}</button>`:''}${it.act?`<button class="btn ${it.act2?'sec ':''}sm" data-a="${it.act}" data-v="${esc(it.v||'')}">${esc(t('h.a.'+c.k))}</button>`:''}${it.key?`<button class="btn ghost sm" data-a="hIgnore" data-v="${esc(it.key)}">${esc(t('h.ignore'))}</button>`:''}</div></div>`).join('')}</div></details>`).join('');
  const errs=ERRS.filter(e=>!e.old).length;
  return `<div class="card" style="margin-bottom:16px"><div class="ch"><div><h2>${esc(t('h.t'))}</h2><p>${esc(t('h.s'))}</p></div><div class="hscore" style="--c:${col}"><b>${sc}</b><span>/100</span></div></div>
    ${L.length?blocks:`<p class="note">${ico('check')} ${esc(t('h.ok'))}</p>`}
    <div class="hrow note" style="justify-content:space-between;margin-top:12px;flex-wrap:wrap;gap:8px"><span>${esc(t('h.errN',{n:ERRS.length}))}${errs?' · '+esc(t('h.errNew',{n:errs})):''}</span><span class="hrow" style="gap:6px">${ERRS.length?`<button class="link" data-a="errCopy">${esc(t('h.errBtn'))}</button><button class="link" data-a="errClear">${esc(t('h.errClear'))}</button>`:''}</span></div></div>`}
const _rcv=reconView;reconView=function(){return healthCard()+_rcv()};

/* écart de rapprochement : opération explicite qui ramène à zéro le solde reconstitué avant la date où il devient cohérent */
EXT.A.hAdj=v=>{const [id,dd,amt]=String(v).split('|');const a=D().accounts.find(x=>x.id===id);if(!a||!(+amt<0))return;
  D().txs.push({id:uid(),d:dd,a:+amt,l:t('h.adjL'),c:'transfer',acc:id,adj:1,mc:1,note:t('h.adjN')});if(typeof HB!=='undefined')HB.key=null;
  if(ST().histRebuild)ST().histRebuild.sig='';save();if(typeof histOpenCheck==='function')histOpenCheck();render();toast(t('h.adjDone',{a:a.name}))};
function negFixFor(id){try{const E=histEngine();const H=E.how[id];if(!H||H.m!=='back')return null;const ar=E.series[id].arr;let mi=0,ln=-1;for(let i=0;i<ar.length;i++){if(ar[i]<ar[mi])mi=i;if(ar[i]<-0.005)ln=i}if(!(ar[mi]<-1))return null;
  const D=E.days[Math.min(ln+1,E.days.length-1)];return {min:r2(ar[mi]),at:E.days[mi],d:D,v:id+'|'+D+'|'+r2(ar[mi])}}catch(e){return null}}
