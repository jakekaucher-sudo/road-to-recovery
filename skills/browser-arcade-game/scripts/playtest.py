#!/usr/bin/env python3
"""Headless playtest: load the game, run a list of actions, save screenshots.
Usage: python3 game/tools/playtest.py "QUERY" ACTIONS.json OUTDIR [WxH] [DPR]
ACTIONS: [{"js": "expr"}, {"step": 600, "inputs": {"gas":1}}, {"shot": "name"}, {"wait": 0.5}]
"step" advances the simulation N frames at 60 fps (inputs optional)."""
import json, os, sys, time, base64, tempfile, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import WS, start_server, free_port, launch_chrome, page_ws_url, evaluate

def main():
    query, actions, out = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3]
    w, h = (int(v) for v in (sys.argv[4] if len(sys.argv) > 4 else "1280x720").split("x"))
    dpr = float(sys.argv[5]) if len(sys.argv) > 5 else 1
    os.makedirs(out, exist_ok=True)
    srv, port = start_server(); dbg = free_port(); prof = tempfile.mkdtemp()
    chrome = launch_chrome(dbg, prof, w, h)
    try:
        ws = WS(page_ws_url(dbg)); ws.call("Page.enable"); ws.call("Runtime.enable")
        mobile = "mobile=1" in query
        metrics = {"width": w, "height": h, "deviceScaleFactor": dpr, "mobile": mobile}
        if mobile:
            metrics["screenOrientation"] = {"type": "landscapePrimary", "angle": 90} if w > h else {"type": "portraitPrimary", "angle": 0}
            ws.call("Emulation.setTouchEmulationEnabled", {"enabled": True, "maxTouchPoints": 5})
        ws.call("Emulation.setDeviceMetricsOverride", metrics)
        logs = []
        ws.call("Page.navigate", {"url": f"http://127.0.0.1:{port}/game/index.html?mute=1&{query}"})
        t0 = time.time()
        while True:
            st = json.loads(evaluate(ws, "JSON.stringify({r: !!window.__ready, e: window.__error || null})") or "{}")
            if st.get("e"): print("PAGE ERROR:", st["e"]); break
            if st.get("r"): break
            if time.time() - t0 > 60: print("timeout waiting for ready"); break
            time.sleep(0.2)
        for a in actions:
            if "cdp" in a: print("cdp:", a["cdp"], ws.call(a["cdp"], a.get("params", {})))
            if "js" in a: print("js:", evaluate(ws, a["js"], await_promise=True))
            if "step" in a:
                inp = json.dumps(a.get("inputs")) if a.get("inputs") is not None else "undefined"
                r = evaluate(ws, f"window.__step({a['step']}, {inp})")
                err = evaluate(ws, "window.__error || ''")
                if err: print("ERROR:", err); 
            if "wait" in a: time.sleep(a["wait"])
            if "shot" in a:
                evaluate(ws, "window.__render && window.__render()")
                d = ws.call("Page.captureScreenshot", {"format": "jpeg", "quality": 88})
                open(os.path.join(out, a["shot"] + ".jpg"), "wb").write(base64.b64decode(d["data"]))
                print("shot", a["shot"])
        err = evaluate(ws, "window.__error || ''")
        if err: print("FINAL ERROR:", err)
    finally:
        chrome.terminate(); srv.shutdown(); shutil.rmtree(prof, ignore_errors=True)

if __name__ == "__main__":
    main()
