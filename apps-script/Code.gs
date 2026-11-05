/**
 * Vigie — tâches automatiques (Google Apps Script), à la place des tâches planifiées de Claude.
 * Lit la copie de tes données que Vigie synchronise dans ton Drive (« vigie-donnees.json.gz ») et :
 *  - le 1er de chaque mois : t'envoie par e-mail le bilan du mois écoulé ;
 *  - chaque dimanche : garde une copie datée de tes données (8 dernières) dans « Vigie — sauvegardes » ;
 *  - les jours ouvrés vers 18 h : vérifie tes alertes de cours et les mouvements de ±5 % (cours lus dans ta feuille de cours).
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
  Logger.log('Tâches installées : bilan le 1er à 8 h, sauvegarde le dimanche à 20 h, alertes chaque soir à 18 h (jours ouvrés).');
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
  const mois = Utilities.formatDate(prev, 'Europe/Paris', 'MMMM yyyy');
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
