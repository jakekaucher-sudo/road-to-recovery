#!/usr/bin/env python3
"""
Headless frame capture for the motion graphic, using only the Python standard
library and Google Chrome. Talks to Chrome over the DevTools protocol with a
minimal websocket client, seeks the page to each time (window.__seek), and
saves a screenshot per frame.

Examples
  python3 tools/render_frames.py                       # full piece, 30 fps, JPEG -> out/frames
  python3 tools/render_frames.py --fps 2 --out out/review
  python3 tools/render_frames.py --times 0,3.5,12 --format png --out out/stills
  python3 tools/render_frames.py --sheet 1 --out out/sheets   # contact sheets, one cell per second
  python3 tools/render_frames.py --query "debug=assets" --times 0 --format png --out out/debug
"""
import argparse, base64, functools, http.server, json, os, socket, struct, subprocess, sys, tempfile, threading, time, urllib.request, shutil

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))


class WS:
    """Tiny RFC 6455 client, enough for CDP."""
    def __init__(self, url):
        rest = url[len("ws://"):]
        hostport, _, path = rest.partition("/")
        host, _, port = hostport.partition(":")
        self.sock = socket.create_connection((host, int(port)))
        self.sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (f"GET /{path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
               f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n")
        self.sock.sendall(req.encode())
        buf = bytearray()
        while b"\r\n\r\n" not in buf:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise RuntimeError("websocket handshake failed")
            buf += chunk
        head, _, extra = bytes(buf).partition(b"\r\n\r\n")
        if b" 101 " not in head.split(b"\r\n")[0]:
            raise RuntimeError(head.decode(errors="replace"))
        self.buf = bytearray(extra)
        self.id = 0

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(max(1 << 16, n - len(self.buf)))
            if not chunk:
                raise RuntimeError("websocket closed")
            self.buf += chunk
        out = bytes(self.buf[:n])
        del self.buf[:n]
        return out

    def _frame(self, op, payload):
        mask = os.urandom(4)
        n = len(payload)
        hdr = bytearray([0x80 | op])
        if n < 126:
            hdr.append(0x80 | n)
        elif n < 65536:
            hdr.append(0x80 | 126); hdr += struct.pack(">H", n)
        else:
            hdr.append(0x80 | 127); hdr += struct.pack(">Q", n)
        hdr += mask
        masked = bytes(b ^ mask[i & 3] for i, b in enumerate(payload))
        self.sock.sendall(bytes(hdr) + masked)

    def send(self, text):
        self._frame(0x1, text.encode())

    def recv(self):
        msg = bytearray()
        while True:
            b0, b1 = self._read(2)
            fin, op = b0 & 0x80, b0 & 0x0F
            n = b1 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read(8))[0]
            mask = self._read(4) if (b1 & 0x80) else None
            payload = self._read(n)
            if mask:
                payload = bytes(b ^ mask[i & 3] for i, b in enumerate(payload))
            if op == 0x8:
                raise RuntimeError("websocket closed by peer")
            if op == 0x9:
                self._frame(0xA, payload); continue
            if op == 0xA:
                continue
            msg += payload
            if fin:
                return msg.decode()

    def call(self, method, params=None):
        self.id += 1
        mid = self.id
        self.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        while True:
            m = json.loads(self.recv())
            if m.get("id") == mid:
                if "error" in m:
                    raise RuntimeError(f"{method}: {m['error']}")
                return m.get("result", {})


from rangehttp import RangeHandler as Quiet       # answers byte ranges, so audio can start part-way through


def start_server():
    handler = functools.partial(Quiet, directory=PROJECT_ROOT)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def launch_chrome(port, profile, w, h):
    args = [CHROME, "--headless=new", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", f"--remote-debugging-port={port}", f"--user-data-dir={profile}",
            f"--window-size={w},{h}", "--hide-scrollbars", "--no-first-run",
            "--no-default-browser-check", "--disable-extensions", "--mute-audio", "--force-device-scale-factor=1",
            "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-dev-shm-usage",
            "about:blank"]
    return subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def page_ws_url(port, timeout=30):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=2) as r:
                for tgt in json.load(r):
                    if tgt.get("type") == "page":
                        return tgt["webSocketDebuggerUrl"]
        except Exception:
            pass
        time.sleep(0.2)
    raise RuntimeError("Chrome DevTools endpoint did not come up")


def evaluate(ws, expr, await_promise=False):
    r = ws.call("Runtime.evaluate", {"expression": expr, "awaitPromise": await_promise, "returnByValue": True})
    if "exceptionDetails" in r:
        raise RuntimeError("JS error: " + json.dumps(r["exceptionDetails"].get("exception", {}).get("description", r["exceptionDetails"])))
    return r.get("result", {}).get("value")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fps", type=float, default=30)
    ap.add_argument("--start", type=float, default=0)
    ap.add_argument("--end", type=float, default=None, help="default: full duration")
    ap.add_argument("--times", default=None, help="comma-separated explicit times (overrides fps/start/end)")
    ap.add_argument("--out", default=os.path.join(HERE, "..", "out", "frames"))
    ap.add_argument("--format", choices=["jpeg", "png"], default="jpeg")
    ap.add_argument("--quality", type=int, default=92)
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--query", default="", help="extra query string for index.html, e.g. debug=assets")
    ap.add_argument("--sheet", type=float, default=None, help="make contact sheets: one cell every N seconds")
    ap.add_argument("--sheet-cols", type=int, default=6)
    ap.add_argument("--prefix", default="frame")
    ap.add_argument("--keep-going", action="store_true", help="do not stop on a JS error")
    ap.add_argument("--eval", default=None, help="evaluate a JS expression once the page is ready, print it, and exit")
    a = ap.parse_args()

    out = os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)
    srv, http_port = start_server()
    dbg_port = free_port()
    profile = tempfile.mkdtemp(prefix="mg-chrome-")
    chrome = launch_chrome(dbg_port, profile, a.width, a.height)
    try:
        ws = WS(page_ws_url(dbg_port))
        ws.call("Page.enable"); ws.call("Runtime.enable")
        ws.call("Emulation.setDeviceMetricsOverride", {"width": a.width, "height": a.height, "deviceScaleFactor": 1, "mobile": False})
        url = f"http://127.0.0.1:{http_port}/game/index.html?mute=1"
        if a.query:
            url += "&" + a.query
        ws.call("Page.navigate", {"url": url})
        t0 = time.time()
        while True:
            st = evaluate(ws, "JSON.stringify({ready: !!window.__ready, error: window.__error || null, total: window.__total || 0, progress: window.__progress || ''})")
            st = json.loads(st) if st else {}
            if st.get("error"):
                raise RuntimeError("page error: " + st["error"])
            if st.get("ready"):
                break
            if time.time() - t0 > 90:
                raise RuntimeError("page never became ready; last progress: " + str(st.get("progress")))
            time.sleep(0.2)
        total = float(st.get("total") or 0)
        warnings = evaluate(ws, "JSON.stringify(window.__warnings || [])")
        if warnings and warnings != "[]":
            print("page warnings:", warnings, file=sys.stderr)
        if a.eval:
            print(evaluate(ws, a.eval, await_promise=True))
            return
        if a.sheet:
            n = int(total // a.sheet) + 1
            per = a.sheet_cols * 4
            k = 0
            for s0 in range(0, n, per):
                times = [round((s0 + i) * a.sheet, 3) for i in range(min(per, n - s0))]
                data = evaluate(ws, f"window.__sheet({json.dumps(times)}, {a.sheet_cols}, 480)", await_promise=True)
                path = os.path.join(out, f"sheet_{k:02d}.png")
                with open(path, "wb") as f:
                    f.write(base64.b64decode(data.split(",", 1)[1]))
                print(path, "times", times[0], "..", times[-1])
                k += 1
            return
        if a.times:
            times = [float(x) for x in a.times.split(",")]
        else:
            end = a.end if a.end is not None else total
            n = int(round((end - a.start) * a.fps))
            times = [a.start + i / a.fps for i in range(n)]
        ext = "jpg" if a.format == "jpeg" else "png"
        started = time.time()
        for i, t in enumerate(times):
            try:
                evaluate(ws, f"window.__seek({t})", await_promise=True)
            except Exception as e:
                if not a.keep_going:
                    raise
                print("warning:", e, file=sys.stderr)
            params = {"format": a.format}
            if a.format == "jpeg":
                params["quality"] = a.quality
            shot = ws.call("Page.captureScreenshot", params)
            name = f"{a.prefix}_{i:05d}.{ext}" if not a.times else f"{a.prefix}_t{t:07.2f}.{ext}".replace(".", "_", 1).replace("_", ".", 0)
            if a.times:
                name = f"{a.prefix}_t{str(t).replace('.', 'p')}.{ext}"
            with open(os.path.join(out, name), "wb") as f:
                f.write(base64.b64decode(shot["data"]))
            if i % 30 == 0 or i == len(times) - 1:
                el = time.time() - started
                print(f"{i + 1}/{len(times)} t={t:.2f}s  ({el:.0f}s elapsed)", flush=True)
        meta = {"fps": a.fps, "start": a.start, "count": len(times), "format": a.format, "width": a.width, "height": a.height, "total": total}
        with open(os.path.join(out, "frames.json"), "w") as f:
            json.dump(meta, f)
        print("done ->", out)
    finally:
        chrome.terminate()
        try:
            chrome.wait(timeout=5)
        except Exception:
            chrome.kill()
        srv.shutdown()
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    main()
