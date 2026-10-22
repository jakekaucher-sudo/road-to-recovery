#!/usr/bin/env python3
"""Load a page under the project root and take screenshots after JS actions.
Usage: python3 game/tools/shots.py PATH OUTDIR WxH 'js1' name1 ['js2' name2 ...]"""
import sys, os, time, json, base64, tempfile, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import WS, start_server, free_port, launch_chrome, page_ws_url, evaluate
path, out, size = sys.argv[1], sys.argv[2], sys.argv[3]; pairs = sys.argv[4:]
w, h = (int(v) for v in size.split("x")); os.makedirs(out, exist_ok=True)
srv, port = start_server(); dbg = free_port(); prof = tempfile.mkdtemp(); chrome = launch_chrome(dbg, prof, w, h)
try:
    ws = WS(page_ws_url(dbg)); ws.call("Page.enable"); ws.call("Runtime.enable")
    ws.call("Emulation.setDeviceMetricsOverride", {"width": w, "height": h, "deviceScaleFactor": 1, "mobile": False})
    ws.call("Page.navigate", {"url": f"http://127.0.0.1:{port}/{path}"})
    t0 = time.time()
    while not evaluate(ws, "!!window.__ready"):
        err = evaluate(ws, "window.__error || ''")
        if err or time.time() - t0 > 25: print("not ready", err); break
        time.sleep(0.3)
    for i in range(0, len(pairs), 2):
        print(pairs[i + 1], evaluate(ws, pairs[i], await_promise=True))
        time.sleep(0.2)
        d = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 88})
        open(os.path.join(out, pairs[i + 1] + ".jpg"), "wb").write(base64.b64decode(d["data"]))
    logs = evaluate(ws, "window.__error || ''")
    if logs: print("ERR", logs)
finally:
    chrome.terminate(); srv.shutdown(); shutil.rmtree(prof, ignore_errors=True)
