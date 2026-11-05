/* ================= V3.2 — assistant documents : relevés, exports CSV multi-comptes, documents fiscaux ================= */
/* état : S.ui.ad = {ctx, busy, name, step, err, res, sel, text} */
const AD_FISCAL_RE=/imp[oô]t sur le revenu|revenu fiscal de r[ée]f[ée]rence|avis d.?imp[oô]t|avis de situation d[ée]clarative|d[ée]claration (des|de) revenus|finances publiques|pr[ée]l[èe]vement [àa] la source|nombre de parts|2042|quotient familial|bofip|code g[ée]n[ée]ral des imp[oô]ts|loi de finances/i;
const ACC_COL_RE=/^(account|account type|account_type|compte|type de compte|portefeuille|portfolio|wallet|enveloppe|sub account|subaccount|depot|konto)$/;

EXT.A.aiDoc=v=>{S.ui.ad={ctx:v||'any'};openOvl({k:'aiDoc'})};
EXT.A.adReset=()=>{S.ui.ad={ctx:(S.ui.ad||{}).ctx||'any'};renderOvl()};
EXT.field.adSel=el=>{const A=S.ui.ad;if(A&&A.sel)A.sel[el.dataset.v]=!!el.checked};
EXT.A.adApply=()=>adApply();
EXT.A.adText=()=>{const el=$('#adTxt');const v=el?el.value.trim():'';if(v.length<8){toast(t('ad.short'),true);return}S.ui.ad.text=v;adFiscal({text:v,name:t('ad.typed')})};
EXT.A.docDel=v=>{const d=D();d.docs=(d.docs||[]).filter(x=>x.id!==v);save();render();renderOvl()};
EXT.A.docOpen=v=>openOvl({k:'docView',id:v});

/* fichiers : écouteurs délégués (le panneau est re-rendu à chaque étape) */
document.addEventListener('change',e=>{if(e.target&&e.target.id==='adFile'){const f=[...(e.target.files||[])];if(f.length)adFiles(f)}});
['dragenter','dragover'].forEach(ev=>document.addEventListener(ev,e=>{const z=e.target&&e.target.closest&&e.target.closest('#adDrop');if(z){e.preventDefault();z.classList.add('on')}}));
['dragleave','drop'].forEach(ev=>document.addEventListener(ev,e=>{const z=e.target&&e.target.closest&&e.target.closest('#adDrop');if(!z)return;e.preventDefault();z.classList.remove('on');if(ev==='drop'){const f=[...((e.dataTransfer&&e.dataTransfer.files)||[])];if(f.length)adFiles(f)}}));

async function readText(f){let text=await f.text();if(/\uFFFD/.test(text)){try{text=new TextDecoder('windows-1252').decode(await f.arrayBuffer())}catch(e){}}return text.replace(/^﻿/,'')}

/* aiguillage : chaque fichier part vers le bon circuit */
async function adFiles(files){
  const A=S.ui.ad||(S.ui.ad={ctx:'any'});
  const bank=[],pf=[];
  for(const f of files){
    A.busy=true;A.name=f.name;A.step=t('ad.reading');A.err=null;renderOvl();
    try{
      if(f.size>15e6)throw {msg:t('imp.tooBig')};
      const isPdf=/\.pdf$/i.test(f.name)||f.type==='application/pdf';const isImg=/^image\//.test(f.type)||/\.(png|jpe?g|webp)$/i.test(f.name);
      if(isImg){A.busy=false;await adFiscal({images:[f],name:f.name});return}
      if(isPdf){
        let r=null;try{r=await readPdf(f,'')}catch(e){if(e&&e.code==='pwd'){bank.push(f);continue}throw e}
        const txt=(r&&r.text)||'';
        if(AD_FISCAL_RE.test(txt.slice(0,20000))||(A.ctx==='tax'&&!(r.ops||[]).length&&!(r.pf&&r.pf.n))){A.busy=false;await adFiscal({text:txt.slice(0,60000),file:f,scanned:(r.chars||0)<80,name:f.name});return}
        if(r.pf&&r.pf.n&&!(r.ops||[]).length)pf.push(f);
        else if(!(r.ops||[]).length&&!r.pf.n&&typeof pdfToItx==='function'&&pdfToItx(r).some(g=>g.kind==='ops'))pf.push(f);
        else bank.push(f);
        continue;
      }
      const text=await readText(f);
      if(/<OFX>|<STMTTRN>/i.test(text)){bank.push(f);continue}
      if(!/[;,\t|]/.test(text.slice(0,2000))&&AD_FISCAL_RE.test(text)){A.busy=false;await adFiscal({text:text.slice(0,60000),name:f.name});return}
      const all=parseCSVText(text,detectDelim(text));if(all.length<2)throw {msg:t('imp.noRows')};
      const header=all[0].map(c=>String(c).trim());const rows=all.slice(1).filter(r=>r.some(c=>String(c).trim()));
      /* export Trade Republic : PEA, compte-titres, crypto et espèces sont séparés automatiquement */
      if(isTrCsv(header)){const st=tiFromCsv(text,f.name);A.busy=false;S.ui.ad=null;startTimport(Object.assign(st,{name:f.name}),[],null);toast(t('ad.trSplit',{n:st.groups.length}));return}
      /* export générique avec une colonne de compte : un groupe par compte */
      const ci=header.findIndex(h=>ACC_COL_RE.test(noAcc(h).replace(/[_-]/g,' ').trim()));
      const vals=ci>-1?[...new Set(rows.map(r=>String(r[ci]||'').trim()).filter(Boolean))]:[];
      const m=guessItxCols(header);const isItx=m.date>-1&&(m.qty>-1||m.isin>-1);
      if(vals.length>=2&&isItx){
        const groups=vals.map(v=>{const rs=rows.filter(r=>String(r[ci]||'').trim()===v);const ty=adGuessType(v);return {key:'g'+norm(v),kind:'ops',type:ty,label:v,ops:parseGenericItx(header,rs,m),cash:[]}}).filter(g=>g.ops.length);
        A.busy=false;S.ui.ad=null;startTimport({src:'split',name:f.name,groups,bank:detectBank(text.slice(0,3000),f.name)},[],null);toast(t('ad.split',{n:groups.length}));return;
      }
      if(vals.length>=2){/* relevé bancaire multi-comptes : un fichier par compte, importés l'un après l'autre */
        const d=detectDelim(text);const q=c=>{const s=String(c??'');return /["\n;,\t]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
        vals.forEach(v=>{const body=[header,...rows.filter(r=>String(r[ci]||'').trim()===v)].map(r=>r.map(q).join(d)).join('\n');bank.push(new File([body],f.name.replace(/\.[a-z]+$/i,'')+' — '+v.replace(/[\\/:*?"<>|]/g,' ')+'.csv',{type:'text/csv'}))});
        toast(t('ad.split',{n:vals.length}));continue;
      }
      if(isItx){pf.push(f);continue}
      bank.push(f);
    }catch(e){A.busy=false;A.err=(e&&e.msg)||t('imp.readErr2',{f:f.name});renderOvl();return}
  }
  A.busy=false;
  if(bank.length){S.ui.ad=null;S.ui.imp={};S.ui.ovl={k:'import'};startImport(bank);if(pf.length)toast(t('ad.pfLater',{n:pf.length}));return}
  if(pf.length){S.ui.ad=null;S.ui.pimp={};S.ui.ovl={k:'pimport'};startPimport(pf);return}
  renderOvl();
}
function adGuessType(v){const n=norm(v);if(/\bpea pme\b/.test(n))return 'peapme';if(/\bpea\b/.test(n))return 'pea';if(/assurance vie|life|\bav\b/.test(n))return 'av';if(/\bper\b|retraite/.test(n))return 'per';if(/crypto|wallet|bitcoin/.test(n))return 'wallet';if(/pee|epargne salariale/.test(n))return 'pee';return 'cto'}

/* ---------- documents fiscaux : lecture par l'IA, proposition de mise à jour, validation ---------- */
const AD_PARAMS={livretA:['rates','livretA'],ldds:['rates','ldds'],lep:['rates','lep'],livretJeune:['rates','livretJeune'],pel:['rates','pel'],cel:['rates','cel'],ps:['tax','ps'],psAV:['tax','psAV'],pfuIR:['tax','ir'],avAbatt:['tax','avAbatt'],avAfter8:['tax','avAfter8']};
async function adFiscal(src){
  const A=S.ui.ad||(S.ui.ad={ctx:'tax'});const sample=S.cap.sample;
  if(!sample){A.err=t('ad.noAi');A.busy=false;renderOvl();return}
  A.busy=true;A.step=t('ad.ai');A.name=src.name;A.err=null;A.res=null;renderOvl();
  const tx=ST().tax,R=ST().rates;
  const ctx={profilActuel:{rattache:tx.attached??null,parts:tx.parts??null,rfr:tx.rfr??null,tauxPAS:tx.pas??null,tmi:tx.tmi??null},parametresActuels:{livretA:R.livretA,ldds:R.ldds,lep:R.lep,pel:R.pel,cel:R.cel,ps:tx.ps,psAV:tx.psAV,pfuIR:tx.ir,avAbatt:tx.avAbatt,avAfter8:tx.avAfter8},dateDuJour:today()};
  const prompt=`Tu es l'assistant fiscal de l'application ${APP.name} (fiscalité française des particuliers). On te transmet un document ou un texte : avis d'impôt, avis de situation déclarative, déclaration de revenus (2042 et annexes), nouvelle règle fiscale (loi de finances, BOFiP, actualité), ou description d'un changement de situation par l'utilisateur.
Réponds uniquement par un objet JSON de cette forme :
{"type":"avis_imposition|declaration_revenus|regle_fiscale|changement_situation|autre","annee_revenus":nombre ou null,"resume":"3 phrases maximum, en français","profil":{"rattache":true|false|null,"parts":nombre ou null,"rfr":nombre ou null,"tauxPAS":nombre ou null,"tmi":nombre ou null,"impotNet":nombre ou null,"situation":"célibataire|marié|pacsé|divorcé|veuf|null"},"revenus":[{"nature":"salaires|chomage|pensions|bic|bnc|micro|dividendes|interets|plusValues|foncier|autre","libelle":"texte","montant":nombre,"case":"1AJ ou null"}],"regles":[{"parametre":"livretA|ldds|lep|livretJeune|pel|cel|ps|psAV|pfuIR|avAbatt|avAfter8|autre","valeur":nombre ou null,"dateEffet":"AAAA-MM-JJ ou null","libelle":"texte court"}],"alertes":["texte court"]}
Règles strictes : n'invente rien ; mets null ou une liste vide quand l'information est absente. Taux en pourcentage (17.2 pour 17,2 %), montants en euros. "rattache" ne vaut true que si le document ou l'utilisateur indique clairement un rattachement au foyer fiscal des parents. "tmi" est la tranche marginale (0, 11, 30, 41 ou 45) si elle est indiquée ou se déduit sans ambiguïté du barème applicable à l'année des revenus. Ne recopie aucun numéro fiscal, numéro d'accès en ligne, référence d'avis, adresse ni IBAN. Signale dans "alertes" toute incohérence ou tout point à vérifier.
Contexte actuel dans l'application : ${JSON.stringify(ctx)}`+(src.text?`\n\nTEXTE :\n${src.text}`:'');
  try{
    const opts={modelTier:'default'};
    if(src.images)opts.images=src.images;
    else if(src.file&&src.scanned){let lim=null;try{lim=await sample.limits()}catch(e){}if(!lim||!lim.images)throw {code:'no_images'};opts.images=await pdfImages(src.file,4,'')}
    const j=await sample.json(prompt,opts);
    if(!j||typeof j!=='object')throw {code:'empty'};
    A.res=adNormalize(j);A.sel={};A.res.changes.forEach((c,i)=>A.sel[i]=c.def);
  }catch(e){const c=e&&e.code;A.err=t(c==='not_granted'?'cp.denied':c==='rate_limited'?'cp.rate':c==='no_images'?'imp.aiNoImg':'ad.fail')}
  A.busy=false;renderOvl();
}
function adNormalize(j){
  const num=v=>v===null||v===undefined||v===''||!isFinite(+v)?null:+v;const P=j.profil||{};const tx=ST().tax;const ch=[];
  const add=(path,label,val,fmt,def=true)=>{const [g,k]=path;const cur=g==='rates'?ST().rates[k]:tx[k];if(val==null||val===cur)return;ch.push({g,k,label,from:cur,to:val,fmt,def})};
  if(typeof P.rattache==='boolean')add(['tax','attached'],t('tp.attached'),P.rattache,'bool');
  add(['tax','parts'],t('tp.parts'),num(P.parts),'num');add(['tax','rfr'],t('tp.rfr'),num(P.rfr),'eur');add(['tax','pas'],t('tp.pas'),num(P.tauxPAS),'pct');
  const tmi=num(P.tmi);add(['tax','tmi'],t('tp.tmi'),[0,11,30,41,45].includes(tmi)?tmi:null,'pct');
  (Array.isArray(j.regles)?j.regles:[]).forEach(r=>{const m=AD_PARAMS[r.parametre];const v=num(r.valeur);if(m&&v!=null&&v>=0&&v<=(m[0]==='rates'||/^ps|ir$/.test(m[1])?60:1e6))add(m,t('ad.p.'+r.parametre)+(r.dateEffet?' · '+t('ad.from',{d:dateT(r.dateEffet)}):''),v,m[1]==='avAbatt'?'eur':'pct',!r.dateEffet||r.dateEffet<=today())});
  const rev=(Array.isArray(j.revenus)?j.revenus:[]).map(r=>({n:String(r.nature||'autre'),l:scrubLabel(String(r.libelle||'')).slice(0,80),a:num(r.montant),c:r.case?String(r.case).slice(0,6).toUpperCase():''})).filter(r=>r.a!=null);
  const other=(Array.isArray(j.regles)?j.regles:[]).filter(r=>!AD_PARAMS[r.parametre]).map(r=>String(r.libelle||'').slice(0,160)).filter(Boolean);
  return {type:['avis_imposition','declaration_revenus','regle_fiscale','changement_situation'].includes(j.type)?j.type:'autre',year:num(j.annee_revenus),sum:String(j.resume||'').slice(0,600),impot:num(P.impotNet),sit:P.situation&&P.situation!=='null'?String(P.situation).slice(0,20):'',rev,other,alerts:(Array.isArray(j.alertes)?j.alertes:[]).map(x=>String(x).slice(0,200)).slice(0,6),changes:ch};
}
function adFmt(c,v){if(v==null)return '—';if(c.fmt==='bool')return v?t('tp.yes'):t('tp.no');if(c.fmt==='eur')return moneyT(v,0);if(c.fmt==='pct')return numT(v,2).replace(/[.,]00$/,'')+' %';return numT(v,2).replace(/[.,]00$/,'')}
function adApply(){
  const A=S.ui.ad;if(!A||!A.res)return;const s=ST();let n=0;
  A.res.changes.forEach((c,i)=>{if(!A.sel[i])return;if(c.g==='rates'){s.rates[c.k]=c.to;s.ratesUser=s.ratesUser||{};s.ratesUser[c.k]=1}else s.tax[c.k]=c.to;n++});
  const d=D();d.docs=d.docs||[];
  d.docs.unshift({id:uid(),at:today(),name:String(A.name||'').slice(0,80),type:A.res.type,year:A.res.year,sum:A.res.sum,impot:A.res.impot,rev:A.res.rev.slice(0,30),applied:A.res.changes.filter((c,i)=>A.sel[i]).map(c=>c.label+' : '+adFmt(c,c.to))});
  if(d.docs.length>40)d.docs.length=40;
  if(['avis_imposition','declaration_revenus'].includes(A.res.type)){s.tax.docAt=today();s.tax.docName=String(A.name||'').slice(0,60)}
  save();S.ui.ad={ctx:A.ctx,done:n};render();renderOvl();toast(t('ad.applied',{n}));
}
EXT.boot.push(d=>{if(!Array.isArray(d.docs))d.docs=[]});

/* ---------- panneau ---------- */
EXT.ovl.aiDoc=()=>{
  const A=S.ui.ad||(S.ui.ad={ctx:'any'});const ai=!!S.cap.sample;
  let body='';
  if(A.busy)body=`<div class="empty" style="border-style:solid"><span class="spin"></span><b>${esc(A.step||t('ad.reading'))}</b>${esc(A.name||'')}</div>`;
  else if(A.res){const R=A.res;
    body=`<div class="card flat"><div class="eyebrow">${esc(t('ad.t.'+R.type))}${R.year?' · '+esc(t('ad.year',{y:R.year})):''}</div><p style="margin:6px 0 0;line-height:1.55">${esc(R.sum||t('ad.noSum'))}</p>${R.impot!=null?`<p class="note" style="margin:8px 0 0">${esc(t('ad.impot',{v:moneyT(R.impot,0)}))}</p>`:''}</div>
    ${R.alerts.length?`<div class="demo-band" style="margin:12px 0 0">${ico('alert')}<div>${R.alerts.map(esc).join('<br>')}</div></div>`:''}
    <div class="sec-t" style="margin-top:16px"><h2>${esc(t('ad.changes'))}</h2></div>
    ${R.changes.length?`<div class="list">${R.changes.map((c,i)=>`<label class="row adch"><input type="checkbox" ${A.sel[i]?'checked':''} data-f="adSel" data-v="${i}"><div class="m"><b>${esc(c.label)}</b><span>${esc(adFmt(c,c.from))} → <b>${esc(adFmt(c,c.to))}</b>${c.def?'':' · '+esc(t('ad.future'))}</span></div></label>`).join('')}</div>`:`<p class="note">${esc(t('ad.noChange'))}</p>`}
    ${R.rev.length?`<div class="sec-t" style="margin-top:16px"><h2>${esc(t('ad.rev'))}</h2></div><div class="tw"><table class="tbl sm"><thead><tr><th>${esc(t('ad.nat'))}</th><th>${esc(t('ad.box'))}</th><th>${esc(t('f.amount'))}</th></tr></thead><tbody>${R.rev.map(r=>`<tr><td>${esc(r.l||t('ad.n.'+r.n))}</td><td>${esc(r.c||'—')}</td><td><b>${esc(moneyT(r.a,0))}</b></td></tr>`).join('')}</tbody></table></div>`:''}
    ${R.other.length?`<div class="sec-t" style="margin-top:16px"><h2>${esc(t('ad.other'))}</h2></div><ul class="rules">${R.other.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
    <p class="note" style="margin-top:14px">${esc(t('ad.verify'))}</p>
    <div class="pfoot"><button class="btn ghost" data-a="adReset">${esc(t('act.cancel'))}</button><span class="sp"></span><button class="btn" data-a="adApply">${ico('check')}${esc(t('ad.apply'))}</button></div>`}
  else body=`${A.done!=null?`<div class="demo-band" style="margin:0 0 12px">${ico('check')}<div>${esc(t('ad.applied',{n:A.done}))}</div></div>`:''}${A.err?`<div class="demo-band" style="margin:0 0 12px;border-color:var(--bad)">${ico('alert')}<div>${esc(A.err)}</div></div>`:''}
    <label class="drop" id="adDrop">${ico('upload')}<b>${esc(t('ad.drop'))}</b><span class="note">${esc(t('ad.formats'))}</span><input type="file" id="adFile" multiple accept=".pdf,.csv,.txt,.ofx,.qfx,.png,.jpg,.jpeg,.webp,application/pdf,text/csv,image/*"></label>
    <div class="adkinds">${[['budget','ad.k1'],['bars','ad.k2'],['tax','ad.k3'],['edit','ad.k4']].map(([i,k])=>`<div>${ico(i)}<span>${esc(t(k))}</span></div>`).join('')}</div>
    <div class="f full" style="margin-top:14px"><label for="adTxt">${esc(t('ad.txtL'))}</label><textarea id="adTxt" rows="3" placeholder="${esc(t('ad.txtPh'))}" ${ai?'':'disabled'}>${esc(A.text||'')}</textarea><div class="hrow" style="justify-content:flex-end;margin-top:8px"><button class="btn sec sm" data-a="adText" ${ai?'':'disabled'}>${ico('spark')}${esc(t('ad.analyse'))}</button></div>${ai?'':`<span class="hint">${esc(t('ad.noAi'))}</span>`}</div>
    ${docsList(5)}`;
  return {html:`<div class="ph"><div><h2>${esc(t('ad.title'))}</h2><p>${esc(t('ad.sub'))}</p></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>${body}`,wide:true};
};
function docsList(n){const L=(D().docs||[]).slice(0,n||40);if(!L.length)return '';
  return `<div class="sec-t" style="margin-top:18px"><h2>${esc(t('ad.hist'))}</h2></div><div class="list">${L.map(x=>`<div class="row"><span class="av sm" style="--c:var(--k6)">${ico(x.type==='regle_fiscale'?'book':'tax')}</span><div class="m"><b>${esc(x.name||t('ad.t.'+x.type))}</b><span>${esc(t('ad.t.'+x.type))}${x.year?' · '+esc(t('ad.year',{y:x.year})):''} · ${esc(dateT(x.at))}</span></div><div class="r"><button class="link" data-a="docOpen" data-v="${x.id}">${esc(t('ad.see'))}</button></div></div>`).join('')}</div>`}
EXT.ovl.docView=o=>{const x=(D().docs||[]).find(d=>d.id===o.id);if(!x)return {html:''};
  return {html:`<div class="ph"><div><div class="eyebrow">${esc(t('ad.t.'+x.type))}${x.year?' · '+esc(t('ad.year',{y:x.year})):''}</div><h2>${esc(x.name||'')}</h2><p>${esc(t('ad.added',{d:dateT(x.at)}))}</p></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  <p style="line-height:1.55">${esc(x.sum||'')}</p>${x.impot!=null?`<p class="note">${esc(t('ad.impot',{v:moneyT(x.impot,0)}))}</p>`:''}
  ${x.rev&&x.rev.length?`<div class="sec-t"><h2>${esc(t('ad.rev'))}</h2></div><div class="tw"><table class="tbl sm"><tbody>${x.rev.map(r=>`<tr><td>${esc(r.l||t('ad.n.'+r.n))}</td><td>${esc(r.c||'—')}</td><td><b>${esc(moneyT(r.a,0))}</b></td></tr>`).join('')}</tbody></table></div>`:''}
  ${x.applied&&x.applied.length?`<div class="sec-t" style="margin-top:14px"><h2>${esc(t('ad.appliedT'))}</h2></div><ul class="rules">${x.applied.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`:''}
  <div class="pfoot"><button class="btn ghost" data-a="docDel" data-v="${x.id}">${ico('trash')}${esc(t('act.delete'))}</button><span class="sp"></span><button class="btn" data-a="close">${esc(t('act.close'))}</button></div>`}};

/* points d'entrée : Fiscalité, Copilote, menu « Ajouter » */
const _tpc=taxProfileCard;taxProfileCard=function(){const L=D().docs||[];return _tpc()+(L.length?`<div class="card" style="margin-bottom:16px"><div class="ch"><div><h2>${esc(t('ad.histT'))}</h2><p>${esc(t('ad.histS'))}</p></div><button class="btn sec sm" data-a="aiDoc" data-v="tax">${ico('upload')}${esc(t('ad.add'))}</button></div>${docsList(40).replace(/^<div class="sec-t"[^>]*>.*?<\/div>/,'')}</div>`:'')};
const _cpv=copilotView;copilotView=function(){const h=_cpv();if(S.cap.sample===null)return h;return `<div class="demo-band adband" style="margin:0 0 16px">${ico('upload')}<div><b>${esc(t('ad.cpT'))}</b> ${esc(t('ad.cpS'))}</div><button class="btn sm" data-a="aiDoc" data-v="any">${esc(t('ad.cpBtn'))}</button></div>`+h};
const _qm=quickMenu;quickMenu=function(){return _qm().replace('</div>',`<button role="menuitem" data-a="aiDoc" data-v="any">${ico('spark')}${esc(t('ad.title'))}</button></div>`)};
/* le copilote connaît le profil fiscal, les documents analysés, les enveloppes et les sous-catégories */
const _cpc=copilotContext;copilotContext=function(){const c=_cpc();const tx=ST().tax;
  c.taxProfile={attachedToParents:tx.attached??null,parts:tx.parts??null,rfr:tx.rfr??null,withholdingRate:tx.pas??null,marginalRate:tx.tmi??null,peaCaps:D().accounts.filter(a=>a.type==='pea').map(a=>({name:a.name,cap:accCap(a),paid:accPaid(a)}))};
  c.taxDocs=(D().docs||[]).slice(0,5).map(d=>({type:d.type,year:d.year,summary:d.sum,applied:d.applied}));
  c.wrappers=envList().map(e=>({wrapper:t('env.'+e.k),value:Math.round(envVal(e.k)),accounts:envAccs(e.k).map(a=>a.name)}));
  try{const ym=today().slice(0,7);const m=ymAdd(ym,-1);const cs=catSpend(monthTx(m));c.lastMonthSubcategories=Object.entries(cs).sort((a,b)=>b[1].v-a[1].v).slice(0,6).map(([k,e])=>({cat:catL(k),total:Math.round(e.v),subs:Object.entries(e.subs).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([s,v])=>subL(k,s)+':'+Math.round(v))}))}catch(e){}
  try{c.scheduledInvestments=dcaDetect().map(x=>({account:x.a.name,name:x.name,monthly:x.plan,day:x.day}))}catch(e){}
  return c};
/* état des enregistrements */
EXT.A.saveInfo=()=>openOvl({k:'saveInfo'});
EXT.A.saveRetry=()=>{SAVE.tries=0;closeOvl();flush()};
EXT.ovl.saveInfo=()=>{const err=SAVE.st==='err';const finWait=FIN&&FIN.busy;
  return {html:`<div class="ph"><div><h2>${esc(t(err?'sv.errT':'sv.busy'))}</h2><p>${esc(t('sv.sub'))}</p></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  ${err?`<div class="card flat"><div class="wkv"><div><span>${esc(t('sv.doc'))}</span><b>${esc(SAVE.doc||'—')}</b></div><div><span>${esc(t('sv.code'))}</span><b>${esc(SAVE.code||'—')}</b></div></div>${SAVE.msg?`<p class="note" style="margin:10px 0 0">${esc(SAVE.msg)}</p>`:''}</div>`:''}
  <p class="note" style="margin-top:12px">${esc(t(SAVE.code==='timeout'||finWait?'sv.hintWait':SAVE.code==='quota_exceeded'?'err.quota':'sv.hint'))}</p>
  <div class="pfoot"><button class="btn ghost" data-a="close">${esc(t('act.close'))}</button><span class="sp"></span><button class="btn" data-a="saveRetry">${ico('refresh')}${esc(t('sv.retry'))}</button></div>`}};
