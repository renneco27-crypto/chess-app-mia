"""
maia-bridge/server.py
---------------------
Thin HTTP bridge between the browser app and Maia 3's UCI engine process.

The browser can't spawn child processes, so this tiny server runs locally,
keeps one Maia 3 UCI process alive per model, and exposes a single endpoint:

    POST http://localhost:8175/move
    Body: { "fen": "<FEN string>", "model": "maia3-5m" }
    Response: { "move": "e2e4" }

Requirements:
    pip install maia3

Usage:
    python maia-bridge/server.py
    python maia-bridge/server.py --port 8175 --model maia3-5m
"""

import argparse
import subprocess
import threading
import queue
import json
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler


# ---------------------------------------------------------------------------
# UCI process wrapper — one per model, kept alive between requests.
# Re-creating the process per request adds 2–5 seconds of model-load latency
# each time; keeping it alive makes moves arrive in ~100–300ms.
# ---------------------------------------------------------------------------

class UciEngine:
    def __init__(self, command: list[str]):
        self.proc = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,          # line-buffered
        )
        self._lock = threading.Lock()
        self._ready = threading.Event()
        self._output_q: queue.Queue[str] = queue.Queue()

        # Reader thread — keeps stdout flowing so the process never blocks
        t = threading.Thread(target=self._read_stdout, daemon=True)
        t.start()

        self._send("uci")
        self._wait_for("uciok")
        self._send("isready")
        self._wait_for("readyok")
        self._ready.set()

    def _read_stdout(self):
        for line in self.proc.stdout:
            self._output_q.put(line.rstrip())

    def _send(self, cmd: str):
        self.proc.stdin.write(cmd + "\n")
        self.proc.stdin.flush()

    def _wait_for(self, token: str, timeout: float = 30.0) -> list[str]:
        lines = []
        while True:
            try:
                line = self._output_q.get(timeout=timeout)
            except queue.Empty:
                raise TimeoutError(f"Maia UCI: timed out waiting for '{token}'")
            lines.append(line)
            if line == token or line.startswith(token):
                return lines

    def get_move(self, fen: str) -> str:
        """Return the engine's best move for a FEN. Thread-safe (serialised)."""
        with self._lock:
            self._send(f"position fen {fen}")
            self._send("go movetime 100")          # 100ms — fast enough for play
            lines = self._wait_for("bestmove")
            for line in reversed(lines):
                if line.startswith("bestmove"):
                    parts = line.split()
                    return parts[1]                 # e.g. "e2e4"
            raise RuntimeError(f"No bestmove in: {lines}")

    def terminate(self):
        self._send("quit")
        self.proc.wait(timeout=5)


# ---------------------------------------------------------------------------
# Engine pool — lazy-loads one UciEngine per model alias
# ---------------------------------------------------------------------------

MODEL_COMMANDS: dict[str, list[str]] = {
    "maia3-5m":  ["maia3-5m"],
    "maia3-23m": ["maia3-23m"],
    "maia3-79m": ["maia3-79m"],
}

_engines: dict[str, UciEngine] = {}
_engines_lock = threading.Lock()


def get_engine(model: str) -> UciEngine:
    if model not in MODEL_COMMANDS:
        raise ValueError(f"Unknown model '{model}'. Valid: {list(MODEL_COMMANDS)}")
    with _engines_lock:
        if model not in _engines:
            print(f"[bridge] Loading {model} ...", flush=True)
            _engines[model] = UciEngine(MODEL_COMMANDS[model])
            print(f"[bridge] {model} ready", flush=True)
        return _engines[model]


# ---------------------------------------------------------------------------
# HTTP handler
# ---------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # silence default Apache-style access log

    def do_OPTIONS(self):
        # Allow the Vite dev server (localhost:5173) to call us
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path != "/move":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            payload = json.loads(body)
            fen   = payload["fen"]
            model = payload.get("model", "maia3-5m")
        except (json.JSONDecodeError, KeyError) as e:
            self.send_error(400, str(e))
            return

        try:
            engine = get_engine(model)
            move   = engine.get_move(fen)
        except Exception as e:
            self.send_error(500, str(e))
            return

        resp = json.dumps({"move": move}).encode()
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(resp)))
        self.end_headers()
        self.wfile.write(resp)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin",  "http://localhost:5173")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Maia 3 UCI bridge server")
    parser.add_argument("--port",  type=int, default=8175)
    parser.add_argument("--model", default=None,
                        help="Pre-load a model on startup (e.g. maia3-5m)")
    args = parser.parse_args()

    if args.model:
        get_engine(args.model)   # eager load so the first move isn't slow

    server = HTTPServer(("127.0.0.1", args.port), Handler)
    print(f"[bridge] Listening on http://127.0.0.1:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[bridge] Shutting down …")
        for e in _engines.values():
            e.terminate()
        sys.exit(0)


if __name__ == "__main__":
    main()
