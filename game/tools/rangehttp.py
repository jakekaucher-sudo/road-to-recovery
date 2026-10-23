"""A static file handler that answers byte-range requests (HTTP 206), like GitHub Pages does.
Browsers need ranges to start a long audio file part-way through, which the desktop radio does
every time it tunes in. Python's built-in server ignores ranges, so the local servers use this."""
import http.server, os, re


class RangeHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def log_message(self, *a):
        pass

    def send_head(self):
        m = re.match(r"bytes=(\d*)-(\d*)$", self.headers.get("Range", ""))
        path = self.translate_path(self.path)
        if not m or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        a, b = m.group(1), m.group(2)
        start, end = (int(a), int(b) if b else size - 1) if a else (max(0, size - int(b or 0)), size - 1)
        if start >= size:
            self.send_error(416); return None
        end = min(end, size - 1)
        f = open(path, "rb"); f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._left = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        left = getattr(self, "_left", None)
        if left is None:
            return super().copyfile(source, outputfile)
        try:
            while left > 0:
                chunk = source.read(min(65536, left))
                if not chunk: break
                outputfile.write(chunk); left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass                                  # the browser dropped a range it no longer needs (normal while seeking)
