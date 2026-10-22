#!/usr/bin/env python3
"""Serve the game over HTTPS on your Wi-Fi so a phone can play it with tilt
steering (phones only allow the gyroscope on secure pages).
Usage: python3 game/tools/serve_https.py [port]
Creates a self-signed certificate on first run (game/tools/.cert). Your phone
will warn that the certificate is not trusted: choose "Show details" ->
"visit this website" (iPhone) or "Advanced" -> "Proceed" (Android)."""
import http.server, os, sys, ssl, socket, subprocess, functools
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, "..", ".."))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8443
cdir = os.path.join(here, ".cert"); os.makedirs(cdir, exist_ok=True)
crt, key = os.path.join(cdir, "cert.pem"), os.path.join(cdir, "key.pem")
if not os.path.exists(crt):
    subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", crt, "-days", "365", "-subj", "/CN=road-to-recovery.local"], check=True, capture_output=True)
def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try: s.connect(("10.255.255.255", 1)); return s.getsockname()[0]
    except Exception: return "127.0.0.1"
    finally: s.close()
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()
    def log_message(self, *a): pass
httpd = http.server.ThreadingHTTPServer(("0.0.0.0", port), functools.partial(H, directory=root))
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(crt, key)
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
print(f"On your phone (same Wi-Fi) open:  https://{lan_ip()}:{port}/game/", flush=True)
httpd.serve_forever()
