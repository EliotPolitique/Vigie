"""Construit la version autonome de Vigie dans web/ (à publier sur Cloudflare Pages)."""
import pathlib,re,shutil,subprocess
R=pathlib.Path(__file__).parent
subprocess.run(['python3','build.py'],cwd=R,check=True,capture_output=True)
js=(R/'dist/app.js').read_text()
head=(R/'src/head.html').read_text()
css=(R/'src/styles.css').read_text()
shim=(R/'web-src/shim.js').read_text()
sa=(R/'web-src/standalone.js').read_text()
# le code autonome doit être chargé avant le démarrage de l'application (dernier bloc de app.js)
html=('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
 '<meta name="theme-color" content="#F7F8FA" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0A0E16" media="(prefers-color-scheme: dark)"><link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="icon-180.png">'
 '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="Vigie"><meta name="format-detection" content="telephone=no"><meta name="robots" content="noindex,nofollow">'
 +head.replace('<meta name="claude:viewport-fit-sides" content="cover">','')+'<style>\n'+css+'</style></head><body>\n<div id="app"></div>\n<div id="ovl" class="ovl" hidden></div>\n<div class="toast" id="toast" hidden role="status" aria-live="polite"></div>\n'
 '<script>\n'+shim+'\n</script>\n<script>\n'+js+'\n'+sa+'\n</script>\n</body></html>\n')
out=R/'web';out.mkdir(exist_ok=True)
(out/'index.html').write_text(html)
for f in ['manifest.webmanifest','sw.js','icon.svg','icon-maskable.svg','icon-180.png','icon-192.png','icon-512.png','_headers']:shutil.copy(R/'web-src'/f,out/f)
print(len(html))
