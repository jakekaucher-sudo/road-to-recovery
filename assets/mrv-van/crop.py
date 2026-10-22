import sys
sys.path.insert(0, '.')
from pngread import read_png
from pngwrite import write_png
src, dst, x0, y0, x1, y1 = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:7])
w, h, bpp, rows = read_png(src)
out = [bytes(rows[y][x0*bpp:(x1)*bpp]) if bpp == 3 else bytes(b''.join(rows[y][x*bpp:x*bpp+3] for x in range(x0, x1))) for y in range(y0, y1)]
write_png(dst, x1-x0, y1-y0, out)
print(dst)
