import re, json, sys
svg = open('adobe/reference-vector.svg').read()
paths = re.findall(r'<path\b[^>]*>', svg)
out = []
for i, p in enumerate(paths):
    d = re.search(r'\bd="([^"]*)"', p).group(1)
    fill = re.search(r'fill="([^"]*)"', p)
    fill = fill.group(1) if fill else 'none'
    nums = [float(x) for x in re.findall(r'-?\d+\.?\d*(?:e-?\d+)?', d)]
    xs, ys = nums[0::2], nums[1::2]
    subpaths = d.count('M')
    out.append(dict(i=i, fill=fill, x0=round(min(xs)), y0=round(min(ys)), x1=round(max(xs)), y1=round(max(ys)), n=len(xs), sub=subpaths, attrs=re.sub(r'\bd="[^"]*"', '', p)[:120]))
json.dump(out, open('adobe/paths.json', 'w'))
def inbox(b, X0, Y0, X1, Y1):
    return b['x0'] >= X0 and b['y0'] >= Y0 and b['x1'] <= X1 and b['y1'] <= Y1
regions = {'dr': (520, 560, 910, 700), 'bullets': (560, 700, 880, 760), 'sba': (920, 570, 1220, 705), 'sub': (950, 700, 1190, 760)}
for name, R in regions.items():
    hits = [b for b in out if inbox(b, *R)]
    print(name, len(hits), 'paths; fills:', sorted(set(b['fill'] for b in hits)))
    print('  ids:', [b['i'] for b in hits])
print('total', len(out))
print('first 6:', [(b['i'], b['fill'], b['x0'], b['y0'], b['x1'], b['y1'], b['sub']) for b in out[:6]])
print('attrs sample:', out[0]['attrs'], '|', out[10]['attrs'])
# big paths
big = [b for b in out if (b['x1']-b['x0'])*(b['y1']-b['y0']) > 200000]
print('big:', [(b['i'], b['fill'], b['x0'], b['y0'], b['x1'], b['y1'], b['sub']) for b in big])
