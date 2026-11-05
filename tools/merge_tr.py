"""Fusionne les traductions scratchpad/tr/<lg>_{1,2,3}.json en src/i18n_<file>.js après validation."""
import json,re,sys,pathlib
TR=pathlib.Path('/tmp/claude-0/-home-claude/047d484b-33bf-5f4c-9c75-5e854ee7b607/scratchpad/tr')
LG={'it':'it','nl':'nl','pt':'pt','ptbr':'pt-BR','pl':'pl','sv':'sv','da':'da','cs':'cs','ro':'ro'}
en={}
for i in (1,2,3):en.update(json.load(open(TR/f'en_{i}.json')))
ph=lambda s:sorted(re.findall(r'\{[a-z]+\}',s))
for f,code in LG.items():
    if len(sys.argv)>1 and f not in sys.argv[1:]:continue
    out={};bad=[];miss=0
    for i in (1,2,3):
        p=TR/f'{f}_{i}.json'
        if not p.exists():print(f,'missing chunk',i);continue
        try:d=json.load(open(p))
        except Exception as e:print(f,i,'JSON error',e);continue
        for k,v in d.items():
            if k not in en or not isinstance(v,str):continue
            if ph(v)!=ph(en[k]):bad.append(k);continue
            out[k]=v
    miss=len([k for k in en if k not in out])
    js=f"I18N[{json.dumps(code)}]={{\n"+',\n'.join(f'{json.dumps(k,ensure_ascii=False)}:{json.dumps(v,ensure_ascii=False)}' for k,v in out.items())+"\n};\n"
    pathlib.Path(f'/home/claude/vigie/src/i18n_{f}.js').write_text(js)
    print(f'{f}: {len(out)} ok, {len(bad)} placeholder mismatches dropped, {miss} missing (fallback EN)')
