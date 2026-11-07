"""
DCN·LINK sender-side web server (OPTIONAL).

The transmitter page is plain HTML/JS, so the sender needs NO backend of its own:
the browser posts the file straight to the receiver's server.py.
This tiny script only serves the web/ folder so you can open the page at
http://localhost:8000/transmitter.html on the sender laptop.

Run:  python sender_server.py
"""
import http.server
import socketserver
from functools import partial
from pathlib import Path

PORT = 8000
WEB_DIR = Path(__file__).resolve().parent / "web"

handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(WEB_DIR))

with socketserver.ThreadingTCPServer(("127.0.0.1", PORT), handler) as httpd:
    print(f"Sender page: http://localhost:{PORT}/transmitter.html  (Ctrl+C to stop)")
    httpd.serve_forever()