"""zoom.py src out x0 y0 x1 y1 scale  - crop+nearest upscale, RGBA composited on white"""
import sys, os
D=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0,D)
from pngread import read_png
from pngwrite import write_png
src,out=sys.argv[1],sys.argv[2]; x0,y0,x1,y1,s=map(int,sys.argv[3:8])
w,h,bpp,rows=read_png(src); res=[]
for y in range(y0,y1):
    r=bytearray()
    for x in range(x0,x1):
        px=rows[y][x*bpp:(x+1)*bpp]
        if bpp==4:
            a=px[3]; c=[(px[i]*a+255*(255-a))//255 for i in range(3)]
        elif bpp==3: c=list(px[:3])
        else: c=[px[0]]*3
        r+=bytes(c)*s
    for _ in range(s): res.append(r)
write_png(out,(x1-x0)*s,(y1-y0)*s,res)
