/* ================= Vigie autonome — réglages et synchronisation (chargé après le code de l'application) ================= */
const SAT={fr:{
  h:'Version autonome',s:'Vigie fonctionne sans Claude : tes données restent dans ce navigateur et, si tu le relies, dans ton Google Drive.',
  g:'Compte Google',gS:'Pour lire et écrire tes feuilles, ton dossier de dépôt et synchroniser tes données entre appareils.',
  cid:'Identifiant client OAuth (Google Cloud)',cidH:'Se termine par « .apps.googleusercontent.com » — voir le guide d\'installation.',
  con:'Connecter Google',recon:'Reconnecter Google',dis:'Déconnecter',ok:'Connecté',off:'Non connecté',exp:'Session expirée',
  sy:'Synchronisation Drive',syS:'Fichier « vigie-donnees.json.gz » dans le dossier « Vigie » de ton Drive.',on1:'Activée',off1:'Désactivée',
  push:'Envoyer maintenant',pull:'Récupérer depuis le Drive',last:'Dernier envoi : {d}',never:'jamais',busy:'Synchronisation…',
  conf:'Une version plus récente existe sur ton Drive (modifiée depuis un autre appareil).',confPull:'Charger la version du Drive',confPush:'Garder celle-ci et écraser le Drive',
  pulled:'Données récupérées depuis ton Drive : rechargement…',pushed:'Données envoyées sur ton Drive',noFile:'Aucune sauvegarde sur ton Drive pour l\'instant',
  err:'Erreur : {e}',ai:'Claude (facultatif)',aiS:'Pour la catégorisation automatique, la lecture des relevés scannés et le copilote. Facturé à l\'usage par Anthropic (quelques centimes par mois).',
  key:'Clé API Anthropic',keyH:'Commence par « sk-ant- ». Elle reste dans ce navigateur seulement.',save:'Enregistrer',rm:'Retirer',keyOk:'Clé enregistrée : rechargement…',
  band:'Reconnecte ton compte Google pour synchroniser et lire tes feuilles.',bandBtn:'Reconnecter',
  wipe:'Effacer les données de ce navigateur',wipeS:'Ton Drive n\'est pas touché.',wipeC:'Confirmer l\'effacement',
  needId:'Renseigne d\'abord l\'identifiant client OAuth.',gisFail:'Impossible de charger la connexion Google (bloqueur de publicités ou de traqueurs ?). Autorise accounts.google.com pour ce site puis réessaie.'},
 en:{h:'Standalone version',s:'Vigie runs without Claude: your data stays in this browser and, if you link it, in your Google Drive.',
  g:'Google account',gS:'To read and write your sheets and drop folder and sync your data across devices.',cid:'OAuth client ID (Google Cloud)',cidH:'Ends with “.apps.googleusercontent.com” — see the setup guide.',
  con:'Connect Google',recon:'Reconnect Google',dis:'Disconnect',ok:'Connected',off:'Not connected',exp:'Session expired',sy:'Drive sync',syS:'File “vigie-donnees.json.gz” in the “Vigie” folder of your Drive.',on1:'On',off1:'Off',
  push:'Upload now',pull:'Download from Drive',last:'Last upload: {d}',never:'never',busy:'Syncing…',conf:'A newer version exists on your Drive (changed from another device).',confPull:'Load the Drive version',confPush:'Keep this one and overwrite Drive',
  pulled:'Data downloaded from your Drive: reloading…',pushed:'Data uploaded to your Drive',noFile:'No backup on your Drive yet',err:'Error: {e}',ai:'Claude (optional)',aiS:'For automatic categorisation, reading scanned statements and the copilot. Billed per use by Anthropic (a few cents a month).',
  key:'Anthropic API key',keyH:'Starts with “sk-ant-”. It stays in this browser only.',save:'Save',rm:'Remove',keyOk:'Key saved: reloading…',band:'Reconnect your Google account to sync and read your sheets.',bandBtn:'Reconnect',
  wipe:'Erase this browser\'s data',wipeS:'Your Drive is not touched.',wipeC:'Confirm erase',needId:'Enter the OAuth client ID first.'}};
const st=(k,v)=>{const L=SAT[(S.data&&ST().lang)==='fr'||!S.data?'fr':'en']||SAT.fr;let s=L[k]||SAT.fr[k]||k;if(v)Object.entries(v).forEach(([a,b])=>s=s.replace('{'+a+'}',b));return s};
VSA.listeners.add(()=>{try{if(S.ui&&S.ui.view==='prefs')render();else if(typeof watchItems==='function')render()}catch(e){}});
function saPrefs(){const C=VSA.cfg,ok=VSA.googleOk(),Y=VSA.sync;
  const line=(label,ctl,hint)=>`<div class="row" style="flex-wrap:wrap"><div class="m" style="min-width:180px"><b style="font-weight:500;white-space:normal">${esc(label)}</b>${hint?`<span style="white-space:normal">${esc(hint)}</span>`:''}</div><div class="hrow" style="gap:8px;flex-wrap:wrap">${ctl}</div></div>`;
  const gst=ok?`<span class="pill good">${esc(st('ok'))}</span>`:C.gLinked?`<span class="pill">${esc(st('exp'))}</span>`:`<span class="pill">${esc(st('off'))}</span>`;
  return `<section class="card" style="grid-column:1/-1"><div class="ch"><div><h2>${esc(st('h'))}</h2><p>${esc(st('s'))}</p></div></div>
  <div class="sec-t" style="margin-top:4px"><h2 style="font-size:14px">${esc(st('g'))}</h2></div><p class="note" style="margin:0 0 6px">${esc(st('gS'))}</p>
  ${line(st('cid'),`<input id="sa-cid" value="${esc(C.gClientId||'')}" placeholder="xxxx.apps.googleusercontent.com" style="width:320px;max-width:100%"><button class="btn sec sm" data-a="saCid">${esc(st('save'))}</button>`,st('cidH'))}
  ${line(st('g'),`${gst}${ok?`<button class="btn ghost sm" data-a="saGOut">${esc(st('dis'))}</button>`:`<button class="btn sm" data-a="saGIn">${esc(st(C.gLinked?'recon':'con'))}</button>`}`)}
  <div class="hr"></div>
  ${line(st('sy'),`${seg('saSync',[['1',st('on1')],['0',st('off1')]],C.sync===false?'0':'1',st('sy'))}`,st('syS'))}
  ${Y.conflict?`<div class="demo-band" style="margin:8px 0">${ico('alert')}<div>${esc(st('conf'))}</div><button class="btn sm" data-a="saPull" data-v="force">${esc(st('confPull'))}</button><button class="btn ghost sm" data-a="saPush" data-v="force">${esc(st('confPush'))}</button></div>`:''}
  ${line(Y.busy?st('busy'):st('last',{d:C.syncRemoteAt?dateT(String(C.syncRemoteAt).slice(0,10),'short')+' '+String(C.syncRemoteAt).slice(11,16):st('never')}),`<button class="btn sec sm" data-a="saPush" ${!ok||Y.busy?'disabled':''}>${ico('upload')}${esc(st('push'))}</button><button class="btn sec sm" data-a="saPull" ${!ok||Y.busy?'disabled':''}>${ico('download')}${esc(st('pull'))}</button>`,Y.err&&Y.err!=='conflict'?st('err',{e:Y.err}):'')}
  <div class="hr"></div>
  <div class="sec-t"><h2 style="font-size:14px">${esc(st('ai'))}</h2></div><p class="note" style="margin:0 0 6px">${esc(st('aiS'))}</p>
  ${line(st('key'),`<input id="sa-key" type="password" autocomplete="off" value="${C.aKey?'••••••••••••':''}" placeholder="sk-ant-…" style="width:240px"><button class="btn sec sm" data-a="saKey">${esc(st('save'))}</button>${C.aKey?`<button class="btn ghost sm" data-a="saKeyRm">${esc(st('rm'))}</button>`:''}`,st('keyH'))}
  <div class="hr"></div>
  ${line(st('wipe'),`<button class="btn ${S.ui.confirm==='saWipe'?'danger':'ghost'} sm" data-a="saWipe">${ico('trash')}${esc(st(S.ui.confirm==='saWipe'?'wipeC':'wipe'))}</button>`,st('wipeS'))}
  </section>`}
{const _pvS=prefsView;prefsView=function(){const h=_pvS();const i=h.indexOf('<div class="grid g2"');if(i<0)return saPrefs()+h;const j=h.indexOf('>',i)+1;return h.slice(0,j)+saPrefs()+h.slice(j)}}
EXT.A.saCid=()=>{const v=(document.getElementById('sa-cid')||{}).value||'';VSA.saveCfg({gClientId:v.trim()});toast(st('save'))};
EXT.A.saGIn=async()=>{if(!VSA.cfg.gClientId){toast(st('needId'),true);return}try{await VSA.googleConnect(false);await saAfterConnect()}catch(e){const m=e&&(e.message||e.code)||'?';toast(m==='gis'?st('gisFail'):st('err',{e:m}),true)}};
EXT.A.saGOut=()=>{VSA.googleSignOut()};
EXT.A.saSync=v=>{VSA.saveCfg({sync:v==='1'})};
EXT.A.saPush=async v=>{await flush();await VSA.push(v==='force');if(!VSA.sync.err)toast(st('pushed'))};
EXT.A.saPull=async v=>{const r=await VSA.pull(v==='force'||true);if(r==='pulled'){toast(st('pulled'));setTimeout(()=>location.reload(),800)}else if(r==='none')toast(st('noFile'))};
EXT.A.saKey=()=>{const v=((document.getElementById('sa-key')||{}).value||'').trim();if(!v||/^•+$/.test(v))return;VSA.saveCfg({aKey:v});toast(st('keyOk'));setTimeout(()=>location.reload(),800)};
EXT.A.saKeyRm=()=>{VSA.saveCfg({aKey:''});setTimeout(()=>location.reload(),300)};
EXT.A.saWipe=async()=>{if(S.ui.confirm!=='saWipe'){S.ui.confirm='saWipe';render();return}S.ui.confirm=null;await VSA.clearAll();try{localStorage.removeItem('vigie:data:v1')}catch(e){}location.reload()};
/* après connexion : récupère la version du Drive si elle est plus récente, sinon envoie la locale */
async function saAfterConnect(){if(VSA.cfg.sync===false){render();try{if(typeof gsySync==='function')gsySync(false);if(typeof syncLive==='function')syncLive()}catch(e){}return}
  const r=await VSA.pull(false);if(r==='pulled'){toast(st('pulled'));setTimeout(()=>location.reload(),800);return}
  if(r==='none'||r==='same'){if(localStorage.getItem('vigie:dirtyAt')||r==='none')await VSA.push(false)}
  render();try{if(typeof gsySync==='function')gsySync(false);if(typeof syncLive==='function')syncLive();if(typeof startGS==='function')startGS()}catch(e){}}
/* bandeau : Google relié mais session expirée (une autorisation demande un clic) */
{const _wiS=watchItems;watchItems=function(){const L=_wiS();try{if(VSA.cfg.gLinked&&!VSA.googleOk())L.unshift({lvl:'info',ic:'refresh',l:st('band'),s:'',act:'saGIn',v:'',prio:9})}catch(e){}return L}}
/* les fonctions propres à Claude (Finary, Finvygo) sont masquées dans la version autonome */
{const _gp=prefsView;prefsView=function(){let h=_gp();try{const k=esc(t('fin.prefT'));const i=h.indexOf(`<h2>${k}</h2>`);if(i>-1){const s0=h.lastIndexOf('<section class="card">',i);const e=h.indexOf('</section>',i)+10;if(s0>-1&&e>9)h=h.slice(0,s0)+h.slice(e)}}catch(e){}return h}}
/* les boutons de la version autonome rejoignent la table des actions (fusionnée au démarrage, avant ce bloc) */
Object.assign(A,{saCid:EXT.A.saCid,saGIn:EXT.A.saGIn,saGOut:EXT.A.saGOut,saSync:EXT.A.saSync,saPush:EXT.A.saPush,saPull:EXT.A.saPull,saKey:EXT.A.saKey,saKeyRm:EXT.A.saKeyRm,saWipe:EXT.A.saWipe});
/* la bibliothèque Google est chargée dès l'ouverture, pour que la fenêtre de connexion s'ouvre au clic sans être bloquée */
setTimeout(()=>{if(VSA.cfg.gClientId&&VSA.loadGis)VSA.loadGis().catch(()=>{})},1500);
/* Finary n'existe pas hors de Claude : pastille et bandeau d'invitation remplacés par l'état de la connexion Google */
finChip=function(){if(S.demo||!S.data)return '';const ok=VSA.googleOk(),linked=VSA.cfg.gLinked;
  if(ok)return `<button class="finchip" data-a="go" data-v="prefs" title="${esc(st('ok'))}"><i class="dot" style="background:var(--good)"></i><span class="hide-m">Google</span></button>`;
  return `<button class="finchip" data-a="saGIn" title="${esc(st(linked?'recon':'con'))}"><i class="dot" style="background:var(--warn)"></i><span class="hide-m">${esc(st(linked?'recon':'con'))}</span></button>`};
{const _hp=homeParts;homeParts=function(){const P=_hp();P.finBand='';return P}}
