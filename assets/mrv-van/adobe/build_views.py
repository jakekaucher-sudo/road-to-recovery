"""Builds the MRV van views from Adobe's vector trace of the reference.

  python3 adobe/build_views.py      -> writes v3/*.svg

Passenger side: the trace mirrored, letter holes closed, the text groups
laid back on unmirrored. Front and rear: elevations drawn to the measured
proportions, reusing the traced text/logo paths. Three-quarter: passenger
side plus the front face attached along the nose profile, with a mild
perspective taper.
"""
import re, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'v3')
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, ROOT)
from pngread import read_png

svg = open(os.path.join(HERE, 'reference-vector.svg')).read()
PATHS = re.findall(r'<path\b[^>]*>', svg)
P = json.load(open(os.path.join(HERE, 'paths.json')))
TEXT = json.load(open(os.path.join(HERE, 'text_ids.json')))   # block -> path ids
TEXT_IDS = {i for ids in TEXT.values() for i in ids}
W, H = 2000, 1339

# measured colors (Adobe trace)
NAVY, RED, WHITE = 'rgb(28,61,114)', 'rgb(203,32,39)', 'rgb(254,254,254)'
GLASS, OUTLINE, BLACK = 'rgb(223,225,229)', 'rgb(12,12,18)', 'rgb(0,0,8)'
ROCKER_TOP, DARK = 'rgb(116,120,125)', 'rgb(48,49,56)'
BUMPER_F, AMBER, HUB, MIRROR = 'rgb(93,96,100)', 'rgb(239,133,43)', 'rgb(190,193,196)', 'rgb(6,3,4)'
ROOF_Y, BODY_BOTTOM, GROUND = 474, 916, 973

# ---------------------------------------------------------------- path data utils
NUM = r'-?\d*\.?\d+(?:e-?\d+)?'
TOK = re.compile(r'[MLCQZHV]|' + NUM)
ARGC = {'M': 2, 'L': 2, 'C': 6, 'Q': 4, 'Z': 0}

def map_d(d, fn):
    """Apply fn(x, y) -> (x, y) to every coordinate of an absolute path."""
    toks = TOK.findall(d)
    out, i, cmd, cur = [], 0, None, (0.0, 0.0)
    while i < len(toks):
        t = toks[i]
        if t in ARGC or t in 'HV':
            cmd = t; i += 1
            if cmd == 'Z':
                out.append('Z'); continue
            out.append(cmd)
            continue
        if cmd == 'H':
            cur = (float(t), cur[1]); i += 1
            x, y = fn(*cur); out[-1] = 'L'; out.append(f'{x:.2f},{y:.2f}'); cmd = 'L'; continue
        if cmd == 'V':
            cur = (cur[0], float(t)); i += 1
            x, y = fn(*cur); out[-1] = 'L'; out.append(f'{x:.2f},{y:.2f}'); cmd = 'L'; continue
        n = ARGC[cmd]
        nums = [float(v) for v in toks[i:i + n]]; i += n
        pts = []
        for k in range(0, n, 2):
            cur = (nums[k], nums[k + 1])
            x, y = fn(*cur)
            pts.append(f'{x:.2f},{y:.2f}')
        out.append(' '.join(pts))
        if cmd == 'M':
            cmd = 'L'
    return ' '.join(out)

def map_paths(fragment, fn):
    return re.sub(r'\bd="([^"]*)"', lambda m: 'd="' + map_d(m.group(1), fn) + '"', fragment)

def mirror(fragment):
    return map_paths(fragment, lambda x, y: (2000 - x, y))

def place(fragment, tx, ty, s):
    return map_paths(fragment, lambda x, y: (x * s + tx, y * s + ty))

def rect_path(x, y, w, h, rx=0, fill=WHITE, extra=''):
    if rx:
        d = (f'M{x + rx},{y} L{x + w - rx},{y} Q{x + w},{y} {x + w},{y + rx} L{x + w},{y + h - rx} '
             f'Q{x + w},{y + h} {x + w - rx},{y + h} L{x + rx},{y + h} Q{x},{y + h} {x},{y + h - rx} '
             f'L{x},{y + rx} Q{x},{y} {x + rx},{y} Z')
    else:
        d = f'M{x},{y} L{x + w},{y} L{x + w},{y + h} L{x},{y + h} Z'
    return f'<path d="{d}" fill="{fill}" {extra}/>'

# ---------------------------------------------------------------- text blocks
def bbox_of(ids):
    bs = [P[i] for i in ids]
    return min(b['x0'] for b in bs), min(b['y0'] for b in bs), max(b['x1'] for b in bs), max(b['y1'] for b in bs)

REGIONS = {k: bbox_of(v) for k, v in TEXT.items()}

def rgb(fill):
    m = re.match(r'rgb\((\d+),(\d+),(\d+)\)', fill)
    return tuple(map(int, m.groups())) if m else (0, 0, 0)

def is_reddish(c):  return c[0] > 110 and c[0] > c[1] + 40 and c[0] > c[2] + 40
def is_navyish(c):  return c[2] > c[0] + 15 and c[2] < 150 and max(c) < 150

def text_paths(block, on=None):
    """Paths of one text block. on='navy' drops the red anti-alias fragments
    (which belonged to the red panel); on='red' drops the navy ones."""
    out = []
    for i in TEXT[block]:
        c = rgb(P[i]['fill'])
        if on == 'navy' and block in ('dr', 'bullets') and is_reddish(c):
            continue
        if on == 'red' and block in ('sba', 'sub') and is_navyish(c):
            continue
        out.append(PATHS[i])
    return out

def text_group(block, cx, cy, s=1.0, on=None):
    x0, y0, x1, y1 = REGIONS[block]
    tx, ty = cx - s * (x0 + x1) / 2, cy - s * (y0 + y1) / 2
    return place('\n'.join(text_paths(block, on)), tx, ty, s)

# panel color under each text path, sampled just outside its box in the trace render
_w, _h, _bpp, _rows = read_png(os.path.join(HERE, 'reference-vector.png'))
def _px(x, y):
    x = max(0, min(_w - 1, int(x))); y = max(0, min(_h - 1, int(y)))
    return tuple(_rows[y][x * _bpp:x * _bpp + 3])
def panel_under(i):
    b = P[i]; ym = (b['y0'] + b['y1']) // 2
    votes = [_px(b['x0'] - 3, ym), _px(b['x1'] + 3, ym), _px((b['x0'] + b['x1']) // 2, b['y0'] - 3), _px((b['x0'] + b['x1']) // 2, b['y1'] + 3)]
    red = sum(1 for c in votes if is_reddish(c)); navy = sum(1 for c in votes if is_navyish(c))
    return RED if red > navy else NAVY

# ---------------------------------------------------------------- passenger side
def subpaths(d):
    return [s for s in re.split(r'(?=M)', d) if s.strip()]

def sub_bbox(s):
    nums = [float(x) for x in re.findall(NUM, s)]
    xs, ys = nums[0::2], nums[1::2]
    return min(xs), min(ys), max(xs), max(ys)

def inside(b, R, pad=6):
    return b[0] >= R[0] - pad and b[1] >= R[1] - pad and b[2] <= R[2] + pad and b[3] <= R[3] + pad

def without_text_holes(p):
    d = re.search(r'\bd="([^"]*)"', p).group(1)
    subs = subpaths(d)
    if len(subs) < 2:
        return p
    keep = [subs[0]] + [s for s in subs[1:] if not any(inside(sub_bbox(s), R) for R in REGIONS.values())]
    return p if len(keep) == len(subs) else p.replace(d, ''.join(keep))

def passenger_group():
    """Mirror of the trace without its text (holes closed, letter shapes
    patched in panel color), plus the text laid back on unmirrored.
    All coordinates baked: no transforms."""
    body = [without_text_holes(p) for i, p in enumerate(PATHS) if i not in TEXT_IDS and i != 0]
    patches = [re.sub(r'fill="[^"]*"', f'fill="{panel_under(i)}"', PATHS[i]) for i in TEXT_IDS]
    out = [mirror('\n'.join(body)), mirror('\n'.join(patches))]
    for k in TEXT:
        x0, y0, x1, y1 = REGIONS[k]
        out.append(text_group(k, cx=2000 - (x0 + x1) / 2, cy=(y0 + y1) / 2))
    return '\n'.join(out)

def wrap(body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">\n'
            f'<rect width="{W}" height="{H}" fill="{WHITE}"/>\n{body}\n</svg>')

# ---------------------------------------------------------------- elevations
BW = 373            # body width in px (2059 mm at the side view's scale)
CX = 1000
L, R = CX - BW / 2, CX + BW / 2          # 813.5 .. 1186.5
TRACK, TIRE_W = 316, 39
TIRE_L, TIRE_R = CX - TRACK / 2, CX + TRACK / 2
RADIUS = 72

def body_outline_path():
    return (f'M{L},{ROOF_Y + RADIUS} Q{L},{ROOF_Y} {L + RADIUS},{ROOF_Y} L{R - RADIUS},{ROOF_Y} '
            f'Q{R},{ROOF_Y} {R},{ROOF_Y + RADIUS} L{R},{BODY_BOTTOM} L{L},{BODY_BOTTOM} Z')

def tires(skip_left=False, skip_right=False):
    out = []
    for cx, skip in ((TIRE_L, skip_left), (TIRE_R, skip_right)):
        if skip:
            continue
        x = cx - TIRE_W / 2
        out.append(f'<path d="M{x},{BODY_BOTTOM} L{x + TIRE_W},{BODY_BOTTOM} L{x + TIRE_W},{GROUND - 8} '
                   f'Q{x + TIRE_W},{GROUND} {x + TIRE_W - 8},{GROUND} L{x + 8},{GROUND} Q{x},{GROUND} {x},{GROUND - 8} Z" fill="{BLACK}"/>')
        out.append(rect_path(x + 6, BODY_BOTTOM + 4, TIRE_W - 12, 4, fill=HUB, extra='opacity="0.5"'))
    return '\n'.join(out)

def mirrors(skip_left=False, skip_right=False):
    out = []
    for side, skip in (('L', skip_left), ('R', skip_right)):
        if skip:
            continue
        if side == 'L':
            x0, x1 = L - 40, L + 2
            arm = rect_path(L - 14, 690, 16, 14, fill=MIRROR)
        else:
            x0, x1 = R - 2, R + 40
            arm = rect_path(R - 2, 690, 16, 14, fill=MIRROR)
        out.append(f'<path d="M{x0 + 6},655 L{x1},655 L{x1},742 L{x0 + 6},742 Q{x0},742 {x0},736 L{x0},661 Q{x0},655 {x0 + 6},655 Z" fill="{MIRROR}"/>')
        out.append(arm)
    return '\n'.join(out)

def front_face(three_quarter=False):
    o = [f'<path d="{body_outline_path()}" fill="{NAVY}"/>']
    o.append(f'<path d="M{L + 10},512 Q{CX},500 {R - 10},512" fill="none" stroke="{OUTLINE}" stroke-width="2.5" opacity="0.8"/>')
    # windshield
    o.append(f'<path d="M{L + 24},735 L{L + 40},528 Q{CX},516 {R - 40},528 L{R - 24},735 Z" fill="{OUTLINE}"/>')
    o.append(f'<path d="M{L + 32},728 L{L + 47},536 Q{CX},524 {R - 47},536 L{R - 32},728 Z" fill="{GLASS}"/>')
    o.append(f'<path d="M{CX - 120},712 L{CX - 40},660 M{CX + 10},712 L{CX + 90},660" fill="none" stroke="rgb(190,193,198)" stroke-width="5" stroke-linecap="round"/>')
    o.append(f'<path d="M{L + 6},748 Q{CX},738 {R - 6},748" fill="none" stroke="{OUTLINE}" stroke-width="2.5"/>')
    # livery wrap at the front corners: red fender wedge with the white stripe above it
    for sgn, x in ((1, L), (-1, R)):
        o.append(f'<path d="M{x},760 Q{x + sgn * 70},790 {x + sgn * 36},{BODY_BOTTOM} L{x},{BODY_BOTTOM} Z" fill="{RED}"/>')
        o.append(f'<path d="M{x},742 Q{x + sgn * 78},776 {x + sgn * 44},{BODY_BOTTOM} L{x + sgn * 26},{BODY_BOTTOM} Q{x + sgn * 62},790 {x},762 Z" fill="{WHITE}"/>')
    # headlights
    for x0, x1 in ((L + 4, L + 96), (R - 96, R - 4)):
        o.append(f'<path d="M{x0},766 L{x1},772 L{x1},806 L{x0},812 Z" fill="{OUTLINE}"/>')
        o.append(f'<path d="M{x0 + 3},770 L{x1 - 3},775 L{x1 - 3},803 L{x0 + 3},808 Z" fill="{GLASS}"/>')
        o.append(f'<path d="M{x0 + 3},796 L{x1 - 3},796 L{x1 - 3},803 L{x0 + 3},808 Z" fill="{AMBER}"/>')
    # grille: three bars
    o.append(rect_path(L + 108, 770, BW - 216, 46, rx=6, fill=OUTLINE))
    for y in (782, 796):
        o.append(rect_path(L + 114, y, BW - 228, 6, fill=NAVY))
    # bumper: light upper, dark lower, black intake
    o.append(rect_path(L - 4, 828, BW + 8, 46, rx=8, fill=BUMPER_F))
    o.append(f'<path d="M{L - 4},868 L{R + 4},868 L{R + 4},906 Q{R + 4},919 {R - 9},919 L{L + 9},919 Q{L - 4},919 {L - 4},906 Z" fill="{DARK}"/>')
    o.append(rect_path(CX - 110, 880, 220, 24, rx=4, fill=BLACK))
    for x in (L + 18, R - 52):
        o.append(rect_path(x, 846, 34, 9, rx=2, fill=AMBER))
    o.append(f'<path d="{body_outline_path()}" fill="none" stroke="{OUTLINE}" stroke-width="3"/>')
    o.append(mirrors(skip_left=three_quarter))
    o.append(tires(skip_left=three_quarter))
    return '\n'.join(o)

def rear_face():
    o = [f'<path d="{body_outline_path()}" fill="{NAVY}"/>']
    o.append(f'<path d="M{L + 8},514 L{R - 8},514" fill="none" stroke="{OUTLINE}" stroke-width="2.5" opacity="0.8"/>')
    o.append(f'<path d="M{CX},514 L{CX},826" fill="none" stroke="{OUTLINE}" stroke-width="3"/>')
    for x in (L + 2, R - 12):
        for y in (560, 700):
            o.append(rect_path(x, y, 10, 44, rx=2, fill=OUTLINE))
    for x in (L + 10, R - 38):
        o.append(rect_path(x, 690, 28, 136, rx=5, fill=OUTLINE))
        o.append(rect_path(x + 3, 693, 22, 42, fill=RED))
        o.append(rect_path(x + 3, 735, 22, 30, fill=AMBER))
        o.append(rect_path(x + 3, 765, 22, 26, fill=WHITE))
        o.append(rect_path(x + 3, 791, 22, 32, fill=RED))
    # branding on the doors: traced glyphs, red fragments dropped since they sit on navy here
    o.append(text_group('sba', cx=CX, cy=588, s=0.8, on='navy'))
    o.append(text_group('sub', cx=CX, cy=660, s=0.8, on='navy'))
    o.append(text_group('dr', cx=CX, cy=726, s=0.72, on='navy'))
    o.append(text_group('bullets', cx=CX, cy=782, s=0.72, on='navy'))
    for x in (CX - 30, CX + 8):
        o.append(rect_path(x, 802, 22, 9, rx=4, fill=OUTLINE))
    o.append(rect_path(L - 4, 826, BW + 8, 10, fill=ROCKER_TOP))
    o.append(f'<path d="M{L - 4},836 L{R + 4},836 L{R + 4},906 Q{R + 4},919 {R - 9},919 L{L + 9},919 Q{L - 4},919 {L - 4},906 Z" fill="{DARK}"/>')
    o.append(rect_path(CX - 120, 884, 240, 18, rx=4, fill=BLACK))
    for x in (L + 16, R - 56):
        o.append(rect_path(x, 848, 40, 10, rx=2, fill=RED))
    o.append(f'<path d="{body_outline_path()}" fill="none" stroke="{OUTLINE}" stroke-width="3"/>')
    o.append(tires())
    return '\n'.join(o)

# ---------------------------------------------------------------- three-quarter
# nose profile of the passenger side (x at each y), from the trace
NOSE = [(474, 1160), (478, 1170), (490, 1240), (515, 1300), (525, 1310), (735, 1455),
        (760, 1570), (770, 1585), (800, 1600), (830, 1608), (916, 1608), (980, 1608)]

def nose_x(y):
    if y <= NOSE[0][0]: return NOSE[0][1]
    for (y0, x0), (y1, x1) in zip(NOSE, NOSE[1:]):
        if y0 <= y <= y1:
            return x0 + (x1 - x0) * (y - y0) / (y1 - y0)
    return NOSE[-1][1]

def three_quarter():
    SX, FX = 0.75, 0.62          # side and front foreshortening
    K_REAR, K_FAR, YH = 0.84, 0.90, 650
    side_w = SX * (1608 - 392); front_w = FX * BW
    e1 = 1000 - (side_w + front_w) / 2 - SX * 392
    Xs = lambda x: SX * x + e1
    k_side = lambda x: K_REAR + (1 - K_REAR) * (x - 392) / (1608 - 392)
    def side_map(x, y):
        return Xs(x), YH + k_side(x) * (y - YH)
    def front_map(x, y):
        t = (x - L) / (R - L)
        nx = nose_x(y)
        k = k_side(nx) * (1 - t) + K_FAR * t
        return Xs(nx) + FX * (x - L), YH + k * (y - YH)
    front = map_paths(front_face(three_quarter=True), front_map)
    side = map_paths(passenger_group(), side_map)
    return front + '\n' + side

if __name__ == '__main__':
    files = {
        'mrv-van-02-passenger-side.svg': passenger_group(),
        'mrv-van-03-front.svg': front_face(),
        'mrv-van-04-rear.svg': rear_face(),
        'mrv-van-05-front-three-quarter.svg': three_quarter(),
    }
    for name, body in files.items():
        with open(os.path.join(OUT, name), 'w') as f:
            f.write(wrap(body))
        print('wrote', name)
