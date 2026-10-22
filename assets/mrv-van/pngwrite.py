"""Minimal pure-stdlib PNG writer (8-bit RGB).

write_png(path, w, h, rows): rows[y] is a bytes/bytearray of length w*3 (RGB).
"""
import zlib, struct


def _chunk(typ, body):
    c = struct.pack('>I', len(body)) + typ + body
    return c + struct.pack('>I', zlib.crc32(typ + body) & 0xffffffff)


def write_png(path, w, h, rows):
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter type: none
        raw += bytes(rows[y][:w * 3])
    png = b'\x89PNG\r\n\x1a\n'
    png += _chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    png += _chunk(b'IDAT', zlib.compress(bytes(raw), 6))
    png += _chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def mirror_png(src, dst):
    """Flip a PNG horizontally; RGBA input is composited onto white."""
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from pngread import read_png
    w, h, bpp, rows = read_png(src)
    out = []
    for row in rows:
        o = bytearray(w * 3)
        for x in range(w):
            px = row[x * bpp:(x + 1) * bpp]
            if bpp == 4:
                a = px[3]
                r = (px[0] * a + 255 * (255 - a)) // 255
                g = (px[1] * a + 255 * (255 - a)) // 255
                b = (px[2] * a + 255 * (255 - a)) // 255
            elif bpp == 3:
                r, g, b = px[0], px[1], px[2]
            else:
                r = g = b = px[0]
            i = (w - 1 - x) * 3
            o[i] = r; o[i + 1] = g; o[i + 2] = b
        out.append(o)
    write_png(dst, w, h, out)


if __name__ == '__main__':
    import sys
    mirror_png(sys.argv[1], sys.argv[2])
