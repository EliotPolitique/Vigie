/* ================= langue et formats ================= */
const LANGS=[['fr','Français'],['en','English'],['es','Español'],['de','Deutsch']];
const LOC={fr:'fr-FR',en:'en-GB',es:'es-ES',de:'de-DE'};
const CURS=['EUR','USD','GBP','CHF','CAD','JPY'];
function lang(){return (S.data&&ST().lang)||'fr'}
function loc(){return LOC[lang()]||'fr-FR'}
function t(k,vars){
  const L=lang();let s=(I18N[L]&&I18N[L][k])??(L!=='fr'&&I18N.en?I18N.en[k]:undefined)??I18N.fr[k]??k;
  if(vars)for(const [a,b] of Object.entries(vars))s=s.split('{'+a+'}').join(b);
  return s;
}
const priv=()=>!!(S.data&&ST().privacy);
const NF={};
function nfmt(key,opts){const k=loc()+key;return NF[k]||(NF[k]=new Intl.NumberFormat(loc(),opts))}
function curSym(c){try{return nfmt('sym'+(c||ST().cur),{style:'currency',currency:c||ST().cur,currencyDisplay:'narrowSymbol'}).formatToParts(0).find(p=>p.type==='currency').value}catch(e){return c||'€'}}
function moneyT(v,d=2,cur){
  if(priv())return '•••• '+curSym(cur);
  if(!isFinite(v))return '—';
  return nfmt('m'+d+(cur||ST().cur),{style:'currency',currency:cur||ST().cur,minimumFractionDigits:d,maximumFractionDigits:d}).format(Math.abs(v)<.005?0:v);
}
const money=(v,d=2,cur)=>`<span class="amt">${esc(moneyT(v,d,cur))}</span>`;
function moneyS(v,d=2,cur){if(priv())return money(v,d,cur);const s=v>0.004?'+':v<-0.004?'−':'';return `<span class="amt">${s}${esc(moneyT(Math.abs(v),d,cur))}</span>`}
function compactT(v){if(priv())return '•••';const a=Math.abs(v);return nfmt('c'+ST().cur,{style:'currency',currency:ST().cur,notation:'compact',maximumFractionDigits:a<1000?0:a<1e5?1:0}).format(v)}
function numT(v,d=2){if(!isFinite(v))return '—';return nfmt('n'+d,{minimumFractionDigits:0,maximumFractionDigits:d}).format(v)}
function qtyT(v){return numT(v,Math.abs(v)<1?6:Math.abs(v)<100?4:2)}
function pctT(v,d=1){if(v==null||!isFinite(v))return '—';return nfmt('p'+d,{style:'percent',minimumFractionDigits:d,maximumFractionDigits:d}).format(v)}
function pctS(v,d=1){if(v==null||!isFinite(v))return '—';return (v>0.00005?'+':v<-0.00005?'−':'')+pctT(Math.abs(v),d)}
const cls=v=>v>0.004?'good':v<-0.004?'bad':'muted';
const DF={};
function dateT(iso,style='med'){if(!iso)return '—';const o=style==='short'?{day:'numeric',month:'short'}:style==='long'?{weekday:'long',day:'numeric',month:'long'}:style==='my'?{month:'short',year:'numeric'}:{day:'numeric',month:'short',year:'numeric'};const k=loc()+style;const f=DF[k]||(DF[k]=new Intl.DateTimeFormat(loc(),o));return f.format(new Date(iso.length===7?iso+'-15T12:00:00':iso+'T12:00:00'))}
function monthT(ym,short){const k=loc()+(short?'ms':'ml');const f=DF[k]||(DF[k]=new Intl.DateTimeFormat(loc(),short?{month:'short'}:{month:'long',year:'numeric'}));return f.format(new Date(ym+'-15T12:00:00'))}
function monthName(m){return monthT('2026-'+pad(m),true)}
const catL=k=>t('cat.'+k);
const typL=k=>t('type.'+k);
const clsL=k=>t('cls.'+k);
const kindL=k=>t('kind.'+k);
const regL=k=>t('reg.'+k);
const secL=k=>t('sec.'+k);
const cvar=c=>c.startsWith('--')?`var(${c})`:c;
