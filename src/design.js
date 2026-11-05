/* ================= V4.9 — choix du design (habillage, interface, densité, taille du texte) =================
   Tout passe par des attributs sur <html> (data-skin, data-ui, data-density, data-fs) et des feuilles CSS :
   aucune donnée n'est touchée, une valeur inconnue retombe sur le défaut, le changement est instantané et réversible. */
const SKINS=[
 {k:'inst',sw:['#F7F8FA','#FFFFFF','#0F172A'],f:"'Inter',system-ui,sans-serif"},
 {k:'prestige',sw:['#F4EFE6','#FFFDF8','#2A2116'],f:"'Fraunces',Georgia,serif"},
 {k:'modern',sw:['#EEF0FB','#FFFFFF','#141A33'],f:"'Bricolage Grotesque',system-ui,sans-serif"},
 {k:'terminal',sw:['#05080A','#0B1013','#7CF0B4'],f:"'JetBrains Mono',ui-monospace,monospace"},
 {k:'zen',sw:['#FBFBF9','#FBFBF9','#2B2B28'],f:"'Inter',system-ui,sans-serif"}
];
const UI_MODES=['full','simple'];
const DENS=['airy','normal','compact'];
const FSZ=['s','m','l'];
/* vues gardées dans la barre latérale en interface « Essentielle » (les autres restent accessibles par la recherche ⌘K) */
const UI_SIMPLE=new Set(['home','wealth','invest','daily','income','goals','copilot','prefs']);
const pick=(v,L,d)=>L.includes(v)?v:d;
function design(){const s=S.data?ST():DEFAULT_SETTINGS();return {skin:pick(s.skin,SKINS.map(x=>x.k),'inst'),ui:pick(s.ui,UI_MODES,'full'),density:pick(s.density,DENS,'normal'),fs:pick(s.fs,FSZ,'m')}}
function uiHidden(k){return design().ui==='simple'&&!UI_SIMPLE.has(k)}
{const _at=applyTheme;applyTheme=function(){_at();const d=design();const r=document.documentElement;
  r.setAttribute('data-skin',d.skin);r.setAttribute('data-ui',d.ui);r.setAttribute('data-density',d.density);r.setAttribute('data-fs',d.fs)}}
function designSet(k,v,L){if(!S.data||!L.includes(v))return;ST()[k]=v;save();render()}
EXT.A.skin=v=>designSet('skin',v,SKINS.map(x=>x.k));
EXT.A.uiMode=v=>designSet('ui',v,UI_MODES);
EXT.A.density=v=>designSet('density',v,DENS);
EXT.A.fsize=v=>designSet('fs',v,FSZ);
EXT.A.designReset=()=>{if(!S.data)return;const s=ST();s.skin='inst';s.ui='full';s.density='normal';s.fs='m';const D0=DEFAULT_SETTINGS();s.theme=D0.theme;s.accent=D0.accent;save();render();toast(t('ds.resetDone'))};
function skinCard(x,cur){const [bg,sf,ink]=x.sw;const on=x.k===cur;
  return `<button class="skc${on?' on':''}" data-a="skin" data-v="${x.k}" aria-pressed="${on}">
    <span class="skp" style="background:${bg}"><span class="skside" style="background:${sf};border-color:color-mix(in srgb,${ink} 14%,transparent)"><i style="background:${ink}"></i><i></i><i></i></span>
    <span class="skmain"><b style="font-family:${x.f};color:${ink}">1 512 €</b><span class="skbar" style="background:${sf};border-color:color-mix(in srgb,${ink} 14%,transparent)"><i style="background:color-mix(in srgb,${ink} 70%,transparent)"></i></span><span class="skbar" style="background:${sf};border-color:color-mix(in srgb,${ink} 14%,transparent)"><i style="background:color-mix(in srgb,${ink} 35%,transparent);width:45%"></i></span></span></span>
    <span class="skt"><b>${esc(t('ds.sk.'+x.k))}</b><span>${esc(t('ds.skd.'+x.k))}</span></span>${on?`<span class="skok">${ico('check')}</span>`:''}</button>`}
function designPrefsHTML(){const d=design();const s=ST();
  const line=(label,ctl,hint)=>`<div class="row" style="flex-wrap:wrap"><div class="m" style="min-width:180px"><b style="font-weight:500;white-space:normal">${esc(label)}</b>${hint?`<span style="white-space:normal">${esc(hint)}</span>`:''}</div><div>${ctl}</div></div>`;
  return `<section class="card dsec" style="grid-column:1/-1"><div class="ch"><div><h2>${esc(t('ds.h'))}</h2><p>${esc(t('ds.sub'))}</p></div><button class="btn ghost sm" data-a="designReset">${ico('refresh')}${esc(t('ds.reset'))}</button></div>
  <div class="skgrid">${SKINS.map(x=>skinCard(x,d.skin)).join('')}</div>
  ${line(t('ds.ui'),seg('uiMode',[['full',t('ds.ui.full')],['simple',t('ds.ui.simple')]],d.ui,t('ds.ui')),t(d.ui==='simple'?'ds.ui.simpleH':'ds.ui.fullH'))}
  ${line(t('ds.dens'),seg('density',[['airy',t('ds.d.airy')],['normal',t('ds.d.normal')],['compact',t('ds.d.compact')]],d.density,t('ds.dens')))}
  ${line(t('ds.fs'),seg('fsize',[['s','A−'],['m','A'],['l','A+']],d.fs,t('ds.fs')))}
  <p class="note" style="margin:10px 0 0">${esc(t('ds.note'))}</p></section>`}
{const _pv=prefsView;prefsView=function(){const h=_pv();const i=h.indexOf('<div class="grid g2"');if(i<0)return designPrefsHTML()+h;const j=h.indexOf('>',i)+1;return h.slice(0,j)+designPrefsHTML()+h.slice(j)}}
