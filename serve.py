# Geliştirme sunucusu: önbellek kapalı, böylece kod değişiklikleri hemen görünür.
import http.server, functools
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
http.server.ThreadingHTTPServer(("127.0.0.1", 8780), functools.partial(H, directory=".")).serve_forever()
