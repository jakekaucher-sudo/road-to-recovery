#!/usr/bin/env python3
"""Serve the project folder (so game/ can load ../assets/). Usage: python3 game/tools/serve.py [port]
Open http://localhost:8790/game/ on this computer."""
import http.server, os, sys, functools
root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()
    def log_message(self, *a): pass
print(f"Open http://localhost:{port}/game/", flush=True)
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(H, directory=root)).serve_forever()
