"""Inline Illustrator's CSS classes as fill attributes and crop the viewBox.
Usage: inline_crop.py in.svg out.svg x y w h"""
import re, sys
src, dst, x, y, w, h = sys.argv[1], sys.argv[2], *sys.argv[3:7]
s = open(src).read()
s = re.sub(r'<metadata>.*?</metadata>', '', s, flags=re.S)
styles = dict(re.findall(r'\.(cls-\d+)\s*\{\s*fill:\s*([^;]+);', s))
s = re.sub(r'<defs>\s*<style>.*?</style>\s*</defs>', '', s, flags=re.S)
def repl(m):
    cls = m.group(1)
    return f'fill="{styles.get(cls, "#000")}"'
s = re.sub(r'class="(cls-\d+)"', repl, s)
s = re.sub(r'viewBox="[^"]*"', f'viewBox="{x} {y} {w} {h}"', s, count=1)
s = re.sub(r'<svg ', f'<svg width="{w}" height="{h}" ', s, count=1)
open(dst, 'w').write(s)
print(dst, 'classes inlined:', len(styles), 'remaining class attrs:', len(re.findall(r'class=', s)))
