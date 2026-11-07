import pathlib
s=pathlib.Path('src')
order=['core.js','fmt.js','pdf.js','i18n_fr.js','i18n_en.js','i18n_es.js','i18n_de.js','i18n_it.js','i18n_nl.js','i18n_pt.js','i18n_ptbr.js','i18n_pl.js','i18n_sv.js','i18n_da.js','i18n_cs.js','i18n_ro.js','intl.js','data.js','charts.js','views1.js','views2.js','views3.js','live.js','pimp.js','ledger.js','timport.js','finary.js','analysis.js','widgets.js','assets.js','tools.js','premium.js','fiscal.js','history.js','budget2.js','nav2.js','expo.js','aidoc.js','health.js','forecast.js','income2.js','catalog.js','logos_data.js','brand.js','dash.js','bench.js','pages.js','trading.js','wave5.js','gsync.js','markets.js','wave6.js','design.js','wave7.js','reset.js','increp.js','app.js']
js='\n'.join((s/f).read_text() for f in order if (s/f).exists())
html=(s/'head.html').read_text()+'<style>\n'+(s/'styles.css').read_text()+'</style>\n<div id="app"></div>\n<div id="ovl" class="ovl" hidden></div>\n<div class="toast" id="toast" hidden role="status" aria-live="polite"></div>\n<script>\n'+js+'\n</script>\n'
pathlib.Path('dist/vigie.html').write_text(html)
open('dist/app.js','w').write(js)
print(len(html))
