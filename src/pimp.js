/* ================= import de relevés de portefeuille (positions) ================= */
/* état : S.ui.pimp = {queue, lockAcc, busy, res:{groups,date,bank,pages,chars,text}, tgt:{gi:accId|'__new'|'__skip'}, nname:{gi}, ntype:{gi}, off:{key:1}, rm:{gi:bool}, cash:{gi:bool}, pwd, file, ai} */
function pfAccounts(kind){return D().accounts.filter(a=>kind==='cash'?(accCls(a)==='cash'||accCls(a)==='savings'||(TYP[a.type]||{}).h):(TYP[a.type]||{}).h)}
const pfRoot=s=>String(s||'').toUpperCase().replace(/^[A-Z]+:/,'').split('.')[0];
function pfMatch(a,p){
  const H=a.holdings;const nn=norm(p.name);
  return (p.isin&&H.find(h=>h.isin&&h.isin.toUpperCase()===p.isin))
    ||(p.sym&&H.find(h=>(h.ticker&&pfRoot(h.ticker)===pfRoot(p.sym))||(h.gsym&&pfRoot(h.gsym)===pfRoot(p.sym))))
    ||H.find(h=>norm(h.name)===nn)
    ||(nn.length>=8&&H.find(h=>{const x=norm(h.name);return x.length>=8&&(x.includes(nn)||nn.includes(x))}))
    ||(p.fe&&H.find(h=>h.kind==='fe'))||null;
}
function pfKind(p,g){
  const n=noAcc(p.name||'');
  if(p.crypto||g.type==='wallet')return 'crypto';
  if(p.fe||/fonds? (en )?euros?|fonds euro|actif general|euro.?croissance/.test(n))return 'fe';
  if(/scpi/.test(n))return 'scpi';
  if(/\betf\b|ucits|msci|s&p|stoxx|cac 40|nasdaq|\((acc|dist|c|d)\)|amundi|ishares|lyxor|xtrackers|vanguard|spdr|tracker|physical gold|\betc\b|\bpea\b.*eur/.test(n))return 'etf';
  if(/sicav|\bfcp\b|\bfund\b|fonds|opcvm|invest\b/.test(n)||(p.isin&&/^(LU|IE)/.test(p.isin)&&(g.type==='av'||g.type==='per')))return 'fund';
  if(/obligation|\bbonds?\b|\boat\b/.test(n))return 'bond';
  return 'stock';
}
function pfRegion(p,kind){
  const n=noAcc(p.name||'');
  if(kind==='etf'||kind==='fund'){if(/emerg|emergent|\bem\b/.test(n))return 'em';if(/s&p|usa|\bus\b|nasdaq|amerique/.test(n))return 'us';if(/cac|france/.test(n))return 'france';if(/europe|stoxx|euro\b|eurozone/.test(n))return 'europe';if(/asia|asie|japan|japon|china|chine/.test(n))return 'asia';return 'world'}
  if(kind==='fe')return 'europe';if(kind==='crypto')return 'world';
  const c=(p.isin||'').slice(0,2)||((p.sym||'').split('.')[1]||'');
  if(c==='US')return 'us';if(c==='FR')return 'france';if(/^(DE|NL|BE|IT|ES|IE|LU|AT|FI|PT|UK|GB|CH|DK|SE|NO)$/.test(c))return 'europe';if(/^(JP|HK|CN|KR|TW|SG)$/.test(c))return 'asia';return 'other';
}
/* compte cible pressenti pour chaque groupe du relevé */
function pfGuess(g,gi,R,I){
  const bank=norm(R.bank||'').split(' ')[0];
  if(g.kind==='cash'){
    const acc=pfAccounts('cash').filter(a=>accCls(a)==='cash'||accCls(a)==='savings');
    const sc=a=>(bank&&norm(a.inst+' '+a.name).includes(bank)?3:0)+(/cash|espece|liquidit/.test(norm(a.name))?1:0);
    const b=acc.map(a=>({a,s:sc(a)})).sort((x,y)=>y.s-x.s)[0];
    if(b&&b.s>=3)return b.a.id;
    const inv=Object.values(I.tgt||{}).find(v=>v&&v[0]!=='_');return inv||'__skip';
  }
  if(I.lockAcc&&gi===I.lockGi)return I.lockAcc;
  const acc=pfAccounts('pos').filter(a=>a.id!==I.lockAcc||I.lockGi==null);if(!acc.length)return '__new';
  const sc=a=>{let s=0;const ov=g.positions.filter(p=>pfMatch(a,p)).length;if(a.type===g.type)s+=3;const bk=norm(a.inst+' '+a.name);if(bank&&bk.includes(bank))s+=2;else if(bank&&a.inst&&!ov)s-=3;s+=Math.min(5,ov);return s};
  const b=acc.map(a=>({a,s:sc(a)})).sort((x,y)=>y.s-x.s)[0];
  const used=Object.entries(I.tgt||{}).filter(([k])=>+k!==gi).map(([,v])=>v);
  if(b&&(b.s>=4||(b.s>=3&&acc.filter(a=>a.type===g.type).length===1))&&!used.includes(b.a.id))return b.a.id;
  return '__new';
}
function pfInit(I){
  const R=I.res;I.tgt={};I.nname={};I.ntype={};I.off={};I.rm={};I.cash={};I.lockGi=null;
  /* compte imposé (import lancé depuis un compte) : la section qui lui ressemble le plus */
  const la=I.lockAcc&&D().accounts.find(a=>a.id===I.lockAcc);
  if(la){let best=-1,bs=-1;R.groups.forEach((g,gi)=>{if(g.kind!=='pos')return;const s=(g.type===la.type?3:0)+g.positions.filter(p=>pfMatch(la,p)).length*2;if(s>bs){bs=s;best=gi}});if(best>-1)I.lockGi=best}
  R.groups.forEach((g,gi)=>{I.tgt[gi]=pfGuess(g,gi,R,I);I.ntype[gi]=g.kind==='cash'?'checking':(TYP[g.type]?g.type:'cto');
    I.nname[gi]=((R.bank?R.bank+' ':'')+(g.kind==='cash'?t('pi.cashName'):typL(I.ntype[gi]))).slice(0,40);
    I.rm[gi]=!!(g.check&&g.check.ok&&g.mode!=='delta');I.cash[gi]=g.cash!=null});
}
/* aperçu d'un groupe : correspondances avec le compte cible */
function pfRows(gi){
  const I=S.ui.pimp;const g=I.res.groups[gi];const tgt=I.tgt[gi];
  const a=tgt&&tgt[0]!=='_'?D().accounts.find(x=>x.id===tgt):null;const fx=ST().fx;
  const delta=g.mode==='delta';const seen=new Set();
  const rows=g.positions.map((p,pi)=>{
    const h=a&&(TYP[a.type]||{}).h?pfMatch(a,p):null;if(h)seen.add(h.id);
    let st='new';
    if(delta)st=p.qty>=0?'buy':'sell';
    else if(h){const hp=+h.price||0,px=p.price*((fx[p.cur]??1)/(fx[h.cur||a.cur]??1));st=Math.abs((+h.qty||0)-p.qty)>1e-7?'upd':Math.abs(hp-px)>Math.max(0.005,px*0.0005)?'px':'same'}
    const key=gi+'|'+pi;return {p,h,st,key,on:!I.off[key]&&st!=='same'};
  });
  const absent=!delta&&a&&(TYP[a.type]||{}).h?a.holdings.filter(h=>!seen.has(h.id)&&(+h.qty||0)>0):[];
  return {g,a,rows,absent,delta};
}
function pfCounts(){
  const I=S.ui.pimp;let n=0,add=0,rm=0,cash=0;
  I.res.groups.forEach((g,gi)=>{if(I.tgt[gi]==='__skip'||!I.tgt[gi])return;if(g.kind==='cash'){if(I.cash[gi]&&g.cash!=null)cash++;return}
    const pr=pfRows(gi);pr.rows.forEach(r=>{if(r.on){n++;if(r.st==='new')add++}});if(I.rm[gi])rm+=pr.absent.length;if(I.cash[gi]&&g.cash!=null)cash++});
  return {n,add,rm,cash,total:n+rm+cash};
}

/* ---------- lecture des fichiers ---------- */
function startPimport(files){
  files=[...(files||[])].filter(Boolean);if(!files.length)return;
  const keep=S.ui.pimp||{};S.ui.pimp={queue:files,lockAcc:keep.lockAcc};nextPimport();
}
async function nextPimport(f){
  const I=S.ui.pimp;if(!I)return;
  if(!f){f=I.queue.shift();I.pwd=''}
  if(!f){S.ui.ovl=null;S.ui.pimp=null;render();return}
  if(f.size>15e6){I.err=t('imp.tooBig');I.res=null;renderOvl();return}
  const isPdf=/\.pdf$/i.test(f.name)||f.type==='application/pdf';
  if(!isPdf&&!/\.(csv|txt)$/i.test(f.name)){I.err=t('pi.pdfOnly');I.res=null;renderOvl();return}
  I.busy=true;I.busyName=f.name;I.res=null;I.err=null;I.ai=false;I.needPwd=null;I.file=f;I.name=f.name;renderOvl();
  try{
    /* CSV : export de transactions (Trade Republic ou colonnes génériques) */
    if(!isPdf){let text=await f.text();if(/\uFFFD/.test(text)){try{text=new TextDecoder('windows-1252').decode(await f.arrayBuffer())}catch(e){}}text=text.replace(/^\uFEFF/,'');
      const st=tiFromCsv(text,f.name);if(!st)throw {msg:t('ti.csvUnknown')};
      I.busy=false;startTimport(Object.assign(st,{name:f.name}),I.queue,I.lockAcc);S.ui.pimp=null;return}
    const r=await readPdf(f,I.pwd);
    /* relevé de compte sans positions mais avec des achats/ventes : import de transactions */
    if(!r.pf.n){const G=pdfToItx(r);if(G.some(g=>g.kind==='ops')){I.busy=false;startTimport({src:'pdf',name:f.name,groups:G,bank:r.bank},I.queue,I.lockAcc);S.ui.pimp=null;return}}
    I.res={groups:r.pf.groups,date:r.pf.date||(r.period&&r.period.to)||today(),bank:r.bank,pages:r.pages,chars:r.chars,text:r.text,period:r.period};
    pfInit(I);
  }catch(e){
    if(e&&e.code==='pwd'){I.needPwd={bad:e.bad}}
    else I.err=e&&e.msg?e.msg:t(String(e&&e.message)==='script'?'imp.pdfLoad':'imp.readErr2',{f:f.name});
  }
  I.busy=false;renderOvl();
}
/* ---------- application au patrimoine ---------- */
function doPimport(){
  const I=S.ui.pimp;if(!I||!I.res)return;const R=I.res;const fx=ST().fx;const date=R.date||today();
  let n=0,touched=new Set();
  R.groups.forEach((g,gi)=>{
    let tgt=I.tgt[gi];if(!tgt||tgt==='__skip')return;
    const pr=pfRows(gi);
    if(tgt==='__new'){
      const type=I.ntype[gi]||(g.kind==='cash'?'checking':'cto');const ty=TYP[type]||{};
      const a={id:uid(),name:(I.nname[gi]||'').trim()||typL(type),inst:R.bank||'',type,cur:ST().cur,balance:0,cash:0,holdings:[],include:true,createdAt:today(),updatedAt:today()};
      if(!ty.h)delete a.cash;D().accounts.push(a);tgt=a.id;I.tgt[gi]=a.id;
      /* les lignes pointent vers le nouveau compte : toutes sont des créations */
      pr.a=a;pr.rows.forEach(r=>{r.h=null;if(!pr.delta)r.st='new';r.on=!I.off[r.key]});pr.absent=[];
    }
    const a=D().accounts.find(x=>x.id===tgt);if(!a)return;const ty=TYP[a.type]||{};
    if(g.kind!=='cash'&&ty.h){
      pr.rows.forEach(r=>{if(!r.on)return;const p=r.p;
        const toH=h=>p.price*((fx[p.cur]??1)/(fx[h.cur||a.cur]??1));
        let h=r.h||(pr.delta?pfMatch(a,p):null);
        if(!h){if(pr.delta&&p.qty<=0)return;
          const kind=pfKind(p,g);
          h={id:uid(),name:p.name||p.sym||p.isin,isin:p.isin||'',ticker:p.sym?pfRoot(p.sym):'',gsym:'',kind,cur:p.cur||a.cur,qty:p.qty,price:p.price,pru:p.pru!=null?p.pru:p.price,ter:0,div:0,region:pfRegion(p,kind),sector:kind==='stock'?'other':'diversified',months:[],src:'pdf'};
          if(p.pru==null)h.pruEst=1;a.holdings.push(h);n++;return}
        const old=+h.qty||0,px=toH(h);
        if(pr.delta){const q=+(old+p.qty).toFixed(8);if(p.qty>0&&q>0)h.pru=+(((old*(+h.pru||0))+p.qty*px)/q).toFixed(4);
          if(q<=1e-9){a.holdings=a.holdings.filter(x=>x.id!==h.id)}else{h.qty=q;if(p.price>0)h.price=+px.toFixed(px<1?6:4)}n++;return}
        if(p.pru!=null)h.pru=+(p.pru*((fx[p.cur]??1)/(fx[h.cur||a.cur]??1))).toFixed(4);
        else if(p.qty>old&&old>=0&&px>0){h.pru=+(((old*(+h.pru||0))+(p.qty-old)*px)/p.qty).toFixed(4);h.pruEst=1}
        h.qty=p.qty;if(p.price>0)h.price=+px.toFixed(px<1?6:4);if(!h.isin&&p.isin)h.isin=p.isin;if(!h.ticker&&p.sym)h.ticker=pfRoot(p.sym);n++});
      if(I.rm[gi]&&pr.absent.length){const ids=new Set(pr.absent.map(h=>h.id));a.holdings=a.holdings.filter(h=>!ids.has(h.id));n+=ids.size}
    }
    if(I.cash[gi]&&g.cash!=null){if(ty.h)a.cash=g.cash;else{a.balance=g.cash;a.balAt=date}n++}
    a.updatedAt=today();a.pfAt=date;touched.add(a.id);
  });
  save();toast(t('pi.done',{n,a:touched.size}));syncLive();
  if(I.queue&&I.queue.length){nextPimport();render();return}
  const ids=[...touched];S.ui.pimp=null;
  if(ids.length===1){S.ui.ovl={k:'acc',id:ids[0]};render()}else{S.ui.ovl=null;S.ui.view='invest';render()}
}
/* ---------- lecture par Claude (relevé atypique, scanné ou avis d'opéré) ---------- */
async function pimportAi(){
  const I=S.ui.pimp;const sample=S.cap.sample;if(!I||!I.file||!sample||I.ai)return;
  I.ai=true;renderOvl();
  const scanned=!I.res||(I.res.chars||0)<80;
  const prompt='Tu lis un relevé de portefeuille financier (compte-titres, PEA, assurance-vie, PER, crypto…), souvent en français.\nRéponds uniquement par un objet JSON de cette forme :\n{"etablissement":"nom ou null","date":"AAAA-MM-JJ (date de valorisation)","mode":"positions","groupes":[{"nom":"intitulé de la section","type":"pea|peapme|cto|av|per|wallet|cash","especes":nombre ou null,"total":nombre ou null,"positions":[{"nom":"texte","isin":"code ou null","symbole":"ticker ou null","quantite":nombre,"cours":nombre,"valeur":nombre,"pru":nombre ou null,"devise":"EUR"}]}]}\nRègles : une entrée par ligne détenue à la date du relevé ; quantite = nombre de parts ou de titres ; cours = prix unitaire dans la devise de cotation ; valeur = valorisation de la ligne ; pru = prix de revient unitaire s’il figure. Pour un fonds en euros sans parts, quantite = montant et cours = 1. Les espèces / liquidités vont dans "especes". Un document à plusieurs enveloppes (ex. compte-titres + PEA) donne plusieurs groupes. Si le document est un avis d’opéré ou une confirmation d’ordre (et non un relevé de positions), mets "mode":"mouvements" : quantite positive pour un achat, négative pour une vente, cours = prix d’exécution. Ignore les historiques de positions clôturées et les opérations de trésorerie. N’invente aucune ligne. Ne recopie aucun numéro de compte.'+(scanned?'':'\n\nTexte du relevé :\n'+I.res.text.replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g,'[IBAN]').replace(/\b\d{9,}\b/g,'[n°]').slice(0,120000));
  try{
    const opts={modelTier:'default'};
    if(scanned){let lim=null;try{lim=await sample.limits()}catch(e){}if(!lim||!lim.images)throw {code:'no_images'};opts.images=await pdfImages(I.file,4,I.pwd)}
    const j=await sample.json(prompt,opts);
    const num=v=>v!==null&&v!==undefined&&v!==''&&isFinite(+v)?+v:null;
    const delta=j&&/mouvement/.test(String(j.mode||''));
    const groups=(j&&Array.isArray(j.groupes)?j.groupes:[]).map(g=>{
      const type=TYP[g.type]&&TYP[g.type].h?g.type:(g.type==='cash'?'cash':'cto');
      const positions=(Array.isArray(g.positions)?g.positions:[]).map(p=>{const isin=String(p.isin||'').toUpperCase().replace(/\s/g,'');const q=num(p.quantite),px=num(p.cours),v=num(p.valeur);
        const P={name:String(p.nom||'').trim().slice(0,80),isin:isinOk(isin)?isin:null,sym:p.symbole?String(p.symbole).toUpperCase().slice(0,12):null,qty:q,price:px!=null?px:(v!=null&&q?v/q:null),value:v,pru:num(p.pru),cur:/^[A-Z]{3}$/.test(p.devise||'')?p.devise:'EUR',cost:null};
        if(P.price==null&&P.value!=null&&!q){P.qty=P.value;P.price=1;P.fe=true}
        P.crypto=type==='wallet'||!!(P.sym&&CRYPTO_SYM.test(P.sym));if(P.value==null&&P.qty!=null&&P.price!=null)P.value=r2(P.qty*P.price);return P})
        .filter(p=>(p.name||p.isin||p.sym)&&isFinite(p.qty)&&p.qty!==0&&(delta||p.qty>0)&&isFinite(p.price)&&p.price>=0);
      const kind=type==='cash'?'cash':'pos';
      const G={title:String(g.nom||'').slice(0,60),type:kind==='cash'?'cash':type,kind,positions:kind==='cash'?[]:positions,cash:num(g.especes),total:num(g.total),mode:delta?'delta':'pos'};
      G.sum=r2(sum(G.positions.map(p=>p.value||0)));G.check=!delta&&G.total!=null&&G.positions.length?{ok:Math.abs(G.sum-G.total)<=Math.max(0.05,G.total*0.002),total:G.total,sum:G.sum}:null;return G})
      .filter(g=>g.positions.length||g.cash!=null);
    if(!groups.length)throw {code:'empty'};
    I.res=Object.assign({},I.res||{pages:0,chars:80,text:''},{groups,date:parseDate(j.date)||(I.res&&I.res.date)||today(),bank:(I.res&&I.res.bank)||j.etablissement||'',ai:true,delta});
    pfInit(I);
  }catch(e){const c=e&&e.code;toast(t(c==='not_granted'?'cp.denied':c==='rate_limited'?'cp.rate':c==='no_images'?'imp.aiNoImg':'imp.aiFail'),true)}
  I.ai=false;renderOvl();
}

/* ---------- tiroir ---------- */
function pimportDrawer(){
  const I=S.ui.pimp||{};const lock=I.lockAcc&&D().accounts.find(a=>a.id===I.lockAcc);
  const head=`<div class="ph"><div><h2>${esc(t('pi.t'))}</h2><p>${esc(t('pi.sub'))}</p></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>`;
  if(I.busy)return head+`<div class="empty" style="border-style:solid"><b>${esc(t('imp.reading',{f:I.busyName||''}))}</b>${esc(t('pi.readingP'))}</div>`;
  const fileCard=()=>`<div class="card flat" style="margin-bottom:14px"><div class="hrow" style="justify-content:space-between"><div class="hrow" style="gap:8px;min-width:0">${ico('receipt')}<b style="overflow-wrap:anywhere">${esc(I.name||'')}</b>${I.queue&&I.queue.length?`<span class="pill acc">${esc(t('imp.queue',{n:I.queue.length}))}</span>`:''}</div><button class="link" data-a="pfReset">${esc(t('imp.other'))}</button></div></div>`;
  if(I.needPwd)return head+fileCard()+`<form class="card flat" data-form="pfPwd" style="display:grid;gap:10px"><div class="hrow" style="gap:8px">${ico('lock')}<b>${esc(t('pi.pwdT'))}</b></div><p class="note" style="margin:0">${esc(t('pi.pwdP'))}</p>
    <div class="form" style="margin:0"><div class="f full"><label for="pf-pwd">${esc(t('pi.pwdL'))}</label><input id="pf-pwd" name="pwd" type="password" autocomplete="off" required></div></div>
    ${I.needPwd.bad?`<p class="bad" style="margin:0;font-size:13px">${esc(t('pi.pwdBad'))}</p>`:''}<div class="hrow" style="justify-content:flex-end"><button class="btn">${ico('check')}${esc(t('pi.pwdGo'))}</button></div></form>`;
  if(!I.res)return head+`${lock?`<div class="card flat" style="margin-bottom:14px;display:flex;gap:12px;align-items:center">${accAvatar(lock,1)}<div><div class="note">${esc(t('imp.into'))}</div><b>${esc(lock.name)}</b></div></div>`:''}
    <label class="drop" id="pfDrop">${ico('upload')}<b>${esc(t('pi.drop'))}</b><span class="note">${esc(t('pi.formats'))}</span><input type="file" id="pfFile" multiple accept=".pdf,.csv,.txt,application/pdf,text/csv"></label>
    <div class="card flat" style="margin-top:16px"><h2 style="font-size:14px;margin-bottom:8px">${esc(t('imp.howT'))}</h2><p class="note" style="margin:0">${esc(t('pi.howP'))}</p></div>
    ${I.err?`<p class="bad" style="margin-top:12px">${esc(I.err)}</p>`:''}`;
  const R=I.res;const npos=sum(R.groups.map(g=>g.positions.length));
  const facts=[[t('imp.bank'),R.bank||t('imp.bankUnknown')],[t('pi.date'),R.date?dateT(R.date):'—'],[t('pi.nPos'),String(npos)]];
  let out=head+fileCard()+`<div class="pff">${facts.map(([l,v])=>`<div class="card flat" style="padding:12px"><div class="note">${esc(l)}</div><b>${esc(v)}</b></div>`).join('')}</div>`;
  if(R.ai)out+=`<p class="note" style="margin:10px 0 0">${ico('copilot')} ${esc(t(R.delta?'pi.aiDelta':'pi.aiDone'))}</p>`;
  const anyKo=R.groups.some(g=>g.check&&!g.check.ok);
  if(!R.groups.length||anyKo||(R.chars||0)<80){out+=`<div class="card flat" style="margin-top:12px"><b>${esc(t(!R.groups.length?((R.chars||0)<80?'imp.scanT':'pi.noneT'):'pi.koT'))}</b><p class="note" style="margin:4px 0 10px">${esc(t(!R.groups.length?'pi.noneP':'pi.koP'))}</p>${S.cap.sample?`<button class="btn sec sm" data-a="pfAi" ${I.ai?'disabled':''}>${ico('copilot')}${esc(t(I.ai?'imp.aiBusy':'imp.aiGo'))}</button>`:`<span class="note">${esc(t('imp.aiOff'))}</span>`}</div>`}
  else if(S.cap.sample&&!R.ai)out+=`<p class="note" style="margin:10px 0 0">${esc(t('pi.aiHint'))} <button class="link" data-a="pfAi" ${I.ai?'disabled':''}>${esc(t(I.ai?'imp.aiBusy':'pi.aiLink'))}</button></p>`;
  const stL={new:t('pi.st.new'),upd:t('pi.st.upd'),px:t('pi.st.px'),same:t('pi.st.same'),buy:t('pi.st.buy'),sell:t('pi.st.sell')};
  const stC={new:'acc',upd:'warn',px:'',same:'',buy:'good',sell:'bad'};
  R.groups.forEach((g,gi)=>{
    const tgt=I.tgt[gi];const isCash=g.kind==='cash';const accs=pfAccounts(isCash?'cash':'pos');
    const typeOpts=isCash?['checking','savingsOther']:TYPES.filter(x=>x.h).map(x=>x.k);
    const sel=`<select id="pf-acc-${gi}" data-f="pfAcc" data-v="${gi}" aria-label="${esc(t('f.account'))}">${accs.map(a=>`<option value="${a.id}"${a.id===tgt?' selected':''}>${esc(a.name)} · ${esc(typL(a.type))}</option>`).join('')}<option value="__new"${tgt==='__new'?' selected':''}>${esc(t('imp.newAcc'))}</option><option value="__skip"${tgt==='__skip'?' selected':''}>${esc(t('pi.skipGroup'))}</option></select>`;
    const newF=tgt==='__new'?`<div class="form" style="margin-top:10px"><div class="f"><label for="pf-nn-${gi}">${esc(t('imp.newName'))}</label><input id="pf-nn-${gi}" data-f="pfNewName" data-v="${gi}" value="${esc(I.nname[gi]||'')}"></div><div class="f"><label for="pf-nt-${gi}">${esc(t('f.type'))}</label><select id="pf-nt-${gi}" data-f="pfNewType" data-v="${gi}">${typeOpts.map(k=>`<option value="${k}"${k===I.ntype[gi]?' selected':''}>${esc(typL(k))}</option>`).join('')}</select></div></div>`:'';
    const title=g.title?(g.title===g.title.toUpperCase()?g.title.charAt(0)+g.title.slice(1).toLowerCase():g.title):(isCash?t('pi.cashName'):typL(g.type));
    out+=`<section class="card flat pfg" style="margin-top:16px"><div class="hrow" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><div class="hrow" style="gap:8px;min-width:0">${ico(isCash?'cash':g.type==='wallet'?'crypto':'bars')}<b>${esc(title)}</b>${!isCash?`<span class="pill">${esc(t('pi.nLines',{n:g.positions.length}))}</span>`:''}${g.mode==='delta'?`<span class="pill acc">${esc(t('pi.deltaPill'))}</span>`:''}</div>
      ${g.check?`<span class="pill ${g.check.ok?'good':'warn'}">${ico(g.check.ok?'check':'alert')}${esc(g.check.ok?t('pi.chkOk',{v:moneyT(g.check.total)}):t('pi.chkKo',{d:moneyT(Math.abs(g.check.total-g.check.sum))}))}</span>`:''}</div>
      <div class="form" style="margin-top:10px"><div class="f full"><label for="pf-acc-${gi}">${esc(t(isCash?'pi.cashInto':'pi.into'))}</label>${sel}${newF}</div></div>`;
    if(tgt==='__skip'){out+=`<p class="note" style="margin:8px 0 0">${esc(t('pi.skipped'))}</p></section>`;return}
    if(isCash){out+=`<label class="inline note" style="margin-top:10px"><input type="checkbox" data-f="pfCash" data-v="${gi}" ${I.cash[gi]?'checked':''}> ${esc(t('pi.cashUpd',{v:moneyT(g.cash),d:dateT(R.date)}))}</label></section>`;return}
    const pr=pfRows(gi);
    out+=`<div class="prev" style="margin-top:10px"><table><thead><tr><th></th><th>${esc(t('inv.colName'))}</th><th>${esc(t('f.qty'))}</th><th>${esc(t('f.price'))}</th><th>${esc(t('inv.value'))}</th><th>${esc(t('pi.status'))}</th></tr></thead><tbody>${pr.rows.map(r=>{const p=r.p;const oq=r.h?+r.h.qty||0:null;
      const qtyCell=r.st==='upd'?`<span class="note">${esc(qtyT(oq))} →</span> <b>${esc(qtyT(p.qty))}</b>`:pr.delta?`<b class="${p.qty>0?'good':'bad'}">${p.qty>0?'+':''}${esc(qtyT(p.qty))}</b>`:esc(qtyT(p.qty));
      return `<tr class="${r.st==='same'?'same':r.on?'':'dup'}"><td><input type="checkbox" data-f="pfRow" data-v="${esc(r.key)}" ${r.on?'checked':''} ${r.st==='same'?'disabled':''} aria-label="${esc(t('pi.include'))}"></td><td style="min-width:0;white-space:normal"><b>${esc(p.name)}</b><div class="note" style="font-size:12px">${esc([p.isin,p.sym&&p.sym!==p.name?p.sym:'',r.h&&norm(r.h.name)!==norm(p.name)?'↔ '+r.h.name:''].filter(Boolean).join(' · '))}</div><span class="pill pfst ${stC[r.st]}">${esc(stL[r.st])}</span></td><td>${qtyCell}</td><td>${esc(moneyT(p.price,p.price<10?4:2,p.cur))}</td><td>${esc(moneyT(p.value!=null?p.value:p.qty*p.price,2,p.vcur||p.cur))}</td><td><span class="pill ${stC[r.st]}">${esc(stL[r.st])}</span></td></tr>`}).join('')}</tbody></table></div>`;
    if(pr.rows.some(r=>r.on&&r.p.pru==null&&(r.st==='new'||r.st==='upd')))out+=`<p class="note" style="margin:8px 0 0;font-size:12.5px">${esc(t('pi.pruNote'))}</p>`;
    if(pr.absent.length)out+=`<label class="inline note" style="margin-top:10px;align-items:flex-start"><input type="checkbox" data-f="pfRm" data-v="${gi}" ${I.rm[gi]?'checked':''}> <span>${esc(t('pi.absent',{n:pr.absent.length}))} <span class="faint">${esc(pr.absent.slice(0,6).map(h=>h.name).join(', ')+(pr.absent.length>6?'…':''))}</span></span></label>`;
    if(g.cash!=null)out+=`<label class="inline note" style="margin-top:8px"><input type="checkbox" data-f="pfCash" data-v="${gi}" ${I.cash[gi]?'checked':''}> ${esc(t('pi.cashUpd',{v:moneyT(g.cash),d:dateT(R.date)}))}</label>`;
    out+=`</section>`;
  });
  const c=pfCounts();
  out+=`<div class="pfoot"><button class="btn ghost" data-a="${I.queue&&I.queue.length?'pfSkip':'close'}">${esc(t(I.queue&&I.queue.length?'imp.skip':'act.cancel'))}</button><span class="note" style="align-self:center;font-size:13px">${esc(t('pi.summary',{n:c.n,a:c.add,r:c.rm}))}</span><button class="btn" data-a="pfGo" ${c.total?'':'disabled'}>${ico('check')}${esc(t('pi.go'))}</button></div>`;
  return out;
}
