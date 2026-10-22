"""Exact vectorizer for reference.png (SBA MRV van, driver side).

Pure python3 stdlib.  Usage:
    python3 trace.py trace            -> writes driver-side-traced.svg + layers.json
    python3 trace.py compare out.png  -> class agreement of a render vs the reference

Pipeline: alpha-threshold + blend-aware nearest-palette classification ->
small-speck cleanup -> 4-connected components -> crack-following boundary
loops (on pixel-edge midpoints) -> Douglas-Peucker 0.6 px -> one evenodd
<path> per component, grouped into layers.
"""
import sys, os, json, math, time
from array import array
from collections import Counter, deque

DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TR = os.path.join(DIR, 'trace')
sys.path.insert(0, DIR)
from pngread import read_png

W, H = 2000, 1339

# class table: (name, hex)   id 0 = transparent background (never traced)
CLASSES = [
    ('bg',           '#FFFFFF'),
    ('white',        '#FFFFFF'),
    ('navy',         '#1C3E75'),
    ('red',          '#CE2027'),
    ('bumper',       '#303238'),
    ('dark',         '#000009'),
    ('rocker',       '#4B4F52'),
    ('rocker-light', '#75787E'),
    ('glass',        '#E0E2E6'),
    ('silver',       '#B1B5B9'),
    ('hub-light',    '#C7CCCD'),
    ('amber',        '#F68422'),
    ('tail-red',     '#EE2225'),
    ('headlight-gray', '#A0A2A6'),
]
NAMES = [c[0] for c in CLASSES]
HEX = [c[1] for c in CLASSES]
RGB = [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in HEX]
NC = len(CLASSES)
C_BG, C_WHITE, C_NAVY, C_RED, C_BUMPER, C_DARK = 0, 1, 2, 3, 4, 5

# paint order (large/underneath first; text drawn last separately)
PAINT = ['navy', 'red', 'white', 'rocker-light', 'rocker', 'bumper', 'glass',
         'silver', 'hub-light', 'headlight-gray', 'amber', 'tail-red', 'dark']

MIN_COMP = 5          # specks smaller than this are merged into neighbours
DP_TOL = 0.6
DARK_BIAS = 0.40      # blend with dark counts as dark from this fraction on


# ---------------------------------------------------------------- classify
_pairs = [(a, b) for a in range(1, NC) for b in range(a + 1, NC)]
_cache = {}


def classify_rgb(r, g, b):
    key = (r, g, b)
    c = _cache.get(key)
    if c is not None:
        return c
    best, bd = 0, 1e18
    for i, (cr, cg, cb) in enumerate(RGB):
        if i == C_BG:
            continue
        d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
        if d < bd:
            bd, best = d, i
    if bd <= 16 * 16:
        _cache[key] = best
        return best
    # blend of two palette colours: project on segment, pick nearer end
    bres, bcls = 1e18, best
    for a, bb in _pairs:
        ar, ag, ab = RGB[a]; br, bg, bb2 = RGB[bb]
        vx, vy, vz = br - ar, bg - ag, bb2 - ab
        L2 = vx * vx + vy * vy + vz * vz
        t = ((r - ar) * vx + (g - ag) * vy + (b - ab) * vz) / L2
        if t < -0.05 or t > 1.05:
            continue
        tt = min(1.0, max(0.0, t))
        px, py, pz = ar + vx * tt, ag + vy * tt, ab + vz * tt
        res = (r - px) ** 2 + (g - py) ** 2 + (b - pz) ** 2
        if res < bres:
            bres = res
            if a == C_DARK:
                bcls = a if (1 - tt) >= DARK_BIAS else bb
            elif bb == C_DARK:
                bcls = bb if tt >= DARK_BIAS else a
            else:
                bcls = bb if tt >= 0.5 else a
    if bres > 40 * 40:
        bcls = best
    _cache[key] = bcls
    return bcls


def classify_png(path):
    w, h, bpp, rows = read_png(path)
    assert (w, h) == (W, H), (w, h)
    lab = [bytearray(w) for _ in range(h)]
    for y in range(h):
        row = rows[y]; L = lab[y]
        if bpp == 4:
            for x in range(w):
                i = x * 4
                if row[i + 3] >= 128:
                    L[x] = classify_rgb(row[i], row[i + 1], row[i + 2])
        elif bpp == 3:
            for x in range(w):
                i = x * 3
                L[x] = classify_rgb(row[i], row[i + 1], row[i + 2])
        else:
            for x in range(w):
                v = row[x * bpp]
                L[x] = classify_rgb(v, v, v)
    return lab


# ---------------------------------------------------------------- components
def components(lab, min_size=0):
    """4-connected components of equal label. Returns (comp array (w*h, -1 for
    white), list of dicts). If min_size>0, specks are relabelled first."""
    comp = array('i', [-1]) * (W * H)
    comps = []
    for y in range(H):
        L = lab[y]
        for x in range(W):
            if L[x] == 0 or comp[y * W + x] >= 0:
                continue
            c = L[x]; cid = len(comps)
            q = deque([(x, y)]); comp[y * W + x] = cid
            pts = []
            while q:
                px, py = q.popleft(); pts.append((px, py))
                for nx, ny in ((px + 1, py), (px - 1, py), (px, py + 1), (px, py - 1)):
                    if 0 <= nx < W and 0 <= ny < H and lab[ny][nx] == c and comp[ny * W + nx] < 0:
                        comp[ny * W + nx] = cid; q.append((nx, ny))
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            comps.append({'id': cid, 'cls': c, 'n': len(pts), 'pts': pts,
                          'bbox': [min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1]})
    if min_size:
        changed = 0
        for cd in comps:
            if cd['n'] >= min_size:
                continue
            cnt = Counter()
            for px, py in cd['pts']:
                for nx, ny in ((px + 1, py), (px - 1, py), (px, py + 1), (px, py - 1)):
                    if 0 <= nx < W and 0 <= ny < H and comp[ny * W + nx] != cd['id']:
                        cnt[lab[ny][nx]] += 1
            if cnt:
                new = cnt.most_common(1)[0][0]
                for px, py in cd['pts']:
                    lab[py][px] = new
                changed += 1
        if changed:
            return components(lab, 0)
    return comp, comps


# ---------------------------------------------------------------- tracing
# edge direction e: 0=+x 1=+y 2=-x 3=-y ; region kept on the right (clockwise)
UX = (1, 0, -1, 0); UY = (0, 1, 0, -1)
# (right-side pixel offset, left-side pixel offset) relative to vertex
RSIDE = ((0, 0), (-1, 0), (-1, -1), (0, -1))
LSIDE = ((0, -1), (0, 0), (-1, 0), (-1, -1))


def trace_loops(lab, comp):
    """Returns dict comp_id -> list of loops; each loop is a list of (x,y)
    edge midpoints."""
    W1 = W + 1
    visited = bytearray(W1 * (H + 1) * 4)
    loops = {}

    def inside(cid, px, py):
        return 0 <= px < W and 0 <= py < H and comp[py * W + px] == cid

    for y in range(H):
        L = lab[y]
        for x in range(W):
            if L[x] == 0:
                continue
            if y > 0 and comp[(y - 1) * W + x] == comp[y * W + x]:
                continue  # no top edge here
            cid = comp[y * W + x]
            vx, vy, e = x, y, 0
            if visited[(vy * W1 + vx) * 4 + e]:
                continue
            pts = []
            while True:
                k = (vy * W1 + vx) * 4 + e
                if visited[k]:
                    break
                visited[k] = 1
                pts.append((vx + 0.5 * UX[e], vy + 0.5 * UY[e]))
                vx += UX[e]; vy += UY[e]
                for ne in ((e + 1) & 3, e, (e + 3) & 3):
                    rx, ry = RSIDE[ne]; lx, ly = LSIDE[ne]
                    if inside(cid, vx + rx, vy + ry) and not inside(cid, vx + lx, vy + ly):
                        e = ne
                        break
                else:
                    raise RuntimeError('dead end at %d,%d' % (vx, vy))
            loops.setdefault(cid, []).append(pts)
    return loops


def _dp(pts, i0, i1, tol, keep):
    stack = [(i0, i1)]
    tol2 = tol * tol
    while stack:
        a, b = stack.pop()
        if b - a < 2:
            continue
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if L2 == 0:
                d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = ((px - ax) * dx + (py - ay) * dy) / L2
                t = 0.0 if t < 0 else (1.0 if t > 1 else t)
                qx, qy = ax + t * dx, ay + t * dy
                d = (px - qx) ** 2 + (py - qy) ** 2
            if d > best:
                best, bi = d, i
        if best > tol2:
            keep[bi] = 1
            stack.append((a, bi)); stack.append((bi, b))


def simplify(loop, tol):
    n = len(loop)
    if n <= 4:
        return loop
    x0, y0 = loop[0]
    far = max(range(n), key=lambda i: (loop[i][0] - x0) ** 2 + (loop[i][1] - y0) ** 2)
    pts = loop + [loop[0]]
    keep = bytearray(n + 1); keep[0] = keep[far] = keep[n] = 1
    _dp(pts, 0, far, tol, keep)
    _dp(pts, far, n, tol, keep)
    return [pts[i] for i in range(n) if keep[i]]


def fmt(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    return s if s else '0'


def path_d(loops):
    parts = []
    for lp in loops:
        if len(lp) < 3:
            continue
        s = 'M' + fmt(lp[0][0]) + ' ' + fmt(lp[0][1])
        px, py = lp[0]
        for x, y in lp[1:]:
            dx, dy = x - px, y - py
            if dy == 0:
                s += 'h' + fmt(dx)
            elif dx == 0:
                s += 'v' + fmt(dy)
            else:
                s += 'l' + fmt(dx) + ' ' + fmt(dy)
            px, py = x, y
        parts.append(s + 'z')
    return ''.join(parts)


# ---------------------------------------------------------------- text regions
# verified against the pixels (see notes); [x0,y0,x1,y1] inclusive-exclusive
TEXT_REGIONS = {
    'text-dr':      {'box': [1130, 585, 1430, 695], 'classes': (C_WHITE,)},
    'text-bullets': {'box': [1160, 705, 1405, 752], 'classes': (C_WHITE,)},
    'text-sba':     {'box': [850, 583, 1010, 702], 'classes': (C_WHITE, C_RED)},
    'text-sub':     {'box': [845, 705, 1020, 755], 'classes': (C_WHITE,)},
}
TEXT_CONTENT = {
    'text-dr': 'DISASTER / RECOVERY',
    'text-bullets': 'Businesses ▪ Homeowners / Renters ▪ Nonprofits',
    'text-sba': 'SBA wordmark with bracket corners (white top bracket + bottom-right corner, red bottom-left corner)',
    'text-sub': 'U.S. Small Business / Administration',
}
MAX_TEXT_COMP = 2500   # a glyph is never bigger than this; the white band is


def text_group_of(cd):
    x, y, w, h = cd['bbox']
    if cd['n'] > MAX_TEXT_COMP:
        return None
    for gid, spec in TEXT_REGIONS.items():
        if cd['cls'] not in spec['classes']:
            continue
        bx0, by0, bx1, by1 = spec['box']
        if x >= bx0 and y >= by0 and x + w <= bx1 and y + h <= by1:
            return gid
    return None


# ---------------------------------------------------------------- main
def do_trace():
    t0 = time.time()
    lab = classify_png(os.path.join(DIR, 'reference.png'))
    print('classified %.1fs' % (time.time() - t0))
    comp, comps = components(lab, MIN_COMP)
    print('components', len(comps), '%.1fs' % (time.time() - t0))
    loops = trace_loops(lab, comp)
    print('loops traced %.1fs' % (time.time() - t0))
    for cd in comps:
        cd['loops'] = [simplify(lp, DP_TOL) for lp in loops.get(cd['id'], [])]
    print('simplified %.1fs' % (time.time() - t0))

    layers = {}   # layer id -> list of comps
    for cd in comps:
        g = text_group_of(cd)
        if g is None:
            g = NAMES[cd['cls']]
        layers.setdefault(g, []).append(cd)

    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1339" viewBox="0 0 2000 1339">',
           '<rect width="2000" height="1339" fill="#FFFFFF"/>']
    layer_info = []
    npts = 0
    # body layers in paint order, text groups last
    order = [('body-navy', 'navy'), ('livery-red', 'red'), ('livery-white', 'white')] + \
            [(n, n) for n in PAINT[3:]]
    for lid, cname in order:
        cs = layers.get(cname, [])
        if not cs:
            continue
        col = HEX[NAMES.index(cname)]
        out.append('<g id="%s" fill="%s" fill-rule="evenodd">' % (lid, col))
        for cd in sorted(cs, key=lambda c: -c['n']):
            d = path_d(cd['loops'])
            if d:
                out.append('<path d="%s"/>' % d)
                npts += sum(len(l) for l in cd['loops'])
        out.append('</g>')
        layer_info.append({'id': lid, 'fill': col, 'components': len(cs),
                           'pixels': sum(c['n'] for c in cs)})
    out.append('<g id="text">')
    text_groups = []
    for gid in TEXT_REGIONS:
        cs = layers.get(gid, [])
        if not cs:
            continue
        xs0 = min(c['bbox'][0] for c in cs); ys0 = min(c['bbox'][1] for c in cs)
        xs1 = max(c['bbox'][0] + c['bbox'][2] for c in cs)
        ys1 = max(c['bbox'][1] + c['bbox'][3] for c in cs)
        out.append('<g id="%s">' % gid)
        for cls in (C_WHITE, C_RED):
            sub = [c for c in cs if c['cls'] == cls]
            if not sub:
                continue
            sid = gid + ('-white' if cls == C_WHITE else '-red')
            out.append('<g id="%s" fill="%s" fill-rule="evenodd">' % (sid, HEX[cls]))
            for cd in sorted(sub, key=lambda c: (c['bbox'][1] // 40, c['bbox'][0])):
                out.append('<path d="%s"/>' % path_d(cd['loops']))
                npts += sum(len(l) for l in cd['loops'])
            out.append('</g>')
        out.append('</g>')
        text_groups.append({'id': gid, 'content': TEXT_CONTENT[gid],
                            'bbox': [xs0, ys0, xs1 - xs0, ys1 - ys0],
                            'components': len(cs)})
    out.append('</g>')
    out.append('</svg>')
    svg = os.path.join(TR, 'driver-side-traced.svg')
    with open(svg, 'w') as f:
        f.write('\n'.join(out))
    print('wrote', svg, 'points', npts, 'bytes', os.path.getsize(svg))
    with open(os.path.join(TR, 'layers.json'), 'w') as f:
        json.dump({'canvas': [W, H], 'layers': layer_info, 'textGroups': text_groups,
                   'classes': [{'name': n, 'fill': h} for n, h in CLASSES]}, f, indent=1)
    # keep the label map for compare
    with open(os.path.join(TR, 'ref-labels.bin'), 'wb') as f:
        for L in lab:
            f.write(L)
    for tg in text_groups:
        print(tg)


def do_compare(render_png):
    ref_path = os.path.join(TR, 'ref-labels.bin')
    if os.path.exists(ref_path):
        data = open(ref_path, 'rb').read()
        ref = [data[y * W:(y + 1) * W] for y in range(H)]
    else:
        ref = classify_png(os.path.join(DIR, 'reference.png'))
    ren = classify_png(render_png)
    tr = bytes.maketrans(bytes([C_BG]), bytes([C_WHITE]))
    ref = [r.translate(tr) for r in ref]
    ren = [r.translate(tr) for r in ren]
    tot = W * H; same = 0
    bx0, by0, bx1, by1 = 393, 474, 1607, 970
    bsame = 0; btot = (bx1 - bx0) * (by1 - by0)
    conf = Counter()
    diff = [bytearray(W * 3) for _ in range(H)]
    for y in range(H):
        a = ref[y]; b = ren[y]
        if a == b:
            same += W
            if by0 <= y < by1:
                bsame += bx1 - bx0
            continue
        for x in range(W):
            if a[x] == b[x]:
                same += 1
                if by0 <= y < by1 and bx0 <= x < bx1:
                    bsame += 1
            else:
                conf[(NAMES[a[x]], NAMES[b[x]])] += 1
                i = x * 3
                diff[y][i] = 255; diff[y][i + 1] = 0; diff[y][i + 2] = 0
    print('agreement full frame %.5f   van bbox %.5f' % (same / tot, bsame / btot))
    for k, v in conf.most_common(12):
        print('  ref %-14s -> render %-14s %d' % (k[0], k[1], v))
    from pngwrite import write_png
    write_png(os.path.join(TR, 'diff.png'), W, H, diff)
    return same / tot


if __name__ == '__main__':
    if sys.argv[1] == 'trace':
        do_trace()
    elif sys.argv[1] == 'compare':
        do_compare(sys.argv[2])
