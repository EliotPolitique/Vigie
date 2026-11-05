/* ================= historique d'opérations des comptes à positions ================= */
/* opération : {id, acc, d, t, isin, sym, n, cls, q, px, amt, fee, tax, cur, ext, s}
   t : buy | sell | div | int | dep | wd | fee | tax | in | out | pl | other
   amt : montant brut signé (achat < 0, vente > 0) ; fee / tax : montants positifs ; effet espèces = amt − fee − tax */
const IOP_IC={buy:'plus',sell:'swap',div:'coins',int:'coins',dep:'upload',wd:'download',fee:'bank',tax:'receipt',in:'plus',out:'swap',pl:'bars',other:'more'};
function iopsOf(accId){return (D().iops||[]).filter(o=>o.acc===accId)}
const iopKey=o=>o.isin||(o.sym?pfRoot(o.sym):'')||norm(o.n||'');
const iopNet=o=>r2((+o.amt||0)-(+o.fee||0)-(+o.tax||0));
/* rejoue l'historique : quantités, prix de revient moyen pondéré (frais inclus), plus-values réalisées, flux */
function replayOps(ops){
  const pos=new Map();
  const T={dep:0,wd:0,other:0,div:0,int:0,fee:0,tax:0,real:0,cash:0,buys:0,sells:0,first:null,last:null,n:0,ownCash:false};
  const seq=[...ops].sort((a,b)=>a.d.localeCompare(b.d)||(a.s||0)-(b.s||0));
  for(const o of seq){
    const net=iopNet(o);T.cash+=net;T.fee+=+o.fee||0;T.tax+=+o.tax||0;T.n++;
    if(!T.first)T.first=o.d;T.last=o.d;
    const k=iopKey(o);let P=null;
    if(k&&['buy','sell','in','out','div','pl'].includes(o.t)){P=pos.get(k);if(!P){P={key:k,isin:o.isin||'',sym:o.sym||'',n:o.n||'',cls:o.cls||'',cur:o.cur||'',qty:0,cost:0,costPx:0,real:0,div:0,fee:0,px:0,pxd:'',ops:0,parkQ:0,parkC:0,parkP:0};pos.set(k,P)}
      if(o.n)P.n=o.n;if(o.isin&&!P.isin)P.isin=o.isin;if(o.sym&&!P.sym)P.sym=o.sym;if(o.cls)P.cls=o.cls;if(o.cur)P.cur=o.cur;P.ops++;P.fee+=(+o.fee||0)+(+o.tax||0)}
    const q=Math.abs(+o.q||0),px=+o.px||0;
    switch(o.t){
      case 'buy':{const c=Math.abs(+o.amt||0)+(+o.fee||0)+(+o.tax||0);P.qty+=q;P.cost+=c;P.costPx+=q*px;T.buys+=c;break}
      case 'in':{let c=q*px,cp=q*px;if(!px&&P.parkQ>1e-12){const sh=Math.min(1,q/P.parkQ);c=P.parkC*sh;cp=P.parkP*sh;P.parkQ-=Math.min(q,P.parkQ);P.parkC-=c;P.parkP-=cp}P.qty+=q;P.cost+=c;P.costPx+=cp;break}
      case 'sell':case 'out':{const sh=P.qty>1e-12?Math.min(1,q/P.qty):0;const c=P.cost*sh,cp=P.costPx*sh;P.cost-=c;P.costPx-=cp;P.qty-=Math.min(q,P.qty);
        if(o.t==='sell'){const pr=net;P.real+=pr-c;T.real+=pr-c;T.sells+=pr}else if(!px){P.parkQ+=q;P.parkC+=c;P.parkP+=cp}
        break}
      case 'pl':P.real+=net;T.real+=net;break;
      case 'div':if(P)P.div+=net;T.div+=net;break;
      case 'int':T.int+=net;break;
      case 'dep':T.dep+=net;T.ownCash=true;break;
      case 'wd':T.wd+=-net;T.ownCash=true;break;
      case 'other':T.other+=net;break;
    }
    if(P&&px>0&&(o.t==='buy'||o.t==='sell')){P.px=px;P.pxd=o.d}
    if(P&&Math.abs(P.qty)<1e-7){P.qty=0;P.cost=0;P.costPx=0}
  }
  ['dep','wd','other','div','int','fee','tax','real','cash','buys','sells'].forEach(k=>T[k]=r2(T[k]));
  const list=[...pos.values()].map(P=>({...P,qty:+P.qty.toFixed(8),pru:P.qty>0?P.cost/P.qty:0,pruPx:P.qty>0&&P.costPx>0?P.costPx/P.qty:0,real:r2(P.real),div:r2(P.div)}));
  return {pos:list,open:list.filter(p=>p.qty>1e-7),T};
}
function holdKind(p,accType){
  const k=pfKind({name:p.n,isin:p.isin,sym:p.sym,crypto:p.cls==='crypto'},{type:accType});
  if(p.cls==='bond')return 'bond';if(p.cls==='crypto')return 'crypto';if(p.cls==='stock'&&k==='fund')return 'stock';
  if(p.cls==='fund'&&k==='stock')return 'etf';return k;
}
/* applique le résultat de l'historique aux positions du compte */
function recalcHoldings(a,opt){
  opt=opt||{};const R=replayOps(iopsOf(a.id));const fx=ST().fx;let n=0;const seen=new Set();
  R.open.forEach(p=>{
    const P={name:p.n,isin:p.isin||null,sym:p.sym||null};let h=pfMatch(a,P);
    const acur=a.cur||'EUR';const pcur=p.cur||acur;
    if(!h){const kind=holdKind(p,a.type);h={id:uid(),name:p.n||p.sym||p.isin,isin:p.isin||'',ticker:p.sym&&!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(p.sym)?pfRoot(p.sym):'',gsym:'',kind,cur:pcur,qty:0,price:p.px||0,pru:0,ter:0,div:0,region:pfRegion({name:p.n,isin:p.isin,sym:p.sym},kind),sector:kind==='stock'?'other':'diversified',months:[],src:'ops'};a.holdings.push(h)}
    seen.add(h.id);
    const hc=h.cur||acur;
    const pru=hc!==acur&&p.pruPx>0&&pcur===hc?p.pruPx:p.pru*((fx[acur]??1)/(fx[hc]??1));
    if(Math.abs((+h.qty||0)-p.qty)>1e-8||Math.abs((+h.pru||0)-pru)>1e-4)n++;
    h.qty=p.qty;h.pru=+pru.toFixed(4);delete h.pruEst;
    if(p.px>0&&(!(+h.price>0)||(p.pxd&&p.pxd>(h.pxd||'')&&(!h.liveAt||String(h.liveAt).slice(0,10)<p.pxd)))){h.price=+(p.px*((fx[pcur]??1)/(fx[hc]??1))).toFixed(4);h.pxd=p.pxd}
    if(!h.isin&&p.isin)h.isin=p.isin;
  });
  if(opt.rm!==false){const before=a.holdings.length;a.holdings=a.holdings.filter(h=>seen.has(h.id)||h.kind==='fe');n+=before-a.holdings.length}
  if(R.T.ownCash&&opt.cash!==false)a.cash=Math.max(0,r2(R.T.cash));
  a.updatedAt=today();a.opsAt=R.T.last;
  return n;
}

/* ---------- lecteurs : CSV Trade Republic, CSV générique, PDF (relevés de compte, XTB) ---------- */
const TR_HDR=['account_type','category','type','shares','transaction_id'];
function isTrCsv(header){const h=header.map(x=>String(x).trim().toLowerCase());return TR_HDR.every(k=>h.includes(k))}
const trCls=c=>({STOCK:'stock',FUND:'fund',BOND:'bond',CRYPTO:'crypto',DERIVATIVE:'deriv',PRIVATE_FUND:'fund'})[c]||'';
const cleanDesc=s=>scrubLabel(String(s||'').replace(/\(\s*[A-Z]{2}\d{2}[A-Z0-9]{8,30}\s*\)/g,'').replace(/\*{2,}\d+/g,'').replace(/\s+/g,' ').trim());
/* renvoie {groups:{key:{kind,label,type,ops:[],cash:[]}}, cashTotal, last} */
function parseTrCsv(header,rows){
  const H={};header.forEach((h,i)=>H[String(h).trim().toLowerCase()]=i);const g=(r,k)=>H[k]!=null?String(r[H[k]]??'').trim():'';
  const f=s=>{const v=parseFloat(String(s).replace(',','.'));return isFinite(v)?v:0};
  const G={};const grp=(k,kind,type,label)=>G[k]||(G[k]={key:k,kind,type,label,ops:[],cash:[]});
  let cashTotal=0,last='',seq=0;
  rows.forEach(r=>{
    const d=parseDate(g(r,'date'))||parseDate(g(r,'datetime').slice(0,10));if(!d)return;
    const acc=g(r,'account_type'),cat=g(r,'category'),ty=g(r,'type'),ac=g(r,'asset_class');
    const sym=g(r,'symbol'),isin=/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(sym)?sym:null;
    const sh=f(g(r,'shares')),px=f(g(r,'price')),amt=f(g(r,'amount')),fee=r2(-f(g(r,'fee'))),tax=r2(-f(g(r,'tax')));/* coûts positifs, remboursements négatifs */
    const base={d,isin,sym:isin?null:(sym||null),n:g(r,'name'),cls:trCls(ac),cur:g(r,'currency')||'EUR',ext:g(r,'transaction_id')||null,s:seq++,q:Math.abs(sh),px,amt,fee,tax};
    const net=r2(amt-fee-tax);
    if(acc!=='PEA'){cashTotal+=net;if(d>last)last=d}
    const pea=acc==='PEA';const gk=pea?'pea':(ac==='CRYPTO'?'crypto':'cto');
    const G1=pea?grp('pea','ops','pea','PEA'):ac==='CRYPTO'?grp('crypto','ops','wallet','Crypto'):grp('cto','ops','cto','Compte-titres');
    if(cat==='TRADING'){if(!sym)return;(gk==='crypto'?grp('crypto','ops','wallet','Crypto'):G1).ops.push({...base,t:sh<0||ty==='SELL'?'sell':'buy'});return}
    if(cat==='DELIVERY'){if(!sym||!sh)return;G1.ops.push({...base,t:sh>0?'in':'out',amt:0});return}
    if(cat==='CORPORATE_ACTION'){if(!sym)return;G1.ops.push({...base,t:sh<0?'sell':'in',amt:amt||0});return}
    /* espèces */
    if(pea){grp('pea','ops','pea','PEA').ops.push({...base,q:0,px:0,t:ty==='TRANSFER_IN'||ty==='TRANSFER_INBOUND'?(net>=0?'dep':'wd'):(ty==='DIVIDEND'?'div':(net>=0?'other':'wd'))});return}
    if(ty==='DIVIDEND'&&sym){grp(ac==='CRYPTO'?'crypto':'cto','ops',ac==='CRYPTO'?'wallet':'cto',ac==='CRYPTO'?'Crypto':'Compte-titres').ops.push({...base,q:0,px:0,t:'div'})}
    const lab=cleanDesc(g(r,'description'))||cleanDesc(g(r,'counterparty_name'))||ty;
    grp('cash','cash','checking','Compte espèces').cash.push({d,a:net,l:lab,ext:base.ext,ty});
  });
  return {groups:Object.values(G).filter(x=>x.ops.length||x.cash.length),cashTotal:r2(cashTotal),last};
}
/* CSV générique : rôles de colonnes devinés, type d'opération déduit du libellé ou du signe */
const ITX_ROLES=['date','type','isin','sym','name','qty','price','amount','fee','tax','cur'];
function guessItxCols(header){
  const m={};ITX_ROLES.forEach(k=>m[k]=-1);
  header.forEach((h,i)=>{const t=noAcc(String(h)).replace(/[’'_]/g,' ').trim();
    const set=k=>{if(m[k]<0)m[k]=i};
    if(/^(date|date d.?operation|date operation|trade date|datum|fecha|jour)\b/.test(t))set('date');
    else if(/^(type|sens|operation|nature|transaction type|action|art)\b/.test(t))set('type');
    else if(/isin/.test(t))set('isin');
    else if(/^(symbol|symbole|ticker|code|mnemo)/.test(t))set('sym');
    else if(/^(name|nom|libelle|produit|instrument|titre|valeur|description|security|asset)/.test(t))set('name');
    else if(/^(quantite|qte|qty|quantity|shares|nombre|volume|parts|units)/.test(t))set('qty');
    else if(/^(cours|prix|price|unit price|prix unitaire|cours d.?execution|execution price)/.test(t))set('price');
    else if(/^(montant net|montant|amount|total|net amount|valeur nette|value)/.test(t))set('amount');
    else if(/^(frais|fee|fees|commission|courtage)/.test(t))set('fee');
    else if(/^(tax|taxe|impot|ttf|withholding)/.test(t))set('tax');
    else if(/^(devise|currency|cur|ccy|monnaie)/.test(t))set('cur');
  });
  return m;
}
function itxType(s,q,amt){
  const t=noAcc(String(s||''));
  if(/achat|buy|kauf|compra|souscription|purchase|savings plan|plan d.?investissement/.test(t))return 'buy';
  if(/vente|sell|verkauf|venta|rachat|cession|sale/.test(t))return 'sell';
  if(/dividend|coupon|distribution|aussch/.test(t))return 'div';
  if(/interet|interest|zins/.test(t))return 'int';
  if(/versement|depot|deposit|inpayment|apport|virement entrant|transfer in|einzahlung/.test(t))return 'dep';
  if(/retrait|withdraw|virement sortant|transfer out|auszahlung/.test(t))return 'wd';
  if(/frais|fee|commission|droits de garde/.test(t))return 'fee';
  if(/taxe|tax|impot|prelevement/.test(t))return 'tax';
  if(q)return q<0||amt>0?'sell':'buy';
  return amt>=0?'dep':'wd';
}
function parseGenericItx(header,rows,m){
  const f=s=>{if(s==null||String(s).trim()==='')return 0;const v=parseAmount(String(s));return isFinite(v)?v:0};
  const ops=[];let seq=0;
  rows.forEach(r=>{const d=parseDate(r[m.date]);if(!d)return;
    const q=m.qty>-1?f(r[m.qty]):0,px=m.price>-1?Math.abs(f(r[m.price])):0;let amt=m.amount>-1?f(r[m.amount]):0;
    const t=itxType(m.type>-1?r[m.type]:(m.name>-1?r[m.name]:''),q,amt);
    if(!amt&&q&&px)amt=(t==='buy'?-1:1)*Math.abs(q)*px;
    if(t==='buy')amt=-Math.abs(amt);if(t==='sell')amt=Math.abs(amt);
    const isinRaw=m.isin>-1?String(r[m.isin]||'').trim().toUpperCase():'';
    const sym=m.sym>-1?String(r[m.sym]||'').trim().toUpperCase():'';
    ops.push({d,t,isin:isinOk(isinRaw)?isinRaw:null,sym:sym||null,n:m.name>-1?String(r[m.name]||'').trim().slice(0,80):'',q:Math.abs(q),px,amt,fee:Math.abs(m.fee>-1?f(r[m.fee]):0),tax:Math.abs(m.tax>-1?f(r[m.tax]):0),cur:m.cur>-1&&/^[A-Z]{3}$/.test(String(r[m.cur]).trim())?String(r[m.cur]).trim():'EUR',s:seq++});
  });
  return ops;
}
/* PDF : opérations d'un relevé de compte → mouvements de portefeuille (achats, ventes, dividendes, versements) */
const TRADE_BUY=/^(buy trade|savings plan execution|achat|ex[eé]cution (du )?plan|kauf|sparplan)/i,TRADE_SELL=/^(sell trade|vente|verkauf)/i;
function opToItx(o,pea){
  const l=o.l||'';const isin=([...l.matchAll(ISIN_G)].map(m=>m[1]).find(isinOk))||null;
  const qm=l.match(/(?:quantity|quantit[eé]|qt[eé]|st[uü]ck)\s*:?\s*([\d.,]+)/i);const q=qm?Math.abs(+qm[1].replace(',','.')):0;
  const name=isin?l.slice(l.indexOf(isin)+12).replace(/,\s*(quantity|quantit[eé]).*$/i,'').replace(/\s+/g,' ').trim().slice(0,80):'';
  if(isin&&q&&TRADE_BUY.test(l))return {d:o.d,t:'buy',isin,n:name,q,px:Math.abs(o.a)/q,amt:o.a,fee:0,tax:0,cur:'EUR'};
  if(isin&&q&&TRADE_SELL.test(l))return {d:o.d,t:'sell',isin,n:name,q,px:Math.abs(o.a)/q,amt:o.a,fee:0,tax:0,cur:'EUR'};
  if(isin&&/dividend|dividende|distribution/i.test(l))return {d:o.d,t:'div',isin,n:'',q:0,px:0,amt:o.a,fee:0,tax:0,cur:'EUR'};
  if(pea){if(/interest|int[eé]r[eê]ts/i.test(l))return {d:o.d,t:'int',q:0,px:0,amt:o.a,fee:0,tax:0,cur:'EUR'};
    return {d:o.d,t:o.a>=0?'dep':'wd',n:l.slice(0,60),q:0,px:0,amt:o.a,fee:0,tax:0,cur:'EUR'}}
  return null;
}
function pdfToItx(r){
  const secs=r.sections||[{name:r.name||'',ops:r.ops||[],endBal:r.endBal,startBal:r.startBal}];
  const G=[];let seq=0;
  secs.forEach(sec=>{const pea=/\bpea\b/i.test(sec.name||'');
    const ops=[],cash=[];
    sec.ops.forEach(o=>{const x=opToItx(o,pea);if(x){x.s=seq++;ops.push(x)}if(!pea&&!(x&&(x.t==='buy'||x.t==='sell')))cash.push({d:o.d,a:o.a,l:o.l})});
    if(pea){if(ops.length)G.push({key:'pea',kind:'ops',type:'pea',label:sec.name||'PEA',ops,cash:[]})}
    else{const tr=ops.filter(x=>x.t!=='dep'&&x.t!=='wd');if(tr.length)G.push({key:'cto',kind:'ops',type:'cto',label:t('ti.ctoOf',{n:sec.name||''}),ops:tr,cash:[]});
      if(cash.length)G.push({key:'cash',kind:'cash',type:'checking',label:sec.name||t('pi.cashName'),ops:[],cash,endBal:sec.endBal,period:r.period})}
  });
  /* XTB : historique des opérations de trésorerie (« OPEN BUY 1 @ 76.210 ») */
  const xo=[];(r.lines||[]).forEach(L=>{const s=L.str;const m=s.match(/^\d{8,}\s+(stock purchase|stock sale|deposit|withdrawal|tax \w+|close trade|dividend|divident|free.?funds interest|swap)\s+(\d{2}\/\d{2}\/\d{4})/i);if(!m)return;
    const d=parseDateH(m[2]);const amtIt=[...L.items].reverse().find(it=>/^-?\d+(\.\d+)?$/.test(it.str.trim()));if(!d||!amtIt)return;const a=+amtIt.str;
    const sy=(L.items.find(it=>/^[A-Z0-9]{1,8}\.[A-Z]{2,3}$/.test(it.str.trim()))||{}).str;const ty=m[1].toLowerCase();
    const om=s.match(/(OPEN|CLOSE) (BUY|SELL) ([\d.]+) @ ([\d.]+)/);const cur=sy&&SYM_CUR[sy.split('.')[1]]||'EUR';
    if(om&&ty==='stock purchase')xo.push({d,t:'buy',sym:sy,n:sy,q:+om[3],px:+om[4],amt:a,fee:0,tax:0,cur});
    else if(om&&ty==='stock sale')xo.push({d,t:'sell',sym:sy,n:sy,q:+om[3],px:+om[4],amt:a,fee:0,tax:0,cur});
    else if(ty==='close trade')xo.push({d,t:'pl',sym:sy,n:sy,q:0,px:0,amt:a,fee:0,tax:0,cur});
    else if(ty.startsWith('tax'))xo.push({d,t:'tax',sym:sy,n:sy||'',q:0,px:0,amt:0,fee:0,tax:Math.abs(a),cur:'EUR'});
    else if(ty==='deposit')xo.push({d,t:'dep',q:0,px:0,amt:a,fee:0,tax:0,cur:'EUR'});
    else if(ty==='withdrawal')xo.push({d,t:'wd',q:0,px:0,amt:a,fee:0,tax:0,cur:'EUR'});
    else if(/divid/.test(ty))xo.push({d,t:'div',sym:sy,n:sy||'',q:0,px:0,amt:a,fee:0,tax:0,cur:'EUR'});
    else if(/interest/.test(ty))xo.push({d,t:'int',q:0,px:0,amt:a,fee:0,tax:0,cur:'EUR'});
  });
  if(xo.length){xo.forEach(x=>x.s=seq++);G.push({key:'xtb',kind:'ops',type:'cto',label:'XTB',ops:xo,cash:[]})}
  return G;
}
/* doublon : identifiant externe, sinon date + type + titre + quantité (+ montant pour les flux) */
function iopSig(o){return [o.acc,o.d,o.t,o.isin||o.sym||'',(+o.q||0).toFixed(6),(o.t==='buy'||o.t==='sell'||o.t==='in'||o.t==='out')?'':iopNet(o).toFixed(2)].join('|')}

/* ---------- affichage ---------- */
function iopRow(o,showName=true){
  const net=iopNet(o);const nm=o.n||o.sym||o.isin||'';
  const named=showName&&nm;const sub=[named?t('ti.t.'+o.t):'',o.q?qtyT(o.q)+(o.px?' × '+moneyT(o.px,o.px<10?4:2,o.cur):''):'',(+o.fee||0)+(+o.tax||0)?t('ti.feeS',{v:moneyT((+o.fee||0)+(+o.tax||0),2)}):'',dateT(o.d,'short')].filter(Boolean).join(' · ');
  return `<div class="row"><span class="av sm" style="--c:${o.t==='buy'||o.t==='dep'||o.t==='in'?'var(--k3)':o.t==='div'||o.t==='int'?'var(--good)':'var(--k6)'}">${ico(IOP_IC[o.t]||'more')}</span><div class="m"><b>${esc(named?nm:t('ti.t.'+o.t))}</b><span>${esc(sub)}</span></div><div class="r"><b class="${net>0?'good':''}">${esc(moneyT(net,2))}</b></div></div>`;
}
function iopsSection(a){
  const ops=iopsOf(a.id);
  const btns=`<div class="act"><button class="btn sec sm" data-a="pimport" data-v="${a.id}">${ico('upload')}${esc(t('ti.importBtn'))}</button>${ops.length&&!a.fid?`<button class="btn sec sm" data-a="recalc" data-v="${a.id}">${ico('refresh')}${esc(t(S.ui.confirm==='rc'+a.id?'ti.recalcConfirm':'ti.recalcBtn'))}</button>`:''}</div>`;
  if(!ops.length)return `<div class="ch" style="margin-top:20px"><div><h2>${esc(t('ti.histT'))}</h2><p>${esc(t('ti.histEmpty'))}</p></div>${btns}</div>`;
  const R=replayOps(ops);const sorted=[...ops].sort((x,y)=>y.d.localeCompare(x.d)||(y.s||0)-(x.s||0));
  return `<div class="ch" style="margin-top:20px"><div><h2>${esc(t('ti.histT'))}</h2><p>${esc(t('ti.histSub',{n:ops.length,d:dateT(R.T.first,'short')}))}</p></div>${btns}</div>
  ${R.T.ownCash?`<div class="kpis" style="box-shadow:none;margin-bottom:10px">${kpi(t('ti.k.div'),money(R.T.div,2))}${kpi(t('ti.k.fee'),money(R.T.fee+R.T.tax,2))}</div>`:`<div class="kpis k4" style="box-shadow:none;margin-bottom:10px">${kpi(t('ti.k.buys'),money(R.T.buys,0))}${kpi(t('ti.k.div'),money(R.T.div,2))}${kpi(t('ti.k.fee'),money(R.T.fee+R.T.tax,2))}${kpi(t('ti.k.real'),`<span class="${cls(R.T.real)}">${moneyS(R.T.real,2)}</span>`)}</div>`}
  <div class="list">${sorted.slice(0,S.ui.iopsAll?2000:8).map(o=>iopRow(o)).join('')}</div>
  ${ops.length>8?`<button class="link" data-a="iopsAll" style="margin-top:8px">${esc(t(S.ui.iopsAll?'ti.less':'imp.showAll',{n:ops.length-8}))}</button>`:''}`;
}
function posOpsSection(p){
  const keys=new Set([p.isin,p.ticker&&pfRoot(p.ticker)].filter(Boolean));const nn=norm(p.name);
  const accIds=new Set(p.lines.map(l=>l.a.id));
  const ops=(D().iops||[]).filter(o=>accIds.has(o.acc)&&((o.isin&&keys.has(o.isin))||(o.sym&&keys.has(pfRoot(o.sym)))||(!o.isin&&!o.sym&&o.n&&norm(o.n)===nn)));
  if(!ops.length)return '';
  const R=replayOps(ops);const P=R.pos[0]||{real:0,div:0,fee:0};
  return `<div class="sec-t" style="margin-top:20px"><h2>${esc(t('ti.posOps'))}</h2><span class="note">${esc(t('ti.posOpsSub',{r:(P.real>0?'+':'')+moneyT(P.real,2),d:moneyT(P.div,2),f:moneyT(P.fee,2)}))}</span></div>
  <div class="list">${[...ops].sort((x,y)=>y.d.localeCompare(x.d)||(y.s||0)-(x.s||0)).slice(0,30).map(o=>iopRow(o,false)).join('')}</div>`;
}

/* ---------- dividendes réels tirés de l'historique ---------- */
/* dividende annuel estimé d'une ligne : dividendes par part perçus sur 12 mois glissants × quantité actuelle,
   extrapolés selon la fréquence observée si la ligne est détenue depuis moins d'un an */
let LDIV={k:'',m:new Map()};
function ledgerDiv(a,h){
  const ops=D().iops||[];const ck=ops.length+'|'+(ops.length?ops[ops.length-1].id:'');
  if(LDIV.k!==ck){LDIV={k:ck,m:new Map()}}
  const key=a.id+'|'+h.id+'|'+(+h.qty||0);if(LDIV.m.has(key))return LDIV.m.get(key);
  const keys=new Set([h.isin,h.ticker&&pfRoot(h.ticker)].filter(Boolean));const nn=norm(h.name);
  const mine=ops.filter(o=>o.acc===a.id&&((o.isin&&keys.has(o.isin))||(o.sym&&keys.has(pfRoot(o.sym)))||(!o.isin&&!o.sym&&o.n&&norm(o.n)===nn)))
    .sort((x,y)=>x.d.localeCompare(y.d)||(x.s||0)-(y.s||0));
  let q=0;const pays=[];
  for(const o of mine){
    if(o.t==='buy'||o.t==='in')q+=Math.abs(+o.q||0);
    else if(o.t==='sell'||o.t==='out')q=Math.max(0,q-Math.abs(+o.q||0));
    else if(o.t==='div'){const held=+o.q>0?+o.q:q;const net=iopNet(o);if(held>1e-9&&net>0)pays.push({d:o.d,ps:net/held,cur:o.cur||a.cur||'EUR'})}
  }
  let r=null;
  if(pays.length){
    const from=dAdd(today(),-365);const last=pays.filter(p=>p.d>=from);
    if(last.length){
      /* fréquence : écart médian entre versements (sur tout l'historique de la ligne) */
      let per=1;if(h.dfreq)per=h.dfreq;else if(pays.length>=2){const gaps=pays.slice(1).map((p,i)=>daysBetween(pays[i].d,p.d)).filter(g=>g>10).sort((x,y)=>x-y);const g=gaps.length?gaps[Math.floor(gaps.length/2)]:365;per=g<45?12:g<120?4:g<240?2:1}
      const ps=sum(last.map(p=>p.ps));const need=Math.max(per,last.length);const est=last.length<per;
      const annual=(ps/last.length)*need*(+h.qty||0);
      const months=per===12?[1,2,3,4,5,6,7,8,9,10,11,12]:[...new Set(last.map(p=>+p.d.slice(5,7)))].sort((x,y)=>x-y);
      r={amount:annual,cur:last[0].cur,months,n:last.length,est:est?'x':(pays.length<2?'one':''),per,last:pays[pays.length-1],pays};
    }
  }
  LDIV.m.set(key,r);return r;
}
/* rendement effectif d'une ligne (%) : saisi par l'utilisateur, sinon déduit des dividendes perçus */
function hDivEff(h,a){
  if(+h.div>0)return {div:+h.div,months:h.months||[],src:'manual'};
  if(h.kind==='fe')return {div:0,months:[],src:''};
  const L=ledgerDiv(a,h);const v=hVal(h,a);
  if(!L||!(v>0))return {div:0,months:h.months||[],src:''};
  return {div:conv(L.amount,L.cur)/v*100,months:L.months,src:'ops',est:L.est};
}
/* revenus effectivement perçus sur 12 mois glissants (dividendes et intérêts) */
function incomeReceived(){
  const from=dAdd(today(),-365);let div=0,int=0;
  D().txs.forEach(x=>{if(x.d>=from&&x.c==='investIncome'&&x.a>0){if(/interest|int[eé]r[eê]t|zins/i.test(x.l))int+=x.a;else div+=x.a}});
  /* dividendes versés à l'intérieur d'une enveloppe qui a ses propres espèces (PEA, assurance-vie…) */
  D().accounts.forEach(a=>{const ops=iopsOf(a.id);if(!ops.some(o=>o.t==='dep'||o.t==='wd'))return;ops.forEach(o=>{if(o.d>=from&&(o.t==='div'||o.t==='int')){const n=iopNet(o);if(o.t==='div')div+=n;else int+=n}})});
  return {div:r2(div),int:r2(int),total:r2(div+int)};
}

/* performance depuis l'ouverture d'une enveloppe qui a ses propres versements (PEA, assurance-vie…) :
   plus-value totale = valeur (positions + espèces) − versements nets ; = latente + réalisée + dividendes et intérêts conservés */
function accPerf(a){
  const ops=iopsOf(a.id);if(!ops.length)return null;const R=replayOps(ops);if(!R.T.ownCash)return null;
  const hv=sum(a.holdings.map(h=>hVal(h,a))),cost=sum(a.holdings.map(h=>hCost(h,a))),cash=conv(+a.cash||0,a.cur);
  const net=r2(R.T.dep-R.T.wd+R.T.other);const value=hv+cash;const total=value-net;
  return {net,value,total,pct:net>0?total/net:0,latent:hv-cost,real:R.T.real,inc:R.T.div+R.T.int,first:R.T.first};
}
