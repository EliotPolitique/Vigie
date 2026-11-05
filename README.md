# Vigie — version autonome

Application personnelle de suivi de patrimoine et de budget. Cette version fonctionne **sans Claude** : c'est une page web installable (PWA), sans serveur. Tes données restent dans ton navigateur et, si tu l'actives, dans ton propre Google Drive.

## Contenu du dépôt

| Dossier | Rôle |
|---|---|
| `web/` | **L'application prête à publier** (c'est ce dossier que Cloudflare Pages met en ligne) |
| `src/` | Code source de Vigie (commun avec la version Claude) |
| `web-src/` | Ce qui remplace les services de Claude : stockage, Google, Claude via clé API, mode hors ligne |
| `apps-script/Code.gs` | Tâches automatiques (bilan mensuel, sauvegarde, alertes) à coller dans Google Apps Script |
| `build.py`, `build_web.py` | Construction : `python3 build_web.py` régénère `web/` |

## Installation (environ 1 heure, une seule fois)

### 1. Mettre l'application en ligne — Cloudflare Pages (gratuit)
1. Crée un compte sur <https://dash.cloudflare.com/sign-up>.
2. **Workers & Pages → Créer → Pages → Se connecter à Git** → autorise GitHub → choisis le dépôt `vigie`.
3. Réglages de construction : *Framework* **Aucun**, *Commande de build* **vide**, *Répertoire de sortie* **`web`**.
4. **Enregistrer et déployer**. Tu obtiens une adresse du type `https://vigie-xxx.pages.dev`.
5. Ouvre-la sur ton ordinateur et ton téléphone, puis « Installer l'application » (Chrome) ou « Sur l'écran d'accueil » (Safari).

Chaque nouvelle version poussée sur GitHub est mise en ligne automatiquement.

### 2. Relier Google (Drive et Sheets)
1. Va sur <https://console.cloud.google.com/> → **Nouveau projet** « Vigie ».
2. **API et services → Bibliothèque** : active **Google Drive API** et **Google Sheets API**.
3. **Écran de consentement OAuth** : type **Externe**, nom « Vigie », ton adresse e-mail ; dans **Utilisateurs test**, ajoute ton adresse Gmail. Laisse l'application en mode **Test**.
4. **Identifiants → Créer des identifiants → ID client OAuth** → type **Application Web** → *Origines JavaScript autorisées* : ton adresse Cloudflare (`https://vigie-xxx.pages.dev`).
5. Copie l'**ID client** (se termine par `.apps.googleusercontent.com`).
6. Dans Vigie : **Paramètres → Version autonome** → colle l'identifiant → **Enregistrer** → **Connecter Google**.

Google affiche « Google n'a pas validé cette application » : c'est normal pour une application personnelle en mode Test (*Paramètres avancés → Accéder à Vigie*). La session dure une heure ; ensuite un bandeau « Reconnecter » apparaît.

### 3. Transférer tes données depuis la version Claude
1. Dans Vigie (version Claude) : **Paramètres → Données → Exporter (JSON)**.
2. Dans Vigie autonome : **Paramètres → Données → Importer (JSON)** et choisis le fichier.
3. **Connecter Google** : tes données sont envoyées dans ton Drive (`Vigie/vigie-donnees.json.gz`) et tes feuilles (PEA, CTO, livrets, dettes, cours) sont relues comme avant.

### 4. Tâches automatiques — Google Apps Script (gratuit)
1. Va sur <https://script.google.com/> → **Nouveau projet** « Vigie — tâches ».
2. Remplace le contenu de `Code.gs` par celui du fichier `apps-script/Code.gs` de ce dépôt (aussi disponible en texte brut à l'adresse `https://<ton-site>.pages.dev/taches.txt`).
3. Sélectionne la fonction **installer** → **Exécuter** → accepte les autorisations.

Tu recevras par e-mail le bilan du mois (le 1er) et les alertes de cours ; une sauvegarde datée est faite chaque dimanche dans « Vigie — sauvegardes ».

### 5. (Facultatif) Claude par clé API
Pour la catégorisation automatique, la lecture des relevés scannés et le copilote :
1. <https://console.anthropic.com/> → crée une clé API et **fixe une limite de dépense** (quelques euros).
2. Vigie → **Paramètres → Version autonome → Clé API Anthropic**.

La clé reste dans ton navigateur ; ne l'utilise que sur tes appareils personnels.

## Ce qui diffère de la version Claude
- Plus de lecture automatique des relevés sur ton ordinateur : importe-les (bouton **Importer** ou dossier Drive « Vigie — dépôt »).
- Plus de veille d'actualité rédigée ni de dossier fiscal rédigé par Claude.
- Les connecteurs Finary et Finvygo ne sont pas disponibles (déjà inutiles depuis l'indépendance vis-à-vis de ces services).

## Sécurité
- Aucune donnée financière n'est dans ce dépôt ni sur Cloudflare : la page ne contient que le code.
- Tes données : navigateur (IndexedDB) + ton Google Drive. Pense au **code PIN** (Paramètres → Confidentialité) sur un appareil partagé.
