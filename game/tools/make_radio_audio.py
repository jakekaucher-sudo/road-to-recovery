#!/usr/bin/env python3
"""Build the desktop radio stations in audio/radio/ from the licensed Artlist sources in
audio/source/radio/ (see audio/README.md). Each station is one looping file, so the game can
tune in part-way through, the way car radios do in open-world games. macOS only (afconvert).
  country / rock / hiphop / pop .m4a   the station's songs back to back, each faded in and out
  latin.m4a                           GC's three breaks, one before each song
  talk.m4a                            Recovery Talk: Charlotte, her callers and her studio guest
Every song is matched to the loudness of the stage music, so switching stations never jumps in volume.
Usage: python3 game/tools/make_radio_audio.py      (prints each station's length for config.js)"""
import array, audioop, glob, os, subprocess, tempfile, wave

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT, SR = os.path.join(GAME, "audio", "source", "radio"), os.path.join(GAME, "audio", "radio"), 44100
VOICE = os.path.join(SRC, "voice")
FRAME = 4                                             # bytes per stereo 16-bit frame

def load(path, ch=2):
    """Decode any audio file to 44.1 kHz 16-bit; return raw interleaved bytes (as in make_escort_audio.py)."""
    tmp = tempfile.mktemp(suffix=".wav")
    subprocess.run(["afconvert", "-f", "WAVE", "-d", f"LEI16@{SR}", "-c", str(ch), path, tmp], check=True)
    raw = open(tmp, "rb").read(); os.remove(tmp)
    p = 12                                            # walk RIFF chunks to "data" (handles extensible headers)
    while raw[p:p + 4] != b"data": p += 8 + int.from_bytes(raw[p + 4:p + 8], "little")
    n = int.from_bytes(raw[p + 4:p + 8], "little"); n -= n % (2 * ch)
    return raw[p + 8:p + 8 + n]

def silence(sec): return b"\0" * (int(sec * SR) * FRAME)
def secs(b): return len(b) / FRAME / SR

def trim(b, floor=180):
    """Cut leading and trailing near-silence (generated speech carries some at each end)."""
    n = len(b) // FRAME; step = SR // 100
    loud = [audioop.rms(b[i * FRAME:(i + step) * FRAME], 2) > floor for i in range(0, n, step)]
    if not any(loud): return b
    a = loud.index(True); z = len(loud) - loud[::-1].index(True)
    return b[max(0, a - 2) * step * FRAME:min(n, (z + 2) * step) * FRAME]

def gain(b, k, ceil=0.88):
    """Multiply by k with a peak limiter, in 5 ms blocks: it looks two blocks ahead and recovers
    over about 60 ms. The ceiling leaves headroom for the AAC encoder, which overshoots peaks a little."""
    blk = SR // 200 * FRAME; top = 32767 * ceil
    parts = [b[i:i + blk] for i in range(0, len(b), blk)]
    g = [min(k, top / max(1, audioop.max(p, 2))) for p in parts]
    g = [min(g[max(0, i - 2):i + 3]) for i in range(len(g))]
    for i in range(1, len(g)): g[i] = min(g[i], g[i - 1] + 0.08 * k)
    return b"".join(audioop.mul(p, 2, x) for p, x in zip(parts, g))

def level(b, target):
    """Scale to a target RMS (two passes, since limiting the peaks lowers the RMS a little)."""
    for _ in range(2): b = gain(b, target / max(1, audioop.rms(b, 2)))
    return b

def fade(b, fin, fout):
    a = array.array("h", b); n = len(a) // 2
    i0, o0 = int(fin * SR), int(fout * SR)
    for j in range(min(i0, n)):
        g = j / i0; a[2 * j] = int(a[2 * j] * g); a[2 * j + 1] = int(a[2 * j + 1] * g)
    for j in range(max(0, n - o0), n):
        g = (n - j) / o0; a[2 * j] = int(a[2 * j] * g); a[2 * j + 1] = int(a[2 * j + 1] * g)
    return a.tobytes()

def overlay(base, top, at):
    """Mix `top` into `base` starting `at` seconds in (extends base if needed)."""
    i = int(at * SR) * FRAME
    if len(base) < i + len(top): base += b"\0" * (i + len(top) - len(base))
    return base[:i] + audioop.add(base[i:i + len(top)], top, 2) + base[i + len(top):]

def write(b, name, kbps=128, mono=False):
    if mono: b = audioop.tomono(b, 2, 0.5, 0.5)
    tmp = tempfile.mktemp(suffix=".wav"); w = wave.open(tmp, "wb")
    w.setnchannels(1 if mono else 2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(b); w.close()
    dst = os.path.join(OUT, name)
    subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", str(kbps * 1000), tmp, dst], check=True); os.remove(tmp)
    print(f"{name:12s} {secs(b) if not mono else len(b) / 2 / SR:7.1f} s  {os.path.getsize(dst) / 1e6:5.1f} MB")

os.makedirs(OUT, exist_ok=True)
# the loudness the game already plays at: the average RMS of the stage songs
stage = [audioop.rms(load(f), 2) for f in sorted(glob.glob(os.path.join(GAME, "audio", "music", "stage*.m4a")))]
TARGET = sum(stage) / len(stage); print(f"stage music RMS {TARGET:.0f}")

def song(f): return fade(level(load(os.path.join(SRC, f)), TARGET), 0.4, 2.5)
def line(f, k=1.0): return level(trim(load(os.path.join(VOICE, f))), TARGET * 0.8 * k)   # speech has pauses, so a lower RMS sounds as loud

STATIONS = {
    "country": ["country-banjo-backbeat.mp3", "country-heartland-and-home.mp3"],
    "rock":    ["rock-top-of-the-rock.mp3", "rock-spark.mp3"],
    "hiphop":  ["hiphop-we-up.mp3", "hiphop-my-chic-sunglasses.mp3"],
    "pop":     ["pop-roll-with-it.mp3", "pop-summer-dive.mp3"],
}
for name, songs in STATIONS.items():
    out = b""
    for f in songs: out += song(f) + silence(0.9)
    write(out, name + ".m4a")

# La Isla: each break starts under the last bars of the song before it, then the next song comes in
out = b""
for gc, f in (("gc-1.mp3", "latin-un-pasito-mas.mp3"), ("gc-2.mp3", "latin-2000.mp3"), ("gc-3.mp3", "latin-moonlit-fiesta.mp3")):
    v = line(gc)
    out = overlay(out, v, max(0.0, secs(out) - 1.6)) if out else v
    out += silence(0.35) + song(f)
write(out, "latin.m4a")

# Recovery Talk: speakers alternate with short, natural gaps; a longer pause before the sign-off
order = ["01-charlotte", "02-dave", "03-charlotte", "04-dave", "05-charlotte", "06-baker", "07-charlotte", "08-baker",
         "09-charlotte", "10-marcus", "11-charlotte", "12-marcus", "13-charlotte", "14-charlotte"]
out = silence(0.6)
for k, n in enumerate(order):
    caller = any(c in n for c in ("dave", "baker"))       # phone-filtered voices read quieter at the same RMS
    out += line(n + ".mp3", 1.08 if caller else 1.0) + silence(1.4 if n == "13-charlotte" else 0.5)
write(out + silence(1.5), "talk.m4a", 64, mono=True)
