"""Usage: python3 tools/addkeys.py file.py  — file defines K={key:[fr,en,es,de]}; replaces existing keys, appends new ones."""
import json,re,sys
ns={};exec(open(sys.argv[1]).read(),ns);K=ns['K']
for i,lg in enumerate(['fr','en','es','de']):
    p=f'/home/claude/vigie/src/i18n_{lg}.js';s=open(p).read();new=[]
    for k,v in K.items():
        val=json.dumps(v[i],ensure_ascii=False);pat=r'"'+re.escape(k)+r'":"(?:[^"\\]|\\.)*"'
        if re.search(pat,s):s=re.sub(pat,lambda m:'"'+k+'":'+val,s)
        else:new.append(f'"{k}":{val}')
    if new:j=s.rstrip().rfind('};');s=s[:j].rstrip()+',\n'+',\n'.join(new)+'\n};\n'
    open(p,'w').write(s)
print(len(K),'keys')
