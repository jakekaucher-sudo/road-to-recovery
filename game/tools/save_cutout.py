#!/usr/bin/env python3
"""Run dev/cutout.html in headless Chrome and save the result as a PNG.
Usage: python3 game/tools/save_cutout.py 'QUERY' OUT.png"""
import sys, os, time, base64, tempfile, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import WS, start_server, free_port, launch_chrome, page_ws_url, evaluate
query, out = sys.argv[1], sys.argv[2]
srv, port = start_server(); dbg = free_port(); prof = tempfile.mkdtemp(); chrome = launch_chrome(dbg, prof, 800, 800)
try:
    ws = WS(page_ws_url(dbg)); ws.call("Page.enable"); ws.call("Runtime.enable")
    ws.call("Page.navigate", {"url": f"http://127.0.0.1:{port}/game/dev/cutout.html?{query}"})
    t0 = time.time()
    while not evaluate(ws, "!!window.__ready || !!window.__error"):
        if time.time() - t0 > 60: raise SystemExit("timeout")
        time.sleep(0.2)
    err = evaluate(ws, "window.__error || ''")
    if err: raise SystemExit("page error: " + err)
    data = evaluate(ws, "window.__png")
    open(out, "wb").write(base64.b64decode(data.split(",", 1)[1])); print("saved", out)
finally:
    chrome.terminate(); srv.shutdown(); shutil.rmtree(prof, ignore_errors=True)
