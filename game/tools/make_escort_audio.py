#!/usr/bin/env python3
"""Build the helicopter escort sounds in audio/sfx/ from the licensed Artlist sources in
audio/source/sfx/ (see audio/README.md). macOS only (afconvert).
  heli-pass.m4a    the Black Hawk passing overhead, cut around its loudest moment
  heli-loop.m4a    rotor loop, written three times over so the game can loop the middle copy
                   (AAC adds a little silence at the start; looping the middle avoids a gap)
  radio-click.m4a  aircraft radio mic click, for when Sam comes on
  sam-in.m4a       Sam on the radio as he arrives, sam-out.m4a as he peels away (Artlist text-to-speech,
                   walkie-talkie effect; trimmed of the silence around the words)
Usage: python3 game/tools/make_escort_audio.py"""
import array, math, os, subprocess, tempfile, wave

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT, SR = os.path.join(GAME, "audio", "source", "sfx"), os.path.join(GAME, "audio", "sfx"), 44100

def load(path, start=0.0, dur=None):
    """Decode any audio file to 44.1 kHz 16-bit stereo; return interleaved samples (as in make_intro_audio.py)."""
    tmp = tempfile.mktemp(suffix=".wav")
    subprocess.run(["afconvert", "-f", "WAVE", "-d", f"LEI16@{SR}", "-c", "2", path, tmp], check=True)
    raw = open(tmp, "rb").read(); os.remove(tmp)
    p = 12                                            # walk RIFF chunks to "data" (handles extensible headers)
    while raw[p:p + 4] != b"data": p += 8 + int.from_bytes(raw[p + 4:p + 8], "little")
    n = int.from_bytes(raw[p + 4:p + 8], "little"); a = array.array("h", raw[p + 8:p + 8 + n - n % 4])
    i0 = int(start * SR) * 2; i1 = len(a) if dur is None else min(len(a), i0 + int(dur * SR) * 2)
    return a[i0:i1]

def write(samples, name, peak_to=0.84):
    peak = max(1, max(abs(x) for x in samples)); k = 32767 * peak_to / peak
    out = array.array("h", (int(max(-32767, min(32767, x * k))) for x in samples))
    tmp = tempfile.mktemp(suffix=".wav"); w = wave.open(tmp, "wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes()); w.close()
    dst = os.path.join(OUT, name); subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "160000", tmp, dst], check=True); os.remove(tmp)
    print(f"{dst}: {len(samples) / 2 / SR:.2f} s")

def fade(a, fin, fout):
    n = len(a) // 2; o = array.array("f", a)
    for j in range(n):
        g = min(1.0, j / (fin * SR)) if fin else 1.0
        if fout: g *= min(1.0, (n - j) / (fout * SR))
        o[j * 2] *= g; o[j * 2 + 1] *= g
    return o

os.makedirs(OUT, exist_ok=True)
# 1. the pass: find the loudest tenth of a second and keep 3 s before it, 2.5 s after
full = load(os.path.join(SRC, "blackhawk-pass.wav")); step = SR // 10 * 2
rms = [math.sqrt(sum(x * x for x in full[i:i + step:2]) / (step // 2)) for i in range(0, len(full) - step, step)]
top = max(range(len(rms)), key=rms.__getitem__) / 10
start = max(0.0, top - 3.0); print(f"pass: loudest at {top:.1f} s, cutting {start:.1f}-{start + 5.5:.1f} s")
write(fade(load(os.path.join(SRC, "blackhawk-pass.wav"), start, 5.5), 0.5, 1.2), "heli-pass.m4a")
# 2. the loop, three times over
loop = load(os.path.join(SRC, "heli-flyby-loop.wav")); write(loop + loop + loop, "heli-loop.m4a", 0.8)
# 3. the radio click
write(fade(load(os.path.join(SRC, "radio-mic-click.wav")), 0, 0.05), "radio-click.m4a", 0.7)

# 4. Sam's two radio calls, the silence trimmed off both ends
def trim(a, floor=600):
    n = len(a) // 2; step = SR // 100
    loud = [max(abs(x) for x in a[i * 2:(i + step) * 2]) > floor for i in range(0, n - step, step)]
    if not any(loud): return a
    i0 = max(0, loud.index(True) - 2) * step; i1 = min(n, (len(loud) - loud[::-1].index(True) + 3) * step)
    return a[i0 * 2:i1 * 2]
for name in ("sam-in", "sam-out"): write(fade(trim(load(os.path.join(SRC, name + ".mp3"))), 0.01, 0.08), name + ".m4a", 0.9)
