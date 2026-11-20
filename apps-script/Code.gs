/**
 * Vigie — tâches automatiques (Google Apps Script), à la place des tâches planifiées de Claude.
 * Lit la copie de tes données que Vigie synchronise dans ton Drive (« vigie-donnees.json.gz ») et :
 *  - le 1er de chaque mois : t'envoie par e-mail le bilan du mois écoulé ;
 *  - chaque dimanche : garde une copie datée de tes données (8 dernières) dans « Vigie — sauvegardes » ;
 *  - les jours ouvrés vers 18 h : vérifie tes alertes de cours et les mouvements de ±5 % (cours lus dans ta feuille de cours) ;
 *  - chaque matin vers 8 h : détachements et versements de dividendes du jour → Telegram, ntfy et agenda Google « Vigie — dividendes ».
 *  - toutes les 5 minutes : si un nouveau « point marché » (matin 9 h 20, soir 22 h 15) est prêt, notification Vigie → ntfy et Telegram.
 * Installation : coller ce fichier dans un projet Apps Script, exécuter une fois installer(), accepter les autorisations.
 * Rien n'est modifié dans Vigie : ce script ne fait que lire tes données et t'écrire.
 */
const SYNC_NAME = 'vigie-donnees.json.gz';
const BACKUP_FOLDER = 'Vigie — sauvegardes';
const MOVE_PCT = 5;

function installer() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('bilanMensuel').timeBased().onMonthDay(1).atHour(8).inTimezone('Europe/Paris').create();
  ScriptApp.newTrigger('sauvegardeHebdo').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(20).inTimezone('Europe/Paris').create();
  ScriptApp.newTrigger('alertesCours').timeBased().everyDays(1).atHour(18).inTimezone('Europe/Paris').create();
  ScriptApp.newTrigger('alertesDividendes').timeBased().everyDays(1).atHour(8).inTimezone('Europe/Paris').create();
  ScriptApp.newTrigger('pointMarche').timeBased().everyMinutes(5).create();
  Logger.log('Tâches installées : bilan le 1er à 8 h, sauvegarde le dimanche à 20 h, alertes de cours chaque soir à 18 h (jours ouvrés), dividendes chaque matin vers 8 h.');
  try { alertesDividendes(); } catch (e) { Logger.log('Dividendes : ' + e.message); }
}

/* uniquement les alertes de dividendes (si tu utilises la version Claude de Vigie, qui a déjà ses propres tâches de bilan et d'alertes de cours) */
function installerDividendes() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'alertesDividendes').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('alertesDividendes').timeBased().everyDays(1).atHour(8).inTimezone('Europe/Paris').create();
  alertesDividendes();
  Logger.log('Alertes de dividendes installées : chaque matin vers 8 h.');
}

/* ---------- lecture des données ---------- */
function syncFile_() {
  const it = DriveApp.getFilesByName(SYNC_NAME);
  let best = null;
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed() && (!best || f.getLastUpdated() > best.getLastUpdated())) best = f; }
  if (!best) throw new Error('Fichier ' + SYNC_NAME + ' introuvable : active la synchronisation Drive dans Vigie (Paramètres → Version autonome).');
  return best;
}
function donnees_() {
  const blob = syncFile_().getBlob(); blob.setContentType('application/x-gzip');
  const j = JSON.parse(Utilities.ungzip(blob).getDataAsString('UTF-8'));
  const docs = j.docs || {}; const get = k => { const key = Object.keys(docs).find(p => p.endsWith('/' + k)); return key ? docs[key] : null; };
  const main = get('main') || {}; const d = main.d || {};
  const txs = [], iops = [];
  Object.keys(docs).forEach(p => { if (/\/tx-\d{4}$/.test(p)) txs.push.apply(txs, (docs[p].rows || [])); if (/\/io-\d{4}$/.test(p)) iops.push.apply(iops, (docs[p].rows || [])); });
  const hist = ((get('hist') || {}).rows || []).map(r => ({ d: r[0], nw: +r[1] || 0 }));
  return { d, settings: d.settings || {}, accounts: (d.accounts || []).filter(a => a.include !== false && !a.closed), txs, iops, hist };
}
const eur = v => (Math.round(v * 100) / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const ym = s => String(s).slice(0, 7);
const net = o => (+o.amt || 0) - (+o.fee || 0) - (+o.tax || 0);
function moi_() { return Session.getEffectiveUser().getEmail(); }

/* ---------- 1. bilan du mois ---------- */
function bilanMensuel() {
  const D = donnees_();
  const now = new Date(); const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1); const prev2 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const M = Utilities.formatDate(prev, 'Europe/Paris', 'yyyy-MM'), M2 = Utilities.formatDate(prev2, 'Europe/Paris', 'yyyy-MM');
  const nwAt = m => { const end = m + '-31'; const h = D.hist.filter(x => x.d <= end); return h.length ? h[h.length - 1].nw : null; };
  const n1 = nwAt(M), n0 = nwAt(M2);
  const tx = D.txs.filter(x => ym(x.d) === M && x.c !== 'transfer' && x.c !== 'saving');
  const inc = tx.filter(x => x.a > 0).reduce((s, x) => s + x.a, 0), exp = -tx.filter(x => x.a < 0).reduce((s, x) => s + x.a, 0);
  const cats = {}; tx.filter(x => x.a < 0).forEach(x => cats[x.c || 'uncat'] = (cats[x.c || 'uncat'] || 0) - x.a);
  const top = Object.keys(cats).sort((a, b) => cats[b] - cats[a]).slice(0, 3).map(k => k + ' ' + eur(cats[k]));
  const div = D.iops.filter(o => ym(o.d) === M && (o.t === 'div' || o.t === 'int')).reduce((s, o) => s + net(o), 0) + D.txs.filter(x => ym(x.d) === M && x.c === 'investIncome' && x.a > 0).reduce((s, x) => s + x.a, 0);
  const unc = D.txs.filter(x => ym(x.d) === M && (!x.c || x.c === 'uncat')).length;
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][prev.getMonth()] + ' ' + prev.getFullYear();
  const lignes = [
    'Bilan de ' + mois,
    'Patrimoine net : ' + (n1 == null ? 'inconnu' : eur(n1)) + (n1 != null && n0 != null ? ' (' + (n1 - n0 >= 0 ? '+' : '') + eur(n1 - n0) + (n0 ? ', ' + ((n1 - n0) / Math.abs(n0) * 100).toFixed(1).replace('.', ',') + ' %' : '') + ')' : ''),
    'Revenus : ' + eur(inc) + ' · Dépenses : ' + eur(exp) + (inc > 0 ? ' · Taux d’épargne : ' + ((inc - exp) / inc * 100).toFixed(0) + ' %' : ''),
    'Plus grosses dépenses : ' + (top.join(', ') || '—'),
    'Dividendes et intérêts reçus : ' + eur(div),
    unc ? unc + ' opération(s) à catégoriser : pense à la clôture du mois dans Vigie.' : 'Toutes les opérations sont catégorisées.'
  ];
  MailApp.sendEmail(moi_(), 'Vigie — bilan de ' + mois, lignes.join('\n'));
}

/* ---------- 2. sauvegarde hebdomadaire ---------- */
function sauvegardeHebdo() {
  const f = syncFile_();
  const it = DriveApp.getFoldersByName(BACKUP_FOLDER); const dir = it.hasNext() ? it.next() : DriveApp.createFolder(BACKUP_FOLDER);
  f.makeCopy('vigie-' + Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd') + '.json.gz', dir);
  const L = []; const fi = dir.getFiles(); while (fi.hasNext()) { const x = fi.next(); if (/^vigie-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(x.getName())) L.push(x); }
  L.sort((a, b) => b.getName().localeCompare(a.getName())).slice(8).forEach(x => x.setTrashed(true));
}

/* ---------- 3. alertes de cours ---------- */
function alertesCours() {
  const wd = new Date().getDay(); if (wd === 0 || wd === 6) return;
  const D = donnees_(); const id = D.settings.gsheet; if (!id) return;
  const vals = SpreadsheetApp.openById(id).getSheets()[0].getDataRange().getValues();
  /* en-têtes au format Vigie (key, isin, gsym, price, changepct) ou « Moteur de cotations » (ISIN, Code Google, Prix coté…) */
  const h = vals[0].map(x => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''));
  const ix = (...k) => { for (const x of k) { const i = h.indexOf(x); if (i > -1) return i; } return -1; };
  const iK = ix('key', 'symbole', 'ticker'), iI = ix('isin'), iG = ix('gsym', 'codegoogle'), iP = ix('price', 'prixcote', 'prix', 'cours'), iX = ix('changepct', 'variation', 'variationpct');
  if (iP < 0) return;
  const cell = (r, i) => i > -1 ? String(r[i] || '').trim().toUpperCase() : '';
  const num = v => typeof v === 'number' ? v : +String(v).replace(/\s/g, '').replace(',', '.');
  const rows = vals.slice(1).map(r => ({ key: cell(r, iK), isin: cell(r, iI), gsym: cell(r, iG), price: num(r[iP]), chg: iX > -1 ? num(r[iX]) : NaN })).filter(r => (r.key || r.isin || r.gsym) && r.price > 0);
  const find = x => rows.find(r => (x.gsym && r.gsym === String(x.gsym).toUpperCase()) || (x.isin && r.isin === String(x.isin).toUpperCase()) || (x.ticker && (r.key === String(x.ticker).toUpperCase() || r.gsym.split(':').pop() === String(x.ticker).toUpperCase())));
  const props = PropertiesService.getUserProperties(); const today = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd'); const sent = JSON.parse(props.getProperty('sent') || '{}');
  const held = []; D.accounts.forEach(a => (a.holdings || []).forEach(x => { if (+x.qty > 0 && x.kind !== 'fe') held.push(x); }));
  /* sans colonne de variation : variation calculée par rapport au dernier cours relevé un jour précédent (lignes détenues uniquement, la mémoire du script est limitée) */
  const last = JSON.parse(props.getProperty('last') || '{}'), last2 = {};
  held.forEach(x => { const r = find(x); if (!r) return; const k = r.gsym || r.isin || r.key; const L = last[k];
    if (!isFinite(r.chg) && L && L.d < today && L.p > 0) r.chg = (r.price - L.p) / L.p * 100;
    last2[k] = (!L || L.d < today) ? { d: today, p: r.price } : L; });
  Object.keys(sent).forEach(k => { if (sent[k] !== today) delete sent[k]; });
  const OPS = { above: 'au-dessus de', below: 'en dessous de', chgUp: 'hausse du jour ≥ %', chgDown: 'baisse du jour ≥ %' };
  const out = [];
  (D.settings.alerts || []).filter(al => al.on !== false).forEach(al => {
    const x = held.find(y => [y.isin, y.ticker, y.name].map(v => String(v || '').toUpperCase()).includes(String(al.key).toUpperCase())) || { isin: al.key, ticker: al.key };
    const q = find(x); if (!q || !(q.price > 0)) return; const c = q.chg;
    const ok = al.op === 'above' ? q.price >= al.val : al.op === 'below' ? q.price <= al.val : al.op === 'chgUp' ? c >= al.val : al.op === 'chgDown' ? c <= -Math.abs(al.val) : false;
    const k = 'al:' + al.id; if (ok && sent[k] !== today) { sent[k] = today; out.push((al.name || al.key) + ' : ' + q.price + ' — alerte « ' + (OPS[al.op] || al.op).replace('%', al.val + ' %').replace(/de$/, 'de ' + al.val) + ' » atteinte'); }
  });
  held.forEach(x => { const q = find(x); if (!q || !isFinite(q.chg) || Math.abs(q.chg) < MOVE_PCT) return; const k = 'mv:' + (x.isin || x.name); if (sent[k] === today) return; sent[k] = today;
    out.push(x.name + ' : ' + (q.chg > 0 ? '+' : '') + q.chg.toFixed(1).replace('.', ',') + ' % aujourd’hui (ligne ≈ ' + eur(x.qty * q.price) + ')'); });
  props.setProperty('sent', JSON.stringify(sent)); props.setProperty('last', JSON.stringify(last2));
  if (out.length) MailApp.sendEmail(moi_(), 'Vigie — alertes de cours', out.join('\n'));
}

/* ---------- 4. dividendes : détachements et versements ----------
   Vigie dépose dans ton Drive « vigie-agenda-dividendes.json » (dates annoncées ou estimées, droit au dividende).
   Chaque matin : notification le jour d'un détachement ou d'un versement (Telegram et/ou ntfy, selon ce que tu as relié)
   et mise à jour de l'agenda Google « Vigie — dividendes » (rappel à 9 h le jour même, sur ton ordinateur et ton téléphone).
   Réglages (Paramètres du projet → Propriétés du script) : TELEGRAM_TOKEN (jeton du bot, à coller toi-même),
   APP_URL (adresse de Vigie ouverte par le bouton). Les autres valeurs sont remplies par les fonctions *Connecter. */
const AGENDA_NAME = 'vigie-agenda-dividendes.json';
const CAL_NAME = 'Vigie — dividendes';
const P_ = () => PropertiesService.getScriptProperties();
const prop_ = k => P_().getProperty(k) || '';
const fr2 = (v, d, mn) => { d = d == null ? 2 : d; return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('fr-FR', { minimumFractionDigits: mn == null ? Math.min(d, 2) : mn, maximumFractionDigits: d }); };
const SYM = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF', CAD: '$ CA' };
const cur_ = (v, c, d) => fr2(v, d) + ' ' + (SYM[c] || c);
const jour_ = d => Utilities.formatDate(Utilities.parseDate(d + ' 12:00', 'Europe/Paris', 'yyyy-MM-dd HH:mm'), 'Europe/Paris', 'dd/MM/yyyy');

function agenda_() {
  const it = DriveApp.getFilesByName(AGENDA_NAME); let best = null;
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed() && (!best || f.getLastUpdated() > best.getLastUpdated())) best = f; }
  if (!best) throw new Error('Fichier ' + AGENDA_NAME + ' introuvable : ouvre Vigie une fois (Investissements → Dividendes) pour qu’il soit créé dans ton Drive.');
  return JSON.parse(best.getBlob().getDataAsString('UTF-8'));
}
function texte_(e) {
  const ex = e.k === 'ex';
  const amt = cur_(e.per, e.cur, e.per < 1 ? 4 : 2) + ' × ' + fr2(e.q, e.q % 1 ? 4 : 0, 0) + ' = ' + cur_(e.tot, e.cur) + (e.cur !== 'EUR' ? ' (≈ ' + cur_(e.eur, 'EUR') + ')' : '');
  return {
    titre: ex ? 'Détachement aujourd’hui' : 'Versement aujourd’hui',
    emoji: ex ? '📅' : '💶',
    nom: e.name + (e.tk ? ' (' + e.tk + ')' : ''),
    montant: amt + ' brut',
    suite: ex ? (e.pay ? 'Versement prévu le ' + jour_(e.pay) + '.' : '') : (e.ex ? 'Détaché le ' + jour_(e.ex) + '.' : ''),
    compte: e.acc || '',
    estime: e.est ? 'Date estimée d’après le rythme habituel (pas encore annoncée).' : ''
  };
}
function esc_(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* Telegram : bot « Vigie » créé avec @BotFather ; jeton dans la propriété TELEGRAM_TOKEN */
function telegram_(e) {
  const tok = prop_('TELEGRAM_TOKEN'), chat = prop_('TELEGRAM_CHAT'); if (!tok || !chat) return false;
  const x = texte_(e);
  const html = x.emoji + ' <b>' + x.titre + '</b>\n\n<b>' + esc_(x.nom) + '</b>\n' + esc_(x.montant) + (x.suite ? '\n' + esc_(x.suite) : '') + (x.compte ? '\n<i>' + esc_(x.compte) + '</i>' : '') + (x.estime ? '\n\n<i>' + esc_(x.estime) + '</i>' : '');
  const body = { chat_id: chat, text: html, parse_mode: 'HTML', disable_web_page_preview: true };
  const url = prop_('APP_URL'); if (url) body.reply_markup = { inline_keyboard: [[{ text: 'Ouvrir Vigie', url: url }]] };
  const r = UrlFetchApp.fetch('https://api.telegram.org/bot' + tok + '/sendMessage', { method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) Logger.log('Telegram : ' + r.getContentText()); return r.getResponseCode() === 200;
}
/* à lancer une fois après avoir écrit /start à ton bot : retrouve la conversation et envoie un message d'essai */
function telegramConnecter() {
  const tok = prop_('TELEGRAM_TOKEN'); if (!tok) throw new Error('Ajoute d’abord la propriété TELEGRAM_TOKEN (Paramètres du projet → Propriétés du script).');
  const r = JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot' + tok + '/getUpdates').getContentText());
  const m = (r.result || []).map(u => u.message || u.my_chat_member || {}).filter(m => m.chat && m.chat.type === 'private').pop();
  if (!m) throw new Error('Aucun message reçu : ouvre ton bot dans Telegram, appuie sur « Démarrer » (ou écris /start), puis relance.');
  P_().setProperty('TELEGRAM_CHAT', String(m.chat.id));
  telegram_({ k: 'ex', name: 'Message d’essai', tk: '', per: 0.24, cur: 'USD', q: 2, tot: 0.48, eur: 0.41, est: false, pay: Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd'), acc: 'Vigie est relié à Telegram ✅' });
  Logger.log('Telegram relié (conversation ' + m.chat.id + ').');
}

/* ntfy : application gratuite (iPhone, ordinateur) ; un sujet secret est créé ici, abonne-toi à ce sujet dans l'app */
function ntfy_(e) {
  const topic = prop_('NTFY_TOPIC'); if (!topic) return false;
  const x = texte_(e); const url = prop_('APP_URL');
  const msg = { topic: topic, title: 'Vigie · ' + x.titre, message: '**' + x.nom + '**\n' + x.montant + (x.suite ? '\n' + x.suite : '') + (x.compte ? '\n_' + x.compte + '_' : '') + (x.estime ? '\n\n_' + x.estime + '_' : ''), markdown: true,
    tags: [e.k === 'ex' ? 'date' : 'euro'], priority: 4 };
  if (url) { msg.click = url; msg.actions = [{ action: 'view', label: 'Ouvrir Vigie', url: url }]; }
  msg.icon = prop_('ICON_URL') || 'https://vigie-2lx.pages.dev/icon-192.png';
  const r = UrlFetchApp.fetch('https://ntfy.sh', { method: 'post', contentType: 'application/json', payload: JSON.stringify(msg), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) Logger.log('ntfy : ' + r.getContentText()); return r.getResponseCode() === 200;
}
function ntfyConnecter() {
  let topic = prop_('NTFY_TOPIC');
  if (!topic) { topic = 'vigie-' + Utilities.getUuid().replace(/-/g, '').slice(0, 16); P_().setProperty('NTFY_TOPIC', topic); }
  ntfy_({ k: 'pay', name: 'Message d’essai', tk: '', per: 0.24, cur: 'USD', q: 2, tot: 0.48, eur: 0.41, est: false, ex: Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd'), acc: 'Vigie est relié à ntfy ✅' });
  Logger.log('Sujet ntfy à ajouter dans l’application (bouton +) : ' + topic);
}

/* agenda Google « Vigie — dividendes » : un événement à 9 h par date (rappel à l'heure), mis à jour chaque matin */
function agendaDividendes_(A) {
  let cal = CalendarApp.getCalendarsByName(CAL_NAME)[0];
  if (!cal) { cal = CalendarApp.createCalendar(CAL_NAME, { color: CalendarApp.Color.GREEN, timeZone: 'Europe/Paris', summary: 'Détachements et versements de dividendes, tenus à jour par Vigie.' }); }
  const today = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd');
  const want = {}; (A.events || []).filter(e => e.elig && e.d >= today).forEach(e => want[e.id] = e);
  const from = Utilities.parseDate(today + ' 00:00', 'Europe/Paris', 'yyyy-MM-dd HH:mm'), to = new Date(from.getTime() + 200 * 864e5);
  const have = {}; cal.getEvents(from, to).forEach(ev => { const k = ev.getTag('vigie'); if (!k) return; if (!want[k] || have[k]) ev.deleteEvent(); else have[k] = ev; });
  let n = 0;
  Object.keys(want).forEach(k => {
    const e = want[k], x = texte_(e);
    const title = x.emoji + ' ' + (e.k === 'ex' ? 'Détachement' : 'Versement') + ' · ' + x.nom + (e.k === 'pay' ? ' · ≈ ' + cur_(e.eur, 'EUR') : '') + (e.est ? ' (estimé)' : '');
    const desc = x.montant + '\n' + x.suite + (x.compte ? '\n' + x.compte : '') + (x.estime ? '\n' + x.estime : '') + '\n\nPour toucher un dividende, il faut détenir le titre la veille du détachement.' + (prop_('APP_URL') ? '\n' + prop_('APP_URL') : '');
    const ev = have[k];
    if (ev) { if (ev.getTitle() !== title) ev.setTitle(title); if (ev.getDescription() !== desc) ev.setDescription(desc); return; }
    const st = Utilities.parseDate(e.d + ' 09:00', 'Europe/Paris', 'yyyy-MM-dd HH:mm');
    const nev = cal.createEvent(title, st, new Date(st.getTime() + 15 * 60000), { description: desc });
    nev.setTag('vigie', k); nev.removeAllReminders(); nev.addPopupReminder(0); nev.setColor(e.k === 'ex' ? CalendarApp.EventColor.YELLOW : CalendarApp.EventColor.GREEN); n++;
  });
  return n;
}

function alertesDividendes() {
  const A = agenda_();
  const today = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd');
  let n = 0; try { n = agendaDividendes_(A); } catch (e) { Logger.log('Agenda : ' + e.message); }
  const props = PropertiesService.getUserProperties(); const sent = JSON.parse(props.getProperty('divSent') || '{}');
  Object.keys(sent).forEach(k => { if (sent[k] < Utilities.formatDate(new Date(Date.now() - 60 * 864e5), 'Europe/Paris', 'yyyy-MM-dd')) delete sent[k]; });
  (A.events || []).filter(e => e.d === today && e.elig && !sent[e.id]).forEach(e => { const ok1 = telegram_(e), ok2 = ntfy_(e); if (ok1 || ok2 || (!prop_('TELEGRAM_CHAT') && !prop_('NTFY_TOPIC'))) sent[e.id] = today; });
  props.setProperty('divSent', JSON.stringify(sent));
  Logger.log('Agenda : ' + n + ' événement(s) ajouté(s). Événements du jour : ' + (A.events || []).filter(e => e.d === today && e.elig).length + '.');
}

/* ---------- point marché : notification Vigie dès qu'un nouveau point est prêt ----------
   La tâche « Vigie · point marché » (9 h 20 et 22 h 15) dépose dans ton Drive le fichier « vigie-point-marche.json »
   {id, at, slot, title, body, p} ; ce script le relit toutes les 5 minutes et envoie la notification une seule fois. */
const BRIEF_NAME = 'vigie-point-marche.json';
function installerPointMarche() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'pointMarche').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('pointMarche').timeBased().everyMinutes(5).create();
  if (!prop_('NTFY_TOPIC') && !prop_('TELEGRAM_CHAT')) Logger.log('Attention : ni ntfy ni Telegram ne sont reliés. Lance d’abord ntfyConnecter().');
  Logger.log('Notifications du point marché installées (vérification toutes les 5 minutes).');
  pointMarche();
}
function pointMarche() {
  const it = DriveApp.getFilesByName(BRIEF_NAME); let best = null;
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed() && (!best || f.getLastUpdated() > best.getLastUpdated())) best = f; }
  if (!best) return;
  let j; try { j = JSON.parse(best.getBlob().getDataAsString('UTF-8')); } catch (e) { Logger.log('Point marché illisible : ' + e.message); return; }
  if (!j || !/^b-\d{8}-(am|pm)$/.test(j.id || '')) return;
  const props = PropertiesService.getUserProperties();
  if (props.getProperty('briefSent') === j.id) return;
  /* un point de plus de 3 heures n'est plus envoyé (ordinateur Google en retard, reprise après une panne) */
  if (j.at && Date.now() - Date.parse(j.at) > 3 * 3600e3) { props.setProperty('briefSent', j.id); return; }
  const ok1 = ntfyBrief_(j), ok2 = telegramBrief_(j);
  if (ok1 || ok2) props.setProperty('briefSent', j.id);
  Logger.log('Point marché ' + j.id + ' : ntfy ' + ok1 + ', Telegram ' + ok2);
}
function briefTitle_(j) {
  const p = +j.p; const v = isFinite(p) ? ' · ' + (p > 0 ? '+' : p < 0 ? '−' : '') + fr2(Math.abs(p) * 100, 2) + ' %' : '';
  return 'Vigie · ' + (j.slot === 'am' ? 'Point du matin' : 'Point du soir') + v;
}
function ntfyBrief_(j) {
  const topic = prop_('NTFY_TOPIC'); if (!topic) return false;
  const url = prop_('APP_URL'); const p = +j.p;
  const msg = { topic: topic, title: briefTitle_(j), message: '**' + String(j.title || '') + '**\n' + String(j.body || '') + '\n\n_Note complète dans Vigie → Point marché._', markdown: true,
    tags: [isFinite(p) && p < 0 ? 'chart_with_downwards_trend' : 'chart_with_upwards_trend'], priority: 3 };
  if (url) { msg.click = url; msg.actions = [{ action: 'view', label: 'Lire dans Vigie', url: url }]; }
  msg.icon = prop_('ICON_URL') || 'https://vigie-2lx.pages.dev/icon-192.png';
  const r = UrlFetchApp.fetch('https://ntfy.sh', { method: 'post', contentType: 'application/json', payload: JSON.stringify(msg), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) Logger.log('ntfy : ' + r.getContentText()); return r.getResponseCode() === 200;
}
function telegramBrief_(j) {
  const tok = prop_('TELEGRAM_TOKEN'), chat = prop_('TELEGRAM_CHAT'); if (!tok || !chat) return false;
  const html = (j.slot === 'am' ? '🌅' : '🌙') + ' <b>' + esc_(briefTitle_(j)) + '</b>\n\n<b>' + esc_(j.title || '') + '</b>\n' + esc_(j.body || '') + '\n\n<i>Note complète dans Vigie → Point marché.</i>';
  const body = { chat_id: chat, text: html, parse_mode: 'HTML', disable_web_page_preview: true };
  const url = prop_('APP_URL'); if (url) body.reply_markup = { inline_keyboard: [[{ text: 'Lire dans Vigie', url: url }]] };
  const r = UrlFetchApp.fetch('https://api.telegram.org/bot' + tok + '/sendMessage', { method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) Logger.log('Telegram : ' + r.getContentText()); return r.getResponseCode() === 200;
}
