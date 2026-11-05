/* ================= V3.1 — fiscalité : revenus perçus, plus-values réalisées, profil fiscal, PEA jeune ================= */
/* plafond d'une enveloppe : un PEA ouvert par un jeune rattaché au foyer fiscal de ses parents est un PEA « jeunes » (20 000 €) */
function accCap(a){const ty=TYP[a.type]||{};if(a.type==='pea'&&(a.young||(ST().tax&&ST().tax.attached)))return 20000;return ty.cap||0}
function accPaid(a){const ops=iopsOf(a.id);if(ops.some(o=>o.t==='dep'||o.t==='wd'))return sum(ops.filter(o=>o.t==='dep').map(iopNet))-sum(ops.filter(o=>o.t==='wd').map(o=>-iopNet(o)));return null}
/* prélèvements sociaux applicables aux revenus mobiliers d'une année (hausse de la CSG au 1er janvier 2026) */
const psYear=y=>+y>=2026?18.6:17.2;

/* revenus de placement perçus pendant une année civile, par compte */
function taxReceived(y){
  const rows=new Map();const row=a=>{if(!rows.has(a.id))rows.set(a.id,{a,div:0,int:0,cpn:0,real:0,env:(TYP[a.type]||{}).env||''});return rows.get(a.id)};
  D().accounts.forEach(a=>{const ty=TYP[a.type]||{};if(!ty.h)return;const ops=iopsOf(a.id);if(!ops.length)return;
    ops.forEach(o=>{if(o.d.slice(0,4)!==String(y))return;if(o.t==='div')row(a).div+=conv(iopNet(o),o.cur||a.cur);else if(o.t==='int')row(a).int+=conv(iopNet(o),o.cur||a.cur)});
    /* plus-values réalisées de l'année : coût moyen pondéré, frais inclus */
    const P={};[...ops].sort((x,z)=>x.d.localeCompare(z.d)||(x.s||0)-(z.s||0)).forEach(o=>{const k=o.isin||norm(o.n||'')||o.sym;if(!k)return;const p=P[k]=P[k]||{q:0,c:0};const q=Math.abs(+o.q||0);
      if(o.t==='buy'||o.t==='in'){p.q+=q;p.c+=Math.abs(+o.amt||0)+(+o.fee||0)+(+o.tax||0)}
      else if((o.t==='sell'||o.t==='out')&&p.q>0){const part=Math.min(1,q/p.q),cost=p.c*part;if(o.t==='sell'&&o.d.slice(0,4)===String(y))row(a).real+=conv(iopNet(o)-cost,o.cur||a.cur);p.q-=Math.min(q,p.q);p.c-=cost}})});
  /* intérêts et dividendes crédités sur des comptes sans historique de portefeuille (ex. intérêts des espèces Trade Republic) */
  const iDiv=(D().iops||[]).filter(o=>(o.t==='div'||o.t==='int')&&o.d.slice(0,4)===String(y));
  D().txs.forEach(x=>{if(x.d.slice(0,4)!==String(y)||x.c!=='investIncome'||!(x.a>0))return;const a=D().accounts.find(z=>z.id===x.acc);if(!a||(TYP[a.type]||{}).h&&iopsOf(a.id).length)return;
    /* déjà compté dans l'historique d'une enveloppe (dividende du compte-titres versé sur le compte espèces) */
    if(iDiv.some(o=>Math.abs(iopNet(o)-x.a)<0.011&&Math.abs(daysBetween(o.d,x.d))<=5))return;
    const r=row(a);if(/interest|int[eé]r[eê]ts?|zins|r[eé]mun/i.test(x.l))r.int+=x.a;else if(/dividend|coupon|distribution|aussch/i.test(x.l))r.div+=x.a;else{r.other=(r.other||0)+x.a}});
  /* livrets : intérêts estimés de l'année (versés au 31 décembre) */
  D().accounts.forEach(a=>{const ty=TYP[a.type]||{};if(ty.env==='exempt'||ty.env==='pel'){const rate=(+a.rate)||ST().rates[ty.rate]||0;const it=accGross(a)*rate/100;if(it>0.004){const r=row(a);r.int+=it;r.est=true}}});
  return [...rows.values()].filter(r=>Math.abs(r.div)+Math.abs(r.int)+Math.abs(r.real)+Math.abs(r.other||0)>0.004);
}
function taxTreat(r){
  /* où et comment chaque revenu est imposé */
  if(r.env==='pea')return 'pea';if(r.env==='av'||r.env==='per'||r.env==='pee')return 'wrap';if(r.env==='exempt')return 'exempt';if(r.env==='pel')return 'pel';return 'pfu';
}
function taxReceivedCard(){
  const tx=ST().tax;const yNow=+today().slice(0,4);const y=+(S.ui.taxY||yNow);const R=taxReceived(y);const ps=psYear(y)/100;const ir=(tx.ir||12.8)/100;
  const pfuRows=R.filter(r=>taxTreat(r)==='pfu'),pelRows=R.filter(r=>taxTreat(r)==='pel');
  const div=sum(pfuRows.map(r=>r.div)),int=sum(pfuRows.map(r=>r.int))+sum(pelRows.map(r=>r.int)),real=sum(pfuRows.map(r=>r.real));
  const base=div+int+Math.max(0,real);
  const taxPfu=base*(ir+ps);const taxBar=(div*0.6+int+Math.max(0,real))*(tx.tmi/100)+base*ps;
  const lbl={pfu:t('tf.t.pfu'),pea:t('tf.t.pea'),wrap:t('tf.t.wrap'),exempt:t('tf.t.exempt'),pel:t('tf.t.pel')};
  const yrs=[yNow,yNow-1,yNow-2];
  const att=tx.attached;
  return `<div class="card" style="margin-bottom:16px"><div class="ch"><div><h2>${esc(t('tf.t',{y}))}</h2><p>${esc(t('tf.s',{y1:y+1}))}</p></div><div class="act">${seg('taxY',yrs.map(v=>[String(v),String(v)]),String(y),t('tf.year'))}</div></div>
  ${!R.length?`<p class="note">${esc(t('tf.none',{y}))}</p>`:`<div class="kpis k4" style="box-shadow:none;margin-bottom:12px">${kpi(t('tf.k.div'),money(div,2),t('tf.k.divS'))}${kpi(t('tf.k.int'),money(int,2),t('tf.k.intS'))}${kpi(t('tf.k.real'),`<span class="${cls(real)}">${moneyS(real,2)}</span>`,real<0?t('tf.k.realL'):t('tf.k.realS'))}${kpi(t('tf.k.tax'),money(Math.min(taxPfu,tx.mode==='bareme'?taxBar:taxPfu),0),tx.mode==='bareme'?t('tf.k.taxB',{p:tx.tmi}):t('tf.k.taxP',{p:numT((ir+ps)*100,1)}))}</div>
  <div class="tw cards"><table class="tbl"><thead><tr><th>${esc(t('f.account'))}</th><th>${esc(t('tf.c.div'))}</th><th>${esc(t('tf.c.int'))}</th><th>${esc(t('tf.c.real'))}</th><th>${esc(t('tf.c.treat'))}</th></tr></thead><tbody>${R.map(r=>`<tr class="click" data-a="acc" data-v="${r.a.id}"><td><b>${esc(r.a.name)}</b></td><td data-l="${esc(t('tf.c.div'))}">${r.div?esc(moneyT(r.div,2)):'—'}</td><td data-l="${esc(t('tf.c.int'))}">${r.int?esc(moneyT(r.int,2))+(r.est?` <span class="muted">${esc(t('w.est'))}</span>`:''):'—'}</td><td data-l="${esc(t('tf.c.real'))}" class="${cls(r.real)}">${r.real?moneyS(r.real,2):'—'}</td><td data-l="${esc(t('tf.c.treat'))}"><span class="muted">${esc(lbl[taxTreat(r)])}${r.other?' · '+esc(t('tf.other',{v:moneyT(r.other,2)})):''}</span></td></tr>`).join('')}</tbody></table></div>
  <div class="grid g2" style="margin-top:12px"><div class="card flat"><b>${esc(t('tf.boxT',{y1:y+1}))}</b><div class="list" style="margin-top:6px">
    ${div>0?`<div class="row"><div class="m"><b>2DC</b><span>${esc(t('tf.b.2dc'))}</span></div><div class="r"><b>${esc(moneyT(div,0))}</b></div></div>`:''}
    ${int>0?`<div class="row"><div class="m"><b>2TR</b><span>${esc(t('tf.b.2tr'))}</span></div><div class="r"><b>${esc(moneyT(int,0))}</b></div></div>`:''}
    ${real>0?`<div class="row"><div class="m"><b>3VG</b><span>${esc(t('tf.b.3vg'))}</span></div><div class="r"><b>${esc(moneyT(real,0))}</b></div></div>`:''}
    ${real<0?`<div class="row"><div class="m"><b>3VH</b><span>${esc(t('tf.b.3vh'))}</span></div><div class="r"><b>${esc(moneyT(-real,0))}</b></div></div>`:''}
    <div class="row"><div class="m"><b>2CK</b><span>${esc(t('tf.b.2ck'))}</span></div><div class="r"><b>${esc(moneyT((div+int)*ir,0))}</b></div></div>
    ${D().accounts.some(a=>a.foreign)?`<div class="row"><div class="m"><b>3916</b><span>${esc(t('tf.b.3916'))}</span></div></div>`:''}
  </div></div><div class="card flat"><b>${esc(t('tf.cmpT'))}</b><div class="list" style="margin-top:6px"><div class="row"><div class="m"><b>${esc(t('tf.cmp.pfu',{p:numT((ir+ps)*100,1)}))}</b></div><div class="r"><b>${esc(moneyT(taxPfu,0))}</b></div></div><div class="row"><div class="m"><b>${esc(t('tf.cmp.bar',{p:tx.tmi}))}</b><span>${esc(t('tf.cmp.barS'))}</span></div><div class="r"><b>${esc(moneyT(taxBar,0))}</b></div></div></div><p class="note" style="margin:8px 0 0">${esc(t(taxBar<taxPfu?'tf.cmp.better':'tf.cmp.keep'))}</p></div></div>`}
  <p class="note" style="margin-top:10px">${esc(t('tf.note',{p:numT(psYear(y),1)}))}${att?' '+esc(t('tf.attached')):''}</p></div>`;
}
EXT.A.taxY=v=>{S.ui.taxY=+v;render()};

/* profil fiscal : rattachement, parts, revenu fiscal de référence, taux de prélèvement à la source */
function taxProfileCard(){
  const tx=ST().tax;
  const f=(k,l,v,step='1',suf='')=>`<div class="f"><label for="tp-${k}">${esc(l)}${suf?` <span class="faint">(${esc(suf)})</span>`:''}</label><input id="tp-${k}" type="number" step="${step}" data-f="taxp" data-v="${k}" value="${v??''}"></div>`;
  return `<div class="card" style="margin-bottom:16px"><div class="ch"><div><h2>${esc(t('tp.t'))}</h2><p>${esc(t('tp.s'))}</p></div><button class="btn sec sm" data-a="aiDoc" data-v="tax">${ico('upload')}${esc(t('tp.import'))}</button></div>
  ${tx.attached==null?`<div class="demo-band" style="margin:0 0 12px">${ico('info')}<div>${esc(t('tp.askAtt'))}</div><button class="btn sm" data-a="taxAtt" data-v="1">${esc(t('tp.yes'))}</button><button class="btn sec sm" data-a="taxAtt" data-v="0">${esc(t('tp.no'))}</button></div>`:''}
  <div class="form"><div class="f full"><label class="inline"><input type="checkbox" data-f="taxAttached" ${tx.attached?'checked':''}> ${esc(t('tp.attached'))}</label></div>
  ${f('parts',t('tp.parts'),tx.parts,'0.25')}${f('rfr',t('tp.rfr'),tx.rfr,'1','€')}${f('pas',t('tp.pas'),tx.pas,'0.1','%')}${f('tmi',t('tp.tmi'),tx.tmi,'1','%')}</div>
  ${tx.attached?`<p class="note" style="margin-top:8px">${esc(t('tp.attNote'))}</p>`:''}${tx.docAt?`<p class="note">${esc(t('tp.docAt',{d:dateT(tx.docAt),n:tx.docName||''}))}</p>`:''}</div>`;
}
EXT.A.taxAtt=v=>{ST().tax.attached=v==='1';save();render()};
EXT.field.taxAttached=(el,v)=>{ST().tax.attached=!!v;save();render()};
EXT.field.taxp=(el,v,later)=>{const n=+String(v).replace(',','.');ST().tax[el.dataset.v]=isFinite(n)&&v!==''?n:null;save();later(render)};

/* PEA jeune sur la fiche du compte */
EXT.accForm.push((k,ty,a,f)=>k==='pea'?`<div class="f full"><label class="inline"><input type="checkbox" name="young" ${a.young||(!a.id&&ST().tax&&ST().tax.attached)?'checked':''}> ${esc(t('pj2.young'))}</label></div>`:'');
EXT.accSave.push((fd,o)=>{if(o.type==='pea')o.young=!!fd.get('young')});
EXT.accDrawer.push(a=>{if(a.type!=='pea'&&a.type!=='peapme')return '';const cap=accCap(a);const paid=accPaid(a);const used=paid!=null?paid:sum(a.holdings.map(h=>hCost(h,a)));const p=cap?used/cap:0;
  return `<div class="card flat" style="margin-bottom:16px"><div class="hrow" style="justify-content:space-between"><b>${esc(t(cap===20000?'pj2.capY':'pj2.cap'))}</b><span class="muted">${esc(moneyT(used,0))} / ${esc(moneyT(cap,0))}</span></div><div class="bar${p>1?' over':''}" style="margin-top:8px"><i style="width:${(clamp(p,0,1)*100).toFixed(1)}%"></i></div><p class="note" style="margin:8px 0 0">${esc(t(cap===20000?'pj2.noteY':'pj2.note',{r:moneyT(Math.max(0,cap-used),0)}))}</p></div>`});
