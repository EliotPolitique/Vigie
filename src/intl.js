/* ================= V3 — 13 langues et 75 devises ================= */
[['it','Italiano','it-IT'],['nl','Nederlands','nl-NL'],['pt','Português (Portugal)','pt-PT'],['pt-BR','Português (Brasil)','pt-BR'],['pl','Polski','pl-PL'],['sv','Svenska','sv-SE'],['da','Dansk','da-DK'],['cs','Čeština','cs-CZ'],['ro','Română','ro-RO']]
  .forEach(([k,l,c])=>{if(!LOC[k]){LANGS.push([k,l]);LOC[k]=c}});

/* cours de référence : unités de devise pour 1 €, relevés le 1er novembre 2026 ; rafraîchis chaque jour ouvré par la base de cours Vigie */
const FX_AT='2026-11-01';
const FX_PER_EUR={USD:1.11666,GBP:0.83374,CHF:0.920605,JPY:175.954,CAD:1.56031,AUD:1.58856,NZD:1.98271,CNY:7.43825,HKD:8.75952,SGD:1.42724,KRW:1489.22,TWD:36.4056,INR:105.988,IDR:20236.6,THB:37.699,MYR:4.5432,PHP:71.178,VND:28821.4,PKR:309.724,BDT:138.99,LKR:371.568,KHR:4568,NPR:169.995,SEK:10.966,NOK:10.2767,DKK:7.47386,ISK:135.994,PLN:4.40545,CZK:24.3588,HUF:365.984,RON:5.338,RSD:117.45,BAM:1.9558,MKD:61.58,MDL:19.9902,UAH:50.779,TRY:55.8166,ILS:3.5101,AED:4.1008,SAR:4.1879,QAR:4.0812,KWD:0.34749,BHD:0.4227,OMR:0.42901,JOD:0.7911,EGP:62.542,MAD:10.9806,TND:3.348,XOF:655.957,XAF:655.957,XPF:119.332,NGN:1504,GHS:13.043,KES:145.49,UGX:4758,ZAR:18.6622,NAD:18.6577,BWP:15.468,MUR:52.79,SCR:15.426,MGA:5051.52,BRL:6.08273,MXN:20.9914,ARS:1714.64,CLP:1111.11,COP:3547,PEN:3.86698,UYU:44.8988,PYG:6559,BOB:13.412,DOP:67.7062,JMD:177.91,TTD:7.591,XCD:3.01807};
CURS.length=0;CURS.push('EUR',...Object.keys(FX_PER_EUR));
EXT.boot.push(d=>{const s=d.settings;s.fx=s.fx||{};const fresh=s.fxAt!==FX_AT&&!(s.fxAt&&s.fxAt>FX_AT);Object.entries(FX_PER_EUR).forEach(([c,r])=>{const v=+(1/r).toPrecision(6);if(s.fx[c]==null||(fresh&&!(s.fxUser||{})[c]))s.fx[c]=v});s.fx.EUR=1;if(fresh)s.fxAt=FX_AT});
let CURN=null;
function curName(c){try{if(!CURN||CURN.l!==loc())CURN={l:loc(),f:new Intl.DisplayNames([loc()],{type:'currency'})};return CURN.f.of(c)||c}catch(e){return c}}
function curOpts(sel){return CURS.map(c=>[c,curName(c)]).sort((a,b)=>a[0]==='EUR'?-1:b[0]==='EUR'?1:a[1].localeCompare(b[1],loc())).map(([c,n])=>`<option value="${c}"${c===sel?' selected':''}>${esc(c)} — ${esc(n)}</option>`).join('')}
/* devises effectivement utilisées : affichage, comptes, lignes */
function fxUsed(){const u=new Set([ST().cur]);(D().accounts||[]).forEach(a=>{if(a.cur)u.add(a.cur);(a.holdings||[]).forEach(h=>{if(h.cur)u.add(h.cur)})});['USD','GBP','CHF'].forEach(c=>u.add(c));return [...u].filter(c=>CURS.includes(c))}
/* une saisie manuelle d'un taux le protège des mises à jour automatiques */
EXT.field.fxUserMark=()=>{};
