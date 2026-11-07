"""
DCN·LINK receiver server (Wi-Fi / any IP network)

Run:   python server.py
Open:  http://<this-laptop-ip>:5000/receiver.html

Folder layout:
    server.py
    web/            <- index.html, transmitter.html, receiver.html, *.css, *.js
    received_files/ <- created automatically (files + index.json database)
"""

import json
import mimetypes
import os
import socket
import threading
import time
import uuid
from pathlib import Path

from flask import Flask, abort, jsonify, redirect, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"
RECEIVED_DIR = BASE_DIR / "received_files"
DB_FILE = RECEIVED_DIR / "index.json"
PORT = int(os.environ.get("PORT", 5000))

RECEIVED_DIR.mkdir(exist_ok=True)
WEB_DIR.mkdir(exist_ok=True)

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024  # 500 MB per request


# ---------------------------------------------------------------- storage
class Store:
    """Small JSON-file database: received items + download history."""

    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()
        self.items = []      # newest first
        self.history = []    # newest first
        self.next_item_id = 1
        self.next_history_id = 1
        self._load()

    def _load(self):
        if not self.path.exists():
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            self.items = data.get("items", [])
            self.history = data.get("history", [])
            self.next_item_id = max([i["id"] for i in self.items], default=0) + 1
            self.next_history_id = max([h["id"] for h in self.history], default=0) + 1
        except (ValueError, KeyError, OSError):
            print("Warning: could not read index.json, starting fresh.")

    def _save(self):
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(
            json.dumps({"items": self.items, "history": self.history}, indent=1),
            encoding="utf-8",
        )
        tmp.replace(self.path)

    # --- items
    def add_item(self, **fields):
        with self.lock:
            item = {"id": self.next_item_id, "cleared": False, "downloads": 0, **fields}
            self.next_item_id += 1
            self.items.insert(0, item)
            self._save()
            return item

    def get_item(self, item_id=None, stored=None):
        with self.lock:
            for item in self.items:
                if item_id is not None and item["id"] == item_id:
                    return dict(item)
                if stored is not None and item.get("stored") == stored:
                    return dict(item)
        return None

    def visible_items(self):
        with self.lock:
            return [dict(i) for i in self.items if not i["cleared"]]

    def clear_items(self):
        with self.lock:
            for item in self.items:
                item["cleared"] = True
            self._save()

    # --- history
    def log(self, item, action, by):
        with self.lock:
            entry = {
                "id": self.next_history_id,
                "item_id": item["id"],
                "name": item["name"],
                "kind": item["kind"],
                "size": item["size"],
                "stored": item.get("stored"),
                "action": action,            # "downloaded" or "copied"
                "by": by,
                "time": int(time.time() * 1000),
            }
            self.next_history_id += 1
            self.history.insert(0, entry)
            for i in self.items:
                if i["id"] == item["id"]:
                    i["downloads"] = i.get("downloads", 0) + 1
            self._save()
            return entry

    def all_history(self):
        with self.lock:
            out = []
            for h in self.history:
                h = dict(h)
                h["available"] = bool(h.get("stored")) and (RECEIVED_DIR / h["stored"]).exists()
                out.append(h)
            return out

    def clear_history(self):
        with self.lock:
            self.history = []
            self._save()


store = Store(DB_FILE)


# ---------------------------------------------------------------- helpers
def local_ip():
    """LAN IPv4 of this laptop (no packet is actually sent)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def detect_kind(mimetype, filename):
    guess = mimetype or mimetypes.guess_type(filename)[0] or ""
    major = guess.split("/")[0]
    return major if major in ("image", "audio", "video") else "file"


def receiver_url():
    return f"http://{local_ip()}:{PORT}"


# ---------------------------------------------------------------- API
@app.get("/api/health")
def health():
    return jsonify(success=True, message="DCN·LINK receiver is running")


@app.get("/api/info")
def info():
    ip = local_ip()
    return jsonify(ip=ip, port=PORT, url=f"http://{ip}:{PORT}")


@app.post("/api/upload")
def upload():
    medium = request.form.get("medium", "Wi-Fi")
    protocol = request.form.get("protocol", "HTTP")
    transfer_type = request.form.get("type", "file")
    sender = request.remote_addr or "unknown"
    now = int(time.time() * 1000)
    saved = []

    if transfer_type == "text":
        text = request.form.get("text", "")
        if not text.strip():
            return jsonify(success=False, message="No text message received"), 400

        stored = f"message_{time.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.txt"
        (RECEIVED_DIR / stored).write_text(text, encoding="utf-8")
        item = store.add_item(
            kind="text", name="Text message", stored=stored, text=text,
            size=len(text.encode("utf-8")), sender=sender,
            medium=medium, protocol=protocol, time=now,
        )
        saved.append(item["id"])

    else:
        files = [f for f in request.files.getlist("files") if f.filename]
        if not files:
            return jsonify(success=False, message="No files received"), 400

        for f in files:
            original = f.filename
            safe = secure_filename(original) or "received_file"
            stored = f"{uuid.uuid4().hex[:8]}_{safe}"
            destination = RECEIVED_DIR / stored
            f.save(destination)
            item = store.add_item(
                kind=detect_kind(f.mimetype, original), name=original, stored=stored,
                size=destination.stat().st_size, sender=sender,
                medium=medium, protocol=protocol, time=now,
            )
            saved.append(item["id"])

    return jsonify(success=True, message="Data successfully received",
                   medium=medium, protocol=protocol, ids=saved), 200


@app.get("/api/incoming")
def incoming():
    return jsonify(store.visible_items())


@app.delete("/api/incoming")
def clear_incoming():
    store.clear_items()          # hides the list; files and history are kept
    return jsonify(success=True)


@app.get("/api/history")
def history():
    return jsonify(store.all_history())


@app.delete("/api/history")
def clear_history():
    store.clear_history()
    return jsonify(success=True)


@app.post("/api/history/<int:item_id>/copied")
def text_copied(item_id):
    item = store.get_item(item_id=item_id)
    if not item:
        abort(404)
    store.log(item, "copied", request.remote_addr or "unknown")
    return jsonify(success=True)


# ---------------------------------------------------------------- files
@app.get("/files/<path:stored>")
def get_file(stored):
    item = store.get_item(stored=stored)      # only files we received are served
    if not item or not (RECEIVED_DIR / stored).exists():
        abort(404)

    download = request.args.get("download") == "1"
    if download:
        store.log(item, "downloaded", request.remote_addr or "unknown")

    return send_from_directory(
        RECEIVED_DIR, stored, as_attachment=download, download_name=item["name"]
    )


# ---------------------------------------------------------------- website
ALLOWED_EXT = {".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".svg", ".ico", ".webp", ".woff2"}
ALIASES = {"sender.html": "transmitter.html", "reciever.html": "receiver.html"}


@app.get("/")
def home():
    if (WEB_DIR / "index.html").exists():
        return send_from_directory(WEB_DIR, "index.html")
    return redirect("/receiver.html")


@app.get("/<path:filename>")
def website(filename):
    filename = ALIASES.get(filename, filename)
    if Path(filename).suffix.lower() not in ALLOWED_EXT:
        abort(404)
    return send_from_directory(WEB_DIR, filename)


@app.errorhandler(413)
def too_large(_e):
    return jsonify(success=False, message="Transfer exceeds the 500 MB limit"), 413


if __name__ == "__main__":
    print("=" * 52)
    print(" DCN·LINK receiver running")
    print(f" Receiver page : {receiver_url()}/receiver.html")
    print(f" Transmitter   : {receiver_url()}/transmitter.html")
    print(" Both devices must be on the same Wi-Fi / hotspot.")
    print(" If the sender cannot connect, allow Python through the")
    print(f" firewall (inbound TCP port {PORT}).")
    print("=" * 52)
    app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)