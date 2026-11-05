/* ================= V4.3 — logos des établissements, actions et ETF =================
   Établissement → logo intégré ; titre → logo du titre (collection « logos ») puis de la société de gestion ; sinon monogramme ou icône du type. */
const INST_DOM=[
 [/bourso/,'boursobank.com'],[/trade ?republic/,'traderepublic.com'],[/fortuneo/,'fortuneo.fr'],[/revolut/,'revolut.com'],[/hello ?bank/,'hellobank.fr'],
 [/paypal/,'paypal.com'],[/credit cooperatif/,'credit-cooperatif.coop'],[/linxea/,'linxea.com'],[/binance/,'binance.com'],[/crypto\.?com/,'crypto.com'],
 [/bnp/,'mabanque.bnpparibas'],[/societe generale|\bsg\b/,'particuliers.sg.fr'],[/credit agricole/,'credit-agricole.fr'],[/\blcl\b/,'lcl.fr'],[/caisse d.?epargne/,'caisse-epargne.fr'],
 [/banque populaire/,'banquepopulaire.fr'],[/credit mutuel/,'creditmutuel.fr'],[/\bcic\b/,'cic.fr'],[/la banque postale|banque postale/,'labanquepostale.fr'],[/hsbc/,'hsbc.fr'],
 [/\bing\b/,'ing.fr'],[/n26/,'n26.com'],[/monabanq/,'monabanq.com'],[/qonto/,'qonto.com'],[/\bshine\b/,'shine.fr'],[/lydia|sumeria/,'sumeria.eu'],[/\bnickel\b/,'nickel.eu'],
 [/degiro/,'degiro.fr'],[/interactive brokers|ibkr/,'interactivebrokers.com'],[/saxo/,'home.saxo'],[/bourse direct/,'boursedirect.fr'],[/scalable/,'scalable.capital'],
 [/yomoni/,'yomoni.fr'],[/\bnalo\b/,'nalo.fr'],[/ramify/,'ramify.fr'],[/goodvest/,'goodvest.fr'],[/placement.?direct/,'placement-direct.fr'],[/lucya|apicil/,'apicil.com'],
 [/suravenir/,'suravenir.fr'],[/generali/,'generali.fr'],[/\baxa\b/,'axa.fr'],[/spirica/,'spirica.fr'],[/coinbase/,'coinbase.com'],[/\bkraken\b/,'kraken.com'],[/bitpanda/,'bitpanda.com'],
 [/\bledger\b/,'ledger.com'],[/\bmeria\b/,'meria.com'],[/\bwise\b/,'wise.com'],[/amex|american express/,'americanexpress.com'],[/\bswile\b/,'swile.co'],[/edenred/,'edenred.fr'],
 [/natixis|interepargne/,'interepargne.natixis.com'],[/amundi/,'amundi.fr'],[/epsor/,'epsor.fr'],[/gomining/,'gomining.com'],[/la premiere brique/,'lapremierebrique.fr'],
 [/homunity/,'homunity.com'],[/\bcorum\b/,'corum.fr'],[/primonial/,'primonial.fr'],[/iroko/,'iroko.eu'],[/\bremake\b/,'remake-am.com'],[/sofidy/,'sofidy.com']
];
const ISSUERS=[[/ishares/,'ishares'],[/amundi/,'amundi'],[/vanguard/,'vanguard'],[/xtrackers/,'xtrackers'],[/spdr/,'spdr'],[/lyxor/,'lyxor'],[/global ?x/,'global-x'],
 [/invesco/,'invesco'],[/wisdomtree/,'wisdomtree'],[/vaneck/,'vaneck'],[/hsbc/,'hsbc'],[/\bubs\b/,'ubs'],[/bnp/,'bnp-paribas'],[/franklin/,'franklin-templeton'],
 [/jpmorgan|jp morgan/,'jpmorgan'],[/l ?& ?g|legal (&|and) general/,'l-g'],[/m ?& ?g/,'m-g'],[/dnca/,'dnca'],[/carmignac/,'carmignac'],[/comgest/,'comgest'],
 [/pimco/,'pimco'],[/fidelity/,'fidelity'],[/ossiam/,'ossiam'],[/hanetf/,'hanetf'],[/rize/,'rize'],[/fineco/,'fineco'],[/expat/,'expat']];
/* Les pages publiées n'acceptent que des images intégrées (data:) : logos génériques dans LOGOS (logos_data.js),
   logos de titres dans la collection « logos » (un document par ISIN, champ d = image data:). */
function instDomain(a){const n=' '+norm([a.inst,a.fname,a.name].filter(Boolean).join(' '))+' ';for(const [re,d] of INST_DOM)if(re.test(n))return d;return ''}
const LGDB={map:new Map(),unsub:null};
function startLogos(){const db=S.cap.db;if(!db||LGDB.unsub)return;try{LGDB.unsub=db.collection('logos').onSnapshot(snap=>{LGDB.map.clear();snap.docs.forEach(d=>{const v=(d.data()||{}).d;if(typeof v==='string'&&/^data:image\/(png|webp|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(v))LGDB.map.set(d.id.toUpperCase(),v)});if(S.phase==='app'&&!S.ui.ovl)render()},()=>{LGDB.unsub=null})}catch(e){LGDB.unsub=null}}
{const _sb2=startBase;startBase=function(){_sb2();startLogos()}}
const slugOf=d=>d.replace(/^(www\.|mabanque\.|particuliers\.|home\.)/,'').replace(/\.(com|fr|eu|coop|capital|co|saxo)$/,'').replace(/\./g,'-');
const INST_SLUG={'boursobank.com':'boursobank','traderepublic.com':'traderepublic','credit-cooperatif.coop':'credit-cooperatif','labanquepostale.fr':'banque-postale','interactivebrokers.com':'interactive-brokers','home.saxo':'saxo','crypto.com':'crypto-com','particuliers.sg.fr':'societe-generale','creditmutuel.fr':'credit-mutuel','lapremierebrique.fr':'la-premiere-brique','sumeria.eu':'sumeria','amundi.fr':'amundi-ee','hellobank.fr':'hellobank','credit-agricole.fr':'credit-agricole'};
function instLogo(a){const d=instDomain(a);if(!d)return '';const k='bank-'+(INST_SLUG[d]||slugOf(d));return LOGOS[k]||''}
function holdLogo(h){if(!h||h.kind==='crypto'||h.kind==='fe')return '';const isin=String(h.isin||'').toUpperCase();if(isin&&LGDB.map.has(isin))return LGDB.map.get(isin);
  const n=' '+norm(h.name||'')+' ';for(const [re,s] of ISSUERS)if(re.test(n))return LOGOS['iss-'+s]||'';return ''}
const mono=s=>esc(String(s||'?').replace(/[^\p{L}\p{N}]/gu,'').slice(0,2).toUpperCase()||'?');
accAvatar=function(a,sm){const ty=TYP[a.type]||{};const c=CLS[ty.cls]||CLS.other;const L=instLogo(a);
  return L?`<span class="av${sm?' sm':''} lgo"><img src="${L}" alt=""></span>`:`<span class="av${sm?' sm':''}" style="--c:var(${c.c})">${ico(ty.ic||'gem')}</span>`};
function holdAvatar(h,cls){const L=holdLogo(h);return L?`<span class="av sm lgo${cls?' '+cls:''}"><img src="${L}" alt=""></span>`:`<span class="av sm round${cls?' '+cls:''}" style="--c:var(--k3)"><b>${mono(h&&(h.ticker&&!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(h.ticker)?h.ticker:h.name))}</b></span>`}
function posAvatar(p){return holdAvatar(Object.assign({},p.lines&&p.lines[0]?p.lines[0].h:{},{name:p.name,ticker:p.ticker,isin:p.isin,kind:p.kind}))}
/* thème « institutionnel » par défaut : accent bleu nuit (réglable dans les préférences) */
EXT.boot.push(d=>{const s=d.settings||{};if(s.design!=='pro1'){s.design='pro1';s.accent='marine';setTimeout(()=>{if(S.data===d&&!S.demo){save();render()}},1200)}});
/* ---------- opérations : logo du commerçant (ou de la banque pour un virement) et pastille de catégorie ---------- */
const MERCH=[[/uber ?eats/,'ubereats'],[/youtube/,'youtube'],[/prime ?video/,'primevideo'],[/openai|chatgpt/,'openai'],[/anthropic|claude\.ai/,'anthropic'],[/\bapple\b|itunes|apple\.com/,'apple'],[/google/,'google'],
 [/\bsfr\b/,'sfr'],[/temu/,'temu'],[/amazon|amzn/,'amazon'],[/\bfdj\b|francaise des jeux/,'fdj'],[/\buber\b/,'uber'],[/netflix/,'netflix'],[/spotify/,'spotify'],[/free ?(mobile|telecom|pro)|freebox/,'free'],
 [/\borange\b/,'orange'],[/bouygues/,'bouygues'],[/\bedf\b/,'edf'],[/engie/,'engie'],[/total ?energies|\btotal\b/,'totalenergies'],[/carrefour/,'carrefour'],[/leclerc/,'leclerc'],[/auchan/,'auchan'],[/\blidl\b/,'lidl'],
 [/franprix/,'franprix'],[/\bfnac\b/,'fnac'],[/darty/,'darty'],[/\bsncf\b|ouigo/,'sncf'],[/\bratp\b/,'ratp'],[/navigo|ile de france mobilites|\bidfm\b/,'idfm'],[/mc ?donald|\bmcdo\b/,'mcdonalds'],[/starbucks/,'starbucks'],
 [/deliveroo/,'deliveroo'],[/decathlon/,'decathlon'],[/\bikea\b/,'ikea'],[/\bzara\b/,'zara'],[/\bh ?& ?m\b/,'hm'],[/booking\.com|\bbooking\b/,'booking'],[/airbnb/,'airbnb'],[/doctolib/,'doctolib'],[/disney/,'disney'],
 [/canal ?\+|canalplus/,'canal'],[/burger ?king/,'burgerking'],[/\bkfc\b/,'kfc'],[/\baction\b/,'action'],[/leroy ?merlin/,'leroymerlin'],[/boulanger/,'boulanger'],[/cdiscount/,'cdiscount'],[/vinted/,'vinted'],
 [/leboncoin|le bon coin/,'leboncoin'],[/blablacar/,'blablacar'],[/shein/,'shein'],[/aliexpress/,'aliexpress'],[/\bxtb\b/,'xtb'],[/steam(powered)?\b/,'steam'],[/playstation|sony interactive/,'playstation'],
 [/xbox/,'xbox'],[/microsoft/,'microsoft'],[/adobe/,'adobe'],[/qonto/,'qonto'],[/lydia|sumeria/,'lydia'],[/sumup/,'sumup'],[/impots|dgfip|finances publiques/,'impots'],[/ameli|\bcpam\b/,'ameli'],[/urssaf/,'urssaf'],
 [/france travail|pole emploi/,'francetravail'],[/nintendo/,'nintendo'],[/twitch/,'twitch']];
function txLogo(x){const n=' '+norm(x.l||'')+' ';for(const [re,s] of MERCH)if(re.test(n)&&LOGOS['m-'+s])return LOGOS['m-'+s];
  for(const [re,d] of INST_DOM)if(re.test(n)){const k='bank-'+(INST_SLUG[d]||slugOf(d));if(LOGOS[k])return LOGOS[k]}return ''}
{const _tr=txRow;txRow=function(x){const h=_tr(x);const L=txLogo(x);if(!L)return h;const c=CAT[x.c]||CAT.uncat;
  return h.replace(/<span class="av sm" style="--c:([^"]*)">([\s\S]*?)<\/span>/,(m,col,ic)=>`<span class="av sm lgo txl"><img src="${L}" alt=""><i class="cbadge" style="--c:${col}">${ic}</i></span>`)}}
