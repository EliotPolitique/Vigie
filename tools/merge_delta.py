"""Ajoute les traductions delta scratchpad/trd/<f>.json aux fichiers src/i18n_<f>.js (clés absentes ou remplacées), après validation des variables."""
import json,re,sys,pathlib
TRD=pathlib.Path('/tmp/claude-0/-home-claude/047d484b-33bf-5f4c-9c75-5e854ee7b607/scratchpad/trd')
ph=lambda s:sorted(re.findall(r'\{[a-z]+\}',s))
def merge(f,src,en):
    p=pathlib.Path(f'/home/claude/vigie/src/i18n_{f}.js');s=p.read_text();d=json.load(open(src));ok=bad=0;new=[]
    for k,v in d.items():
        if k not in en or not isinstance(v,str):continue
        if ph(v)!=ph(en[k]) or v.count('|')!=en[k].count('|'):bad+=1;continue
        val=json.dumps(v,ensure_ascii=False);pat=r'["\']'+re.escape(k)+r'["\']:(?:"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\')'
        if re.search(pat,s):s=re.sub(pat,lambda m:json.dumps(k)+':'+val,s,count=1)
        else:new.append(f'{json.dumps(k)}:{val}')
        ok+=1
    if new:j=s.rstrip().rfind('};');s=s[:j].rstrip().rstrip(',')+',\n'+',\n'.join(new)+'\n};\n'
    p.write_text(s);print(f,ok,'ok',bad,'rejected',len(new),'new')
en=json.load(open(TRD/'delta_en.json'));en.update(json.load(open(TRD/'envr_en.json')))
for f in sys.argv[1:]:
    src=TRD/(f+'.json') if f not in('es','de') else TRD/f'envr_{f}.json'
    if src.exists():merge(f,src,en)
    else:print(f,'absent')
