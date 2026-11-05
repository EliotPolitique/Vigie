/* ================= V4 — exposition réelle (transparence des fonds, estimation) ================= */
/* Pondérations approximatives des grands indices (ordres de grandeur, en %). Elles servent d'estimation tant
   qu'aucune source de composition exacte (fournisseur de données) n'est branchée. */
const IDX={
 world:{l:'MSCI World',c:{US:72,JP:5.5,GB:3.5,CA:3.2,FR:2.7,CH:2.4,DE:2.4,AU:1.7,NL:1.2,ZZ:5.4},s:{tech:27,finance:16,consumer:15.8,industry:11,health:10,telecom:8.5,energy:3.5,materials:3.2,utilities:2.7,realestate:2}},
 acwi:{l:'MSCI ACWI / FTSE All-World',c:{US:64,JP:4.8,GB:3.1,CA:2.8,CN:2.7,FR:2.4,CH:2.1,DE:2.1,TW:1.9,IN:1.9,ZZ:10.2},s:{tech:26,finance:17,consumer:15.5,industry:10.5,health:9.5,telecom:8.5,energy:3.8,materials:3.6,utilities:2.6,realestate:2}},
 sp500:{l:'S&P 500',c:{US:100},s:{tech:32,consumer:16,finance:13,health:10,telecom:9.5,industry:8.5,energy:3.2,utilities:2.5,realestate:2,materials:2}},
 ndx:{l:'Nasdaq-100',c:{US:97,ZZ:3},s:{tech:51,consumer:19,telecom:16,health:5,industry:5,utilities:1.5,materials:1,energy:0.5,finance:0.5}},
 em:{l:'MSCI Emerging Markets',c:{CN:28,TW:19,IN:18,KR:10,BR:4.5,SA:3.5,ZA:3.2,MX:1.8,ZZ:12},s:{finance:24.5,tech:24,consumer:17,telecom:9.5,industry:7,materials:6,energy:4.5,health:3.5,utilities:2.5,realestate:1.5}},
 europe:{l:'Europe (Stoxx 600)',c:{GB:22,FR:16,CH:14,DE:14,NL:7,SE:5,DK:4,IT:4,ES:4,ZZ:10},s:{finance:22,industry:17,consumer:16,health:14,tech:7,materials:6,energy:5,utilities:4.5,telecom:4,realestate:1.5}},
 france:{l:'CAC 40',c:{FR:100},s:{consumer:30,industry:20,finance:12,health:10,materials:8,energy:7,tech:6,utilities:4,telecom:2,realestate:1}}
};
const ZONES={US:'na',CA:'na',JP:'jp',GB:'eu',FR:'eu',CH:'eu',DE:'eu',NL:'eu',SE:'eu',DK:'eu',IT:'eu',ES:'eu',BE:'eu',FI:'eu',NO:'eu',IE:'eu',AT:'eu',PT:'eu',LU:'eu',AU:'ap',NZ:'ap',HK:'ap',SG:'ap',CN:'em',TW:'em',IN:'em',KR:'em',BR:'em',SA:'em',ZA:'em',MX:'em',ID:'em',TH:'em',MY:'em',AE:'em',QA:'em',CL:'em',PL:'em',TR:'em',ZZ:'zz'};
/* nature et indice d'une ligne */
function expoOf(h){
  const n=norm([h.name,h.ticker].filter(Boolean).join(' '));const k=h.kind;
  if(k==='fe'||/fonds euro/.test(n))return {cls:'fe'};
  if(k==='crypto')return {cls:'crypto'};
  if(k==='metal'||/\b(gold|or physique|physical gold|xetra gold|gold etc|silver|argent metal)\b/.test(n))return {cls:'gold'};
  if(k==='scpi'||/\b(scpi|opci|reit|real estate|immobilier)\b/.test(n))return {cls:'re'};
  if(k==='bond'||/\b(bond|bonds|oblig|obligations|obligataire|treasury|govt|aggregate|convertible|cnvrts|monetaire|money market|tresorerie)\b/.test(n))return {cls:'bond'};
  if(k==='stock'){const cc=(h.isin||'').slice(0,2).toUpperCase();return {cls:'eq',stock:1,c:{[/^[A-Z]{2}$/.test(cc)&&!['XS','EU'].includes(cc)?cc:'ZZ']:100},s:{[h.sector&&h.sector!=='diversified'?h.sector:'other']:100},src:'isin'}}
  let ix=null,approx=false;
  if(/\b(nasdaq|ndx|nasdaq 100|qyld|covered call)\b/.test(n))ix='ndx';
  else if(/\b(s p 500|sp 500|sp500|s and p 500|s p500|msci usa|usa)\b/.test(n))ix='sp500';
  else if(/\b(all world|all-world|acwi|ftse all|msci all country)\b/.test(n))ix='acwi';
  else if(/\b(emerg\w*|emerging|em|emergent|marches emergents)\b/.test(n))ix='em';
  else if(/\b(cac 40|cac40)\b/.test(n))ix='france';
  else if(/\b(stoxx|europe|eurozone|euro stoxx|msci emu)\b/.test(n))ix='europe';
  else if(/\b(msci world|world|monde|global)\b/.test(n))ix='world';
  if(ix&&/\b(dividend|dividends|quality|income|value|min vol|esg)\b/.test(n))approx=true;
  if(!ix){ix={world:'world',us:'sp500',em:'em',europe:'europe',france:'france'}[h.region]||null;approx=true}
  if(!ix)return {cls:'eq',c:{ZZ:100},s:{other:100},src:'none'};
  return {cls:'eq',ix,c:IDX[ix].c,s:IDX[ix].s,src:approx?'approx':'index'};
}
function expoModel(){
  const lines=[];D().accounts.filter(a=>a.include!==false&&(TYP[a.type]||{}).h).forEach(a=>(a.holdings||[]).forEach(h=>{if(!(+h.qty>0))return;const v=hVal(h,a);if(v<=0.004)return;lines.push({a,h,v,E:expoOf(h)})}));
  const total=sum(lines.map(x=>x.v));const eq=lines.filter(x=>x.E.cls==='eq');const eqT=sum(eq.map(x=>x.v));
  const cls={};lines.forEach(x=>cls[x.E.cls]=(cls[x.E.cls]||0)+x.v);
  const cty={},sec={},zone={};eq.forEach(x=>{Object.entries(x.E.c).forEach(([c,w])=>{const v=x.v*w/100;cty[c]=(cty[c]||0)+v;const z=ZONES[c]||'other';zone[z]=(zone[z]||0)+v});Object.entries(x.E.s).forEach(([s,w])=>{sec[s]=(sec[s]||0)+x.v*w/100})});
  const src={};eq.forEach(x=>src[x.E.src]=(src[x.E.src]||0)+x.v);
  /* frais : frais courants annuels des fonds, en euros */
  const fees=lines.filter(x=>x.h.kind!=='stock').map(x=>({x,ter:+x.h.ter||0,eur:x.v*(+x.h.ter||0)/100})).sort((a,b)=>b.eur-a.eur);
  return {lines,total,eqT,cls,cty,sec,zone,src,fees}}
let CTYN=null;function ctyName(c){if(c==='ZZ')return t('ex.other');try{if(!CTYN||CTYN.l!==loc())CTYN={l:loc(),f:new Intl.DisplayNames([loc()],{type:'region'})};return CTYN.f.of(c)||c}catch(e){return c}}
function expoView(){
  const M=expoModel();if(!M.lines.length)return envChips('expo')+emptyBlock(t('inv.emptyT'),t('inv.emptyP'),t('inv.addAcc'),'addAccInv');
  const pct=v=>pctT(v/(M.eqT||1),1);
  const bars=(o,lab,max)=>{const L=Object.entries(o).filter(([,v])=>v>0.004).sort((a,b)=>b[1]-a[1]).slice(0,max||12);const mx=L.length?L[0][1]:1;
    return `<div class="mbars">${L.map(([k,v])=>`<div class="mb" style="grid-template-columns:150px 1fr 110px"><span>${esc(lab(k))}</span><i><b style="width:${(v/mx*100).toFixed(1)}%"></b></i><em>${esc(pct(v))} · ${esc(moneyT(v,0))}</em></div>`).join('')}</div>`};
  const clsL=k=>t('ex.c.'+k);const clsC={eq:'--k3',bond:'--k2',fe:'--k6',gold:'--warn',re:'--k4',crypto:'--k7'};
  const segs=Object.entries(M.cls).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({k,l:clsL(k),v,c:`var(${clsC[k]||'--k5'})`}));
  const us=M.cty.US||0;const exact=(M.src.index||0)+(M.src.isin||0)+(M.src.cat||0);
  const head=`${envChips('expo')}<div class="kpis k4" style="margin-bottom:16px">${kpi(t('ex.k.eq'),money(M.eqT,0),t('ex.k.eqS',{p:pctT(M.eqT/(M.total||1),0)}))}${kpi(t('ex.k.us'),pctT(us/(M.eqT||1),0),t('ex.k.usS'))}${kpi(t('ex.k.em'),pctT((M.zone.em||0)/(M.eqT||1),0),t('ex.k.emS'))}${kpi(t('ex.k.fees'),money(sum(M.fees.map(f=>f.eur)),2),t('ex.k.feesS'))}</div>
   <div class="callout" style="margin-bottom:16px">${esc(t('ex.est',{p:pctT(exact/(M.eqT||1),0)}))}</div>`;
  const c1=`<div class="card"><div class="ch"><div><h2>${esc(t('ex.clsT'))}</h2><p>${esc(t('ex.clsS'))}</p></div></div>${donut(segs,esc(compactT(M.total)),t('ex.total'),'')}<div class="legend" style="margin-top:12px">${segs.map(s=>`<div class="lg"><i class="sq" style="--c:${s.c}"></i><span class="n">${esc(s.l)}</span><span class="p">${pctT(s.v/(M.total||1),0)}</span><span class="v">${money(s.v,0)}</span></div>`).join('')}</div></div>`;
  const c2=`<div class="card"><div class="ch"><div><h2>${esc(t('ex.zoneT'))}</h2><p>${esc(t('ex.zoneS'))}</p></div></div>${bars(M.zone,z=>t('ex.z.'+z))}<div class="sec-t" style="margin-top:16px"><h2 style="font-size:14px">${esc(t('ex.ctyT'))}</h2></div>${bars(M.cty,ctyName,10)}</div>`;
  const c3=`<div class="card"><div class="ch"><div><h2>${esc(t('ex.secT'))}</h2><p>${esc(t('ex.secS'))}</p></div></div>${bars(M.sec,s=>t('sec.'+s))}</div>`;
  const c4=`<div class="card"><div class="ch"><div><h2>${esc(t('ex.lineT'))}</h2><p>${esc(t('ex.lineS'))}</p></div></div><div class="list">${M.lines.sort((a,b)=>b.v-a.v).map(x=>`<button class="row btnrow" data-a="pos" data-v="${esc((x.h.isin||x.h.ticker||x.h.name||'').toUpperCase())}"><div class="m"><b>${esc(x.h.name)}</b><span>${esc(x.E.cls==='eq'?(x.E.stock?t('ex.src.isin',{c:ctyName(Object.keys(x.E.c)[0])}):x.E.ix?t(x.E.src==='approx'?'ex.src.approx':'ex.src.index',{i:IDX[x.E.ix].l}):t('ex.src.none')):clsL(x.E.cls))}</span></div><div class="r"><b>${money(x.v,0)}</b><span>${esc(pctT(x.v/(M.total||1),1))}</span></div></button>`).join('')}</div></div>`;
  const miss=M.fees.filter(f=>!f.ter);
  const c5=`<div class="card"><div class="ch"><div><h2>${esc(t('ex.feeT'))}</h2><p>${esc(t('ex.feeS'))}</p></div></div><div class="list">${M.fees.filter(f=>f.ter).map(f=>`<div class="row"><div class="m"><b>${esc(f.x.h.name)}</b><span>${esc(t('ex.ter',{p:numT(f.ter,2)}))} · ${esc(f.x.a.name)}</span></div><div class="r"><b>${money(f.eur,2)}</b><span>${esc(t('per.year'))}</span></div></div>`).join('')}</div>${miss.length?`<p class="note" style="margin-top:10px">${esc(t('ex.feeMiss',{n:miss.length,l:miss.slice(0,3).map(f=>f.x.h.name).join(', ')}))}</p>`:''}<p class="note">${esc(t('ex.feeNote'))}</p></div>`;
  return head+`<div class="grid g2">${c1}${c2}</div><div class="grid g2" style="margin-top:16px">${c3}${c5}</div><div style="margin-top:16px">${c4}</div><p class="note" style="margin-top:12px">${esc(t('ex.method'))}</p>`;
}
VIEWS.push({k:'expo',g:'pilot',ic:'pie',hide:1});
EXT.V.expo=()=>expoView();
/* entrée dans la barre latérale (sous Investissements) et dans les puces */
const _navSub=navSub;navSub=function(k){const h=_navSub(k);if(k!=='invest'||!h.includes('class="nvs"'))return h;return h.replace('<div class="nvs">',`<div class="nvs"><button class="nv sub" data-a="go" data-v="expo"${S.ui.view==='expo'?' aria-current="page"':''}><i class="dot" style="--c:var(--accent)"></i><span>${esc(t('ex.nav'))}</span></button>`)};
const _envChips=envChips;envChips=function(cur){const h=_envChips(cur);if(!h)return h;return h.replace(/(<button class="chip" data-a="go" data-v="invest"[^>]*>[^<]*<\/button>)/,`$1<button class="chip" data-a="go" data-v="expo" aria-pressed="${cur==='expo'}">${esc(t('ex.nav'))}</button>`)};
