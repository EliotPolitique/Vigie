'use strict';
/* ================= utilitaires ================= */
const APP={name:'Vigie',version:'1.0.0',build:'2026-11'};
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sum=a=>a.reduce((x,y)=>x+(+y||0),0);
const r2=v=>Math.round(v*100)/100;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const pad=n=>String(n).padStart(2,'0');
const isoOf=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=()=>isoOf(new Date());
const ymOf=d=>String(d).slice(0,7);
const ymAdd=(ym,n)=>{let y=+ym.slice(0,4),m=+ym.slice(5,7)-1+n;y+=Math.floor(m/12);m=((m%12)+12)%12;return y+'-'+pad(m+1)};
const dAdd=(iso,n)=>{const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return isoOf(d)};
const mAddIso=(iso,n)=>{const d=new Date(iso+'T12:00:00');d.setMonth(d.getMonth()+n);return isoOf(d)};
const daysBetween=(a,b)=>Math.round((Date.parse(b+'T12:00:00')-Date.parse(a+'T12:00:00'))/864e5);
const noAcc=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const norm=s=>noAcc(s).replace(/[^a-z0-9&]+/g,' ').replace(/\s+/g,' ').trim();
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
function rng(seed){let s=seed>>>0||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return ((s>>>0)%1e6)/1e6}}
const store={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}},del(k){try{localStorage.removeItem(k)}catch(e){}}};

/* ================= icônes (traits 24×24) ================= */
const EXT={A:{},ovl:{},field:{},boot:[],accForm:[],accSave:[],accDrawer:[],holdForm:[],holdSave:[],holdFoot:[],F:{},passive:[]};
const IC={
 home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
 wealth:'<path d="M3 21h18M5 21V10m4.5 11V10m5 11V10M19 21V10M2.5 10 12 3.5 21.5 10z"/>',
 invest:'<path d="M3 17l5.5-5.5 4 4L21 7"/><path d="M15 7h6v6"/>',
 budget:'<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M7 15h3"/>',
 income:'<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.6-3-1.6-1.7 0-3 .9-3 2.2 0 3 6 1.5 6 4.4 0 1.3-1.3 2.3-3 2.3-1.5 0-2.7-.7-3.1-1.8M12 6v2m0 8.3V18"/>',
 goals:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
 sim:'<path d="M4 20V4m0 16h16"/><path d="M7 15c3-1 4-7 7-8s4 2 6 1"/>',
 tax:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 17l6-6M9.5 11.5h.01M14.5 16.5h.01"/>',
 copilot:'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
 prefs:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 eyeoff:'<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.3 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
 x:'<path d="M18 6 6 18M6 6l12 12"/>',
 more:'<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
 upload:'<path d="M12 15V3m0 0-4.5 4.5M12 3l4.5 4.5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
 download:'<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
 edit:'<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/>',
 trash:'<path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
 lock:'<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7"/>',
 alert:'<path d="M12 3 2 20h20zM12 10v4m0 3h.01"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
 spark:'<path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l2.8 2.8m8.4 8.4L19 19M5 19l2.8-2.8m8.4-8.4L19 5"/>',
 shield:'<path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
 pie:'<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
 cal:'<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4m8-4v4"/>',
 refresh:'<path d="M20 11a8 8 0 0 0-14.6-4.5L3 9m0-5v5h5M4 13a8 8 0 0 0 14.6 4.5L21 15m0 5v-5h-5"/>',
 chev:'<path d="m9 6 6 6-6 6"/>',
 chevl:'<path d="m15 6-6 6 6 6"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
 /* classes et comptes */
 cash:'<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v5M18 9.5v5"/>',
 savings:'<path d="M5 11a7 6 0 0 1 13.4-2.3L21 8v4l-2 .6A7 6 0 0 1 16 16v3h-3v-2h-3v2H7v-3.3A6 6 0 0 1 5 11z"/><path d="M10 7.5h3"/>',
 bars:'<path d="M4 20V10m6 10V4m6 16v-8m5 8H3"/>',
 crypto:'<circle cx="12" cy="12" r="9"/><path d="M9.5 7.5v9m0-9H13a2.2 2.2 0 0 1 0 4.4H9.5h4a2.3 2.3 0 0 1 0 4.6h-4M11 6v1.5m0 9V18m2-12v1.5m0 9V18"/>',
 house:'<path d="M3 11 12 4l9 7"/><path d="M5 9.5V20h14V9.5M10 20v-5h4v5"/>',
 gem:'<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l3 18 3-18"/>',
 car:'<path d="M5 16V11l2-5h10l2 5v5M5 16h14M5 16v3m14-3v3M3 11h18"/><circle cx="8" cy="13.5" r=".8"/><circle cx="16" cy="13.5" r=".8"/>',
 loan:'<path d="M4 20h16M6 20V9l6-5 6 5v11"/><path d="M14.5 11.5c-.4-.8-1.3-1.3-2.5-1.3-1.4 0-2.5.7-2.5 1.8 0 2.4 5 1.2 5 3.6 0 1.1-1.1 1.9-2.5 1.9-1.2 0-2.2-.6-2.6-1.5"/>',
 watch:'<circle cx="12" cy="12" r="6"/><path d="M9 6.5 9.5 2h5l.5 4.5M9 17.5l.5 4.5h5l.5-4.5M12 9.5V12l1.5 1.5"/>',
 brief:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
 /* catégories de budget */
 cart:'<path d="M3 4h2l2.4 11h11.2L21 8H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
 fork:'<path d="M7 3v7a2 2 0 0 0 4 0V3M9 10v11M17 21V3c-2 1.5-3 4-3 7h3"/>',
 bus:'<rect x="4" y="3.5" width="16" height="14" rx="3"/><path d="M4 11h16M7.5 20.5v-3m9 3v-3"/><circle cx="8" cy="14.3" r=".7"/><circle cx="16" cy="14.3" r=".7"/>',
 bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
 phone:'<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
 bag:'<path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
 film:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4m10 0h4M3 15h4m10 0h4"/>',
 plane:'<path d="M10.5 13.5 3 11l1.5-1.5 7.5.5 4-4.5a2 2 0 0 1 3 3L14.5 13l.5 7.5L13.5 22 11 14.5l-3 3V20l-1.5 1-1-3.5-3.5-1 1-1.5h2.5z"/>',
 heart:'<path d="M12 20s-7.5-4.6-9.2-9.4C1.6 7 4 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4 20 4 22.4 7 21.2 10.6 19.5 15.4 12 20 12 20z"/>',
 book:'<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20"/>',
 umbrella:'<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9zM12 12v6.5a2 2 0 0 1-4 0"/>',
 receipt:'<path d="M5 3h14v18l-2.3-1.5L14.3 21 12 19.5 9.7 21l-2.4-1.5L5 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
 bank:'<path d="M3 9.5 12 4l9 5.5M5 10v8m4.5-8v8m5-8v8M19 10v8M3 20h18"/>',
 gift:'<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8c-1.5-3.5-5.5-4-5.5-1.5S10 8 12 8zm0 0c1.5-3.5 5.5-4 5.5-1.5S14 8 12 8z"/>',
 swap:'<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
 question:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.7M12 17h.01"/>',
 coins:'<ellipse cx="9" cy="6.5" rx="6" ry="2.5"/><path d="M3 6.5v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4M3 10.5v4C3 15.9 5.7 17 9 17c1 0 2-.1 2.8-.3"/><circle cx="17" cy="16" r="4.5"/>',
 paw:'<circle cx="7" cy="9" r="1.8"/><circle cx="17" cy="9" r="1.8"/><circle cx="10" cy="5.5" r="1.8"/><circle cx="14" cy="5.5" r="1.8"/><path d="M12 12c-3 0-5.5 3.5-5.5 6 0 1.5 1.5 2 2.8 1.6 1-.3 1.8-.6 2.7-.6s1.7.3 2.7.6c1.3.4 2.8-.1 2.8-1.6 0-2.5-2.5-6-5.5-6z"/>'
};
const ico=(k,cls='ic')=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[k]||IC.question}</svg>`;
const MARK=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18.5 12 4l8 14.5" fill="none" stroke="var(--bg)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="14" r="2.2" fill="var(--accent)"/></svg>`;

/* ================= classes d'actifs et types de comptes ================= */
const CLASSES=[
 {k:'cash',c:'--k1',ic:'cash'},
 {k:'savings',c:'--k2',ic:'savings'},
 {k:'invest',c:'--k3',ic:'bars'},
 {k:'crypto',c:'--k4',ic:'crypto'},
 {k:'realestate',c:'--k5',ic:'house'},
 {k:'other',c:'--k6',ic:'gem'},
 {k:'debt',c:'--bad',ic:'loan'}
];
const CLS={};CLASSES.forEach(c=>CLS[c.k]=c);
/* h : positions détaillées ; env : enveloppe fiscale ; rate : taux réglementé par défaut (paramétrable) ; cap : plafond de versement */
const TYPES=[
 {k:'checking',cls:'cash',ic:'cash'},
 {k:'card',cls:'cash',ic:'budget'},
 {k:'livretA',cls:'savings',ic:'savings',rate:'livretA',cap:22950,env:'exempt'},
 {k:'ldds',cls:'savings',ic:'savings',rate:'ldds',cap:12000,env:'exempt'},
 {k:'lep',cls:'savings',ic:'savings',rate:'lep',cap:10000,env:'exempt'},
 {k:'livretJeune',cls:'savings',ic:'savings',rate:'livretJeune',cap:1600,env:'exempt'},
 {k:'pel',cls:'savings',ic:'savings',rate:'pel',cap:61200,env:'pel'},
 {k:'term',cls:'savings',ic:'savings',env:'pfu'},
 {k:'savingsOther',cls:'savings',ic:'savings',env:'pfu'},
 {k:'pea',cls:'invest',ic:'bars',h:1,env:'pea',cap:150000},
 {k:'peapme',cls:'invest',ic:'bars',h:1,env:'pea',cap:225000},
 {k:'cto',cls:'invest',ic:'bars',h:1,env:'pfu'},
 {k:'av',cls:'invest',ic:'umbrella',h:1,env:'av'},
 {k:'per',cls:'invest',ic:'brief',h:1,env:'per'},
 {k:'pee',cls:'invest',ic:'brief',h:1,env:'pee'},
 {k:'wallet',cls:'crypto',ic:'crypto',h:1,env:'crypto'},
 {k:'property',cls:'realestate',ic:'house',env:'immo'},
 {k:'scpi',cls:'realestate',ic:'bank',h:1,env:'immo'},
 {k:'vehicle',cls:'other',ic:'car'},
 {k:'valuables',cls:'other',ic:'watch'},
 {k:'otherAsset',cls:'other',ic:'gem'},
 {k:'mortgage',cls:'debt',ic:'loan',loan:1},
 {k:'consumer',cls:'debt',ic:'loan',loan:1},
 {k:'studentLoan',cls:'debt',ic:'loan',loan:1}
];
const TYP={};TYPES.forEach(t=>TYP[t.k]=t);
const KINDS=['etf','stock','bond','fund','fe','crypto','scpi','metal','other'];
const REGIONS=['world','us','europe','france','em','asia','other'];
const SECTORS=['tech','health','finance','consumer','industry','energy','materials','utilities','realestate','telecom','diversified','other'];

/* ================= catégories de budget ================= */
const CATS=[
 {k:'salary',kind:'in',ic:'brief',c:'--k2'},
 {k:'benefits',kind:'in',ic:'shield',c:'--k7'},
 {k:'investIncome',kind:'in',ic:'coins',c:'--k3'},
 {k:'refunds',kind:'in',ic:'swap',c:'--k6'},
 {k:'otherIn',kind:'in',ic:'plus',c:'--k6'},
 {k:'housing',kind:'out',ic:'house',c:'--k5'},
 {k:'groceries',kind:'out',ic:'cart',c:'--k2'},
 {k:'restaurants',kind:'out',ic:'fork',c:'--k4'},
 {k:'transport',kind:'out',ic:'bus',c:'--k1'},
 {k:'utilities',kind:'out',ic:'bolt',c:'--k7'},
 {k:'subscriptions',kind:'out',ic:'phone',c:'--k3'},
 {k:'shopping',kind:'out',ic:'bag',c:'--k8'},
 {k:'leisure',kind:'out',ic:'film',c:'--k4'},
 {k:'travel',kind:'out',ic:'plane',c:'--k7'},
 {k:'health',kind:'out',ic:'heart',c:'--good'},
 {k:'education',kind:'out',ic:'book',c:'--k3'},
 {k:'insurance',kind:'out',ic:'umbrella',c:'--k6'},
 {k:'taxes',kind:'out',ic:'receipt',c:'--bad'},
 {k:'fees',kind:'out',ic:'bank',c:'--k6'},
 {k:'gifts',kind:'out',ic:'gift',c:'--k8'},
 {k:'cashout',kind:'out',ic:'cash',c:'--k6'},
 {k:'pets',kind:'out',ic:'paw',c:'--k4'},
 {k:'otherOut',kind:'out',ic:'more',c:'--k6'},
 {k:'saving',kind:'save',ic:'savings',c:'--accent'},
 {k:'transfer',kind:'move',ic:'swap',c:'--faint'},
 {k:'uncat',kind:'nc',ic:'question',c:'--warn'}
];
const CAT={};CATS.forEach(c=>CAT[c.k]=c);
const KW=[
 [/virement interne|vir interne|de compte a compte|transfert entre|internal transfer/,'transfer','transfer'],
 [/\b(livret a|livret jeune|ldds|lep|pel|cel|epargne|savings)\b/,'saving','saving'],
 [/\b(buy trade|sell trade|savings plan execution|execution d ordre|ordre de bourse|achat titres|vente titres)\b/,'saving','saving'],
 [/\b(pea|cto|compte titres|trade republic|bourse direct|boursobank titres|xtb|degiro|interactive brokers|linxea|assurance vie|yomoni|nalo|ramify|per )\b/,'saving',null],
 [/\b(salaire|paie|remuneration|payroll|salary|gehalt|nomina|indemnite de stage|gratification)\b/,null,'salary'],
 [/\b(caf|aah|rsa|prime d activite|apl|allocation|mdph|crous|france travail|pole emploi|cpam ij)\b/,null,'benefits'],
 [/\b(dividende|dividend|coupon|interets|interest|distribution)\b/,null,'investIncome'],
 [/\b(remboursement|rembt|refund|avoir|ameli|cpam|mutuelle remb)\b/,null,'refunds'],
 [/\b(loyer|rent|syndic|charges copro|credit immo|pret immo)\b/,'housing',null],
 [/\b(edf|engie|totalenergies electricite|eau|veolia|gaz|ekwateur|octopus)\b/,'utilities',null],
 [/\b(carrefour|leclerc|auchan|lidl|aldi|intermarche|monoprix|franprix|super u|casino|picard|biocoop|naturalia|grand frais|g20|epicerie)\b/,'groceries',null],
 [/\b(uber eats|deliveroo|just eat|mcdonald|burger king|kfc|restaurant|resto|sushi|pizza|starbucks|boulangerie|brasserie|cafe)\b/,'restaurants',null],
 [/\b(sncf|ratp|navigo|ile de france mobilites|uber|bolt|blablacar|essence|carburant|total station|shell|esso|autoroute|peage|parking|velib|lime)\b/,'transport',null],
 [/\b(free mobile|free telecom|sfr|orange|bouygues|sosh|red by sfr|spotify|netflix|deezer|disney|canal|prime video|amazon prime|youtube|apple com bill|icloud|google one|chatgpt|openai|anthropic|claude|microsoft|adobe)\b/,'subscriptions',null],
 [/\b(air france|easyjet|ryanair|transavia|booking|airbnb|hotel|accor|vueling)\b/,'travel',null],
 [/\b(pharmacie|medecin|docteur|doctolib|dentiste|opticien|hopital|laboratoire|kine)\b/,'health',null],
 [/\b(mutuelle|assurance|maif|macif|matmut|axa|allianz|groupama|alan|luko)\b/,'insurance',null],
 [/\b(dgfip|impot|impots|tresor public|amende|antai|taxe)\b/,'taxes',null],
 [/\b(frais|commission|cotisation carte|cotisations? bancaires?|agios|tenue de compte|commission d intervention)\b/,'fees',null],
 [/\b(retrait d especes|retrait especes|retrait dab|retrait cb|retrait|dab)\b/,'cashout',null],
 [/\b(versement especes|vrst especes|depot especes)\b/,null,'otherIn'],
 [/\b(universite|inscription|cvec|librairie|gibert|dalloz|lexisnexis|udemy|coursera)\b/,'education',null],
 [/\b(cinema|ugc|pathe|mk2|steam|playstation|nintendo|xbox|concert|ticketmaster|fnac spectacles|musee|bar|theatre)\b/,'leisure',null],
 [/\b(amazon|fnac|darty|boulanger|zara|h&m|uniqlo|decathlon|ikea|vinted|cdiscount|apple store|sephora|leroy merlin)\b/,'shopping',null],
 [/\b(veterinaire|zooplus|animalerie)\b/,'pets',null],
 [/\b(don |unicef|croix rouge|restos du coeur|msf|helloasso|cadeau)\b/,'gifts',null]
];
function categorize(label,amount,rules){
  const t=' '+norm(label)+' ';
  for(const r of (rules||[])){if(r.p&&t.includes(' '+norm(r.p)))return r.c}
  for(const [re,d,c] of KW){if(re.test(t)){const k=amount<0?d:c;if(k)return k}}
  return amount>0?'otherIn':'uncat';
}

/* ================= nombres, dates, CSV ================= */
function parseAmount(v){
  if(typeof v==='number')return v;
  let s=String(v??'').trim();if(!s)return NaN;
  const neg=/^[-−–]/.test(s)||/[-−]$/.test(s)||/^\(.*\)$/.test(s);
  s=s.replace(/[€$£]|eur|usd|chf|gbp/ig,'').replace(/[\s  '()+\-−–]/g,'');
  if(!/\d/.test(s))return NaN;
  const lc=s.lastIndexOf(','),ld=s.lastIndexOf('.');
  if(lc>-1&&ld>-1){if(lc>ld)s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'')}
  else if(lc>-1){const dec=s.length-lc-1;s=dec<=2?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'')}
  else if(ld>-1){const dec=s.length-ld-1;if(dec===3&&s.split('.').length===2&&!/^0\./.test(s))s=s.replace('.','');else if(s.split('.').length>2)s=s.replace(/\.(?=.*\.)/g,'')}
  const n=parseFloat(s);if(!isFinite(n))return NaN;
  return neg?-Math.abs(n):n;
}
function validISO(y,m,d){if(!(y>1970&&y<2100&&m>=1&&m<=12&&d>=1&&d<=31))return null;const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCMonth()!==m-1)return null;return y+'-'+pad(m)+'-'+pad(d)}
function parseDate(v){
  const s=noAcc(String(v??'').trim());if(!s)return null;
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return validISO(+m[1],+m[2],+m[3]);
  m=s.match(/^(\d{4})(\d{2})(\d{2})/);if(m)return validISO(+m[1],+m[2],+m[3]);
  m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);if(m){let y=+m[3];if(y<100)y+=2000;return validISO(y,+m[2],+m[1])}
  return null;
}
function parseCSVText(text,delim){
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++}else q=false}else cell+=ch}
    else if(ch==='"')q=true;
    else if(ch===delim){row.push(cell);cell=''}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}
    else cell+=ch}
  if(cell!==''||row.length){row.push(cell);rows.push(row)}
  return rows.filter(r=>r.some(c=>String(c).trim()!==''));
}
function detectDelim(text){
  const lines=text.split(/\r?\n/).filter(l=>l.trim()).slice(0,8);let best=';',bs=-1;
  for(const d of [';',',','\t','|']){const c=lines.map(l=>l.split(d).length-1);const min=Math.min(...c);const score=min>0?min*10+c.filter(x=>x===c[0]).length:0;if(score>bs){bs=score;best=d}}
  return best;
}
/* devine les colonnes date / montant / débit / crédit / libellé */
function guessColumns(header,rows){
  const h=header.map(c=>norm(c));
  const find=(re,ex)=>h.findIndex(x=>re.test(x)&&!(ex&&ex.test(x)));
  const map={date:-1,amount:-1,debit:-1,credit:-1,label:-1};
  map.date=[find(/^completed date$/),find(/date (d )?operation|^dateop|date op/),find(/date comptable|booking date|buchungstag|fecha/),find(/\bdate\b|datum/,/valeur|value|naissance/)].find(x=>x>-1)??-1;
  map.amount=find(/^(montant|amount|somme|betrag|importe|montant eur|montant en euros)$/);if(map.amount<0)map.amount=find(/montant|amount|betrag|importe/,/frais|fee|solde|balance/);
  map.debit=find(/\bdebit\b|sortie|paid out|money out|soll/);map.credit=find(/\bcredit\b|entree|paid in|money in|haben/);
  map.label=[find(/^(libelle|label|libelle operation|description|wording|intitule|detail|details|operation|beneficiaire|merchant|verwendungszweck|concepto)$/),find(/libelle|label|description|wording|intitule|detail|concepto/,/categor/)].find(x=>x>-1)??-1;
  if(map.date<0||(map.amount<0&&map.debit<0&&map.credit<0)){
    const n=Math.max(...rows.slice(0,30).map(r=>r.length));let bl=0;
    for(let c=0;c<n;c++){const vals=rows.slice(0,30).map(r=>r[c]);const dr=vals.filter(v=>parseDate(v)).length/vals.length,ar=vals.filter(v=>/\d[.,]\d{2}\b/.test(v||'')&&isFinite(parseAmount(v))).length/vals.length,ln=sum(vals.map(v=>String(v||'').length))/vals.length;
      if(dr>.6&&map.date<0)map.date=c;else if(ar>.6&&map.amount<0&&c!==map.date)map.amount=c;else if(dr<.3&&ar<.3&&ln>bl&&map.label<0){bl=ln;map.label=c}}
  }
  return map;
}
