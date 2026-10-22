import re, json
svg = open('adobe/reference-vector.svg').read()
paths = re.findall(r'<path\b[^>]*>', svg)
P = json.load(open('adobe/paths.json'))
def inbox(b, R): return b['x0'] >= R[0] and b['y0'] >= R[1] and b['x1'] <= R[2] and b['y1'] <= R[3]
RED, NAVY = 'rgb(203,32,39)', 'rgb(28,61,114)'
blocks = {  # region box, panel color under it
  'sba':     ((846, 580, 1000, 702), NAVY),
  'sub':     ((840, 704, 1012, 756), NAVY),
  'dr':      ((1120, 578, 1436, 696), RED),
  'bullets': ((1150, 704, 1412, 752), RED),
}
ids = {k: [b['i'] for b in P if inbox(b, R) and b['i'] not in (0,)] for k, (R, _) in blocks.items()}
for k, v in ids.items():
    bs = [P[i] for i in v]
    print(k, len(v), 'paths, bbox', min(b['x0'] for b in bs), min(b['y0'] for b in bs), max(b['x1'] for b in bs), max(b['y1'] for b in bs))
    print('   fills', sorted(set(b['fill'] for b in bs))[:12])
    print('   largest', sorted([(b['x1']-b['x0'])*(b['y1']-b['y0']) for b in bs])[-3:])
json.dump(ids, open('adobe/text_ids.json', 'w'))
# ---- passenger side ----
def refill(p, color): return re.sub(r'fill="[^"]*"', f'fill="{color}"', p)
out = ['<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1339" viewBox="0 0 2000 1339">',
       '<g transform="translate(2000,0) scale(-1,1)">', *paths, '</g>',
       '<g transform="translate(2000,0) scale(-1,1)">']
for k, (R, color) in blocks.items():
    out += [refill(paths[i], color) for i in ids[k]]      # patch the mirrored holes
out.append('</g>')
for k, (R, color) in blocks.items():
    bs = [P[i] for i in ids[k]]
    x0, x1 = min(b['x0'] for b in bs), max(b['x1'] for b in bs)
    dx = 2000 - (x0 + x1)
    out.append(f'<g id="text-{k}" transform="translate({dx},0)">')
    out += [paths[i] for i in ids[k]]
    out.append('</g>')
out.append('</svg>')
open('v3/mrv-van-02-passenger-side.svg', 'w').write('\n'.join(out)) if __import__('os').makedirs('v3', exist_ok=True) is None else None
print('passenger written')
# ---- measurements for the other views ----
body = [b for b in P if b['i'] != 0]
print('van extents: x', min(b['x0'] for b in body), '-', max(b['x1'] for b in body), ' y', min(b['y0'] for b in body), '-', max(b['y1'] for b in body))
for i in (1, 24, 5, 66, 67, 149, 275, 420):
    b = P[i]; print(f"  path {i} {b['fill']} x{b['x0']}-{b['x1']} y{b['y0']}-{b['y1']}")
# wheels: dark circles
for b in P:
    w, h = b['x1']-b['x0'], b['y1']-b['y0']
    if 100 < w < 200 and abs(w-h) < 12 and b['y0'] > 800: print('  wheel-ish', b['i'], b['fill'], b['x0'], b['y0'], b['x1'], b['y1'])
