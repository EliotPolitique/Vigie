/* ================= état ================= */
const S={data:null,real:null,demo:false,phase:'boot',cap:{sample:undefined,downloads:undefined},
  ui:{view:'home',period:'1Y',cls:'all',ovl:null,confirm:null}};
const STORE={mode:'local',db:null,uid:null,last:{}};
const LS_KEY='vigie:data:v1',LS_UI='vigie:ui';

/* ================= stockage : espace privé par personne (db) ou navigateur ================= */
async function initStore(){
  const C=window.claude;if(!C||!C.use){S.cap.mcp=null;S.cap.sample=null;return}
  const timeout=ms=>new Promise(r=>setTimeout(()=>r(null),ms));
  try{
    const [db,user]=await Promise.all([Promise.race([C.use('db'),timeout(8000)]),Promise.race([C.use('user'),timeout(8000)])]);
    if(db){S.cap.db=db;startBase()}
    if(user){try{S.isOwner=await user.isOwner()}catch(e){}}
    if(db&&user){const id=await user.id();if(id){STORE.db=db;STORE.uid=id;STORE.mode='cloud'}}
  }catch(e){console.warn('db',e)}
  C.use('mcp').then(m=>{S.cap.mcp=m||null;syncLive()}).catch(()=>S.cap.mcp=null);
  C.use('sample').then(s=>S.cap.sample=s||null).catch(()=>S.cap.sample=null);
  C.use('downloads').then(s=>S.cap.downloads=s||null).catch(()=>S.cap.downloads=null);
}
const P=k=>'data/users/'+STORE.uid+'/'+k;
const HCOLS=['d','nw','g','db',...CLASSES.map(c=>c.k),'r'];
async function loadData(){
  if(STORE.mode==='cloud'){
    try{
      const main=await STORE.db.doc(P('main')).get();
      if(!main.exists)return null;
      /* les données lues sont figées (lecture seule) : on travaille sur une copie modifiable */
      const own=v=>v==null?v:JSON.parse(JSON.stringify(v));
      const m=own(main.data())||{};const raw=Object.assign({},m.d||{});
      const hist=await STORE.db.doc(P('hist')).get();
      if(hist.exists){const rows=own((hist.data()||{}).rows)||[];raw.history=rows.map(r=>{const o={};HCOLS.forEach((k,i)=>o[k]=r[i]);return o})}
      const years=(m.txYears||[]);raw.txs=[];
      for(const y of years){const s=await STORE.db.doc(P('tx-'+y)).get();if(s.exists){const r=own((s.data()||{}).rows)||[];STORE.last['tx-'+y]=JSON.stringify({rows:r});raw.txs.push(...r)}}
      raw.iops=[];for(const y of (m.ioYears||[])){const s=await STORE.db.doc(P('io-'+y)).get();if(s.exists){const r=own((s.data()||{}).rows)||[];STORE.last['io-'+y]=JSON.stringify({rows:r});raw.iops.push(...r)}}
      /* corrections ponctuelles déposées par l'assistant (dates d'ouverture…) : appliquées une fois au chargement */
      try{const pt=await STORE.db.doc(P('patch')).get();if(pt.exists){const q=own(pt.data())||{};/* comptes ajoutés (ex. ancien compte clos, opérations seules) */(Array.isArray(q.accAdd)?q.accAdd:[]).forEach(x=>{if(!x||typeof x.id!=='string'||!/^[\w-]{4,40}$/.test(x.id)||!TYP[x.type]||(raw.accounts||[]).some(a=>a.id===x.id))return;const o={id:x.id,name:String(x.name||'').slice(0,60)||typL(x.type),inst:String(x.inst||'').slice(0,60),type:x.type,cur:/^[A-Z]{3}$/.test(x.cur||'')?x.cur:'EUR',balance:isFinite(+x.balance)?Math.round(+x.balance*100)/100:0,holdings:[],include:x.include!==false,createdAt:today(),updatedAt:today()};['opened','closed'].forEach(k=>{if(/^\d{4}-\d{2}-\d{2}$/.test(x[k]||''))o[k]=x[k]});if(typeof x.note==='string')o.note=x.note.slice(0,200);(raw.accounts=raw.accounts||[]).push(o)});(raw.accounts||[]).forEach(a=>{const c=(q.acc||{})[a.id];if(c)['opened','inst','closed'].forEach(k=>{if(typeof c[k]==='string'&&/^[\w .:\-À-ÿ!·]{1,60}$/.test(c[k]))a[k]=c[k]});if(c&&typeof c.name==='string'&&c.name.trim()&&c.name.length<=60)a.name=c.name.trim();if(c&&isFinite(+c.balance)&&c.balance!==null&&c.balance!=='')a.balance=Math.round(+c.balance*100)/100});(Array.isArray(q.txAdd)?q.txAdd:[]).forEach(x=>{if(x&&typeof x.id==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.d||'')&&isFinite(+x.a)&&(raw.accounts||[]).some(a=>a.id===x.acc)&&!raw.txs.some(y=>y.id===x.id)){raw.txs.push({id:x.id,d:x.d,a:+x.a,l:String(x.l||'').slice(0,80),c:'transfer',acc:x.acc,adj:1,mc:1,note:String(x.note||'').slice(0,200)});const yy=x.d.slice(0,4);if(!(m.txYears||[]).includes(yy))(m.txYears=m.txYears||[]).push(yy)}});if(Array.isArray(q.incTxt))STORE.incPend=q.incTxt.map(x=>typeof x==='string'?{t:x}:x).filter(x=>x&&typeof x.t==='string'&&x.t.length<60000).slice(0,400).map(x=>({t:x.t,n:String(x.n||'').slice(0,80)}));if(Array.isArray(q.trCsv))STORE.trPend=q.trCsv.filter(x=>typeof x==='string'&&x.length<400000).slice(0,24);(Array.isArray(q.txImp)?q.txImp:[]).forEach(x=>{if(x&&typeof x.id==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.d||'')&&isFinite(+x.a)&&(raw.accounts||[]).some(a=>a.id===x.acc)&&!raw.txs.some(y=>y.id===x.id)){const l=String(x.l||'').slice(0,80);let c='otherOut';if(x.c&&CAT[x.c])c=x.c;else try{c=categorize(l,+x.a,raw.rules||[])||c}catch(e){}const o={id:x.id,d:x.d,a:+x.a,l,c,acc:x.acc,src:'import'};if(x.s&&(SUBS[c]||[]).includes(x.s))o.s=x.s;if(x.c&&CAT[x.c])o.mc=1;raw.txs.push(o);const yy=x.d.slice(0,4);if(!(m.txYears||[]).includes(yy))(m.txYears=m.txYears||[]).push(yy)}});if(q.gsync&&q.gsync.files&&typeof q.gsync.files==='object'){raw.settings=raw.settings||{};const g=raw.settings.gsync=(raw.settings.gsync&&typeof raw.settings.gsync==='object')?raw.settings.gsync:{};g.files=g.files||{};Object.entries(q.gsync.files).forEach(([k,v])=>{if(['pea','cto','liv','debt','mkt','cry'].includes(k)&&/^[A-Za-z0-9_-]{20,}$/.test(String(v)))g.files[k]=String(v)})}if(Array.isArray(q.detach)){raw.settings=raw.settings||{};const F=raw.settings.finary=raw.settings.finary||{map:{}};F.map=F.map||{};q.detach.forEach(id=>{const a=(raw.accounts||[]).find(x=>x.id===id);if(!a)return;Object.keys(F.map).forEach(k=>{if(F.map[k]===id)F.map[k]='__skip'});delete a.fid;delete a.fsync;delete a.fwarn;(a.holdings||[]).forEach(h=>{delete h.fin;delete h.fhid;if(h.liveSrc==='Finary'){delete h.liveSrc;delete h.liveAt}});if(!a.src)a.src='manual'})}if(q.fe&&typeof q.fe==='object')Object.entries(q.fe).forEach(([id,c])=>{const a=(raw.accounts||[]).find(x=>x.id===id);if(!a||!c)return;(a.holdings||[]).filter(h=>h.kind==='fe').forEach(h=>{if(isFinite(+c.rate)&&+c.rate>0&&+c.rate<20)h.feRate=+c.rate;if(/^\d{4}-\d{2}-\d{2}$/.test(c.from||''))h.feFrom=c.from})});if(/^[A-Za-z0-9_-]{20,}$/.test(String(q.bkFolder||''))){raw.settings=raw.settings||{};const b=raw.settings.backup=(raw.settings.backup&&typeof raw.settings.backup==='object')?raw.settings.backup:{};if(!b.folder)b.folder=String(q.bkFolder)}STORE.patched=1}}catch(e){}
      const d=raw;
      STORE.lastIo=(m.ioYears||[]).slice();
      STORE.last.main=JSON.stringify(m);
      return d;
    }catch(e){console.error(e);toast(t('err.load'),true);return null}
  }
  return store.get(LS_KEY);
}
let saveT=null,saving=false,pendingSave=false;
function save(){if(S.demo)return;try{recordSnapshot()}catch(e){console.warn(e)}clearTimeout(saveT);saveT=setTimeout(()=>{saveT=null;flush()},500)}
/* écriture d'un document avec délai maximal : un appel qui ne répond pas ne doit jamais bloquer les enregistrements suivants */
const SAVE={st:'ok',at:0,code:null,doc:null,tries:0,retryT:null};
function dbWrite(k,v){let tm=null;const lim=new Promise((_,rej)=>{tm=setTimeout(()=>rej({code:'timeout'}),25000)});
  const op=v===null?STORE.db.doc(P(k)).delete():STORE.db.doc(P(k)).set(v);
  return Promise.race([op,lim]).finally(()=>clearTimeout(tm))}
function savePaint(){const el=$('.savechip');const tmp=document.createElement('div');tmp.innerHTML=saveChip();const n=tmp.firstElementChild;if(el&&n)el.replaceWith(n);else if(el&&!n)el.remove();else if(!el&&n){const f=$('.finchip')||$('#top .ib');if(f)f.before(n)}}
function saveChip(){if(S.demo||STORE.mode!=='cloud'||SAVE.st==='ok')return '';const err=SAVE.st==='err';
  return `<button class="savechip ${err?'err':'busy'}" data-a="saveInfo" title="${esc(err?t('sv.errT'):t('sv.busy'))}"><i></i><span class="hide-m">${esc(err?t('sv.err'):t('sv.busy'))}</span></button>`}
async function flush(){
  if(S.demo||!S.data)return;
  if(saving){pendingSave=true;return}saving=true;
  let failed=null;
  try{
    const d=S.data;
    if(STORE.mode==='cloud'){
      SAVE.st='busy';savePaint();
      const byYear={};d.txs.forEach(x=>{const y=x.d.slice(0,4);(byYear[y]=byYear[y]||[]).push(x)});
      const years=Object.keys(byYear).sort();
      const byIo={};(d.iops||[]).forEach(x=>{const y=x.d.slice(0,4);(byIo[y]=byIo[y]||[]).push(x)});const ioYears=Object.keys(byIo).sort();
      const {txs,history,iops,...rest}=d;
      const main={d:rest,txYears:years,ioYears,v:1};
      const docs=[];
      years.forEach(y=>docs.push(['tx-'+y,{rows:byYear[y]}]));
      (STORE.lastYears||[]).filter(y=>!years.includes(y)).forEach(y=>docs.push(['tx-'+y,null]));
      ioYears.forEach(y=>docs.push(['io-'+y,{rows:byIo[y]}]));
      (STORE.lastIo||[]).filter(y=>!ioYears.includes(y)).forEach(y=>docs.push(['io-'+y,null]));
      docs.push(['main',main],['hist',{rows:history.map(h=>HCOLS.map(k=>h[k]??0))}]);
      /* les années d'opérations sont écrites avant le document principal qui les référence */
      for(const [k,v] of docs){const js=v===null?'null':JSON.stringify(v);if(STORE.last[k]===js)continue;
        try{await dbWrite(k,v===null?null:JSON.parse(js));STORE.last[k]=js}
        catch(e){console.error('save',k,e);failed={doc:k,code:e&&e.code||'error',msg:String(e&&e.message||'').slice(0,200)};if(e&&(e.code==='timeout'||e.code==='revoked'||e.code==='not_granted'))break}}
      if(!failed){STORE.lastYears=years;STORE.lastIo=ioYears}
    }else{
      if(!store.set(LS_KEY,d))toast(t('err.local'),true);
    }
  }catch(e){console.error(e);failed={doc:'?',code:e&&e.code||'error',msg:String(e&&e.message||'').slice(0,200)}}
  saving=false;
  if(STORE.mode==='cloud'){
    clearTimeout(SAVE.retryT);
    if(failed){SAVE.st='err';SAVE.code=failed.code;SAVE.doc=failed.doc;SAVE.msg=failed.msg;SAVE.tries++;savePaint();
      if(SAVE.tries===1||failed.code==='quota_exceeded')toast(failed.code==='quota_exceeded'?t('err.quota'):t('sv.errToast'),true);
      if(!['invalid_argument','quota_exceeded','revoked','not_granted'].includes(failed.code)&&SAVE.tries<8)SAVE.retryT=setTimeout(flush,Math.min(120000,4000*2**(SAVE.tries-1)));
    }else{const was=SAVE.st;SAVE.st='ok';SAVE.at=Date.now();SAVE.code=null;if(SAVE.tries&&was==='err')toast(t('sv.okAgain'));SAVE.tries=0;savePaint()}
  }
  if(pendingSave){pendingSave=false;flush()}
}
/* départ ou mise en arrière-plan : on enregistre tout de suite */
['pagehide','visibilitychange'].forEach(ev=>addEventListener(ev,()=>{if(ev==='visibilitychange'&&document.visibilityState!=='hidden')return;if(saveT){clearTimeout(saveT);saveT=null;flush()}}));

/* ================= rendu ================= */
let toastT;function toast(m,err){const el=$('#toast');el.textContent=m;el.className='toast'+(err?' err':'');el.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>el.hidden=true,3400)}
function applyTheme(){
  const s=S.data?ST():DEFAULT_SETTINGS();const r=document.documentElement;
  if(s.theme==='light'||s.theme==='dark')r.setAttribute('data-theme',s.theme);else r.removeAttribute('data-theme');
  r.setAttribute('data-accent',s.accent||'saphir');r.lang=lang();
}
function render(){
  applyTheme();
  const app=$('#app');
  const ae=document.activeElement;const fid=ae&&ae.id;let sel=null;try{sel=fid&&ae.selectionStart!=null?[ae.selectionStart,ae.selectionEnd]:null}catch(e){}
  CH.clear();
  if(S.phase==='boot'){app.innerHTML=`<div style="min-height:100vh;display:grid;place-items:center"><div style="display:grid;gap:14px;justify-items:center"><span class="mark" style="width:48px;height:48px;border-radius:14px">${MARK}</span><span class="note">${esc(t('boot'))}</span></div></div>`;return}
  if(S.phase==='welcome'){app.innerHTML=welcomeHTML();renderOvl();return}
  app.innerHTML=shellHTML();
  renderOvl();
  requestAnimationFrame(drawCharts);
  if(fid){const el=document.getElementById(fid);if(el&&el!==document.activeElement){el.focus({preventScroll:true});if(sel)try{el.setSelectionRange(sel[0],sel[1])}catch(e){}}}
  try{store.set(LS_UI,{view:S.ui.view,period:S.ui.period})}catch(e){}
}
function renderOvl(){
  const o=S.ui.ovl;const root=$('#ovl');
  if(!o){root.hidden=true;root.innerHTML='';root.className='ovl';return}
  let html='',cls='ovl',wide=false;
  switch(o.k){
    case 'acc':html=accDrawer(o.id);break;
    case 'accForm':html=accForm(o.id,o.type);break;
    case 'hold':html=holdForm(o.acc,o.id);break;
    case 'pos':html=posDrawer(o.id);break;
    case 'prices':html=pricesDrawer();break;
    case 'tx':html=txDrawer(o.id);break;
    case 'import':html=importDrawer();wide=true;break;
    case 'pimport':html=pimportDrawer();wide=true;break;
    case 'timport':html=timportDrawer();wide=true;break;
    case 'fin':html=finDrawer();wide=true;break;
    case 'goal':html=goalForm(o.id,o.tpl);break;
    case 'more':html=moreSheet();cls+=' sheet';break;
    case 'cmd':root.className='ovl center';root.hidden=false;root.innerHTML=`<div class="scrim" data-a="close"></div>${cmdHTML()}`;setTimeout(()=>{const i=$('#cmdq');if(i&&document.activeElement!==i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},0);return;
    case 'lock':root.className='lock';root.hidden=false;root.innerHTML=lockHTML();return;
    default:if(EXT.ovl[o.k]){const r=EXT.ovl[o.k](o)||{};html=r.html||'';wide=!!r.wide}
  }
  if(!html){S.ui.ovl=null;root.hidden=true;return}
  root.className=cls;root.hidden=false;
  root.innerHTML=`<div class="scrim" data-a="close"></div><div class="panel${wide?' wide':''}" role="dialog" aria-modal="true">${html}</div>`;
  const p=root.querySelector('.panel');if(o.scroll!=null)p.scrollTop=o.scroll;
  const fileIn=$('#impFile');if(fileIn)fileIn.addEventListener('change',e=>startImport(e.target.files));
  const drop=$('#drop');if(drop){['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('on')}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('on')}));drop.addEventListener('drop',e=>{startImport(e.dataTransfer.files)})}
  const pfIn=$('#pfFile');if(pfIn)pfIn.addEventListener('change',e=>startPimport(e.target.files));
  const pfd=$('#pfDrop');if(pfd){['dragenter','dragover'].forEach(ev=>pfd.addEventListener(ev,e=>{e.preventDefault();pfd.classList.add('on')}));['dragleave','drop'].forEach(ev=>pfd.addEventListener(ev,e=>{e.preventDefault();pfd.classList.remove('on')}));pfd.addEventListener('drop',e=>{startPimport(e.dataTransfer.files)})}
  if(root.querySelector('.chart'))requestAnimationFrame(drawCharts);
}
function openOvl(o){const p=$('#ovl .panel');S.ui.confirm=null;S.ui.ovl=o;renderOvl();const f=$('#ovl input:not([type=hidden]):not([type=checkbox]),#ovl select');if(f&&o.k!=='acc'&&o.k!=='pos'&&o.k!=='more'&&window.matchMedia('(pointer:fine)').matches)setTimeout(()=>{try{f.focus({preventScroll:true})}catch(e){}},30)}
function closeOvl(){if(S.ui.ovl&&S.ui.ovl.k==='lock')return;S.ui.ovl=null;S.ui.confirm=null;renderOvl();if(LIVE.pending){LIVE.pending=false;render()}}
function go(v){if(!VIEWS.some(x=>x.k===v))v='home';S.ui.view=v;S.ui.confirm=null;if(S.ui.ovl&&S.ui.ovl.k!=='lock')S.ui.ovl=null;try{if(location.hash!=='#'+v)history.replaceState(null,'','#'+v)}catch(e){}render();window.scrollTo({top:0})}

/* ================= actions ================= */
const A={
  go:v=>go(v),
  period:v=>{S.ui.period=v;render()},
  clsFilter:v=>{S.ui.cls=v;if(S.ui.view!=='wealth')go('wealth');else render()},
  privacy:()=>{ST().privacy=!ST().privacy;save();render()},
  quick:(v,el)=>{const ex=$('#qmenu');if(ex){ex.remove();return}const r=el.getBoundingClientRect();const w=document.createElement('div');w.innerHTML=quickMenu();const m=w.firstElementChild;m.style.top=(r.bottom+8+window.scrollY)+'px';m.style.right=Math.max(12,window.innerWidth-r.right)+'px';document.body.appendChild(m);setTimeout(()=>document.addEventListener('click',function h(e){if(!m.contains(e.target)){m.remove();document.removeEventListener('click',h)}}),0)},
  more:()=>openOvl({k:'more'}),
  cmd:()=>{S.ui.cmdQ='';S.ui.cmdSel=0;openOvl({k:'cmd'})},
  cmdGo:v=>{const it=(S.ui.cmdList||[])[+v];if(!it)return;S.ui.ovl=null;renderOvl();(A[it.act]||(()=>{}))(it.v)},
  themeCycle:()=>{const o=['system','light','dark'];ST().theme=o[(o.indexOf(ST().theme)+1)%3];save();render()},
  close:()=>closeOvl(),
  exitDemo:()=>{exitDemo()},
  demo:()=>{enterDemo()},
  lang:v=>{if(S.data){ST().lang=v;save()}else S.preLang=v;render()},
  acc:v=>openOvl({k:'acc',id:v}),
  addAcc:v=>{S.ui.formType=TYP[v]?v:null;openOvl({k:'accForm',type:TYP[v]?v:null})},
  addAccInv:()=>{S.ui.formType='pea';openOvl({k:'accForm',type:'pea'})},
  editAcc:v=>{S.ui.formType=null;openOvl({k:'accForm',id:v})},
  delAcc:v=>{if(S.ui.confirm!=='acc'+v){S.ui.confirm='acc'+v;renderOvl();return}const d=D();d.accounts=d.accounts.filter(a=>a.id!==v);d.goals.forEach(g=>g.accounts=(g.accounts||[]).filter(x=>x!==v));S.ui.ovl=null;save();render();toast(t('toast.deleted'))},
  toggleInc:v=>{const a=D().accounts.find(x=>x.id===v);if(!a)return;a.include=a.include===false;save();render()},
  addHold:v=>openOvl({k:'hold',acc:v}),
  addHoldAny:()=>{const a=investAccounts()[0];if(a)openOvl({k:'hold',acc:a.id})},
  editHold:v=>{const [a,h]=v.split('|');openOvl({k:'hold',acc:a,id:h})},
  delHold:v=>{const [aid,hid]=v.split('|');if(S.ui.confirm!=='h'+hid){S.ui.confirm='h'+hid;renderOvl();return}const a=D().accounts.find(x=>x.id===aid);if(a)a.holdings=a.holdings.filter(h=>h.id!==hid);save();S.ui.ovl={k:'acc',id:aid};S.ui.confirm=null;render();toast(t('toast.deleted'))},
  pos:v=>openOvl({k:'pos',id:v}),
  prices:()=>openOvl({k:'prices'}),
  invTab:v=>{S.ui.invTab=v;render()},
  sort:v=>{if(S.ui.sort===v)S.ui.sortDir=-(S.ui.sortDir||-1);else{S.ui.sort=v;S.ui.sortDir=v==='name'?1:-1}render()},
  budgetTab:v=>{S.ui.bTab=v;if(S.ui.view!=='budget')go('budget');else render()},
  ym:v=>{S.ui.ym=ymAdd(S.ui.ym||curBudgetYm(),+v);if(S.ui.ym>today().slice(0,7))S.ui.ym=today().slice(0,7);S.ui.lim=40;render()},
  ymSet:v=>{S.ui.ym=v;render()},
  catFilter:v=>{S.ui.fc=v;S.ui.bTab='ops';if(S.ui.view!=='budget')go('budget');else render()},
  fl:v=>{S.ui.fl=v;render()},
  more40:()=>{S.ui.lim=(S.ui.lim||40)+40;render()},
  tx:v=>openOvl({k:'tx',id:v}),
  addTx:()=>openOvl({k:'tx'}),
  delTx:v=>{if(S.ui.confirm!=='tx'+v){S.ui.confirm='tx'+v;renderOvl();return}D().txs=D().txs.filter(x=>x.id!==v);S.ui.ovl=null;save();render();toast(t('toast.deleted'))},
  suggestBud:()=>{const prev=[1,2,3].map(i=>aggTx(monthTx(ymAdd(today().slice(0,7),-i))));CATS.filter(c=>c.kind==='out').forEach(c=>{const a=sum(prev.map(p=>p.cat[c.k]||0))/3;if(a>5)D().budgets[c.k]=Math.ceil(a*1.05/10)*10});save();render();toast(t('toast.budSug'))},
  import:v=>{const a=v&&D().accounts.find(x=>x.id===v);S.ui.imp=a?{acc:a.id,lockAcc:true}:{};openOvl({k:'import'})},
  impReset:()=>{const I=S.ui.imp||{};S.ui.imp={acc:I.lockAcc?I.acc:undefined,lockAcc:I.lockAcc};renderOvl()},
  impGo:()=>doImport(),
  impSkip:()=>{S.ui.imp.kind=null;nextImport()},
  impAll:()=>{S.ui.imp.showAll=true;rerenderImport()},
  impAi:()=>importAi(),
  pimport:v=>{const a=v&&D().accounts.find(x=>x.id===v);S.ui.pimp={lockAcc:a?a.id:null};openOvl({k:'pimport'})},
  pfReset:()=>{const I=S.ui.pimp||{};S.ui.pimp={lockAcc:I.lockAcc};renderOvl()},
  pfGo:()=>doPimport(),
  pfSkip:()=>{S.ui.pimp.res=null;nextPimport()},
  pfAi:()=>pimportAi(),
  tiReset:()=>{const I=S.ui.timp||{};S.ui.timp=null;S.ui.pimp={lockAcc:I.lockAcc};S.ui.ovl={k:'pimport'};renderOvl()},
  tiGo:()=>doTimport(),
  finOpen:()=>openOvl({k:'fin'}),
  finSync:()=>finSync({manual:true}),
  finFull:()=>finSync({manual:true,full:true}),
  tiSkip:()=>nextTimport(),
  iopsAll:()=>{S.ui.iopsAll=!S.ui.iopsAll;renderOvl()},
  recalc:v=>{const a=D().accounts.find(x=>x.id===v);if(!a)return;if(S.ui.confirm!=='rc'+v){S.ui.confirm='rc'+v;renderOvl();return}S.ui.confirm=null;const n=recalcHoldings(a,{rm:true});save();renderOvl();render();toast(t('ti.recalcDone',{n}))},
  goal:v=>openOvl({k:'goal',id:v}),
  addGoal:()=>openOvl({k:'goal'}),
  goalTpl:v=>{const [k,ic]=v.split('|');const tt=totals();const tpl={name:t(k),icon:ic};if(k==='gt.emergency'){tpl.target=Math.round((avgMonthlyExpense(6)||1500)*ST().emergencyMonths/100)*100;tpl.accounts=D().accounts.filter(a=>accCls(a)==='savings').map(a=>a.id);tpl.rate=1.7}if(k==='gt.fi'){tpl.target=Math.round((avgMonthlyExpense(6)||2000)*12/(ST().swr/100)/1000)*1000;tpl.accounts=investAccounts().map(a=>a.id);tpl.rate=5}openOvl({k:'goal',tpl})},
  delGoal:v=>{if(S.ui.confirm!=='g'+v){S.ui.confirm='g'+v;renderOvl();return}D().goals=D().goals.filter(g=>g.id!==v);S.ui.ovl=null;save();render();toast(t('toast.deleted'))},
  simTab:v=>{S.ui.simTab=v;render()},
  simReset:()=>{S.ui.sim=simDefaults();render()},
  theme:v=>{ST().theme=v;save();render()},
  accent:v=>{ST().accent=v;save();render()},
  taxMode:v=>{ST().tax.mode=v;save();render()},
  pinSet:()=>{S.ui.pinMode='set';S.ui.pin='';S.ui.pinMsg='';S.ui.ovl={k:'lock'};renderOvl()},
  pinOff:()=>{ST().pin='';save();render();toast(t('toast.pinOff'))},
  lockNow:()=>{S.ui.pinMode=null;S.ui.pin='';S.ui.pinMsg='';S.ui.ovl={k:'lock'};renderOvl()},
  pinKey:v=>pinKey(v),
  pinCancel:()=>{S.ui.pinMode=null;S.ui.ovl=null;renderOvl()},
  pinForgot:()=>{S.ui.pinForgot=true;renderOvl()},
  pinReset:()=>{ST().pin='';S.ui.pinForgot=false;S.ui.ovl=null;save();renderOvl();render()},
  exportJson:()=>exportFile('vigie-'+today()+'.json',JSON.stringify(S.data,null,1),'application/json'),
  exportCsv:()=>{const rows=[['date','libelle','montant','categorie','compte','note']].concat(D().txs.map(x=>[x.d,x.l,String(x.a).replace('.',','),catL(x.c),(D().accounts.find(a=>a.id===x.acc)||{}).name||'',x.note||'']));exportFile('vigie-operations-'+today()+'.csv','﻿'+rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(';')).join('\n'),'text/csv')},
  wipe:()=>{if(S.ui.confirm!=='wipe'){S.ui.confirm='wipe';render();return}S.ui.confirm=null;const lg=ST().lang;S.data=emptyData();ST().lang=lg;flush().then(()=>{S.phase='welcome';render();toast(t('toast.wiped'))})},
  delRule:v=>{D().rules.splice(+v,1);save();render()},
  liveRefresh:()=>liveRefresh(),
  gsCreate:()=>gsCreate(),
  gsUnlink:()=>gsUnlink(),
  chatAsk:v=>askCopilot(v),
  chatClear:()=>{S.ui.chat=[];render()},
  formType:()=>{}
};
Object.assign(A,EXT.A);

/* ================= démo ================= */
function enterDemo(){
  if(!S.demo)S.real=S.data;
  const lg=(S.data&&ST().lang)||S.preLang||'fr';
  S.data=buildDemo(lg);S.demo=true;S.phase='app';S.ui.view='home';S.ui.ovl=null;render();toast(t('toast.demo'));stopLive();LIVE.st='idle';syncLive();
}
function exitDemo(){
  const lg=ST().lang;S.demo=false;
  if(S.real&&S.real.accounts){S.data=S.real;S.real=null;S.phase='app'}
  else{S.data=null;S.real=null;S.preLang=lg;S.phase='welcome'}
  S.ui.ovl=null;S.ui.view='home';render();stopLive();LIVE.st='idle';syncLive();
}

/* ================= formulaires ================= */
const F={
  welcome:fd=>{S.data=emptyData();ST().lang=S.preLang||'fr';ST().name=(fd.get('name')||'').trim();ST().cur=fd.get('cur')||'EUR';S.demo=false;S.phase='app';save();go('home');toast(t('toast.welcome'))},
  acc:(fd,id)=>{
    const d=D();let a=id?d.accounts.find(x=>x.id===id):null;
    const type=fd.get('type');const ty=TYP[type];const n=k=>{const v=fd.get(k);return v===null||v===''?undefined:+String(v).replace(',','.')};
    const o={name:(fd.get('name')||'').trim()||typL(type),inst:(fd.get('inst')||'').trim(),type,cur:fd.get('cur')||ST().cur,note:(fd.get('note')||'').trim(),foreign:!!fd.get('foreign'),updatedAt:today()};
    if(ty.h)o.cash=n('cash')||0;else o.balance=ty.cls==='debt'?Math.abs(n('balance')||0):(n('balance')||0);
    ['rate','rent','loanRate','monthly'].forEach(k=>{if(fd.has(k))o[k]=n(k)});
    ['opened','end'].forEach(k=>{if(fd.has(k))o[k]=fd.get(k)||undefined});
    EXT.accSave.forEach(fn=>fn(fd,o,ty,n,a));
    if(a)Object.assign(a,o);else{a=Object.assign({id:uid(),holdings:[],include:true,createdAt:today()},o);d.accounts.push(a)}
    save();S.ui.ovl=ty.h&&!id?{k:'hold',acc:a.id}:{k:'acc',id:a.id};render();toast(t(id?'toast.saved':'toast.accAdded'));
  },
  hold:(fd,v)=>{
    const [aid,hid]=v.split('|');const a=D().accounts.find(x=>x.id===aid);if(!a)return;
    const n=k=>{const x=fd.get(k);return x===''||x===null?0:+String(x).replace(',','.')};
    const o={gsym:(fd.get('gsym')||'').trim().toUpperCase(),name:(fd.get('name')||'').trim(),ticker:(fd.get('ticker')||'').trim().toUpperCase(),isin:(fd.get('isin')||'').trim().toUpperCase(),kind:fd.get('kind'),cur:fd.get('cur'),qty:n('qty'),pru:n('pru'),price:n('price')||n('pru'),ter:n('ter'),div:n('div'),region:fd.get('region'),sector:fd.get('sector'),months:[1,2,3,4,5,6,7,8,9,10,11,12].filter(m=>fd.get('m'+m))};
    for(const fn of EXT.holdSave){if(fn(fd,o,a,hid)===false)return}
    if(hid){const h=a.holdings.find(x=>x.id===hid);Object.assign(h,o)}else a.holdings.push(Object.assign({id:uid()},o));
    a.updatedAt=today();save();S.ui.ovl={k:'acc',id:a.id};render();toast(t('toast.saved'));syncLive();
  },
  pfPwd:fd=>{const I=S.ui.pimp;if(!I||!I.file)return;I.pwd=String(fd.get('pwd')||'');nextPimport(I.file)},
  impPwd:fd=>{const I=S.ui.imp;if(!I||!I.file)return;I.pwd=String(fd.get('pwd')||'');nextImport(I.file)},
  quickBal:(fd,id)=>{const a=D().accounts.find(x=>x.id===id);if(!a)return;const v=+String(fd.get('v')).replace(',','.')||0;a.balance=accCls(a)==='debt'?Math.abs(v):v;a.updatedAt=today();a.balAt=today();save();render();toast(t('toast.saved'))},
  prices:fd=>{let n=0;positions().forEach(p=>{const v=fd.get(p.key);if(v==null||v==='')return;const x=+String(v).replace(',','.');if(!isFinite(x)||x===p.price)return;p.lines.forEach(({a,h})=>{h.price=x;a.updatedAt=today()});n++});S.ui.ovl=null;save();render();toast(t('toast.prices',{n}))},
  tx:(fd,id)=>{
    const d=D();const o={l:(fd.get('l')||'').trim(),a:r2(+String(fd.get('a')).replace(',','.')||0),d:fd.get('d')||today(),c:fd.get('c'),s:fd.get('s')||'',acc:fd.get('acc')||'',note:(fd.get('note')||'').trim(),mc:1};if(!o.s)delete o.s;
    if(id){const x=d.txs.find(y=>y.id===id);if(!o.s)delete x.s;Object.assign(x,o);
      if(fd.get('rule')){const p=norm(cleanLabel(o.l)).split(' ').slice(0,2).join(' ');if(p){d.rules=d.rules.filter(r=>r.p!==p);d.rules.push(o.s?{p,c:o.c,s:o.s}:{p,c:o.c});let n=0;d.txs.forEach(y=>{if((' '+norm(y.l)).includes(' '+p)&&(y.c!==o.c||(o.s&&y.s!==o.s))){y.c=o.c;if(o.s)y.s=o.s;else delete y.s;n++}});toast(t('toast.rule',{n}))}}}
    else{if(o.c==='uncat')o.c=categorize(o.l,o.a,d.rules);d.txs.unshift(Object.assign({id:uid()},o))}
    S.ui.ovl=null;save();render();if(!fd.get('rule'))toast(t('toast.saved'));
  },
  goal:(fd,id)=>{
    const d=D();const n=k=>{const x=fd.get(k);return x===''||x===null?undefined:+String(x).replace(',','.')};
    const o={name:(fd.get('name')||'').trim(),target:n('target')||0,date:fd.get('date')||undefined,monthly:n('monthly')||0,rate:n('rate')||0,manual:n('manual'),icon:fd.get('icon')||'goals',accounts:d.accounts.filter(a=>fd.get('acc_'+a.id)).map(a=>a.id)};
    if(id)Object.assign(d.goals.find(g=>g.id===id),o);else d.goals.push(Object.assign({id:uid()},o));
    S.ui.ovl=null;save();render();toast(t('toast.saved'));
  },
  gsLink:fd=>gsLink(fd.get('v')),
  chat:fd=>{const q=(fd.get('q')||'').trim();if(q)askCopilot(q)}
};

/* ================= champs en direct ================= */
let liveT=null;
function onField(el){
  const f=el.dataset.f,v=el.type==='checkbox'?el.checked:el.value;const s=S.data&&ST();
  const later=fn=>{clearTimeout(liveT);liveT=setTimeout(fn,el.type==='number'||el.tagName==='INPUT'&&el.type!=='checkbox'?350:0)};
  switch(f){
    case 'q':S.ui.q=v;S.ui.lim=40;later(render);return;
    case 'allMonths':S.ui.allMonths=v;render();return;
    case 'invAcc':S.ui.invAcc=v;render();return;
    case 'bud':{const k=el.dataset.v;const n=+String(v).replace(',','.');if(n>0)D().budgets[k]=n;else delete D().budgets[k];save();later(render);return}
    case 'sim':{const tab=S.ui.simTab||'ci';const n=parseIn(v);((S.ui.simTxt=S.ui.simTxt||{})[tab]=S.ui.simTxt[tab]||{})[el.dataset.v]=v;el.classList.toggle('bad',n===null);if(n===null)return;S.ui.sim[tab][el.dataset.v]=n;later(()=>{if($('#simRes'))simRefresh();else render()});return}
    case 'cmdQ':S.ui.cmdQ=v;S.ui.cmdSel=0;cmdRefresh();return;
    case 'impMap':S.ui.imp.map[el.dataset.v]=+v;rerenderImport();return;
    case 'impAcc':S.ui.imp.acc=v;if(v==='__new'&&!S.ui.imp.newName)S.ui.imp.newName=((S.ui.imp.res&&S.ui.imp.res.bank)||'').slice(0,40);rerenderImport();return;
    case 'impInv':S.ui.imp.inv=v;rerenderImport();return;
    case 'impBal':S.ui.imp.updBal=v;return;
    case 'impCat':(S.ui.imp.catOver=S.ui.imp.catOver||{})[el.dataset.v]=v;return;
    case 'impNewName':S.ui.imp.newName=v;return;
    case 'impNewType':S.ui.imp.newType=v;return;
    case 'pfAcc':{const I=S.ui.pimp,gi=+el.dataset.v;I.tgt[gi]=v;rerenderImport();return}
    case 'pfNewName':S.ui.pimp.nname[+el.dataset.v]=v;return;
    case 'pfNewType':S.ui.pimp.ntype[+el.dataset.v]=v;return;
    case 'pfRow':{const I=S.ui.pimp;if(v)delete I.off[el.dataset.v];else I.off[el.dataset.v]=1;rerenderImport();return}
    case 'pfRm':S.ui.pimp.rm[+el.dataset.v]=v;rerenderImport();return;
    case 'pfCash':S.ui.pimp.cash[+el.dataset.v]=v;rerenderImport();return;
    case 'proj':{const n=+String(v).replace(',','.');if(!isFinite(n))return;(s.proj=s.proj||{})[el.dataset.v]=n;save();later(render);return}
    case 'fluxGoal':{const n=+String(v).replace(',','.');if(n>=0){s.fluxGoal=n;save();later(render)}return}
    case 'finMap':finRemap(el.dataset.v,v);renderOvl();return;
    case 'finAuto':finSet().auto=v;save();return;
    case 'tiAcc':S.ui.timp.tgt[+el.dataset.v]=v;rerenderImport();return;
    case 'tiNewName':S.ui.timp.nname[+el.dataset.v]=v;return;
    case 'tiNewType':S.ui.timp.ntype[+el.dataset.v]=v;return;
    case 'tiRecalc':S.ui.timp.recalc[+el.dataset.v]=v;rerenderImport();return;
    case 'tiRm':S.ui.timp.rm[+el.dataset.v]=v;return;
    case 'tiBal':S.ui.timp.bal[+el.dataset.v]=v;return;
    case 'tiMap':{const I=S.ui.timp;I.map[el.dataset.v]=+v;I.groups[0].ops=parseGenericItx(I.header,I.rows,I.map);rerenderImport();return}
    case 'impSec':{const I=S.ui.imp,k=+v,x=I.res.sections[k];I.sec=k;Object.assign(I.res,{ops:x.ops,startBal:x.startBal,endBal:x.endBal,curBal:x.curBal});rerenderImport();return}
    case 'privacy':s.privacy=v;save();render();return;
    case 'name':s.name=v.trim();save();later(render);return;
    case 'lang':s.lang=v;save();render();return;
    case 'cur':s.cur=v;save();render();return;
    case 'tax.tmi':s.tax.tmi=+v;save();render();return;
  }
  const m=f.match(/^(rate|fx|tax)\.(\w+)$/);
  if(m){const n=+String(v).replace(',','.');if(!isFinite(n))return;const grp=m[1]==='rate'?'rates':m[1];s[grp][m[2]]=n;if(m[1]!=='tax'){const uk=m[1]==='fx'?'fxUser':'ratesUser';s[uk]=s[uk]||{};s[uk][m[2]]=1}save();later(render);return}
  if(f==='emergencyMonths'||f==='swr'){const n=+v;if(n>0){s[f]=n;save();later(render)}return}
  if(EXT.field[f]){EXT.field[f](el,v,later);return}
}
function rerenderImport(){const p=$('#ovl .panel');const sc=p?p.scrollTop:0;S.ui.ovl.scroll=sc;renderOvl()}

/* ================= import de fichiers ================= */
function startImport(files){
  files=[...(files||[])].filter(Boolean);if(!files.length)return;
  const keep=S.ui.imp||{};S.ui.imp={queue:files,acc:keep.acc,lockAcc:keep.lockAcc};nextImport();
}
async function nextImport(f0){
  const I=S.ui.imp;if(!I)return;const f=f0||I.queue.shift();if(!f0)I.pwd='';I.needPwd=null;
  if(!f){S.ui.ovl=null;S.ui.imp=null;render();return}
  if(f.size>15e6){I.err=t('imp.tooBig');I.kind=null;renderOvl();return}
  I.busy=true;I.busyName=f.name;I.kind=null;I.res=null;I.err=null;I.showAll=false;I.ai=false;renderOvl();
  try{
    const isPdf=/\.pdf$/i.test(f.name)||f.type==='application/pdf';
    if(isPdf){I.file=f;I.name=f.name;I.res=await readPdf(f,I.pwd);I.kind='pdf';
      /* relevé de portefeuille déposé ici : bascule vers l'import de positions */
      if(!I.res.ops.length&&I.res.pf&&I.res.pf.n){const r=I.res;S.ui.pimp={queue:I.queue,lockAcc:null,file:f,name:f.name,pwd:I.pwd,res:{groups:r.pf.groups,date:r.pf.date||(r.period&&r.period.to)||today(),bank:r.bank,pages:r.pages,chars:r.chars,text:r.text,period:r.period}};pfInit(S.ui.pimp);S.ui.imp=null;S.ui.ovl={k:'pimport'};renderOvl();toast(t('pi.switched'));return}}
    else{
      let text=await f.text();if(/\uFFFD/.test(text)){try{text=new TextDecoder('windows-1252').decode(await f.arrayBuffer())}catch(e){}}
      text=text.replace(/^﻿/,'');
      if(/<OFX>|<STMTTRN>/i.test(text)){I.kind='ofx';I.header=[t('f.date'),t('f.label'),t('f.amount')];I.rows=ofxRows(text);I.map={date:0,label:1,amount:2,debit:-1,credit:-1}}
      else if(/^\s*\{/.test(text))throw {msg:t('imp.jsonHint')};
      else{
        const all=parseCSVText(text,detectDelim(text));if(all.length<2)throw {msg:t('imp.noRows')};
        if(isTrCsv(all[0])){const st=tiFromCsv(text,f.name);I.busy=false;S.ui.imp=null;startTimport(Object.assign(st,{name:f.name}),I.queue,null);toast(t('ti.switched'));return}
        let hi=0;for(let k=0;k<Math.min(all.length,15);k++){const m=guessColumns(all[k],all.slice(k+1));if(m.date>-1&&(m.amount>-1||m.debit>-1||m.credit>-1)&&!parseDate(all[k][m.date])){hi=k;break}}
        let header=all[hi].map(c=>String(c).trim()),rows=all.slice(hi+1);
        if(parseDate(header[guessColumns(header,rows).date])){rows=all.slice(hi);header=header.map((_,k)=>t('imp.col',{n:k+1}))}
        I.kind='csv';I.header=header;I.rows=rows;I.map=guessColumns(header,rows);I.res={bank:detectBank(text.slice(0,3000),f.name)};
      }
    }
    I.name=f.name;
    if(!I.lockAcc||!I.acc)I.acc=guessImportAcc(I.res&&I.res.bank,f.name);
    if(I.acc==='__new'){I.newName=((I.res&&I.res.bank)||f.name.replace(/\.[a-z]+$/i,'')).slice(0,40);I.newType=/carte|card/i.test(f.name+' '+((I.res&&I.res.head)||''))?'card':'checking'}
    I.updBal=true;
  }catch(e){I.kind=null;if(e&&e.code==='pwd'){I.needPwd={bad:e.bad};I.file=f;I.name=f.name}else I.err=e&&e.msg?e.msg:t(String(e&&e.message)==='script'?'imp.pdfLoad':'imp.readErr2',{f:f.name})}
  I.busy=false;renderOvl();
}
function guessImportAcc(bank,name){
  const accs=importAccounts();if(!accs.length)return '__new';
  const nb=norm(bank||'').split(' ')[0];const nn=norm(name||'');
  const byBank=nb?accs.filter(a=>norm(a.inst+' '+a.name).includes(nb)):[];
  if(byBank.length>1){const card=byBank.find(a=>a.type==='card');if(card&&/carte|card/.test(nn))return card.id;return byBank.find(a=>a.type==='checking')?.id||byBank[0].id}
  if(byBank.length===1)return byBank[0].id;
  if(bank)return '__new';
  return accs.length===1?accs[0].id:'';
}
function doImport(){
  const I=S.ui.imp;if(!I.acc)return;const prev=importPreview();const bal=importBalance();
  if(I.res&&I.res.holder){const h=I.res.holder.join(' ');const L=ST().selfNames||(ST().selfNames=[]);if(!L.includes(h))L.push(h)}
  if(I.acc==='__new'){const a={id:uid(),name:(I.newName||'').trim()||typL(I.newType||'checking'),inst:(I.res&&I.res.bank)||'',type:I.newType||'checking',cur:ST().cur,balance:0,holdings:[],include:true,createdAt:today(),updatedAt:today()};D().accounts.push(a);I.acc=a.id}
  prev.ok.forEach(o=>D().txs.push({id:uid(),d:o.d,a:o.a,l:o.l,c:o.c,acc:I.acc}));
  D().txs.sort((a,b)=>b.d.localeCompare(a.d));
  const acc=D().accounts.find(x=>x.id===I.acc);
  if(bal&&I.updBal!==false&&acc){acc.balance=bal.v;acc.balAt=bal.d;acc.updatedAt=today()}
  S.ui.lastImp=(S.ui.lastImp||0)+prev.ok.length;
  save();toast(t('toast.imported',{n:prev.ok.length,d:prev.dup}));
  if(prev.ok.length){S.ui.ym=prev.ok[0].d.slice(0,7)}
  if(I.queue&&I.queue.length){I.kind=null;nextImport();render();return}
  S.ui.ovl=null;S.ui.imp=null;S.ui.view='budget';S.ui.bTab='ops';render();
}
async function importAi(){
  const I=S.ui.imp;const sample=S.cap.sample;if(!I||!I.res||!sample||I.ai)return;
  I.ai=true;renderOvl();
  const scanned=(I.res.chars||0)<80;
  const prompt='Tu lis un relevé de compte bancaire (souvent en français). Extrais chaque opération du relevé.\nRéponds uniquement par un objet JSON de cette forme :\n{"banque":"nom ou null","debut":"AAAA-MM-JJ ou null","fin":"AAAA-MM-JJ ou null","soldeDebut":nombre ou null,"soldeFin":nombre ou null,"operations":[{"date":"AAAA-MM-JJ","libelle":"texte","montant":-12.40}]}\nRègles : montant négatif pour un débit (sortie d’argent), positif pour un crédit (entrée). Date = date d’opération. Ignore les lignes de solde, de total, de report et les en-têtes. N’invente aucune opération. Ne recopie aucun numéro de compte ni de carte dans les libellés.'+(scanned?'':'\n\nTexte du relevé :\n'+I.res.text.replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g,'[IBAN]').replace(/\b\d{9,}\b/g,'[n°]').slice(0,120000));
  try{
    let opts={modelTier:'default'};
    if(scanned){let lim=null;try{lim=await sample.limits()}catch(e){}if(!lim||!lim.images)throw {code:'no_images'};opts.images=await pdfImages(I.file,4,I.pwd)}
    const j=await sample.json(prompt,opts);
    const ops=(j&&Array.isArray(j.operations)?j.operations:[]).map(o=>({d:parseDate(o.date),a:r2(+o.montant),l:scrubLabel(o.libelle)})).filter(o=>o.d&&isFinite(o.a)&&o.a!==0);
    if(!ops.length)throw {code:'empty'};
    const num=v=>v!==null&&v!==undefined&&isFinite(+v)?+v:null;
    I.res=Object.assign({},I.res,{ops,startBal:num(j.soldeDebut),endBal:num(j.soldeFin),period:j.debut&&j.fin&&parseDate(j.debut)&&parseDate(j.fin)?{from:parseDate(j.debut),to:parseDate(j.fin)}:I.res.period,bank:I.res.bank||j.banque||'',warn:[{k:'ai'}],chars:Math.max(I.res.chars||0,80)});
  }catch(e){const c=e&&e.code;toast(t(c==='not_granted'?'cp.denied':c==='rate_limited'?'cp.rate':c==='no_images'?'imp.aiNoImg':'imp.aiFail'),true)}
  I.ai=false;renderOvl();
}
function readJsonFile(file){
  const rd=new FileReader();rd.onload=()=>{try{const d=JSON.parse(rd.result);if(!d||!Array.isArray(d.accounts))throw new Error('format');const lg=ST().lang;S.data=migrate(d);delete S.data.demo;if(!S.data.settings.lang)S.data.settings.lang=lg;S.demo=false;S.real=null;S.phase='app';save();render();toast(t('toast.restored'));syncLive()}catch(e){toast(t('err.json'),true)}};rd.readAsText(file);
}
async function exportFile(name,data,type){
  const dl=S.cap.downloads;
  if(dl){try{await dl.save({filename:name,data:new Blob([data],{type})});toast(t('toast.exported'));return}catch(e){if(e&&e.code==='declined')return}}
  try{await navigator.clipboard.writeText(data);toast(t('toast.copied'))}catch(e){toast(t('err.export'),true)}
}

/* ================= code PIN ================= */
const pinHash=p=>hash('vigie:'+p+':'+(STORE.uid||'local'));
function pinKey(k){
  if(k==='⌫'){S.ui.pin=(S.ui.pin||'').slice(0,-1);renderOvl();return}
  S.ui.pin=((S.ui.pin||'')+k).slice(0,4);S.ui.pinMsg='';
  if(S.ui.pin.length<4){renderOvl();return}
  const p=S.ui.pin;S.ui.pin='';
  if(S.ui.pinMode==='set'){S.ui.pinFirst=p;S.ui.pinMode='confirm';renderOvl();return}
  if(S.ui.pinMode==='confirm'){if(p===S.ui.pinFirst){ST().pin=pinHash(p);S.ui.pinMode=null;S.ui.ovl=null;save();renderOvl();render();toast(t('toast.pinOn'))}else{S.ui.pinMode='set';S.ui.pinMsg=t('lock.mismatch');renderOvl()}return}
  if(pinHash(p)===ST().pin){S.ui.ovl=null;renderOvl();render()}else{S.ui.pinMsg=t('lock.wrong');renderOvl()}
}

/* ================= copilote ================= */
async function askCopilot(q){
  const sample=S.cap.sample;if(!sample||S.ui.chatBusy)return;
  const C=S.ui.chat||(S.ui.chat=[]);C.push({r:'user',c:q});S.ui.chatBusy=true;S.ui.chatPartial='';render();scrollChat();
  const sys=`Tu es le copilote financier de l'application ${APP.name}. Réponds en ${LANGS.find(l=>l[0]===lang())[1]}, de façon précise, structurée et concise (texte brut, listes avec tirets autorisées, pas de tableau Markdown). Appuie-toi uniquement sur les données ci-dessous ; distingue les faits, les hypothèses et les opinions ; signale quand une information manque. Tu n'es pas un conseiller en investissement agréé : donne des éléments d'analyse et des pistes, jamais d'ordre d'achat ou de vente, et rappelle de vérifier les règles fiscales en vigueur pour toute décision.\n\nDONNÉES (${ST().cur}) :\n${JSON.stringify(copilotContext())}`;
  const msgs=[{role:'user',content:sys+'\n\nQuestion : '+C[0].c}];
  for(let i=1;i<C.length;i++)msgs.push({role:C[i].r==='user'?'user':'assistant',content:C[i].c});
  try{
    const res=await sample(msgs,{cache:false,onText:({text})=>{S.ui.chatPartial=text;const el=$('#streaming');if(el){el.textContent=text;scrollChat()}}});
    C.push({r:'assistant',c:res.text||S.ui.chatPartial||'…'});
  }catch(e){C.push({r:'assistant',c:e&&e.code==='not_granted'?t('cp.denied'):e&&e.code==='rate_limited'?t('cp.rate'):t('cp.err')});if(e&&e.code==='not_granted')S.cap.sample=null}
  S.ui.chatBusy=false;S.ui.chatPartial='';render();scrollChat();
}
function scrollChat(){const c=$('#chat');if(c){const last=c.lastElementChild;if(last)last.scrollIntoView({block:'nearest'})}}

/* ================= écouteurs ================= */
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-a]');if(!el)return;
  if(el.tagName==='SELECT'||el.tagName==='INPUT')return;
  const a=el.dataset.a;if(!A[a])return;
  if(el.tagName==='A')e.preventDefault();
  if(a!=='quick'){const qm=$('#qmenu');if(qm)qm.remove()}
  A[a](el.dataset.v,el,e);
});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.id==='jsonFile'&&el.files[0]){readJsonFile(el.files[0]);return}
  if(el.dataset.a==='formType'){const fm=el.closest('form');const fd=new FormData(fm);S.ui.formType=el.value;const o=S.ui.ovl;const keep={name:fd.get('name'),inst:fd.get('inst')};renderOvl();const n=$('#af-name');if(n&&keep.name&&!Object.values(I18N.fr).includes(keep.name))n.value=keep.name;else if(n)n.value=typL(el.value);const i=$('#af-inst');if(i&&keep.inst)i.value=keep.inst;return}
  if(el.dataset.f&&(el.tagName==='SELECT'||el.type==='checkbox'))onField(el);
});
document.addEventListener('input',e=>{const el=e.target;if(el.dataset.f&&el.tagName!=='SELECT'&&el.type!=='checkbox')onField(el)});
/* envoi des formulaires sans dépendre de l'envoi natif : dans la page intégrée à Claude, le navigateur peut bloquer
   l'envoi des formulaires (cadre isolé) ; le clic sur le bouton d'envoi et la touche Entrée sont donc traités directement */
let SUBMIT_AT=0;
function submitForm(fm){
  if(!fm||!fm.dataset.form)return;const now=Date.now();if(now-SUBMIT_AT<300)return;SUBMIT_AT=now;
  if(!fm.checkValidity()){const bad=fm.querySelector(':invalid');if(bad){try{bad.focus({preventScroll:false})}catch(e){}const lab=bad.id&&fm.querySelector('label[for="'+bad.id+'"]');toast((lab?lab.textContent.trim()+' : ':'')+(bad.validationMessage||t('err.form')),true)}return}
  const fn=F[fm.dataset.form]||EXT.F[fm.dataset.form];
  if(fn){try{fn(new FormData(fm),fm.dataset.v,fm)}catch(e){console.error(e);toast(t('err.form2'),true)}}
}
document.addEventListener('click',e=>{const btn=e.target.closest&&e.target.closest('button');if(!btn||btn.type!=='submit'||btn.disabled||btn.dataset.a)return;const fm=btn.form;if(!fm||!fm.dataset.form)return;e.preventDefault();e.stopPropagation();submitForm(fm)},true);
document.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.isComposing)return;const el=e.target;if(!el||el.tagName!=='INPUT'||/^(checkbox|radio|button|submit|file)$/.test(el.type))return;const fm=el.form;if(!fm||!fm.dataset.form)return;e.preventDefault();submitForm(fm)},true);
document.addEventListener('submit',e=>{
  const fm=e.target.closest('form[data-form]');if(!fm)return;e.preventDefault();submitForm(fm);
});
document.addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'&&S.phase==='app'){e.preventDefault();A.cmd();return}
  const o=S.ui.ovl;
  if(o&&o.k==='lock'){if(/^\d$/.test(e.key))pinKey(e.key);else if(e.key==='Backspace')pinKey('⌫');return}
  if(e.key==='Escape'&&o){closeOvl();return}
  if(o&&o.k==='cmd'){const n=(S.ui.cmdList||[]).length;if(e.key==='ArrowDown'){e.preventDefault();S.ui.cmdSel=Math.min(n-1,(S.ui.cmdSel||0)+1);cmdRefresh()}else if(e.key==='ArrowUp'){e.preventDefault();S.ui.cmdSel=Math.max(0,(S.ui.cmdSel||0)-1);cmdRefresh()}else if(e.key==='Enter'){e.preventDefault();A.cmdGo(S.ui.cmdSel||0)}}
  if(e.key==='Enter'&&e.target.id==='chatIn'&&!e.shiftKey){e.preventDefault();const fm=e.target.form;if(fm)submitForm(fm)}
});
window.addEventListener('pagehide',()=>{if(saveT&&STORE.mode!=='cloud'&&!S.demo&&S.data){clearTimeout(saveT);store.set(LS_KEY,S.data)}else if(saveT)flush()});
let rsT;window.addEventListener('resize',()=>{clearTimeout(rsT);rsT=setTimeout(()=>{if(S.phase==='app')drawCharts()},150)});
window.addEventListener('scroll',()=>{const tp=$('#top');if(tp)tp.classList.toggle('sc',window.scrollY>4)},{passive:true});
window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(S.phase==='app'&&v&&v!==S.ui.view&&VIEWS.some(x=>x.k===v))go(v)});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(S.phase==='app')requestAnimationFrame(drawCharts)});

/* ================= démarrage ================= */
async function boot(){
  const u=store.get(LS_UI);if(u){if(u.period&&PERIODS[u.period])S.ui.period=u.period}
  const h=location.hash.slice(1);if(VIEWS.some(x=>x.k===h))S.ui.view=h;else if(u&&u.view)S.ui.view=u.view;
  const nv=navigator.language||'fr',nl=nv.slice(0,2);S.preLang=LOC[nv]?nv:LOC[nl]?nl:'fr';
  render();
  await initStore();
  const d=await loadData();
  if(d&&(d.accounts&&d.accounts.length||d.settings&&d.settings.name!==undefined)){
    S.data=migrate(d);S.phase='app';
    if(STORE.mode==='cloud'){STORE.lastYears=[...new Set(S.data.txs.map(x=>x.d.slice(0,4)))]}
    if(ST().pin){S.ui.ovl={k:'lock'}}
    if(recordSnapshot())flush();
    syncLive();
  }else S.phase='welcome';
  render();
}
boot();
