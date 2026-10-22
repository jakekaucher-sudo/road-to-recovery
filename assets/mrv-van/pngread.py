import sys, zlib, struct, collections

def read_png(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    pos = 8; idat = b''; w = h = 0; ctype = 0
    while pos < len(data):
        ln, = struct.unpack('>I', data[pos:pos+4]); typ = data[pos+4:pos+8]
        body = data[pos+8:pos+8+ln]; pos += 12 + ln
        if typ == b'IHDR':
            w, h, bd, ctype, _, _, _ = struct.unpack('>IIBBBBB', body)
            assert bd == 8, 'only 8-bit'
        elif typ == b'IDAT': idat += body
        elif typ == b'IEND': break
    bpp = {2: 3, 6: 4, 0: 1, 4: 2}[ctype]
    raw = zlib.decompress(idat); stride = w * bpp
    prev = bytearray(stride); rows = []; p = 0
    for _ in range(h):
        f = raw[p]; p += 1
        cur = bytearray(raw[p:p+stride]); p += stride
        for i in range(stride):
            a = cur[i-bpp] if i >= bpp else 0
            b = prev[i]
            c = prev[i-bpp] if i >= bpp else 0
            if f == 1: cur[i] = (cur[i] + a) & 255
            elif f == 2: cur[i] = (cur[i] + b) & 255
            elif f == 3: cur[i] = (cur[i] + ((a + b) >> 1)) & 255
            elif f == 4:
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2*c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                cur[i] = (cur[i] + pr) & 255
        rows.append(bytes(cur)); prev = cur
    return w, h, bpp, rows

def top_colors(path, n=12, q=4):
    w, h, bpp, rows = read_png(path)
    cnt = collections.Counter()
    for row in rows:
        for x in range(0, w*bpp, bpp):
            r, g, b = row[x], row[x+1], row[x+2]
            cnt[(r//q*q+q//2, g//q*q+q//2, b//q*q+q//2)] += 1
    total = w*h
    return [('#%02x%02x%02x' % c, round(100*k/total, 1)) for c, k in cnt.most_common(n)]

if __name__ == '__main__':
    for path in sys.argv[1:]:
        print(path.split('-')[-1], top_colors(path))
