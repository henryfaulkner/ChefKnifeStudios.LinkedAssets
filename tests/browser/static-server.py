"""Test-only static host that applies the committed SWA fallback/header contract."""
import fnmatch
import json
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

root = Path(sys.argv[1]).resolve()
config = json.loads((root / 'staticwebapp.config.json').read_text(encoding='utf-8-sig'))

class StaticHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm', '.woff2': 'font/woff2'}
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)
    def end_headers(self):
        for key, value in config['globalHeaders'].items():
            self.send_header(key, value)
        super().end_headers()
    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        target = (root / path.lstrip('/')).resolve()
        if not target.is_relative_to(root):
            self.send_error(403)
            return
        excluded = any(fnmatch.fnmatch(path, pattern) for pattern in config['navigationFallback']['exclude'] if '{' not in pattern)
        suffixes = ('.json', '.wasm', '.dll', '.pdb', '.png', '.svg', '.ico', '.woff', '.woff2', '.js', '.css', '.map', '.webcil', '.dat', '.bin', '.br', '.gz')
        if not target.exists() and not excluded and not path.endswith(suffixes):
            self.path = '/index.html'
        super().do_GET()
    def log_message(self, *_):
        pass

ThreadingHTTPServer(('127.0.0.1', 5180), StaticHandler).serve_forever()
