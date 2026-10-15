# Как собран fonts/osifont.woff2: исходник osifont-lgpl3fe.ttf (github.com/hikikomori82/osifont) -> этот скрипт -> pyftsubset --flavor=woff2
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.reverseContourPen import ReverseContourPen
f=TTFont('fdl/osifont-lgpl3fe.ttf'); cm=f.getBestCmap(); gs=f.getGlyphSet(); g=f['glyf']; hm=f['hmtx']
def remake(dst,src,mat,rev=False):
    pen=TTGlyphPen(gs); p=ReverseContourPen(pen) if rev else pen
    gs[cm[ord(src)]].draw(TransformPen(p,mat)); g[cm[ord(dst)]]=pen.glyph()
def adv(c): return hm[cm[ord(c)]][0]
# Э, э — зеркальные Є, є (в файле на их месте залитые прямоугольники)
for d,s in (('Э','Є'),('э','є')):
    a=adv(s); remake(d,s,(-1,0,0,1,a,0),rev=True); hm[cm[ord(d)]]=(a,0)
# з — строчная высотой строчных (в файле — почти цифра 3 во весь рост)
ZH=g[cm[ord('З')]]; sy=1060/1515.0; sx=0.82
remake('з','З',(sx,0,0,sy,100*(1-sx),0)); hm[cm[ord('з')]]=(int(adv('З')*sx+40),0)
for d,sc in (('Ё','Ë'),('ё','ë')):
    remake(d,sc,(1,0,0,1,0,0)); hm[cm[ord(d)]]=(adv(sc),0)
for c in 'ЭэзЁё': g[cm[ord(c)]].recalcBounds(g)
f.save('fdl/osifont-fixed.ttf')
# штрихи ′ ″ ‴ (обозначения проекций A′, A″, A‴), минус, подстрочные цифры ₀–₉ (π₁, x₁₄)
f=TTFont('fdl/osifont-fixed.ttf'); cm=f.getBestCmap(); gs=f.getGlyphSet(); g=f['glyf']; hm=f['hmtx']; go=f.getGlyphOrder()
def add(u,name,draws,advw):
    pen=TTGlyphPen(gs)
    for src,mat in draws: gs[cm[ord(src)]].draw(TransformPen(pen,mat))
    gl=pen.glyph(); gl.recalcBounds(g)
    if name not in go: go.append(name)
    g[name]=gl; hm[name]=(int(advw),0)
    for t in f['cmap'].tables:
        if t.isUnicode(): t.cmap[u]=name
q=cm[ord("'")]; qa=hm[q][0]
add(0x2032,'prime',[("'",(1,0,0,1,0,0))],qa)
add(0x2033,'dblprime',[("'",(1,0,0,1,0,0)),("'",(1,0,0,1,qa*0.55,0))],qa*1.55)
add(0x2034,'trprime',[("'",(1,0,0,1,0,0)),("'",(1,0,0,1,qa*0.55,0)),("'",(1,0,0,1,qa*1.1,0))],qa*2.1)
add(0x2212,'minus',[('–',(1,0,0,1,0,0))],hm[cm[ord('–')]][0])
for i in range(10):
    d=str(i); a=hm[cm[ord(d)]][0]
    add(0x2080+i,'uni%04X'%(0x2080+i),[(d,(0.62,0,0,0.62,0,-300))],a*0.66)
f.setGlyphOrder(go); f.save('fdl/osifont-fixed.ttf')
