#!/usr/bin/env python3
"""Serve the project folder (so game/ can load ../assets/). Usage: python3 game/tools/serve.py [port]
Open http://localhost:8790/game/ on this computer."""
import http.server, os, sys, functools
from rangehttp import RangeHandler
root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
print(f"Open http://localhost:{port}/game/", flush=True)
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(RangeHandler, directory=root)).serve_forever()
