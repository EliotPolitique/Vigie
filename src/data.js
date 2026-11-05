/* ================= modèle de données ================= */
const DEFAULT_SETTINGS=()=>({
  lang:'fr',cur:'EUR',theme:'system',accent:'saphir',privacy:false,pin:'',name:'',
  fx:{EUR:1,USD:0.92,GBP:1.17,CHF:1.06,CAD:0.67,JPY:0.0061},
  rates:{livretA:1.7,ldds:1.7,lep:2.5,livretJeune:2.0,pel:2.0},
  tax:{ir:12.8,ps:18.6,psAV:17.2,avAfter8:7.5,avAbatt:4600,tmi:11,mode:'pfu'},
  emergencyMonths:6,swr:4,startDay:1,density:'normal',gsheet:''
});
const emptyData=()=>({v:1,settings:DEFAULT_SETTINGS(),accounts:[],txs:[],iops:[],budgets:{},goals:[],rules:[],history:[],created:today()});
function migrate(d){
  const base=emptyData();
  d=Object.assign(base,d||{});
  d.settings=Object.assign(DEFAULT_SETTINGS(),d.settings||{});
  ['fx','rates','tax'].forEach(k=>d.settings[k]=Object.assign(DEFAULT_SETTINGS()[k],(d.settings||{})[k]||{}));
  ['accounts','txs','goals','rules','history','iops'].forEach(k=>{if(!Array.isArray(d[k]))d[k]=[]});
  if(!d.budgets||typeof d.budgets!=='object')d.budgets={};
  d.accounts.forEach(a=>{if(!Array.isArray(a.holdings))a.holdings=[];if(a.include==null)a.include=true});
  EXT.boot.forEach(f=>{try{f(d)}catch(e){console.warn(e)}});
  return d;
}

/* ================= conversions et valeurs ================= */
const D=()=>S.data;
const ST=()=>S.data.settings;
function conv(v,cur){const fx=ST().fx,base=ST().cur;const a=fx[cur||base]??1,b=fx[base]??1;return v*a/b}
function hVal(h,a){return conv((+h.qty||0)*(+h.price||0),h.cur||a.cur)}
function hCost(h,a){return conv((+h.qty||0)*(+h.pru||0),h.cur||a.cur)}
function accGross(a){const t=TYP[a.type]||{};if(t.h)return sum(a.holdings.map(h=>hVal(h,a)))+conv(+a.cash||0,a.cur);return conv(+a.balance||0,a.cur)}
function accValue(a){const t=TYP[a.type]||{};const v=accGross(a);return t.cls==='debt'?-Math.abs(v):v}
function accCls(a){return (TYP[a.type]||{}).cls||'other'}
function totals(data){
  data=data||D();
  const by={};CLASSES.forEach(c=>by[c.k]=0);
  let gross=0,debts=0;
  data.accounts.filter(a=>a.include!==false).forEach(a=>{const v=accValue(a),c=accCls(a);by[c]+=v;if(c==='debt')debts+=-v;else gross+=v});
  return {gross,debts,net:gross-debts,by,liquid:by.cash+by.savings,financial:by.cash+by.savings+by.invest+by.crypto};
}
function positions(){
  const map=new Map();
  D().accounts.filter(a=>a.include!==false&&(TYP[a.type]||{}).h).forEach(a=>a.holdings.forEach(h=>{
    const key=(h.isin||h.ticker||h.name||'').toUpperCase();
    const v=hVal(h,a),c=hCost(h,a);
    let p=map.get(key);
    if(!p){p={key,name:h.name,ticker:h.ticker,isin:h.isin,kind:h.kind,region:h.region,sector:h.sector,ter:+h.ter||0,div:0,divV:0,months:[],divSrc:'',value:0,cost:0,qty:0,price:+h.price||0,cur:h.cur||a.cur,accounts:[],lines:[]};map.set(key,p)}
    p.value+=v;p.cost+=c;p.qty+=(+h.qty||0);p.accounts.push(a.id);p.lines.push({a,h});
    const E=hDivEff(h,a);p.divV+=v*(E.div||0)/100;if(E.months&&E.months.length)p.months=[...new Set(p.months.concat(E.months))].sort((x,y)=>x-y);if(E.src&&!p.divSrc)p.divSrc=E.src;if(E.est)p.divEst=1;
  }));
  return [...map.values()].map(p=>({...p,div:p.value>0?p.divV/p.value*100:0,pl:p.value-p.cost,plp:p.cost>0?(p.value-p.cost)/p.cost:0})).sort((x,y)=>y.value-x.value);
}
function investAccounts(){return D().accounts.filter(a=>a.include!==false&&(TYP[a.type]||{}).h)}

/* ================= historique ================= */
function snapshotNow(){const t=totals();const s={d:today(),nw:r2(t.net),g:r2(t.gross),db:r2(t.debts)};CLASSES.forEach(c=>s[c.k]=r2(t.by[c.k]));return s}
function recordSnapshot(){
  const h=D().history,s=snapshotNow();
  const i=h.findIndex(x=>x.d===s.d);
  if(i>-1){const o=h[i];if(o.nw===s.nw&&o.g===s.g)return false;h[i]=s}else h.push(s);
  h.sort((a,b)=>a.d.localeCompare(b.d));
  if(h.length>1500)h.splice(0,h.length-1500);
  return true;
}
const PERIODS={'1M':30,'3M':91,'6M':182,'YTD':-1,'1Y':365,'3Y':1095,'ALL':1e6};
function seriesFor(period,key='nw'){
  const h=D().history;if(!h.length)return [];
  const end=today();let start;
  if(period==='YTD')start=end.slice(0,4)+'-01-01';else start=dAdd(end,-PERIODS[period]);
  let pts=h.filter(x=>x.d>=start).map(x=>({d:x.d,v:x[key]??0}));
  const before=h.filter(x=>x.d<start).pop();
  if(before&&(!pts.length||pts[0].d>start))pts.unshift({d:start,v:before[key]??0});
  const live=snapshotNow();
  if(!pts.length||pts[pts.length-1].d!==live.d)pts.push({d:live.d,v:live[key]});else pts[pts.length-1].v=live[key];
  return pts;
}

/* ================= budget ================= */
function monthTx(ym){return D().txs.filter(t=>ymOf(t.d)===ym)}
function aggTx(list){
  const g={inc:0,exp:0,sav:0,cat:{},n:list.length};
  for(const t of list){const c=CAT[t.c]||CAT.uncat;const v=conv(t.a,(D().accounts.find(a=>a.id===t.acc)||{}).cur);
    if(c.kind==='move')continue;
    if(c.kind==='save'){g.sav-=v;g.cat[c.k]=(g.cat[c.k]||0)-v;continue}
    if(v>0&&c.kind!=='out'){g.inc+=v;g.cat[c.k]=(g.cat[c.k]||0)+v}
    else if(v<0){g.exp-=v;g.cat[c.k]=(g.cat[c.k]||0)-v}
    else {g.exp-=v;g.cat[c.k]=(g.cat[c.k]||0)-v}
  }
  g.net=g.inc-g.exp;g.rate=g.inc>0?(g.inc-g.exp)/g.inc:null;
  return g;
}
function curBudgetYm(){const cur=today().slice(0,7);if(monthTx(cur).filter(x=>x.a<0).length<3&&monthTx(ymAdd(cur,-1)).length)return ymAdd(cur,-1);return cur}
function txMonths(){const s=new Set(D().txs.map(t=>ymOf(t.d)));s.add(today().slice(0,7));return [...s].sort()}
function avgMonthlyExpense(n=6){
  const end=today().slice(0,7);const ms=[];for(let i=1;i<=n;i++)ms.push(ymAdd(end,-i));
  const vals=ms.map(m=>aggTx(monthTx(m)).exp).filter(v=>v>0);
  return vals.length?sum(vals)/vals.length:0;
}
function recurring(){
  const end=today().slice(0,7),from=ymAdd(end,-6);const groups={};
  D().txs.filter(t=>t.a<0&&(CAT[t.c]||{}).kind==='out'&&ymOf(t.d)>=from).forEach(t=>{const key=norm(cleanLabel(t.l)).split(' ').filter(w=>w.length>1&&!/^\d+$/.test(w)).slice(0,2).join(' ');if(!key)return;(groups[key]=groups[key]||[]).push(t)});
  const out=[];
  for(const [k,g] of Object.entries(groups)){const months=new Set(g.map(t=>ymOf(t.d)));if(months.size<3)continue;
    const amts=g.map(t=>-t.a),mx=Math.max(...amts),mn=Math.min(...amts);if(mn<=0||mx/mn>1.25)continue;
    const days=g.map(t=>+t.d.slice(8,10)).sort((a,b)=>a-b);const last=g.map(t=>t.d).sort().pop();
    out.push({k,l:cleanLabel(g[g.length-1].l),avg:sum(amts)/amts.length,day:days[Math.floor(days.length/2)],c:g[g.length-1].c,n:months.size,last})}
  return out.sort((a,b)=>b.avg-a.avg);
}
function cleanLabel(l){
  let s=String(l||'');
  s=s.replace(/^(paiement par carte|paiement carte|achat cb|carte bancaire|cb|carte|prlv sepa|prlv|prelevement sepa|prélèvement sepa|prélèvement|prelevement|vir sepa recu|vir sepa emis|vir sepa|vir inst|vir)\s*[:\-]?\s*/i,'');
  s=s.replace(/\b\d{2}[\/.]\d{2}(?:[\/.]\d{2,4})?\b/g,'').replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}\b/g,'').replace(/\b\d{6,}\b/g,'').replace(/\s+/g,' ').trim();
  return s||l;
}

/* ================= revenus passifs ================= */
function passiveIncome(){
  const months=Array(12).fill(0).map(()=>({div:0,int:0,rent:0}));
  const lines=[];
  D().accounts.filter(a=>a.include!==false).forEach(a=>{
    const t=TYP[a.type]||{};
    if(t.h)a.holdings.forEach(h=>{
      if(h.kind==='bond'&&+h.coupon>0){const y=conv((+h.qty||0)*(+h.nominal||+h.price||0)*(+h.coupon)/100,h.cur||a.cur);if(y>0&&(!h.maturity||h.maturity>=today())){const ms=(h.cmonths&&h.cmonths.length)?h.cmonths:[h.maturity?+h.maturity.slice(5,7):12];ms.forEach(m=>months[m-1].int+=y/ms.length);lines.push({type:'coupon',name:h.name,acc:a,amount:y,months:ms,yield:hVal(h,a)>0?y/hVal(h,a)*100:0})}return}
      const v=hVal(h,a);const E=hDivEff(h,a);const y=v*(E.div||0)/100;
      if(y<=0)return;
      const ms=(E.months&&E.months.length)?E.months:[1,2,3,4,5,6,7,8,9,10,11,12];
      const isInt=h.kind==='fe';
      const sw=E.w?sum(E.w):0;if(isInt){months[11].int+=y}else if(sw>0)E.w.forEach((x,i)=>{if(x>0)months[i].div+=y*x/sw});else ms.forEach(m=>months[m-1].div+=y/ms.length);
      lines.push({type:isInt?'int':'div',name:h.name,acc:a,h,amount:y,months:isInt?[12]:ms,w:isInt?null:E.w,yield:E.div||0,src:E.src,est:E.est});
    });
    else if(t.rate||a.rate){const rate=(+a.rate)||ST().rates[t.rate]||0;const y=accGross(a)*rate/100;if(y>0){months[11].int+=y;lines.push({type:'int',name:a.name,acc:a,amount:y,months:[12],yield:rate})}}
    if(t.cls==='realestate'&&+a.rent>0){const y=a.type==='property'&&typeof propModel==='function'?propModel(a).grossY:conv(+a.rent,a.cur)*12;for(let m=0;m<12;m++)months[m].rent+=y/12;lines.push({type:'rent',name:a.name,acc:a,amount:y,months:[1,2,3,4,5,6,7,8,9,10,11,12],yield:accGross(a)>0?y/accGross(a)*100:0})}
    EXT.passive.forEach(fn=>fn(a,months,lines));
  });
  const total=sum(lines.map(l=>l.amount));
  return {months,lines:lines.sort((a,b)=>b.amount-a.amount),total};
}

/* ================= objectifs ================= */
function goalCurrent(g){
  if(!g.accounts||!g.accounts.length)return +g.manual||0;
  return sum(D().accounts.filter(a=>g.accounts.includes(a.id)).map(accValue));
}
function goalProjection(g){
  const cur=goalCurrent(g),target=+g.target||0,m=+g.monthly||0,r=(+g.rate||0)/100/12;
  if(cur>=target)return {months:0,date:today(),cur,target,pct:1};
  let v=cur,n=0;while(v<target&&n<720){v=v*(1+r)+m;n++}
  const pct=target>0?clamp(cur/target,0,1):0;
  let need=null;
  if(g.date){const mm=Math.max(1,Math.round(daysBetween(today(),g.date)/30.44));if(r>0){const f=Math.pow(1+r,mm);need=(target-cur*f)*r/(f-1)}else need=(target-cur)/mm;need=Math.max(0,need)}
  return {months:n>=720?null:n,date:n>=720?null:mAddIso(today(),n),cur,target,pct,need};
}

/* ================= santé financière ================= */
function health(){
  const t=totals(),exp=avgMonthlyExpense(6);
  const emergency=exp>0?t.liquid/exp:null;
  const vals=CLASSES.filter(c=>c.k!=='debt').map(c=>Math.max(0,t.by[c.k]));const tot=sum(vals);
  const hhi=tot>0?sum(vals.map(v=>(v/tot)**2)):1;
  const pos=positions();const invTot=sum(pos.map(p=>p.value));
  const top=pos[0];const topW=invTot>0&&top?top.value/invTot:0;
  const ter=invTot>0?sum(pos.map(p=>p.value*(p.ter||0)))/invTot:0;
  const debtRatio=t.gross>0?t.debts/t.gross:0;
  const months=txMonths().slice(-4,-1);const rates=months.map(m=>aggTx(monthTx(m)).rate).filter(x=>x!=null);
  const savRate=rates.length?sum(rates)/rates.length:null;
  let score=50;
  if(emergency!=null)score+=clamp((emergency/ST().emergencyMonths)*15,0,15)-5;
  score+=clamp((1-hhi)*25,0,20);
  score-=clamp(debtRatio*25,0,20);
  if(savRate!=null)score+=clamp(savRate*60,-10,15);
  score-=clamp((ter-0.3)*10,0,8);
  score-=clamp((topW-0.25)*30,0,10);
  return {score:Math.round(clamp(score,0,100)),emergency,hhi,top,topW,ter,debtRatio,savRate,exp,t};
}

/* ================= démo réaliste (données fictives) ================= */
function buildDemo(lang){
  const R=rng(20261101);const d=emptyData();d.demo=true;
  d.settings.lang=lang||'fr';d.settings.name='Camille';
  const T=today();
  const A=(o)=>{const a=Object.assign({id:uid(),include:true,holdings:[],cur:'EUR',createdAt:'2023-01-10',updatedAt:T},o);d.accounts.push(a);return a};
  const H=(o)=>Object.assign({id:uid(),cur:'EUR',ter:0,div:0,months:[]},o);
  const chk=A({name:'Compte courant',inst:'Banque Aster',type:'checking',balance:3240.18});
  const la=A({name:'Livret A',inst:'Banque Aster',type:'livretA',balance:15400});
  A({name:'LDDS',inst:'Banque Aster',type:'ldds',balance:8200});
  A({name:'PEA',inst:'Courtier Atlas',type:'pea',opened:'2021-03-15',cash:412.6,holdings:[
    H({name:'ETF MSCI World',ticker:'WLD',isin:'FR0000000001',kind:'etf',qty:95,pru:268.2,price:312.4,region:'world',sector:'diversified',ter:0.25}),
    H({name:'ETF S&P 500',ticker:'SP5',isin:'FR0000000002',kind:'etf',qty:420,pru:38.1,price:44.8,region:'us',sector:'diversified',ter:0.15}),
    H({name:'ETF Marchés émergents',ticker:'EMK',isin:'FR0000000003',kind:'etf',qty:300,pru:24.9,price:26.2,region:'em',sector:'diversified',ter:0.3}),
    H({name:'Air Liquide',ticker:'AI',isin:'FR0000120073',kind:'stock',qty:18,pru:152,price:178.3,region:'france',sector:'materials',div:1.8,months:[5]}),
    H({name:'TotalEnergies',ticker:'TTE',isin:'FR0000120271',kind:'stock',qty:40,pru:54.2,price:58.5,region:'france',sector:'energy',div:5.6,months:[1,4,7,10]}),
    H({name:'LVMH',ticker:'MC',isin:'FR0000121014',kind:'stock',qty:4,pru:700,price:621,region:'france',sector:'consumer',div:2.1,months:[4,12]}),
    H({name:'Schneider Electric',ticker:'SU',isin:'FR0000121972',kind:'stock',qty:10,pru:190,price:238.6,region:'france',sector:'industry',div:1.6,months:[5]})
  ]});
  A({name:'Compte-titres',inst:'Courtier Atlas',type:'cto',opened:'2023-06-02',cash:180,holdings:[
    H({name:'Apple',ticker:'AAPL',isin:'US0378331005',kind:'stock',qty:12,pru:180,price:231.5,cur:'USD',region:'us',sector:'tech',div:0.45,months:[2,5,8,11]}),
    H({name:'Microsoft',ticker:'MSFT',isin:'US5949181045',kind:'stock',qty:6,pru:332,price:421.9,cur:'USD',region:'us',sector:'tech',div:0.75,months:[3,6,9,12]}),
    H({name:'Realty Income',ticker:'O',isin:'US7561091049',kind:'stock',qty:40,pru:55.3,price:57.1,cur:'USD',region:'us',sector:'realestate',div:5.6,months:[1,2,3,4,5,6,7,8,9,10,11,12]})
  ]});
  A({name:'Assurance-vie',inst:'Assureur Lumen',type:'av',opened:'2018-09-01',holdings:[
    H({name:'Fonds en euros',kind:'fe',qty:18000,pru:1,price:1,region:'europe',sector:'diversified',div:2.6}),
    H({name:'ETF MSCI World (UC)',ticker:'WLD',isin:'FR0000000001',kind:'etf',qty:10.4,pru:280,price:312.4,region:'world',sector:'diversified',ter:0.25}),
    H({name:'SCPI Rendement',kind:'scpi',qty:20,pru:200,price:198,region:'europe',sector:'realestate',div:4.6,months:[1,4,7,10],ter:0})
  ]});
  A({name:'Portefeuille crypto',inst:'Plateforme Orion',type:'wallet',holdings:[
    H({name:'Bitcoin',ticker:'BTC',kind:'crypto',qty:0.085,pru:52000,price:92400,region:'other',sector:'other'}),
    H({name:'Ethereum',ticker:'ETH',kind:'crypto',qty:1.2,pru:2600,price:3380,region:'other',sector:'other'})
  ]});
  const flat=A({name:'Studio locatif — Lille',inst:'',type:'property',balance:148000,rent:620,address:'Lille (59)'});
  A({name:'Crédit immobilier studio',inst:'Banque Aster',type:'mortgage',balance:112400,loanRate:1.85,monthly:640,end:'2041-04-05',linked:flat.id});
  A({name:'Voiture',type:'vehicle',balance:11500});
  A({name:'Montre automatique',type:'valuables',balance:4200});

  /* opérations : 14 mois */
  const tx=(dt,a,l,c)=>d.txs.push({id:uid(),d:dt,a:r2(a),l,c:c||categorize(l,a,[]),acc:chk.id});
  const endYm=T.slice(0,7);
  for(let i=13;i>=0;i--){
    const ym=ymAdd(endYm,-i);const day=n=>ym+'-'+pad(n);const lastDay=+T.slice(8,10);
    const ok=n=>i>0||n<=lastDay;
    if(ok(1))tx(day(1),2650,'VIR SEPA SALAIRE ATELIER NOVA','salary');
    if(ok(3))tx(day(3),620,'VIR LOYER STUDIO LILLE','otherIn');
    if(ok(5))tx(day(5),-640,'PRLV CREDIT IMMO BANQUE ASTER','housing');
    if(ok(5))tx(day(5),-400,'VIR PEA COURTIER ATLAS','saving');
    if(ok(6))tx(day(6),-150,'VIR LIVRET A','saving');
    if(ok(2))tx(day(2),-86.4,'PRLV NAVIGO ILE DE FRANCE MOBILITES','transport');
    if(ok(7))tx(day(7),-19.99,'PRLV FREE MOBILE','subscriptions');
    if(ok(9))tx(day(9),-13.49,'CB NETFLIX.COM','subscriptions');
    if(ok(11))tx(day(11),-11.12,'CB SPOTIFY','subscriptions');
    if(ok(12))tx(day(12),-r2(52+R()*30),'PRLV EDF','utilities');
    if(ok(14))tx(day(14),-38.5,'PRLV ASSURANCE MAIF','insurance');
    if(ok(15))tx(day(15),-29.9,'PRLV MUTUELLE ALAN','insurance');
    const shops=['CB CARREFOUR CITY','CB MONOPRIX','CB LIDL','CB PICARD','CB BIOCOOP'];
    for(let w=0;w<4;w++){const dd=3+w*7+Math.floor(R()*3);if(ok(dd))tx(day(dd),-r2(38+R()*62),shops[Math.floor(R()*shops.length)],'groceries')}
    const rest=['CB BOULANGERIE PAUL','CB UBER EATS','CB SUSHI SHOP','CB BRASSERIE DU MARCHE','CB STARBUCKS'];
    for(let k=0;k<5;k++){const dd=2+Math.floor(R()*26);if(ok(dd))tx(day(dd),-r2(8+R()*34),rest[Math.floor(R()*rest.length)],'restaurants')}
    const shop=['CB FNAC','CB AMAZON','CB DECATHLON','CB UNIQLO','CB IKEA'];
    for(let k=0;k<2;k++){const dd=4+Math.floor(R()*24);if(ok(dd))tx(day(dd),-r2(15+R()*85),shop[Math.floor(R()*shop.length)],'shopping')}
    const fun=['CB UGC CINE CITE','CB STEAM','CB FNAC SPECTACLES','CB BAR LE COMPTOIR'];
    for(let k=0;k<2;k++){const dd=6+Math.floor(R()*20);if(ok(dd))tx(day(dd),-r2(10+R()*40),fun[Math.floor(R()*fun.length)],'leisure')}
    if(R()<.45){const dd=10+Math.floor(R()*15);if(ok(dd))tx(day(dd),-r2(25+R()*40),'CB PHARMACIE DU CENTRE','health')}
    if(R()<.3){const dd=8+Math.floor(R()*15);if(ok(dd))tx(day(dd),r2(18+R()*30),'VIR CPAM REMBOURSEMENT','refunds')}
    const mo=+ym.slice(5,7);
    if([1,4,7,10].includes(mo)&&ok(20))tx(day(20),r2(31.4+R()*3),'DIVIDENDE TOTALENERGIES','investIncome');
    if([7,8].includes(mo)&&ok(16)){tx(day(16),-r2(180+R()*240),'CB AIR FRANCE','travel');tx(day(18),-r2(260+R()*200),'CB AIRBNB','travel')}
    if(mo===10&&ok(15))tx(day(15),-728,'PRLV DGFIP TAXE FONCIERE','taxes');
    if(mo===9&&ok(18))tx(day(18),-r2(170+R()*20),'CB INSCRIPTION UNIVERSITE','education');
    if(mo===12&&ok(18))tx(day(18),-r2(160+R()*90),'CB CADEAUX NOEL GALERIES','gifts');
    if(ok(28))tx(day(28),-2.5,'FRAIS COTISATION CARTE','fees');
  }
  d.txs.sort((a,b)=>b.d.localeCompare(a.d));
  d.budgets={groceries:380,restaurants:170,transport:110,shopping:150,leisure:110,subscriptions:60,travel:120,health:50,utilities:90};
  d.goals=[
    {id:uid(),name:'Épargne de précaution',target:20000,accounts:[la.id,d.accounts[2].id],monthly:150,rate:1.7,icon:'shield'},
    {id:uid(),name:'Apport résidence principale',target:60000,date:'2029-06-30',accounts:[d.accounts[4].id,d.accounts[5].id],monthly:500,rate:4,icon:'house'},
    {id:uid(),name:'Indépendance financière',target:750000,date:'2046-01-01',accounts:d.accounts.filter(a=>['pea','cto','av','wallet'].includes(a.type)).map(a=>a.id),monthly:900,rate:5,icon:'spark'}
  ];
  d.rules=[{p:'atelier nova',c:'salary'}];
  /* historique : 30 mois, quotidien, reconstruit à rebours depuis la valeur actuelle */
  S.data=d;const now=snapshotNow();
  const days=910;const hist=[];let f={};CLASSES.forEach(c=>f[c.k]=now[c.k]);
  const drift={cash:0,savings:-0.00055,invest:-0.0009,crypto:-0.0011,realestate:-0.00004,other:0.00012,debt:0.00011};
  const vol={cash:0.012,savings:0.0004,invest:0.0085,crypto:0.03,realestate:0.0006,other:0.001,debt:0};
  for(let i=0;i<=days;i++){
    const dt=dAdd(T,-i);const s={d:dt};let g=0,db=0;
    CLASSES.forEach(c=>{s[c.k]=r2(f[c.k]);if(c.k==='debt')db+=-f[c.k];else g+=f[c.k]});
    s.nw=r2(g-db);s.g=r2(g);s.db=r2(db);hist.push(s);
    CLASSES.forEach(c=>{const shock=(R()-.5)*2*vol[c.k];f[c.k]=f[c.k]*(1+drift[c.k]+shock)});
    if(R()<.04)f.cash*=1+(R()-.5)*.5;
  }
  d.history=hist.reverse();
  return d;
}
