"""Builds the SBA Disaster Recovery MRV van views as SVG files.

Colors and layout are measured from the reference side view (driver side).
Run:  python3 build_views.py   -> writes *.svg next to this file.
"""
import os

W, H = 2000, 1339
NAVY, RED, WHITE = "#1C3E75", "#CD2127", "#FFFFFF"
LINE = "#0C0D16"          # panel lines / outline
ROCKER = "#4A4E51"        # gray lower band
BUMPER = "#2D3339"
GLASS = "#E0E2E6"
AMBER = "#F58321"
HUB = "#C9CBD0"
FONT = "'Source Sans 3','Source Sans Pro','Helvetica Neue',Arial,sans-serif"

OUT = os.path.dirname(os.path.abspath(__file__))

# ---------- shared pieces -------------------------------------------------

def sba_logo(cx, cy, s=1.0, sub=True):
    """SBA logo: white letters with the right leg of the A as a white
    stroke, bracket corners above (white) and below (red)."""
    g = [f'<g transform="translate({cx},{cy}) scale({s})">']
    g.append(f'<text x="0" y="30" text-anchor="middle" font-family="{FONT}" '
             f'font-size="96" font-weight="600" fill="{WHITE}" letter-spacing="2">SBA</text>')
    # bracket corners
    g.append(f'<path d="M-118,-50 h22 M-118,-50 v22" stroke="{WHITE}" stroke-width="7" fill="none"/>')
    g.append(f'<path d="M118,-50 h-22 M118,-50 v22" stroke="{WHITE}" stroke-width="7" fill="none"/>')
    g.append(f'<path d="M-118,50 h22 M-118,50 v-22" stroke="{RED}" stroke-width="7" fill="none"/>')
    g.append(f'<path d="M118,50 h-22 M118,50 v-22" stroke="{RED}" stroke-width="7" fill="none"/>')
    if sub:
        g.append(f'<text x="0" y="86" text-anchor="middle" font-family="{FONT}" font-size="22" '
                 f'fill="{WHITE}">U.S. Small Business</text>')
        g.append(f'<text x="0" y="110" text-anchor="middle" font-family="{FONT}" font-size="22" '
                 f'fill="{WHITE}">Administration</text>')
    g.append('</g>')
    return "\n".join(g)


def dr_lockup(cx, cy, s=1.0):
    """DISASTER RECOVERY headline with the audience bullets beneath."""
    g = [f'<g transform="translate({cx},{cy}) scale({s})">']
    for i, word in enumerate(("DISASTER", "RECOVERY")):
        g.append(f'<text x="0" y="{i*58}" text-anchor="middle" font-family="{FONT}" font-size="60" '
                 f'font-weight="700" fill="{WHITE}" letter-spacing="3">{word}</text>')
    g.append(f'<text x="0" y="100" text-anchor="middle" font-family="{FONT}" font-size="21" '
             f'font-weight="700" fill="{WHITE}">Businesses&#160;&#160;&#9642;&#160;&#160;Homeowners</text>')
    g.append(f'<text x="0" y="124" text-anchor="middle" font-family="{FONT}" font-size="21" '
             f'font-weight="700" fill="{WHITE}">Renters&#160;&#160;&#9642;&#160;&#160;Nonprofits</text>')
    g.append('</g>')
    return "\n".join(g)


def wheel(cx, cy, r=72):
    spokes = "".join(
        f'<ellipse cx="0" cy="-{r*0.36:.0f}" rx="{r*0.11:.0f}" ry="{r*0.2:.0f}" fill="#8E9196" '
        f'transform="rotate({a})"/>' for a in range(0, 360, 60))
    return (f'<g transform="translate({cx},{cy})">'
            f'<circle r="{r}" fill="#0A0A10"/>'
            f'<circle r="{r*0.6:.0f}" fill="{HUB}" stroke="#9A9DA3" stroke-width="2"/>'
            f'{spokes}<circle r="{r*0.12:.0f}" fill="#9A9DA3"/></g>')


# ---------- side view (nose on the left) ------------------------------------

BODY = ("M405,792 C405,760 432,744 472,736 L522,730 C560,650 622,560 700,506 "
        "C722,492 760,486 820,484 L1540,482 C1576,484 1596,506 1597,542 L1599,898 "
        "L1372,898 A97,97 0 0 0 1178,898 L668,898 A97,97 0 0 0 474,898 L405,898 Z")

def side_livery():
    """Livery shapes drawn inside the body clip. Coordinates match the
    reference: red front swoosh, white stripe, white centre band,
    big red panel, navy everywhere else."""
    return f"""
<g clip-path="url(#body)">
  <rect x="0" y="0" width="{W}" height="{H}" fill="{NAVY}"/>
  <!-- front red swoosh (under the white stripe) -->
  <path d="M470,740 C560,760 700,790 860,900 L560,900 C520,880 480,830 470,740 Z" fill="{RED}"/>
  <path d="M560,700 C600,660 640,620 690,600 L700,700 Z" fill="{RED}"/>
  <!-- white front stripe -->
  <path d="M500,728 C620,760 760,810 880,900 L820,900 C720,830 600,790 480,770 Z" fill="{WHITE}"/>
  <!-- white centre band -->
  <path d="M1020,482 C1065,600 1075,720 1040,900 L1090,900 C1125,720 1115,600 1070,482 Z" fill="{WHITE}"/>
  <!-- big red panel -->
  <path d="M1070,482 C1115,600 1125,720 1090,900 L1310,900 C1450,840 1540,740 1540,650
           C1540,560 1430,490 1290,482 Z" fill="{RED}"/>
</g>"""


def side_hardware(mirrored=False):
    """Windows, mirror, rocker, bumpers, lights, wheels, panel lines."""
    return f"""
<!-- rocker band and underbody -->
<path d="M405,836 L1599,836 L1599,872 L405,872 Z" fill="{ROCKER}" clip-path="url(#body)"/>
<path d="M405,872 L1599,872 L1599,898 L405,898 Z" fill="{NAVY}" clip-path="url(#body)"/>
<path d="M430,898 L1580,898 L1580,912 L430,912 Z" fill="#0C0D16"/>
<!-- bumpers -->
<path d="M400,800 C400,780 410,770 425,768 L470,765 L470,898 L400,898 Z" fill="{BUMPER}"/>
<rect x="1560" y="836" width="42" height="62" fill="{BUMPER}"/>
<!-- headlight and tail light -->
<path d="M418,772 L470,768 L470,800 C450,802 430,800 418,790 Z" fill="{GLASS}"/>
<path d="M425,788 L470,786 L470,800 C450,802 435,798 425,794 Z" fill="{AMBER}"/>
<rect x="1578" y="700" width="18" height="120" rx="4" fill="{RED}"/>
<rect x="1578" y="745" width="18" height="30" fill="{AMBER}"/>
<rect x="1578" y="780" width="18" height="18" fill="{GLASS}"/>
<!-- windshield and cab window -->
<path d="M530,732 L690,528 L720,520 L790,520 L790,700 L560,700 Z" fill="{NAVY}"/>
<path d="M545,728 L695,540 L720,536 L720,696 L580,696 Z" fill="{GLASS}"/>
<path d="M735,536 L792,536 L792,696 L735,696 Z" fill="{GLASS}"/>
<path d="M735,536 L792,536 L792,696 L735,696 Z" fill="none" stroke="{LINE}" stroke-width="3"/>
<!-- door mirror -->
<path d="M598,660 L650,660 L650,740 L612,740 C600,740 596,730 598,718 Z" fill="#0A0A10"/>
<!-- side marker lamps -->
<rect x="748" y="846" width="30" height="12" rx="3" fill="{AMBER}"/>
<rect x="1108" y="846" width="30" height="12" rx="3" fill="{AMBER}"/>
<rect x="1478" y="846" width="30" height="12" rx="3" fill="{AMBER}"/>
<!-- panel lines -->
<g fill="none" stroke="{LINE}" stroke-width="3" opacity="0.8">
  <path d="M805,520 L805,836"/>
  <path d="M1085,500 L1085,836"/>
  <path d="M1530,500 L1530,836"/>
  <path d="M700,760 L1085,760"/>
  <path d="M1090,560 L1530,560"/>
  <path d="M780,540 C820,536 1500,534 1560,540"/>
</g>
<!-- door handle -->
<rect x="768" y="788" width="14" height="14" rx="7" fill="{LINE}"/>
<!-- body outline -->
<path d="{BODY}" fill="none" stroke="{LINE}" stroke-width="4"/>
{wheel(571, 906)}
{wheel(1275, 906)}
"""


def side_view(passenger=False):
    """Driver side as drawn; passenger side mirrors the body and livery
    but keeps the text reading left to right."""
    mirror = f'transform="translate({W},0) scale(-1,1)"' if passenger else ""
    text_x = (lambda x: W - x) if passenger else (lambda x: x)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<rect width="{W}" height="{H}" fill="{WHITE}"/>
<defs><clipPath id="body"><path d="{BODY}"/></clipPath></defs>
<g {mirror}>
{side_livery()}
{side_hardware()}
</g>
{sba_logo(text_x(930), 640)}
{dr_lockup(text_x(1280), 625)}
</svg>"""


# ---------- front and rear views ----------------------------------------------

FRONT_BODY = ("M700,470 C700,440 720,420 760,418 L1240,418 C1280,420 1300,440 1300,470 "
              "L1300,900 L700,900 Z")

def front_view():
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<rect width="{W}" height="{H}" fill="{WHITE}"/>
<defs><clipPath id="fb"><path d="{FRONT_BODY}"/></clipPath></defs>
<g clip-path="url(#fb)">
  <rect x="0" y="0" width="{W}" height="{H}" fill="{NAVY}"/>
  <!-- red lower corners wrapping from the sides -->
  <path d="M700,720 C760,760 800,820 790,900 L700,900 Z" fill="{RED}"/>
  <path d="M1300,720 C1240,760 1200,820 1210,900 L1300,900 Z" fill="{RED}"/>
  <!-- white stripes wrapping from the sides -->
  <path d="M700,700 C790,740 830,820 820,900 L785,900 C795,820 760,760 700,728 Z" fill="{WHITE}"/>
  <path d="M1300,700 C1210,740 1170,820 1180,900 L1215,900 C1205,820 1240,760 1300,728 Z" fill="{WHITE}"/>
</g>
<!-- roof cap -->
<path d="M700,470 C700,440 720,420 760,418 L1240,418 C1280,420 1300,440 1300,470 L1300,500 L700,500 Z" fill="{NAVY}"/>
<!-- windshield -->
<path d="M735,500 L1265,500 L1255,650 L745,650 Z" fill="{GLASS}" stroke="{LINE}" stroke-width="3"/>
<path d="M760,520 L1240,520 L1232,628 L768,628 Z" fill="none" stroke="#C8CBD1" stroke-width="2"/>
<!-- mirrors -->
<path d="M648,560 L700,566 L700,640 L660,640 C646,640 640,630 642,616 Z" fill="#0A0A10"/>
<path d="M1352,560 L1300,566 L1300,640 L1340,640 C1354,640 1360,630 1358,616 Z" fill="#0A0A10"/>
<!-- hood line -->
<path d="M700,690 C860,672 1140,672 1300,690" fill="none" stroke="{LINE}" stroke-width="3"/>
<!-- SBA on the hood -->
{sba_logo(1000, 745, 0.52, sub=False)}
<!-- grille -->
<rect x="860" y="790" width="280" height="56" rx="8" fill="#0C0D16"/>
<g stroke="#4A4E51" stroke-width="3"><path d="M860,808 H1140 M860,826 H1140"/></g>
<!-- headlights -->
<path d="M712,780 L840,788 L840,840 L712,830 Z" fill="{GLASS}" stroke="{LINE}" stroke-width="3"/>
<path d="M1288,780 L1160,788 L1160,840 L1288,830 Z" fill="{GLASS}" stroke="{LINE}" stroke-width="3"/>
<rect x="716" y="818" width="60" height="12" fill="{AMBER}"/>
<rect x="1224" y="818" width="60" height="12" fill="{AMBER}"/>
<!-- bumper -->
<path d="M690,850 L1310,850 L1310,905 C1310,920 1300,928 1285,928 L715,928 C700,928 690,920 690,905 Z" fill="{BUMPER}"/>
<rect x="760" y="880" width="480" height="30" rx="4" fill="#0C0D16"/>
<path d="M{FRONT_BODY[1:]}" fill="none" stroke="{LINE}" stroke-width="4"/>
<!-- tires -->
<rect x="716" y="928" width="80" height="32" rx="6" fill="#0A0A10"/>
<rect x="1204" y="928" width="80" height="32" rx="6" fill="#0A0A10"/>
</svg>"""


def rear_view():
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<rect width="{W}" height="{H}" fill="{WHITE}"/>
<defs><clipPath id="rb"><path d="{FRONT_BODY}"/></clipPath></defs>
<g clip-path="url(#rb)">
  <rect x="0" y="0" width="{W}" height="{H}" fill="{NAVY}"/>
  <!-- red panel wrapping around from the driver side (left when seen from behind) -->
  <path d="M1300,660 C1210,690 1180,760 1195,830 C1205,865 1235,890 1300,900 Z" fill="{RED}"/>
  <path d="M700,660 C790,690 820,760 805,830 C795,865 765,890 700,900 Z" fill="{RED}"/>
</g>
<!-- door seam and hinges -->
<path d="M1000,500 L1000,850" stroke="{LINE}" stroke-width="4"/>
<g fill="{LINE}"><rect x="704" y="560" width="10" height="40"/><rect x="704" y="760" width="10" height="40"/>
<rect x="1286" y="560" width="10" height="40"/><rect x="1286" y="760" width="10" height="40"/></g>
<!-- roof cap -->
<path d="M700,470 C700,440 720,420 760,418 L1240,418 C1280,420 1300,440 1300,470 L1300,500 L700,500 Z" fill="{NAVY}"/>
<path d="M700,500 L1300,500" stroke="{LINE}" stroke-width="3"/>
<!-- livery text on the doors -->
{sba_logo(1000, 575, 0.7, sub=False)}
{dr_lockup(1000, 695, 0.78)}
<!-- tail lights -->
<g>
  <rect x="704" y="640" width="26" height="170" rx="5" fill="{RED}" stroke="{LINE}" stroke-width="3"/>
  <rect x="707" y="700" width="20" height="40" fill="{AMBER}"/>
  <rect x="707" y="748" width="20" height="26" fill="{GLASS}"/>
  <rect x="1270" y="640" width="26" height="170" rx="5" fill="{RED}" stroke="{LINE}" stroke-width="3"/>
  <rect x="1273" y="700" width="20" height="40" fill="{AMBER}"/>
  <rect x="1273" y="748" width="20" height="26" fill="{GLASS}"/>
</g>
<!-- door handles -->
<rect x="965" y="832" width="24" height="10" rx="5" fill="{LINE}"/>
<rect x="1011" y="832" width="24" height="10" rx="5" fill="{LINE}"/>
<!-- bumper and step -->
<path d="M690,850 L1310,850 L1310,905 C1310,920 1300,928 1285,928 L715,928 C700,928 690,920 690,905 Z" fill="{BUMPER}"/>
<rect x="730" y="870" width="60" height="14" fill="{RED}"/><rect x="1210" y="870" width="60" height="14" fill="{RED}"/>
<rect x="880" y="896" width="240" height="20" rx="4" fill="#0C0D16"/>
<path d="M{FRONT_BODY[1:]}" fill="none" stroke="{LINE}" stroke-width="4"/>
<!-- tires -->
<rect x="716" y="928" width="80" height="32" rx="6" fill="#0A0A10"/>
<rect x="1204" y="928" width="80" height="32" rx="6" fill="#0A0A10"/>
</svg>"""


# ---------- front three-quarter view ------------------------------------------

def three_quarter_view():
    """Front three-quarter from the passenger side. The passenger-side
    composition (mirrored body, text reading normally) is squashed to 58%
    and sheared so the nose sits lower and nearer; the front face is
    attached at the nose and sheared the other way so it recedes."""
    passenger = f"""
<g transform="translate({W},0) scale(-1,1)">
{side_livery()}
{side_hardware()}
</g>
{sba_logo(W - 930, 640)}
{dr_lockup(W - 1280, 625)}"""
    side_tf = "matrix(0.58,0.09,0,1,300,-100)"
    # left edge x=700 -> x'=1180 (the nose), bumper bottom y=928 -> y'=941,
    # hood line y=690 -> y'~770, so the face meets the side's nose profile
    front_tf = "matrix(0.35,-0.12,0,0.82,905,264)"
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<rect width="{W}" height="{H}" fill="{WHITE}"/>
<defs><clipPath id="body"><path d="{BODY}"/></clipPath></defs>
<g transform="{front_tf}">
{front_face_only()}
</g>
<g transform="{side_tf}">
{passenger}
</g>
</svg>"""


def front_face_only():
    """The front view without its background, for the 3/4 composite."""
    svg = front_view()
    start = svg.index('<defs>')
    end = svg.rindex('</svg>')
    body = svg[start:end]
    return body.replace('id="fb"', 'id="fb2"').replace('url(#fb)', 'url(#fb2)')


if __name__ == "__main__":
    views = {
        "mrv-van-01-driver-side-check.svg": side_view(False),
        "mrv-van-02-passenger-side.svg": side_view(True),
        "mrv-van-03-front.svg": front_view(),
        "mrv-van-04-rear.svg": rear_view(),
        "mrv-van-05-front-three-quarter.svg": three_quarter_view(),
    }
    for name, svg in views.items():
        with open(os.path.join(OUT, name), "w") as f:
            f.write(svg)
        print("wrote", name)
