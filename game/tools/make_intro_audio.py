#!/usr/bin/env python3
"""Build audio/intro-hq.m4a: the HQ prologue (muffled music bed + call, button,
siren and beacon sound effects) followed by the existing intro music.
All sources are licensed from Artlist (see audio/README.md). macOS only (afconvert).
Usage: python3 game/tools/make_intro_audio.py"""
import array, math, os, subprocess, tempfile, wave

GAME = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(GAME, "audio")
SR = 44100
PROLOGUE = 11.16                      # seconds before the original intro music starts

def load(path, start=0.0, dur=None):
    """Decode any audio file to 44.1 kHz 16-bit stereo; return interleaved samples."""
    tmp = tempfile.mktemp(suffix=".wav")
    subprocess.run(["afconvert", "-f", "WAVE", "-d", f"LEI16@{SR}", "-c", "2", path, tmp], check=True)
    raw = open(tmp, "rb").read(); os.remove(tmp)
    p = 12                                            # walk RIFF chunks to "data" (handles extensible headers)
    while raw[p:p + 4] != b"data": p += 8 + int.from_bytes(raw[p + 4:p + 8], "little")
    n = int.from_bytes(raw[p + 4:p + 8], "little"); a = array.array("h", raw[p + 8:p + 8 + n - n % 4])
    i0 = int(start * SR) * 2; i1 = len(a) if dur is None else min(len(a), i0 + int(dur * SR) * 2)
    return a[i0:i1]

def lowpass(a, fc, passes=2):
    k = 1 - math.exp(-2 * math.pi * fc / SR); out = array.array("f", a)
    for _ in range(passes):
        yl = yr = 0.0
        for i in range(0, len(out), 2):
            yl += k * (out[i] - yl); yr += k * (out[i + 1] - yr); out[i] = yl; out[i + 1] = yr
    return out

total = PROLOGUE + 16.95
mix = array.array("f", [0.0]) * (int(total * SR) * 2)
def add(src, at, gain=1.0, fade_in=0.0, fade_out=0.0):
    o = int(at * SR) * 2; n = len(src) // 2
    for j in range(n):
        g = gain
        if fade_in and j < fade_in * SR: g *= j / (fade_in * SR)
        if fade_out and j > n - fade_out * SR: g *= max(0.0, (n - j) / (fade_out * SR))
        p = o + j * 2
        if p + 1 >= len(mix): break
        mix[p] += src[j * 2] * g; mix[p + 1] += src[j * 2 + 1] * g

# 1. muffled music bed for the office scenes (heard "through the walls")
bed = lowpass(load(os.path.join(A, "source", "IamDayLight - Night Drive.mp3"), 20.0, 9.9), 520)
add(bed, 0.0, 0.55, fade_in=1.2, fade_out=0.8)
# 2. sound effects
add(load(os.path.join(A, "source", "sfx", "ringtone.wav")), 3.25, 0.75)
add(load(os.path.join(A, "source", "sfx", "button.wav")), 9.40, 1.0)
add(load(os.path.join(A, "source", "sfx", "siren.wav")), 9.55, 0.55, fade_out=0.4)
add(load(os.path.join(A, "source", "sfx", "impact.wav")), PROLOGUE - 0.06, 0.8)
# 3. the original intro music, unchanged, so every existing cut still lands on the beat
add(load(os.path.join(A, "intro-night-drive.m4a")), PROLOGUE, 1.0)

peak = max(1.0, max(abs(x) for x in mix) / 32000)
out = array.array("h", (int(max(-32767, min(32767, x / peak))) for x in mix))
tmp = tempfile.mktemp(suffix=".wav"); w = wave.open(tmp, "wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes()); w.close()
dst = os.path.join(A, "intro-hq.m4a")
subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "192000", tmp, dst], check=True); os.remove(tmp)
print(f"{dst}: {total:.2f} s, peak scale {peak:.2f}")
