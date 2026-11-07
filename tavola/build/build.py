# Genera il file unico finale: font incorporati (niente internet), <head> vero, audio in fondo caricato solo quando serve.
import base64,re,sys,os
SRC=sys.argv[1]; OUT=sys.argv[2]; MP3=sys.argv[3]; FONTS=sys.argv[4]
s=open(SRC).read()
css=open(os.path.join(FONTS,'g.css')).read()
faces=[]
seen=set()
for sub,body in re.findall(r'/\* ([\w-]+) \*/\s*@font-face\s*{([^}]*)}',css):
    if sub not in('latin','latin-ext'):continue
    fam=re.search(r"font-family: '([^']+)'",body).group(1)
    key=(fam,sub)
    if key in seen:continue
    seen.add(key)
    fn=[f for f in os.listdir(FONTS) if f.startswith(fam.replace(' ','')+'_'+sub+'_')][0]
    b64=base64.b64encode(open(os.path.join(FONTS,fn),'rb').read()).decode()
    wght='400 900' if fam=='Archivo' else '400 600'
    stretch='font-stretch:62% 125%;' if fam=='Archivo' else ''
    ur=re.search(r'unicode-range: ([^;]+);',body).group(1)
    faces.append(f"@font-face{{font-family:'{fam}';font-style:normal;font-weight:{wght};{stretch}font-display:swap;src:url(data:font/woff2;base64,{b64}) format('woff2');unicode-range:{ur}}}")
# separa testa (titolo, link, stile) dal corpo
head_end=s.index('</style>')+len('</style>')
head=s[:head_end]; body=s[head_end:]
head=re.sub(r'<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*','',head)
head=head.replace('<style>','<style>\n'+'\n'.join(faces)+'\n',1)
body=body.replace('data-src="__AUDIO__"','data-src=""')
# Satoshi (design system FonteAlta) incorporato come gli altri font
sat=base64.b64encode(open(os.path.join(FONTS,'Satoshi-Variable.woff2'),'rb').read()).decode()
head=head.replace('url(build/fonts/Satoshi-Variable.woff2)','url(data:font/woff2;base64,'+sat+')')
audio=base64.b64encode(open(MP3,'rb').read()).decode()
page=('<!doctype html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
      +head+'\n</head>\n<body>'+body+'\n<script type="text/plain" id="voce-data">'+audio+'</script>\n</body>\n</html>\n')
open(OUT,'w').write(page)
print(OUT, round(len(page)/1e6,2),'MB', len(faces),'font-face')
