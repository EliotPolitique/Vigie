/* ================= synchronisation automatique via Finary (V2) ================= */
/* Finary agrège tes banques et courtiers (DSP2) : Vigie lit comptes, positions, cours et opérations,
   et les rapproche de tes comptes existants. Correspondances : settings.finary = {map:{fid:accId|'__skip'}, at, txAt, auto, ref} */
const FIN_SERVER='Finary';
const FIN={st:'idle',code:null,at:0,busy:false,timer:null,last:null,step:''};
const finSet=()=>{const s=ST();if(!s.finary)s.finary={map:{},auto:true};if(!s.finary.map)s.finary.map={};return s.finary};
const finNum=v=>{const n=parseFloat(v);return isFinite(n)?n:0};
function finPayload(res){let p=res&&res.payload;if(p==null&&res&&Array.isArray(res.content)){const b=res.content.find(x=>x.type==='text');p=b&&b.text}
  if(typeof p==='string'){try{p=JSON.parse(p)}catch(e){const i=p.indexOf('{'),j=p.lastIndexOf('}');try{p=i>-1&&j>i?JSON.parse(p.slice(i,j+1)):null}catch(e2){p=null}}}return p}
async function finCall(tool,input,fresh){
  const opts={cache:fresh?{staleTime:0,gcTime:600000,refresh:true}:{staleTime:120000,gcTime:600000}};
  /* délai maximal : un appel bloqué (autorisation non donnée, serveur muet) ne doit pas figer la synchronisation */
  let timer=null;const lim=new Promise((_,rej)=>{timer=setTimeout(()=>rej({code:'timeout',message:tool}),FIN_TIMEOUT)});
  try{const r=await Promise.race([S.cap.mcp.callTool(FIN_SERVER,tool,input||{},opts),lim]);const p=finPayload(r);if(!p)throw {code:'format',message:tool};return p}
  catch(e){FIN.lastErr={tool,code:e&&e.code||'upstream_error',msg:String(e&&e.message||'').slice(0,240),at:new Date().toISOString()};throw e}
  finally{clearTimeout(timer)}
}
let FIN_TIMEOUT=45000;
/* type Vigie déduit du compte Finary */
function finType(a){
  const n=norm(a.attributes.name||'');const t=a.attributes.account_type;
  if(t==='checking')return /paypal|premier/.test(n)?'card':'checking';
  if(t==='saving'){if(/ldds|developpement durable/.test(n))return 'ldds';if(/livret a\b/.test(n))return 'livretA';if(/jeune/.test(n))return 'livretJeune';if(/\blep\b|epargne populaire/.test(n))return 'lep';if(/\bpel\b|epargne logement/.test(n))return 'pel';return 'savingsOther'}
  if(t==='investment'){if(/pea.?pme/.test(n))return 'peapme';if(/\bpea\b|plan d.?epargne en actions/.test(n))return 'pea';if(/\bper\b|retraite/.test(n))return 'per';if(/assurance|avenir|vie\b|linxea|lucya|spirica|suravenir/.test(n))return 'av';if(/\bpee\b|salariale/.test(n))return 'pee';return 'cto'}
  if(t==='crypto')return 'wallet';
  if(t==='real-estate')return 'property';
  if(t==='loan')return /immo|habitat/.test(n)?'mortgage':'consumer';
  if(t==='credit')return 'card';
  if(/montre|watch/.test(n))return 'valuables';
  return 'otherAsset';
}
/* index des inclusions JSON:API */
function finIdx(p){const m=new Map();(p&&p.included||[]).forEach(x=>m.set(x.type+':'+x.id,x));return m}
function finInst(a,idx){const c=a.relationships&&a.relationships.institution_connection&&a.relationships.institution_connection.data;if(!c)return {name:'',conn:null};
  const conn=idx.get('institution-connections:'+c.id);const ii=conn&&conn.relationships&&conn.relationships.institution&&conn.relationships.institution.data;const inst=ii&&idx.get('institutions:'+ii.id);
  return {name:inst?inst.attributes.name:'',logo:inst&&inst.attributes.logo_url,conn:conn?conn.attributes:null}}
/* proposition de correspondance avec un compte Vigie existant */
function finGuess(fa,info,used){
  const type=finType(fa);const cls=(TYP[type]||{}).cls;const bank=norm(info.name).split(' ').filter(w=>w.length>2)[0]||'';
  const fname=norm(fa.attributes.name||'');
  const cand=D().accounts.filter(a=>!a.fid&&!used.has(a.id)&&(TYP[a.type]||{}).cls===cls&&(!(TYP[a.type]||{}).h===!(TYP[type]||{}).h));
  const sc=a=>{const s=norm((a.inst||'')+' '+a.name);let k=0;if(bank&&s.includes(bank))k+=3;if(a.type===type)k+=2;if(fname&&fname.length>4&&s.includes(fname))k+=2;
    if(/compte.?titres|portfolio/.test(fname)&&a.type==='cto')k+=1;return k};
  const ranked=cand.map(a=>({a,k:sc(a)})).filter(x=>x.k>=3).sort((x,y)=>y.k-x.k||Math.abs((+x.a.balance||0)-finNum(fa.attributes.balance))-Math.abs((+y.a.balance||0)-finNum(fa.attributes.balance)));
  return ranked.length?ranked[0].a.id:null;
}
const FIN_CAT={income:'otherIn',investment:'saving',transfer:'transfer',cash_and_checks:'cashout',personal_and_home_essentials:'shopping',bills_and_utilities:'utilities',fees:'fees',food_and_beverage:'groceries',auto_and_transport:'transport',leasure_and_entertainment:'leisure',refunds:'refunds',taxes:'taxes',health:'health',health_and_wellness:'health',shopping:'shopping',travel:'travel',education:'education',housing:'housing',home:'housing',insurance:'insurance',gifts_and_donations:'gifts',gifts:'gifts',pets:'pets',subscriptions:'subscriptions'};
function finCat(t){
  {const st=typeof labelCatStrong==='function'?labelCatStrong(t.label||'',finNum(t.amount)):'';if(st)return st}
  const s=t.category&&t.category.slug||'';const sub=norm(t.subcategory&&(t.subcategory.slug||t.subcategory.label_fr||'')||'');const a=finNum(t.amount);
  if(/salar|salaire|paie/.test(sub))return 'salary';if(/allocation|aide|benefit|caf/.test(sub))return 'benefits';if(/dividend|interet|interest/.test(sub))return 'investIncome';
  if(/restaurant|bar|fast/.test(sub))return 'restaurants';if(/abonnement|subscription|streaming|telephon|internet|mobile/.test(sub))return 'subscriptions';
  if(s==='investment')return a>0?'investIncome':'saving';
  if(s==='income')return 'otherIn';
  const c=FIN_CAT[s];if(c)return c;
  return categorize(t.label||'',a,D().rules);
}
function finKind(sec,type){const st=(sec&&sec.attributes.security_type)||'';if(st==='etf')return 'etf';if(st==='equity'||st==='stock')return 'stock';if(st==='fund')return 'fund';if(st==='bond')return 'bond';if(type==='crypto')return 'crypto';return pfKind({name:sec?sec.attributes.name:''},{type:''})}
const FREQ={monthly:12,quarterly:4,biannually:2,semiannually:2,annually:1,yearly:1};

/* ---------- synchronisation ---------- */
async function finSync(opt){
  opt=opt||{};
  if(!S.cap.mcp||S.demo||!S.data)return;
  if(FIN.busy){if(opt.manual&&Date.now()-(FIN.started||0)>3*60000){FIN.busy=false}else return}
  const F=finSet();if(F.auto===false&&!opt.manual)return;
  FIN.busy=true;FIN.started=Date.now();FIN.st='busy';FIN.step='accounts';FIN.fails=[];FIN.lastErr=null;finPaint();
  try{
    const AP=await finCall('accounts',{},opt.manual);
    const idx=finIdx(AP);const list=(AP.data||[]).filter(x=>x.type==='assets');
    FIN.warn=(AP.sync_warnings||[]).map(w=>({inst:w.institution_name,reason:w.reason,ids:w.account_ids||[]}));
    const used=new Set(Object.values(F.map).filter(v=>v&&v[0]!=='_'));
    let created=0,linked=0;const first=!F.at;const withPos=[];
    /* 1er passage : correspondances, création des comptes, soldes (aucun appel réseau) */
    for(const fa of list){
      const fid=fa.id;const info=finInst(fa,idx);const at=fa.attributes;const type=finType(fa);
      (F.names=F.names||{})[fid]=(at.name||'')+(info.name?' · '+info.name:'');
      let map=F.map[fid];
      if(map===undefined||(map&&map[0]!=='_'&&!D().accounts.some(x=>x.id===map))){
        const g=finGuess(fa,info,used);
        const hasValue=at.balance!=null&&Math.abs(finNum(at.balance))>0.004;
        if(g){map=g;linked++}else if(hasValue){map='__new'}else map='__skip';
        F.map[fid]=map;if(map&&map[0]!=='_')used.add(map);
      }
      if(map==='__skip')continue;
      let a=map==='__new'?null:D().accounts.find(x=>x.id===map);
      if(!a){const base=at.name||typL(type);a={id:uid(),name:info.name&&!norm(base).includes(norm(info.name).split(' ')[0])?info.name+' · '+base:base,inst:info.name||'',type,cur:at.currency||ST().cur,balance:0,holdings:[],include:true,createdAt:today(),updatedAt:today()};if((TYP[type]||{}).h)a.cash=0;D().accounts.push(a);F.map[fid]=a.id;created++}
      a.fid=fid;a.fname=at.name;if(info.name&&!a.inst)a.inst=info.name;if(info.logo)a.logo=info.logo;
      const c=info.conn;a.fsync=c&&c.last_successful_sync_at||at.updated_at||null;a.fstate=c?c.sync_status:'manual';
      const w=FIN.warn.find(x=>x.ids.includes(fid));a.fwarn=w?w.reason:null;
      if(at.opened_at&&!a.opened)a.opened=at.opened_at;
      const ty=TYP[a.type]||{};
      if(!ty.h){if(at.balance!=null){const v=finNum(at.balance);a.balance=ty.cls==='debt'?Math.abs(v):v;a.balAt=(a.fsync||'').slice(0,10)||today()}a.updatedAt=today();continue}
      withPos.push({a,fid,name:at.name||a.name,bal:at.balance!=null?finNum(at.balance):null});
    }
    save();finSoftRender();
    /* 2e passage : positions, compte par compte ; un échec n'arrête pas les autres */
    for(const {a,fid,name,bal} of withPos){
      FIN.step='holdings';FIN.stepName=name;finPaint();
      try{const HP=await finCall('holdings',{account_id:fid,limit:1000},opt.manual);finMergeHoldings(a,HP);if(!a.holdings.length&&!(+a.cash)&&bal>0)a.cash=bal;a.updatedAt=today()}
      catch(e){FIN.fails.push({name,code:e&&e.code||'upstream_error'});if(e&&e.code==='approval_required')break}
    }
    save();
    /* total de référence Finary (contrôle de cohérence) */
    try{const OV=await finCall('get_portfolio_overview',{},opt.manual);const b=OV&&OV.balance_sheet;if(b)F.ref={gross:finNum(b.owned_gross_assets_effective),net:b.owned_net_worth_effective!=null?finNum(b.owned_net_worth_effective):null,at:new Date().toISOString()}}catch(e){FIN.fails.push({name:t('fin.overview'),code:e&&e.code||'upstream_error'})}
    /* opérations bancaires */
    FIN.step='tx';finPaint();
    let nTx=0;try{nTx=await finSyncTx(opt.full)}catch(e){FIN.fails.push({name:t('fin.txs'),code:e&&e.code||'upstream_error'})}
    F.at=new Date().toISOString();FIN.at=Date.now();FIN.st=FIN.fails.some(f=>f.code==='approval_required')?'auth':FIN.fails.length?'part':'ok';FIN.code=FIN.fails.length?FIN.fails[0].code:null;
    FIN.last={created,linked,nTx};
    save();finSoftRender();
    if(first)toast(t('fin.firstDone',{n:list.length,c:created,l:linked}));else if(opt.manual)toast(FIN.fails.length?t('fin.partial',{n:FIN.fails.length}):t('fin.done',{x:nTx}),!!FIN.fails.length);
  }catch(e){
    const code=e&&e.code||'upstream_error';FIN.code=code;
    FIN.st=code==='approval_required'?'auth':['needs_reauth','server_not_connected','not_in_manifest','blocked_by_policy','not_granted','capability_disabled','selection_required','consent_required'].includes(code)?'off':'err';
    if(opt.manual||code==='approval_required')toast(t('fin.err.'+(FIN.st==='off'?'off':FIN.st==='auth'?'auth':'err')),true);
  }
  FIN.busy=false;FIN.step='';FIN.stepName='';finPaint();
}
function finMergeHoldings(a,HP){
  const idx=finIdx(HP);const fx=ST().fx;const keep=new Map(a.holdings.map(h=>[h.fhid||('i:'+(h.isin||'')),h]));
  const out=[];let cash=0;
  for(const r of (HP.data||[])){
    const at=r.attributes||{};
    if(r.type==='fiat-holdings'){const v=finNum(at.current_value);const cur=at.current_value_currency||a.cur;cash+=v*((fx[cur]??1)/(fx[a.cur||'EUR']??1));continue}
    let h=null;
    if(r.type==='security-holdings'){
      const sr=r.relationships&&r.relationships.security&&r.relationships.security.data;const sec=sr&&idx.get('securities:'+sr.id);const sa=sec?sec.attributes:{};
      const isin=(sa.isin||'').toUpperCase();h=keep.get(r.id)||(isin&&keep.get('i:'+isin))||a.holdings.find(x=>isin&&x.isin===isin);
      const qty=finNum(at.quantity);const val=finNum(at.current_value);const cur=at.current_value_currency||sa.current_price_currency_code||a.cur;
      const kind=finKind(sec,'');
      if(!h)h={id:uid(),months:[],div:0,ter:0,region:pfRegion({name:sa.name,isin},kind),sector:kind==='stock'?'other':'diversified'};
      Object.assign(h,{fhid:r.id,fin:1,name:sa.name||h.name||isin,isin:isin||h.isin||'',ticker:sa.symbol||h.ticker||'',kind:h.kindSet?h.kind:kind,cur,qty,
        price:qty>0?val/qty:finNum(sa.current_price),pru:finNum(at.buying_price)||h.pru||0,logo:sa.logo_url||h.logo,liveAt:new Date().toISOString(),liveSrc:'Finary'});
      if(sa.expense_ratio!=null&&!h.terSet)h.ter=+(finNum(sa.expense_ratio)*100).toFixed(3);
      if(sa.dividend_frequency)h.dfreq=FREQ[sa.dividend_frequency]||0;else delete h.dfreq;
      delete h.pruEst;delete h.chg;
    }else if(r.type==='fond-euro-holdings'){
      h=keep.get(r.id)||a.holdings.find(x=>x.kind==='fe'&&!x.fhid)||{id:uid(),months:[],region:'europe',sector:'diversified'};
      const v=finNum(at.current_value);Object.assign(h,{fhid:r.id,fin:1,name:at.name||h.name||t('kind.fe'),kind:'fe',cur:at.current_value_currency||a.cur,qty:v,price:1,pru:1,liveAt:new Date().toISOString(),liveSrc:'Finary'});
      if(at.annual_yield!=null&&finNum(at.annual_yield)>0&&!h.divSet)h.div=+(finNum(at.annual_yield)*(finNum(at.annual_yield)<1?100:1)).toFixed(2);
    }else if(r.type==='crypto-holdings'){
      const cr=r.relationships&&(r.relationships.crypto||r.relationships.cryptocurrency);const cd=cr&&cr.data;const c=cd&&(idx.get(cd.type+':'+cd.id));const ca=c?c.attributes:{};
      const code=(ca.code||ca.symbol||'').toUpperCase();h=keep.get(r.id)||a.holdings.find(x=>code&&x.ticker===code)||{id:uid(),months:[],div:0,ter:0,region:'world',sector:'diversified'};
      const qty=finNum(at.quantity);const val=finNum(at.current_value);
      Object.assign(h,{fhid:r.id,fin:1,name:ca.name||code||h.name,ticker:code,kind:'crypto',cur:at.current_value_currency||a.cur,qty,price:qty>0?val/qty:0,pru:finNum(at.buying_price)||h.pru||0,logo:ca.logo_url||h.logo,liveAt:new Date().toISOString(),liveSrc:'Finary'});
    }else if(at.current_value!=null){
      h=keep.get(r.id)||{id:uid(),months:[],div:0,ter:0,region:'other',sector:'other'};
      const v=finNum(at.current_value);Object.assign(h,{fhid:r.id,fin:1,name:at.name||h.name||t('kind.other'),kind:'other',cur:at.current_value_currency||a.cur,qty:1,price:v,pru:finNum(at.buying_price)||h.pru||v,liveAt:new Date().toISOString(),liveSrc:'Finary'});
    }
    if(h)out.push(h);
  }
  /* lignes saisies à la main (non Finary) conservées, lignes Finary disparues retirées */
  a.holdings=out.concat(a.holdings.filter(h=>!h.fin&&!out.includes(h)&&!(h.isin&&out.some(o=>o.isin===h.isin))));
  a.cash=r2(cash);
}
/* opérations : fenêtre glissante (90 jours la première fois, depuis la dernière synchro − 7 jours ensuite) */
async function finSyncTx(full){
  const F=finSet();const byName=new Map();
  Object.entries(F.map).forEach(([fid,id])=>{if(!id||id[0]==='_')return;const a=D().accounts.find(x=>x.id===id&&x.fid===fid);if(!a||(TYP[a.type]||{}).h)return;const k=norm(a.fname||'');if(!byName.has(k))byName.set(k,[]);byName.get(k).push(a)});
  if(!byName.size)return 0;
  const end=today();const start=full?'2015-01-01':(F.txAt?dAdd(F.txAt,-7):dAdd(end,-90));
  const known=new Set(D().txs.map(x=>x.fid).filter(Boolean));
  let cursor=null,n=0,pages=0;
  do{
    const inp={start_date:start,end_date:end,page_size:200};if(cursor)inp.cursor=cursor;
    const P=await finCall('list_transactions',inp,true);pages++;
    for(const tr of (P.transactions||[])){
      if(known.has(tr.id)||tr.is_excluded||tr.is_unpriced)continue;
      const accs=byName.get(norm(tr.account||''));if(!accs)continue;const a=accs[0];
      const amt=r2(finNum(tr.amount));if(!amt)continue;const d=tr.date;
      /* déjà importée depuis un relevé ? même compte, même montant, à 3 jours près */
      const twin=D().txs.find(x=>x.acc===a.id&&!x.fid&&Math.abs(x.a-amt)<0.005&&Math.abs(daysBetween(x.d,d))<=3);
      if(twin){twin.fid=tr.id;known.add(tr.id);continue}
      D().txs.push({id:uid(),d,a:amt,l:scrubLabel(String(tr.label||'').replace(/\s+Terminé$/,'')),c:finCat(tr),acc:a.id,fid:tr.id});known.add(tr.id);n++;
    }
    cursor=P.next_cursor||null;
  }while(cursor&&pages<40);
  D().txs.sort((x,y)=>y.d.localeCompare(x.d));
  F.txAt=end;return n;
}
function finSoftRender(){const ae=document.activeElement;const typing=ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);if(S.phase==='app'&&!S.ui.ovl&&!typing)render();else{LIVE.pending=true;finPaint()}}
function startFinary(){
  if(FIN.timer||!S.cap.mcp||!S.data||S.demo)return;
  /* la synchronisation automatique attend que les enregistrements en cours soient terminés */
  const go=(n=0)=>{if((saving||saveT)&&n<30){setTimeout(()=>go(n+1),2000);return}finSync()};setTimeout(go,6000);
  FIN.timer=setInterval(()=>{if(document.visibilityState==='visible'&&Date.now()-FIN.at>14*60000)finSync()},60000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-FIN.at>14*60000)finSync()});
}

/* ---------- affichage ---------- */
function finAgo(iso){if(!iso)return '—';const m=Math.round((Date.now()-Date.parse(iso))/60000);if(m<1)return t('fin.now');if(m<60)return t('fin.min',{n:m});const h=Math.round(m/60);if(h<48)return t('fin.h',{n:h});return dateT(iso.slice(0,10))}
function finChip(){
  if(S.demo||!S.data||S.cap.mcp===null)return '';const F=ST().finary;
  const st=FIN.st==='busy'?'busy':FIN.st==='off'?'off':FIN.st==='err'||FIN.st==='auth'?'err':FIN.st==='part'?'part':F&&F.at?'ok':'idle';
  const txt=st==='busy'?t('fin.busy'):st==='off'?t('fin.offS'):FIN.st==='auth'?t('fin.authS'):st==='err'?t('fin.errS'):st==='part'?t('fin.partS'):st==='ok'?t('fin.okS',{t:finAgo(F.at)}):t('fin.idleS');
  return `<button class="finchip ${st}" data-a="finOpen" title="${esc(t('fin.chipT'))}"><i></i><span class="hide-m">${esc(txt)}</span>${ico('refresh')}</button>`;
}
function finPaint(){const el=$('.finchip');if(el){const tmp=document.createElement('div');tmp.innerHTML=finChip();const n=tmp.firstElementChild;if(n)el.replaceWith(n)}if(S.ui.ovl&&S.ui.ovl.k==='fin')renderOvl()}
/* écart entre le patrimoine Vigie et le total Finary */
function finCheck(){
  const F=ST().finary;if(!F||!F.ref||S.demo)return null;
  const synced=D().accounts.filter(a=>a.fid&&a.include!==false&&accCls(a)!=='debt');const gross=sum(synced.map(accGross));
  const others=D().accounts.filter(a=>!a.fid&&a.include!==false&&accCls(a)!=='debt'&&Math.abs(accGross(a))>0.004);
  return {fin:F.ref.gross,vig:gross,diff:gross-F.ref.gross,ok:Math.abs(gross-F.ref.gross)<=Math.max(1,F.ref.gross*0.005),others,at:F.ref.at};
}
function finDrawer(){
  const F=finSet();const C=finCheck();
  const head=`<div class="ph"><div><h2>${esc(t('fin.t'))}</h2><p>${esc(t('fin.sub'))}</p></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>`;
  let out=head;
  const st=FIN.st==='off'?`<div class="demo-band" style="margin:0 0 14px;background:color-mix(in srgb,var(--bad) 10%,var(--surface));border-color:color-mix(in srgb,var(--bad) 40%,var(--line))">${ico('alert')}<div>${esc(t('fin.offP'))}</div></div>`:FIN.st==='auth'?`<div class="demo-band" style="margin:0 0 14px">${ico('lock')}<div><b>${esc(t('fin.authT'))}</b> ${esc(t('fin.authP'))}</div><button class="btn sm" data-a="finSync">${esc(t('fin.authBtn'))}</button></div>`:FIN.st==='err'?`<div class="demo-band" style="margin:0 0 14px">${ico('alert')}<div>${esc(t('fin.errP'))}</div></div>`:'';
  const errD=(FIN.lastErr&&FIN.st!=='ok')||FIN.fails&&FIN.fails.length?`<div class="card flat" style="margin:0 0 14px"><b>${esc(t('fin.diagT'))}</b>${(FIN.fails||[]).map(f=>`<div class="row"><div class="m"><b>${esc(f.name)}</b><span>${esc(t('fin.code.'+f.code)==='fin.code.'+f.code?f.code:t('fin.code.'+f.code))}</span></div></div>`).join('')}${FIN.lastErr?`<p class="note" style="margin:6px 0 0">${esc(t('fin.lastErr',{t:FIN.lastErr.tool,c:FIN.lastErr.code}))}${FIN.lastErr.msg?' — '+esc(FIN.lastErr.msg):''}</p>`:''}</div>`:'';
  out+=st+errD+`<div class="card flat" style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><div class="note">${esc(t('fin.lastSync'))}</div><b>${esc(F.at?finAgo(F.at):t('fin.never'))}</b>${FIN.busy?` <span class="note">· ${esc(t('fin.step.'+(FIN.step||'accounts')))}${FIN.stepName?' — '+esc(FIN.stepName):''}</span>`:''}</div>
    <div class="hrow"><label class="inline note"><input type="checkbox" data-f="finAuto" ${F.auto!==false?'checked':''}> ${esc(t('fin.auto'))}</label><button class="btn sm" data-a="finSync" ${FIN.busy?'disabled':''}>${ico('refresh')}${esc(t(FIN.busy?'fin.busy':'fin.syncNow'))}</button></div></div>`;
  if(C)out+=`<div class="demo-band" style="margin:12px 0 0;${C.ok?'':'background:color-mix(in srgb,var(--warn) 12%,var(--surface));border-color:color-mix(in srgb,var(--warn) 40%,var(--line))'}">${ico(C.ok?'check':'alert')}<div>${esc(C.ok?t('fin.checkOk',{v:moneyT(C.fin,2)}):t('fin.checkKo',{f:moneyT(C.fin,2),v:moneyT(C.vig,2)}))}${C.others.length?`<br><span class="note">${esc(t('fin.others',{n:C.others.length,l:C.others.slice(0,5).map(a=>a.name).join(', ')}))}</span>`:''}</div></div>`;
  const rows=Object.entries(F.map);
  if(!rows.length)return out+`<div class="empty" style="margin-top:16px"><b>${esc(t('fin.emptyT'))}</b>${esc(t('fin.emptyP'))}</div>`;
  out+=`<div class="sec-t" style="margin-top:20px"><h2>${esc(t('fin.mapT'))}</h2><span class="note">${esc(t('fin.mapSub'))}</span></div><div class="list">`;
  const linkedIds=new Set(rows.map(([,v])=>v));
  rows.forEach(([fid,v])=>{
    const a=v&&v[0]!=='_'?D().accounts.find(x=>x.id===v):null;const nm=a?(a.fname||a.name):(F.names&&F.names[fid])||fid.slice(0,8);
    const opts=D().accounts.filter(x=>!x.fid||x.fid===fid).map(x=>`<option value="${x.id}"${x.id===v?' selected':''}>${esc(x.name)} · ${esc(typL(x.type))}</option>`).join('');
    out+=`<div class="row" style="align-items:flex-start;flex-wrap:wrap;gap:10px">${a?accAvatar(a,1):`<span class="av sm">${ico('bank')}</span>`}<div class="m" style="min-width:160px"><b>${esc(a?a.fname||a.name:nm)}</b><span>${esc([a&&a.inst,a&&a.fsync?t('fin.syncedAt',{t:finAgo(a.fsync)}):'',a&&a.fwarn?t('fin.w.'+a.fwarn):''].filter(Boolean).join(' · '))}</span></div>
      <select data-f="finMap" data-v="${fid}" style="width:auto;max-width:100%;min-height:36px" aria-label="${esc(t('fin.mapT'))}">${opts}<option value="__new"${v==='__new'?' selected':''}>${esc(t('imp.newAcc'))}</option><option value="__skip"${v==='__skip'?' selected':''}>${esc(t('fin.ignore'))}</option></select></div>`;
  });
  out+=`</div><p class="note" style="margin-top:12px">${esc(t('fin.note'))}</p>
  <div class="pfoot"><button class="btn ghost" data-a="finFull" ${FIN.busy?'disabled':''}>${ico('download')}${esc(t('fin.full'))}</button><span class="sp"></span><button class="btn" data-a="close">${esc(t('act.close'))}</button></div>`;
  return out;
}

/* changement de correspondance depuis le tiroir */
function finRemap(fid,v){
  const F=finSet();const prev=F.map[fid];
  if(prev&&prev[0]!=='_'){const a=D().accounts.find(x=>x.id===prev);if(a&&a.fid===fid){delete a.fid;delete a.fsync;delete a.fwarn;a.holdings.forEach(h=>{delete h.fin;delete h.fhid;if(h.liveSrc==='Finary'){delete h.liveSrc;delete h.liveAt}})}}
  if(v&&v[0]!=='_'){Object.keys(F.map).forEach(k=>{if(k!==fid&&F.map[k]===v)F.map[k]='__skip'})}
  F.map[fid]=v;save();finSync({manual:true});
}
