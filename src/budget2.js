/* ================= V3.2 — budget approfondi : sous-catégories et analyses ================= */
/* reconnaissance enrichie (appliquée aux imports futurs et, au démarrage, aux opérations restées « à catégoriser » ou « autres revenus » sans choix manuel) */
const KW2=[
 [/\b(ordre de vente|sell trade|vente de titres|ordre d achat|buy trade|achat de titres|round up|arrondi|saveback|savings plan)\b/,'saving','saving'],
 [/\b(recharge sur apple pay|recharge sur google pay|recharge reference from|from investment account|top up|rechargez)\b/,'transfer','transfer'],
 [/\b(virement avec fortuneo|to eur pro|from eur pro|vers le compte d investissement)\b/,'transfer','transfer'],
 [/\brevolut digital assets\b/,'saving','transfer'],
 [/\bincoming transfer from (xtb|interactive brokers|degiro|boursorama|bourse direct|saxo)\b/,null,'transfer'],
 [/\b(paiement envoye par trade republic|trade republic bank)\b/,'transfer','transfer'],
 [/\b(youtubepremium|youtube premium|youtubepremiu|amz digital|apple com|itunes)\b/,'subscriptions','refunds'],
 [/\b(ann carte|annulation|remboursement achat)\b/,null,'refunds'],
 [/\b(ebuyclub|igraal|poulpeo|cashback|joko|amazon media eu)\b/,null,'refunds'],
 [/\b(temu|aliexpress|shein|wish)\b/,'shopping','refunds'],
 [/\b(crypto com|coinstop|binance|coinbase|kraken|bitpanda|gomining|bitstack|paymium)\b/,'saving','investIncome'],
 [/\b(francaise des jeux|fdj|betclic|winamax|unibet|parions sport|pmu)\b/,'leisure','otherIn']
];
KW.unshift(...KW2);
const BANKS_RE=/\b(qonto|revolut|fortuneo|boursobank|boursorama|hello bank|trade republic|n26|lydia|sumeria|paypal|shine|lcl|bnp|societe generale|credit agricole|caisse d epargne|banque populaire|credit mutuel|la banque postale)\b/;
function selfTok(d){return (((d||D()).settings||{}).selfNames||[]).map(s=>norm(s).split(' ').filter(w=>w.length>1)).filter(a=>a.length>=2)}
function recat2(x,d){d=d||D();const n=' '+norm(x.l)+' ';const r=(d.rules||[]).find(z=>z.p&&n.includes(' '+norm(z.p)));if(r)return null;
  const sel=selfTok(d);if(sel.length){const self=sel.some(a=>a.every(w=>n.includes(' '+w+' ')));const first=sel.some(a=>n.includes(' '+a[0]+' ')||n.includes(' '+a[a.length-1]+' '));
    if(self||(first&&(BANKS_RE.test(n)||x.a<0)&&/\b(to|vers|a|transfer|virement|vir)\b/.test(n)))return {c:'transfer'};
    const sur=new Set(sel.flatMap(a=>a));const fam=x.a>0&&[...sur].some(w=>w.length>3&&n.includes(' '+w+' '))&&!self;if(fam)return {c:'otherIn',s:'family'}}
  for(const [re,d,c] of KW2){if(re.test(n)){const k=x.a<0?d:c;if(k)return {c:k}}}
  return null}
function labelCatStrong(l,a,d){const n=' '+norm(l)+' ';const r=((d||D()).rules||[]).find(z=>z.p&&n.includes(' '+norm(z.p)));if(r)return r.c;for(const [re,dd,c] of KW2.slice(0,1)){if(re.test(n))return a<0?dd:c}return ''}
EXT.boot.push(d=>{(d.txs||[]).forEach(x=>{if(!x.mc&&x.fid&&x.c!=='saving'){const st=labelCatStrong(x.l,x.a,d);if(st&&st!==x.c){x.c=st;x.ac=1}}if(x.mc||!(x.c==='uncat'||x.c==='otherIn'))return;if(x.c==='otherIn'&&x.s)return;const r=recat2(x,d);if(r&&(r.c!==x.c||r.s)){x.c=r.c;if(r.s)x.s=r.s;x.ac=1}})});
const SUBS={salary:['pay','bonus','intern','freelance'],benefits:['caf','aah','grant','unemp','sick'],investIncome:['div','int','sale','crypto'],refunds:['health','purchase','people'],otherIn:['family','gift','games','resale','misc'],
 housing:['rent','charges','mortgage','furnish'],groceries:['super','market','organic','grocery'],restaurants:['resto','fastfood','delivery','bar','bakery'],transport:['public','ride','fuel','parking','micro','train'],
 utilities:['energy','water','internet'],subscriptions:['phone','video','music','software','cloud','press'],shopping:['clothes','tech','home','beauty','books','online'],leisure:['cinema','games','sport','outing','culture','betting'],
 travel:['flight','lodging','rental','activities'],health:['pharmacy','doctor','dental','other'],education:['tuition','supplies','training'],insurance:['home','health','car','other'],taxes:['income','property','fines'],
 fees:['bank','card','commission'],gifts:['gifts','charity'],cashout:['atm'],pets:['food','vet'],otherOut:['misc'],saving:['livret','stocks','lifeins','crypto','vault'],transfer:['internal']};
const SUBKW=[
 [/\b(ordre de vente|sell trade|ordre d achat|buy trade|round up|arrondi|saveback|savings plan|versement pea)\b/,'saving','stocks'],
 [/\b(prime|bonus|interessement|participation)\b/,'salary','bonus'],[/\b(stage|gratification|apprenti)\b/,'salary','intern'],[/\b(malt|freelance|facture|honoraires|urssaf auto)\b/,'salary','freelance'],
 [/\b(caf|apl|allocation logement|prime d activite)\b/,'benefits','caf'],[/\baah\b|mdph/,'benefits','aah'],[/\b(crous|bourse)\b/,'benefits','grant'],[/\b(france travail|pole emploi|chomage|are)\b/,'benefits','unemp'],[/\b(indemnites journalieres|\bij\b|cpam ij)\b/,'benefits','sick'],
 [/\b(dividend|dividende|distribution|coupon)\b/,'investIncome','div'],[/\b(interest|interet|interets|remuneration)\b/,'investIncome','int'],[/\b(vente|sell|cession)\b/,'investIncome','sale'],[/\b(gomining|minage|staking|mining|crypto)\b/,'investIncome','crypto'],
 [/\b(cpam|ameli|mutuelle|pharma)\b/,'refunds','health'],[/\b(amazon|fnac|zalando|refund|avoir|retour)\b/,'refunds','purchase'],
 [/\b(fdj|francaise des jeux|betclic|winamax|unibet|pmu|parions sport|pokerstars)\b/,'otherIn','games'],[/\b(vinted|leboncoin|ebay)\b/,'otherIn','resale'],[/\b(cadeau|anniversaire|noel|don de)\b/,'otherIn','gift'],
 [/\b(loyer|rent|bailleur|agence immo)\b/,'housing','rent'],[/\b(syndic|charges copro|charges locatives)\b/,'housing','charges'],[/\b(pret immo|credit immo|echeance pret)\b/,'housing','mortgage'],[/\b(ikea|leroy merlin|castorama|but\b|conforama|maisons du monde)\b/,'housing','furnish'],
 [/\b(carrefour|leclerc|auchan|lidl|aldi|intermarche|super u|hyper u|casino|monoprix|franprix|cora|match|netto)\b/,'groceries','super'],[/\b(marche|primeur|grand frais|boucherie|fromagerie)\b/,'groceries','market'],[/\b(biocoop|naturalia|la vie claire|bio c bon)\b/,'groceries','organic'],[/\b(epicerie|picard|g20|carrefour city|proxi|spar)\b/,'groceries','grocery'],
 [/\b(uber eats|deliveroo|just eat|frichti)\b/,'restaurants','delivery'],[/\b(mcdonald|mcdo|burger king|kfc|quick|subway|five guys|o tacos|tacos|kebab)\b/,'restaurants','fastfood'],[/\b(starbucks|cafe|bar|brasserie|pub)\b/,'restaurants','bar'],[/\b(boulangerie|paul|patisserie|marie blachere)\b/,'restaurants','bakery'],[/\b(restaurant|resto|sushi|pizza|bistro|creperie)\b/,'restaurants','resto'],
 [/\b(ratp|navigo|ile de france mobilites|tcl|rtm|tisseo|tram|bus|metro)\b/,'transport','public'],[/\b(uber|bolt|heetch|g7|taxi|marcel)\b/,'transport','ride'],[/\b(essence|carburant|total|shell|esso|bp|station|avia)\b/,'transport','fuel'],[/\b(parking|peage|autoroute|indigo|saemes)\b/,'transport','parking'],[/\b(velib|lime|dott|tier|voi|cityscoot)\b/,'transport','micro'],[/\b(sncf|ouigo|tgv|trainline|blablacar)\b/,'transport','train'],
 [/\b(edf|engie|totalenergies|ekwateur|octopus|gaz|electricite)\b/,'utilities','energy'],[/\b(eau|veolia|suez|saur)\b/,'utilities','water'],[/\b(freebox|livebox|bbox|box|fibre|internet)\b/,'utilities','internet'],
 [/\b(free mobile|sfr|orange|bouygues|sosh|red by sfr|b and you|lebara|forfait)\b/,'subscriptions','phone'],[/\b(netflix|disney|canal|prime video|max|paramount|crunchyroll|youtube premium|youtubepremiu|molotov)\b/,'subscriptions','video'],[/\b(spotify|deezer|apple music|tidal|qobuz)\b/,'subscriptions','music'],[/\b(chatgpt|openai|anthropic|claude|microsoft|adobe|notion|canva|github|google workspace)\b/,'subscriptions','software'],[/\b(icloud|apple com bill|google one|dropbox|onedrive)\b/,'subscriptions','cloud'],[/\b(le monde|figaro|mediapart|liberation|kiosque|journal|magazine)\b/,'subscriptions','press'],
 [/\b(zara|h m|uniqlo|kiabi|celio|jules|primark|nike|adidas|zalando|vinted|shein|asos)\b/,'shopping','clothes'],[/\b(apple store|fnac|darty|boulanger|ldlc|materiel net|samsung|backmarket)\b/,'shopping','tech'],[/\b(sephora|nocibe|yves rocher|marionnaud)\b/,'shopping','beauty'],[/\b(librairie|gibert|cultura|dalloz|lgdj|lexisnexis)\b/,'shopping','books'],[/\b(amazon|cdiscount|aliexpress|temu|ebay)\b/,'shopping','online'],[/\b(action|gifi|hema|maisons du monde)\b/,'shopping','home'],
 [/\b(cinema|ugc|pathe|mk2|gaumont|concert|theatre|fnac spectacles|ticketmaster|billetreduc)\b/,'leisure','cinema'],[/\b(steam|playstation|psn|nintendo|xbox|epic games|riot|blizzard|g2a)\b/,'leisure','games'],[/\b(basic fit|fitness park|neoness|salle de sport|decathlon|club)\b/,'leisure','sport'],[/\b(musee|exposition|louvre|monument|bibliotheque)\b/,'leisure','culture'],[/\b(fdj|francaise des jeux|betclic|winamax|unibet|pmu|parions sport)\b/,'leisure','betting'],
 [/\b(air france|easyjet|ryanair|transavia|vueling|volotea|lufthansa)\b/,'travel','flight'],[/\b(booking|airbnb|hotel|accor|ibis|abritel)\b/,'travel','lodging'],[/\b(europcar|hertz|sixt|avis|getaround|ada)\b/,'travel','rental'],
 [/\b(pharmacie|parapharmacie)\b/,'health','pharmacy'],[/\b(medecin|docteur|doctolib|hopital|laboratoire|kine|psy|osteo)\b/,'health','doctor'],[/\b(dentiste|opticien|optique|krys|afflelou)\b/,'health','dental'],
 [/\b(universite|sorbonne|inscription|cvec|frais de scolarite|ecole)\b/,'education','tuition'],[/\b(fournitures|papeterie|gibert|librairie)\b/,'education','supplies'],[/\b(udemy|coursera|openclassrooms|formation)\b/,'education','training'],
 [/\b(habitation|mrh|pno)\b/,'insurance','home'],[/\b(mutuelle|alan|harmonie|complementaire sante)\b/,'insurance','health'],[/\b(auto|moto|vehicule)\b/,'insurance','car'],
 [/\b(impot sur le revenu|prelevement a la source|pas dgfip|impots gouv|dgfip)\b/,'taxes','income'],[/\b(taxe fonciere|taxe d habitation)\b/,'taxes','property'],[/\b(amende|antai|pv)\b/,'taxes','fines'],
 [/\b(cotisation carte|carte visa|carte mastercard|offre groupee|forfait bancaire)\b/,'fees','card'],[/\b(commission|frais de change|frais operation)\b/,'fees','commission'],[/\b(frais|agios|tenue de compte)\b/,'fees','bank'],
 [/\b(unicef|croix rouge|restos du coeur|msf|helloasso|don)\b/,'gifts','charity'],[/\b(cadeau|fleuriste|interflora)\b/,'gifts','gifts'],
 [/\b(retrait|dab|atm)\b/,'cashout','atm'],[/\b(veterinaire|veto)\b/,'pets','vet'],[/\b(zooplus|animalis|croquettes|truffaut)\b/,'pets','food'],
 [/\b(livret|ldds|lep|pel|cel)\b/,'saving','livret'],[/\b(pea|cto|compte titres|trade republic|bourse|xtb|degiro|interactive brokers|versement pea|savings plan)\b/,'saving','stocks'],[/\b(assurance vie|linxea|lucya|spirica|suravenir|yomoni|nalo)\b/,'saving','lifeins'],[/\b(binance|coinbase|kraken|crypto com|bitpanda)\b/,'saving','crypto'],[/\b(vault|coffre|pocket|tirelire|savings vault|epargne)\b/,'saving','vault']
];
const SUBCACHE=new Map();
function subGuess(x){const ck=x.id+'|'+x.c+'|'+x.l;if(SUBCACHE.has(ck))return SUBCACHE.get(ck);let r='';const L=SUBS[x.c];
  if(L){const n=' '+norm(x.l)+' ';const rule=(D().rules||[]).find(z=>z.s&&z.c===x.c&&n.includes(' '+norm(z.p)));if(rule)r=rule.s;else for(const [re,c,s] of SUBKW){if(c===x.c&&re.test(n)){r=s;break}}if(!r&&L.length===1)r=L[0]}
  SUBCACHE.set(ck,r);return r}
function subOf(x){if(x.s&&SUBS[x.c]&&SUBS[x.c].includes(x.s))return x.s;return subGuess(x)}
function subL(c,s){return s?t('sub.'+c+'.'+s):t('sub.none')}
function subOptions(c,sel){const L=SUBS[c]||[];return `<option value="">${esc(t('sub.none'))}</option>`+L.map(s=>`<option value="${s}"${s===sel?' selected':''}>${esc(subL(c,s))}</option>`).join('')}
EXT.field.txCat=(el,v)=>{const s=$('#tf-s');if(s)s.innerHTML=subOptions(v,'')};

/* ---------- filtres ---------- */
const BUD_ACC_TYPES=['cash','savings'];
function bAcc(){return S.ui.bAcc||''}
function txOf(list){const a=bAcc();return a?list.filter(x=>x.acc===a):list}
function monthTxA(ym){return txOf(monthTx(ym))}
function rangeMonths(n,end){end=end||today().slice(0,7);const out=[];for(let i=n-1;i>=0;i--)out.push(ymAdd(end,-i));return out}
function bPeriod(){const p=S.ui.bPer||'6';const cur=today().slice(0,7);const lastFull=ymAdd(cur,-1);
  if(p==='y')return rangeMonths(+cur.slice(5,7),cur);if(p==='m')return [S.ui.ym||curBudgetYm()];return rangeMonths(+p,lastFull)}
function merchant(l){return norm(cleanLabel(l)).split(' ').filter(w=>w.length>1&&!/^\d+$/.test(w)&&!/^(sas|sarl|sa|fr|paris|france|www|com|carte|cb|prlv|sepa|vir|paiement|achat)$/.test(w)).slice(0,2).join(' ')}
const INC_GROUPS=[['act',x=>x.c==='salary','--k2'],['soc',x=>x.c==='benefits','--k7'],['fam',x=>x.c==='otherIn'&&subOf(x)==='family','--k4'],['cap',x=>x.c==='investIncome','--k3'],['remb',x=>x.c==='refunds','--k6'],['aut',x=>(x.c==='otherIn'&&subOf(x)!=='family')||x.c==='uncat','--warn']];
const FIXED=new Set(['housing','utilities','subscriptions','insurance','taxes','fees']);
function catSpend(list){const m={};list.forEach(x=>{const c=CAT[x.c]||CAT.uncat;if(c.kind!=='out'&&c.kind!=='nc')return;if(c.kind==='nc'&&x.a>0)return;const v=-conv(x.a,(D().accounts.find(a=>a.id===x.acc)||{}).cur);const s=subOf(x)||'';const e=m[c.k]=m[c.k]||{v:0,subs:{},n:0};e.v+=v;e.n++;e.subs[s]=(e.subs[s]||0)+v});return m}

/* ---------- vue Budget ---------- */
function budgetView(opt){
  opt=opt||{};const d=D();const ym=S.ui.ym||curBudgetYm();const tab=S.ui.bTab||'over';
  const accs=d.accounts.filter(a=>BUD_ACC_TYPES.includes(accCls(a))&&d.txs.some(x=>x.acc===a.id));
  const accSel=opt.embed?'':`<select data-f="bAcc" aria-label="${esc(t('bg.accAll'))}" style="width:auto;border-radius:999px;padding:7px 12px"><option value="">${esc(t('bg.accAll'))}</option>${accs.map(a=>`<option value="${a.id}"${a.id===bAcc()?' selected':''}>${esc(a.name)}</option>`).join('')}</select>`;
  const showYm=['over','ops','bud'].includes(tab);
  const nav=`<div class="hrow bnavbar" style="justify-content:space-between;margin-bottom:16px;gap:10px;flex-wrap:wrap">
    ${showYm?`<div class="hrow"><button class="ib" data-a="ym" data-v="-1" aria-label="${esc(t('b.prev'))}">${ico('chevl')}</button><b style="font:600 18px var(--display);min-width:150px;text-align:center;text-transform:capitalize">${esc(monthT(ym))}</b><button class="ib" data-a="ym" data-v="1" aria-label="${esc(t('b.next'))}">${ico('chev')}</button></div>`:`<div>${seg('bPer',[['3',t('bg.p3')],['6',t('bg.p6')],['12',t('bg.p12')],['y',t('bg.pY')]],S.ui.bPer||'6',t('bg.period'))}</div>`}
    ${seg('budgetTab',[['over',t('b.tabOver')],['cats',t('bg.tabCats')],['ana',t('bg.tabAna')],['ops',t('b.tabOps')],['bud',t('b.tabBud')],['rec',t('b.tabRec')]],tab,'')}
    <div class="hrow" style="gap:8px">${accSel}<button class="btn sec sm" data-a="import">${ico('upload')}${esc(t('b.import'))}</button><button class="btn sm" data-a="addTx">${ico('plus')}${esc(t('b.addTx'))}</button></div></div>`;
  if(!d.txs.length&&tab!=='bud')return nav+`<div class="empty"><b>${esc(t('b.emptyT'))}</b>${esc(t('b.emptyP'))}<div class="hrow" style="justify-content:center;margin-top:14px"><button class="btn" data-a="import">${ico('upload')}${esc(t('b.import'))}</button></div></div>`;
  let body='';
  try{
    if(tab==='over')body=bOverview(ym);else if(tab==='cats')body=bCats();else if(tab==='ana')body=bAnalysis();
    else body=budgetViewV1(true);
  }catch(e){console.error(e);body=`<div class="empty">${esc(String(e))}</div>`}
  return nav+body;
}
EXT.A.bPer=v=>{S.ui.bPer=v;render()};
EXT.A.catFilter=v=>{const [c,sb]=String(v).split('|');S.ui.fc=c;S.ui.fs=sb===undefined?null:sb;S.ui.bTab='ops';S.ui.allMonths=sb!==undefined?true:S.ui.allMonths;closeOvl&&closeOvl();if(S.ui.view!=='budget')go('budget');else render()};
EXT.field.bAcc=(el,v)=>{S.ui.bAcc=v;render()};

function bOverview(ym){
  const list=monthTxA(ym);const g=aggTx(list);const rest=g.inc-g.exp-g.sav;
  const prev=[1,2,3].map(i=>aggTx(monthTxA(ymAdd(ym,-i))));const avgExp=sum(prev.map(p=>p.exp))/3;
  const bud=D().budgets;const tb=sum(Object.values(bud).map(v=>+v||0));
  /* prévision de fin de mois : dépenses à ce jour + rythme habituel du reste du mois */
  const cur=today().slice(0,7);let fc=null;if(ym===cur){const day=+today().slice(8,10),dim=new Date(+cur.slice(0,4),+cur.slice(5,7),0).getDate();
    const pastRest=[1,2,3].map(i=>{const m=ymAdd(cur,-i);return sum(monthTxA(m).filter(x=>+x.d.slice(8,10)>day&&x.a<0&&['out','nc'].includes((CAT[x.c]||{}).kind)).map(x=>-x.a))});fc=g.exp+(pastRest.length?sum(pastRest)/pastRest.length:g.exp/day*(dim-day))}
  const hero=`<div class="card"><div class="eyebrow">${esc(t('bg.spentIn',{m:monthT(ym)}))}</div><div class="hero-v" style="font-size:40px">${money(g.exp,2)}</div>
    <div class="hrow" style="gap:8px;flex-wrap:wrap"><span class="delta ${g.exp<=avgExp?'up':'dn'}">${g.exp<=avgExp?'▼':'▲'} ${esc(pctS(avgExp?(g.exp-avgExp)/avgExp:0).replace(/<[^>]+>/g,''))}</span><span class="muted" style="font-size:13px">${esc(t('bg.vsAvg',{v:moneyT(avgExp,0)}))}</span></div>
    ${tb?`<div class="bar${g.exp>tb?' over':''}" style="margin-top:14px"><i style="width:${(clamp(g.exp/tb,0,1)*100).toFixed(1)}%"></i></div><div class="hrow note" style="justify-content:space-between;margin-top:6px"><span>${esc(t('bg.ofBud',{p:pctT(g.exp/tb,0),v:moneyT(tb,0)}))}</span><span class="${g.exp>tb?'bad':''}">${esc(g.exp>tb?t('b.over',{v:moneyT(g.exp-tb,0)}):t('b.left',{v:moneyT(tb-g.exp,0)}))}</span></div>`:`<p class="note" style="margin-top:10px">${esc(t('bg.noBud'))} <button class="link" data-a="budgetTab" data-v="bud">${esc(t('bg.setBud'))}</button></p>`}
    ${fc!=null?`<p class="note" style="margin:10px 0 0">${ico('spark')} ${esc(t('bg.fc',{v:moneyT(fc,0)}))}</p>`:''}</div>`;
  const kp=`<div class="kpis k4" style="margin:0">${kpi(t('b.income'),`<span class="good">${money(g.inc,0)}</span>`)}${kpi(t('b.saved'),money(g.sav,0),t('b.savedS'))}${kpi(t('b.rest'),`<span class="${cls(rest)}">${moneyS(rest,0)}</span>`,t('b.restS'))}${kpi(t('k.savRate'),g.inc>0?pctT((g.inc-g.exp)/g.inc,0):'—',t('bg.rateS'))}</div>`;
  const last12=rangeMonths(12,ym);const aggs=last12.map(m=>({m,g:aggTx(monthTxA(m))}));
  const flows=`<div class="card"><div class="ch"><div><h2>${esc(t('b.flow'))}</h2><p>${esc(t('b.flowSub'))}</p></div></div>${chart({type:'bars',h:220,act:'ymSet',groups:aggs.map(x=>({key:x.m,label:monthT(x.m,true),vals:[x.g.inc,x.g.exp,x.g.sav],on:x.m===ym,title:monthT(x.m)+' · '+moneyT(x.g.inc-x.g.exp,0)})),keys:[{c:'var(--good)'},{c:'var(--k5)'},{c:'var(--accent)'}],label:t('b.flow')})}
    <div class="lgd2"><span><i style="background:var(--good)"></i>${esc(t('b.income'))}</span><span><i style="background:var(--k5)"></i>${esc(t('b.expense'))}</span><span><i style="background:var(--accent)"></i>${esc(t('b.saved'))}</span></div></div>`;
  /* où part l'argent, avec sous-catégories dépliables */
  const cs=catSpend(list);const rows=Object.entries(cs).sort((a,b)=>b[1].v-a[1].v);const mx=rows.length?rows[0][1].v:1;const open=S.ui.bOpen||'';
  const avg3={};[1,2,3].forEach(i=>{const c2=catSpend(monthTxA(ymAdd(ym,-i)));Object.entries(c2).forEach(([k,e])=>avg3[k]=(avg3[k]||0)+e.v/3)});
  const where=`<div class="card"><div class="ch"><div><h2>${esc(t('bg.where'))}</h2><p>${esc(t('bg.whereS'))}</p></div><button class="link" data-a="budgetTab" data-v="cats">${esc(t('see.all'))}</button></div>
    ${rows.length?`<div class="cats">${rows.slice(0,9).map(([k,e])=>{const c=CAT[k]||CAT.uncat;const b=+D().budgets[k]||0;const dv=avg3[k]?(e.v-avg3[k])/avg3[k]:null;const subs=Object.entries(e.subs).sort((a,z)=>z[1]-a[1]);
      return `<div class="catr${open===k?' open':''}"><button class="catb" data-a="bOpen" data-v="${k}"><span class="av sm" style="--c:${cvar(c.c)}">${ico(c.ic)}</span><span class="cn"><b>${esc(catL(k))}</b><span class="bar sm"><i style="width:${(e.v/mx*100).toFixed(1)}%;background:${cvar(c.c)}"></i></span></span><span class="cv"><b>${money(e.v,0)}</b><span class="${dv==null?'muted':dv>0.1?'bad':dv<-0.1?'good':'muted'}">${dv==null?esc(pctT(e.v/(g.exp||1),0)):esc((dv>0?'+':'')+pctT(dv,0))+' '+esc(t('bg.vs3'))}${b?' · '+esc(t('bg.budOf',{v:moneyT(b,0)})):''}</span></span>${ico(open===k?'up':'down')}</button>
      ${open===k?`<div class="subl">${subs.map(([s,v])=>`<button class="subr" data-a="catDetail" data-v="${k}|${s||'_'}"><span>${esc(subL(k,s))}</span><span class="bar sm"><i style="width:${(v/e.v*100).toFixed(1)}%;background:${cvar(c.c)}"></i></span><b>${money(v,0)}</b></button>`).join('')}<button class="link" data-a="catDetail" data-v="${k}|">${esc(t('bg.catMore'))}</button></div>`:''}</div>`}).join('')}</div>`:`<p class="note">${esc(t('b.noOpsM'))}</p>`}</div>`;
  /* revenus par nature */
  const incL=INC_GROUPS.map(([gk,f,col])=>({gk,col,v:sum(list.filter(x=>x.a>0&&f(x)).map(x=>x.a))})).filter(x=>x.v>=0.5);const incT=sum(incL.map(x=>x.v));
  const inc=`<div class="card"><div class="ch"><div><h2>${esc(t('bg.incNat'))}</h2><p>${esc(t('bg.incNatS',{v:moneyT(incT,0)}))}</p></div></div>${incL.length?`<div class="mbars">${incL.map(x=>`<div class="mb" style="grid-template-columns:150px 1fr auto"><span>${esc(t('bg.ig.'+x.gk))}</span><i><b style="width:${(x.v/incT*100).toFixed(1)}%;background:var(${x.col})"></b></i><em>${money(x.v,0)}</em></div>`).join('')}</div>`:`<p class="note">${esc(t('bg.noInc'))}</p>`}</div>`;
  const nc=list.filter(x=>x.c==='uncat').length;
  const alert=nc?`<div class="demo-band" style="margin:0 0 16px">${ico('question')}<div>${esc(t('bg.nc',{n:nc}))}</div><button class="btn sm" data-a="ncGo">${esc(t('bg.ncBtn'))}</button></div>`:'';
  const recent=list.slice().sort((a,b)=>b.d.localeCompare(a.d)).slice(0,6);
  const rec=`<div class="card"><div class="ch"><div><h2>${esc(t('home.recent'))}</h2></div><button class="link" data-a="budgetTab" data-v="ops">${esc(t('see.all'))}</button></div><div class="list">${recent.map(txRow).join('')||`<p class="note">${esc(t('b.noOpsM'))}</p>`}</div></div>`;
  return alert+`<div class="grid g-21"><div style="display:flex;flex-direction:column;gap:16px">${hero}${kp}</div>${flows}</div><div class="grid g-21" style="margin-top:16px">${where}<div style="display:flex;flex-direction:column;gap:16px">${inc}${rec}</div></div>`;
}
EXT.A.bOpen=v=>{S.ui.bOpen=S.ui.bOpen===v?'':v;render()};
EXT.A.ncGo=()=>{S.ui.bTab='ops';S.ui.fl='nc';render()};

function bCats(){
  const ms=bPeriod();const list=txOf(D().txs.filter(x=>ms.includes(ymOf(x.d))));const cs=catSpend(list);const tot=sum(Object.values(cs).map(e=>e.v));
  const n=ms.length;const prevMs=ms.map(m=>ymAdd(m,-n));const pcs=catSpend(txOf(D().txs.filter(x=>prevMs.includes(ymOf(x.d)))));
  const rows=Object.entries(cs).sort((a,b)=>b[1].v-a[1].v);
  const spark=k=>{const vals=ms.map(m=>(catSpend(monthTxA(m))[k]||{v:0}).v);const mx=Math.max(1,...vals);return `<span class="spk">${vals.map(v=>`<i style="height:${Math.max(4,v/mx*100).toFixed(0)}%"></i>`).join('')}</span>`};
  return `<div class="kpis k4" style="margin-bottom:16px">${kpi(t('bg.k.tot'),money(tot,0),t('bg.k.totS',{n}))}${kpi(t('bg.k.avg'),money(tot/n,0),t('tl.perMonth'))}${kpi(t('bg.k.fixed'),money(sum(rows.filter(([k])=>FIXED.has(k)).map(([,e])=>e.v))/n,0),t('bg.k.fixedS'))}${kpi(t('bg.k.var'),money(sum(rows.filter(([k])=>!FIXED.has(k)).map(([,e])=>e.v))/n,0),t('bg.k.varS'))}</div>
  <div class="card"><div class="tw cards"><table class="tbl"><thead><tr><th>${esc(t('f.cat'))}</th><th>${esc(t('bg.c.tot'))}</th><th>${esc(t('bg.c.avg'))}</th><th>${esc(t('bg.c.share'))}</th><th>${esc(t('bg.c.prev'))}</th><th>${esc(t('bg.c.trend'))}</th></tr></thead><tbody>
  ${rows.map(([k,e])=>{const c=CAT[k]||CAT.uncat;const p=pcs[k]?pcs[k].v:0;const dv=p?(e.v-p)/p:null;return `<tr class="click" data-a="catDetail" data-v="${k}|"><td><div class="nm"><span class="av sm" style="--c:${cvar(c.c)}">${ico(c.ic)}</span><div><b>${esc(catL(k))}</b><span>${esc(Object.entries(e.subs).sort((a,z)=>z[1]-a[1]).slice(0,3).map(([s])=>subL(k,s)).join(' · '))}</span></div></div></td><td data-l="${esc(t('bg.c.tot'))}"><b>${esc(moneyT(e.v,0))}</b></td><td data-l="${esc(t('bg.c.avg'))}">${esc(moneyT(e.v/n,0))}</td><td data-l="${esc(t('bg.c.share'))}">${esc(pctT(e.v/(tot||1),0))}</td><td data-l="${esc(t('bg.c.prev'))}" class="${dv==null?'muted':dv>0.1?'bad':dv<-0.1?'good':''}">${dv==null?'—':esc((dv>0?'+':'')+pctT(dv,0))}</td><td data-l="${esc(t('bg.c.trend'))}">${spark(k)}</td></tr>`}).join('')}</tbody></table></div></div>`;
}

function bAnalysis(){
  const ms=bPeriod();const n=ms.length;const all=txOf(D().txs);const list=all.filter(x=>ms.includes(ymOf(x.d)));
  const mAgg=ms.map(m=>{const l=all.filter(x=>ymOf(x.d)===m);return {m,g:aggTx(l),l}});
  /* revenus par nature, mois par mois */
  const incStack=chart({type:'bars',stack:true,h:200,groups:mAgg.map(x=>({label:monthT(x.m,true),vals:INC_GROUPS.map(([,f])=>sum(x.l.filter(z=>z.a>0&&f(z)).map(z=>z.a))),title:monthT(x.m)})),keys:INC_GROUPS.map(([,,c])=>({c:`var(${c})`})),label:t('bg.incNat')});
  const reg=sum(list.filter(x=>x.a>0&&(['salary','benefits','investIncome'].includes(x.c)||(x.c==='otherIn'&&subOf(x)==='family'))).map(x=>x.a)),one=sum(list.filter(x=>x.a>0&&((x.c==='otherIn'&&subOf(x)!=='family')||x.c==='uncat')).map(x=>x.a));
  const incC=`<div class="card"><div class="ch"><div><h2>${esc(t('bg.incNat'))}</h2><p>${esc(t('bg.incNatS',{v:moneyT(sum(mAgg.map(x=>x.g.inc)),0)}))}</p></div></div>${incStack}<div class="lgd2">${INC_GROUPS.map(([gk,,c])=>`<span><i style="background:var(${c})"></i>${esc(t('bg.ig.'+gk))}</span>`).join('')}</div>
    <div class="wkv"><div><span>${esc(t('bg.reg'))}</span><b>${money(reg,0)}</b></div><div><span>${esc(t('bg.one'))}</span><b>${money(one,0)}</b></div></div></div>`;
  /* taux d'épargne mensuel */
  const pts=mAgg.map(x=>({v:x.g.inc>0?clamp((x.g.inc-x.g.exp)/x.g.inc,-1,1)*100:0}));
  const rateC=`<div class="card"><div class="ch"><div><h2>${esc(t('bg.rateT'))}</h2><p>${esc(t('bg.rateTS'))}</p></div></div>${chart({h:190,zero:true,series:[{pts,c:'var(--accent)'},{pts:pts.map(()=>({v:20})),c:'var(--good)',dash:true}],xl:i=>monthT(mAgg[i].m,true),tip:i=>`<b>${numT(pts[i].v,0)} %</b><br>${esc(monthT(mAgg[i].m))}`,fy:v=>numT(v,0)+' %'})}</div>`;
  /* fixes et variables */
  const fx=mAgg.map(x=>{const c=catSpend(x.l);let f=0,v=0;Object.entries(c).forEach(([k,e])=>{if(FIXED.has(k))f+=e.v;else v+=e.v});return [f,v]});
  const fixC=`<div class="card"><div class="ch"><div><h2>${esc(t('bg.fixT'))}</h2><p>${esc(t('bg.fixS'))}</p></div></div>${chart({type:'bars',stack:true,h:190,groups:mAgg.map((x,i)=>({label:monthT(x.m,true),vals:fx[i],title:monthT(x.m)+' · '+moneyT(fx[i][0],0)+' / '+moneyT(fx[i][1],0)})),keys:[{c:'var(--k5)'},{c:'var(--k2)'}],label:t('bg.fixT')})}<div class="lgd2"><span><i style="background:var(--k5)"></i>${esc(t('bg.k.fixed'))}</span><span><i style="background:var(--k2)"></i>${esc(t('bg.k.var'))}</span></div></div>`;
  /* évolutions par rapport à la période précédente */
  const prevMs=ms.map(m=>ymAdd(m,-n));const cs=catSpend(list),ps=catSpend(all.filter(x=>prevMs.includes(ymOf(x.d))));
  const ch=[...new Set([...Object.keys(cs),...Object.keys(ps)])].map(k=>({k,d:(cs[k]?cs[k].v:0)-(ps[k]?ps[k].v:0)})).filter(x=>Math.abs(x.d)>1).sort((a,b)=>b.d-a.d);
  const chgRow=x=>`<button class="row btnrow" data-a="catDetail" data-v="${x.k}|"><span class="av sm" style="--c:${cvar((CAT[x.k]||CAT.uncat).c)}">${ico((CAT[x.k]||CAT.uncat).ic)}</span><div class="m"><b>${esc(catL(x.k))}</b></div><div class="r"><b class="${x.d>0?'bad':'good'}">${moneyS(x.d,0)}</b></div></button>`;
  const evoC=`<div class="card"><div class="ch"><div><h2>${esc(t('bg.evoT'))}</h2><p>${esc(t('bg.evoS'))}</p></div></div><div class="grid g2 keep" style="gap:12px"><div><div class="note">${esc(t('bg.up'))}</div><div class="list">${ch.filter(x=>x.d>0).slice(0,4).map(chgRow).join('')||`<p class="note">—</p>`}</div></div><div><div class="note">${esc(t('bg.down'))}</div><div class="list">${ch.filter(x=>x.d<0).reverse().slice(0,4).map(chgRow).join('')||`<p class="note">—</p>`}</div></div></div></div>`;
  /* marchands */
  const mm={};list.filter(x=>x.a<0&&['out','nc'].includes((CAT[x.c]||{}).kind)).forEach(x=>{const k=merchant(x.l);if(!k)return;const e=mm[k]=mm[k]||{k,l:cleanLabel(x.l),v:0,n:0,c:x.c};e.v-=x.a;e.n++});
  const top=Object.values(mm).sort((a,b)=>b.v-a.v).slice(0,10);
  const merC=`<div class="card"><div class="ch"><div><h2>${esc(t('bg.merT'))}</h2><p>${esc(t('bg.merS'))}</p></div></div><div class="list">${top.map(e=>`<div class="row"><span class="av sm" style="--c:${cvar((CAT[e.c]||CAT.uncat).c)}">${esc(e.l.trim().charAt(0).toUpperCase())}</span><div class="m"><b>${esc(e.l)}</b><span>${esc(catL(e.c))} · ${esc(t('bg.merN',{n:e.n,v:moneyT(e.v/e.n,2)}))}</span></div><div class="r"><b>${money(e.v,0)}</b></div></div>`).join('')||`<p class="note">—</p>`}</div></div>`;
  /* calendrier du dernier mois complet et jours de la semaine */
  const lm=ms[ms.length-1];const dim=new Date(+lm.slice(0,4),+lm.slice(5,7),0).getDate(),first=(new Date(+lm.slice(0,4),+lm.slice(5,7)-1,1).getDay()+6)%7;
  const per={},wd=[0,0,0,0,0,0,0];list.filter(x=>x.a<0&&['out','nc'].includes((CAT[x.c]||{}).kind)).forEach(x=>{const dt=new Date(x.d+'T12:00:00');wd[(dt.getDay()+6)%7]-=x.a;if(ymOf(x.d)===lm){const dd=+x.d.slice(8);per[dd]=(per[dd]||0)-x.a}});
  const vmax=Math.max(1,...Object.values(per));let cal=[1,2,3,4,5,6,7].map(i=>`<span class="h">${esc(dayName(i).slice(0,1).toUpperCase())}</span>`).join('')+Array(first).fill('<span></span>').join('');
  for(let dd=1;dd<=dim;dd++){const v=per[dd]||0,lv=v?Math.max(1,Math.ceil(v/vmax*4)):0;cal+=`<span class="cd l${lv}" title="${esc(dd+' '+monthT(lm)+' · '+moneyT(v,2))}">${dd}</span>`}
  const wmx=Math.max(1,...wd);
  const calC=`<div class="card"><div class="ch"><div><h2>${esc(t('bg.calT',{m:monthT(lm)}))}</h2><p>${esc(t('bg.calS',{v:moneyT(vmax,0)}))}</p></div></div><div class="bcal">${cal}</div>
    <div class="sec-t" style="margin-top:14px"><h2 style="font-size:14px">${esc(t('bg.wdT'))}</h2></div><div class="wdb">${wd.map((v,i)=>`<div><i style="height:${(v/wmx*100).toFixed(0)}%"></i><span>${esc(dayName(i+1).slice(0,3))}</span><em>${esc(compactT(v/Math.max(1,n)))}</em></div>`).join('')}</div><p class="note">${esc(t('bg.wdS'))}</p></div>`;
  /* prévu et réel du mois le plus récent */
  const lg=catSpend(all.filter(x=>ymOf(x.d)===lm));const pl=CATS.filter(c=>c.kind==='out').map(c=>({k:c.k,real:lg[c.k]?lg[c.k].v:0,plan:+D().budgets[c.k]||0})).filter(x=>x.real>0.5||x.plan>0).sort((a,b)=>b.real-a.real);const pmax=Math.max(1,...pl.map(x=>Math.max(x.real,x.plan)))*1.1;
  const planC=`<div class="card"><div class="ch"><div><h2>${esc(t('bg.planT',{m:monthT(lm)}))}</h2><p>${esc(t('bg.planS'))}</p></div><button class="link" data-a="budgetTab" data-v="bud">${esc(t('b.tabBud'))}</button></div>${pl.map(x=>{const over=x.plan&&x.real>x.plan;return `<div class="plr"><div class="hrow" style="justify-content:space-between"><span>${esc(catL(x.k))}</span><span><b class="${over?'bad':''}">${esc(moneyT(x.real,0))}</b> <span class="muted">/ ${x.plan?esc(moneyT(x.plan,0)):esc(t('bg.noPlan'))}</span></span></div><div class="plb"><i style="width:${(x.real/pmax*100).toFixed(1)}%;background:${over?'var(--bad)':cvar((CAT[x.k]||{}).c)}"></i>${x.plan?`<b style="left:${(x.plan/pmax*100).toFixed(1)}%"></b>`:''}</div></div>`}).join('')||`<p class="note">—</p>`}</div>`;
  return `<div class="grid g2">${incC}${rateC}</div><div class="grid g2" style="margin-top:16px">${fixC}${evoC}</div><div class="grid g2" style="margin-top:16px">${merC}${calC}</div><div style="margin-top:16px">${planC}</div>`;
}
function dayName(i){/* 1 = lundi */const dt=new Date(2024,0,i);return new Intl.DateTimeFormat(loc(),{weekday:'long'}).format(dt)}

/* ---------- détail d'une catégorie ---------- */
EXT.A.catDetail=v=>{const [k,s]=v.split('|');openOvl({k:'catD',cat:k,sub:s===undefined||s===''?null:s})};
EXT.ovl.catD=o=>{const k=o.cat;const c=CAT[k]||CAT.uncat;const all=txOf(D().txs).filter(x=>x.c===k&&(o.sub==null||(subOf(x)||'_')===o.sub));
  const ms=rangeMonths(12);const per=ms.map(m=>sum(all.filter(x=>ymOf(x.d)===m).map(x=>-x.a)));const avg=sum(per.slice(0,11))/11;
  const subs={};all.filter(x=>ms.includes(ymOf(x.d))).forEach(x=>{const s=subOf(x)||'';subs[s]=(subs[s]||0)-x.a});const st=sum(Object.values(subs));
  const mm={};all.filter(x=>ms.includes(ymOf(x.d))).forEach(x=>{const kk=merchant(x.l);if(!kk)return;const e=mm[kk]=mm[kk]||{l:cleanLabel(x.l),v:0,n:0};e.v-=x.a;e.n++});
  const b=+D().budgets[k]||0;
  return {html:`<div class="ph"><div style="display:flex;gap:12px;align-items:center"><span class="av" style="--c:${cvar(c.c)}">${ico(c.ic)}</span><div><div class="eyebrow">${esc(o.sub?catL(k):t('bg.cat12'))}</div><h2>${esc(o.sub?subL(k,o.sub==='_'?'':o.sub):catL(k))}</h2></div></div><button class="ib" data-a="close" aria-label="${esc(t('act.close'))}">${ico('x')}</button></div>
  <div class="kpis k4" style="box-shadow:none;margin-bottom:14px">${kpi(t('bg.k.12'),money(sum(per),0))}${kpi(t('bg.k.avgM'),money(sum(per)/12,0))}${kpi(t('bg.k.thisM'),money(per[11],0),per[11]>avg*1.1?t('bg.aboveAvg'):'')}${kpi(t('bg.k.bud'),b?money(b,0):'—')}</div>
  <div class="card flat" style="margin-bottom:14px">${chart({type:'bars',h:170,groups:ms.map((m,i)=>({label:monthT(m,true),vals:[Math.max(0,per[i])],on:i===11,title:monthT(m)+' · '+moneyT(per[i],2)})),keys:[{c:cvar(c.c)}],label:catL(k)})}</div>
  ${!o.sub&&Object.keys(subs).length?`<div class="sec-t"><h2>${esc(t('bg.subs'))}</h2></div><div class="list" style="margin-bottom:14px">${Object.entries(subs).sort((a,z)=>z[1]-a[1]).map(([s,v])=>`<button class="row btnrow" data-a="catDetail" data-v="${k}|${s||'_'}"><div class="m"><b>${esc(subL(k,s))}</b><span class="bar sm" style="margin-top:6px"><i style="width:${(v/(st||1)*100).toFixed(1)}%;background:${cvar(c.c)}"></i></span></div><div class="r"><b>${money(v,0)}</b><span>${esc(pctT(v/(st||1),0))}</span></div></button>`).join('')}</div>`:''}
  <div class="sec-t"><h2>${esc(t('bg.merT'))}</h2></div><div class="list" style="margin-bottom:14px">${Object.values(mm).sort((a,z)=>z.v-a.v).slice(0,6).map(e=>`<div class="row"><div class="m"><b>${esc(e.l)}</b><span>${esc(t('bg.merN',{n:e.n,v:moneyT(e.v/e.n,2)}))}</span></div><div class="r"><b>${money(e.v,0)}</b></div></div>`).join('')||`<p class="note">—</p>`}</div>
  <div class="sec-t"><h2>${esc(t('home.recent'))}</h2><button class="link" data-a="catFilter" data-v="${k}${o.sub?'|'+o.sub:''}">${esc(t('bg.allOps'))}</button></div><div class="list">${all.slice().sort((a,z)=>z.d.localeCompare(a.d)).slice(0,10).map(txRow).join('')||`<p class="note">—</p>`}</div>`}};

/* ---------- styles ---------- */
