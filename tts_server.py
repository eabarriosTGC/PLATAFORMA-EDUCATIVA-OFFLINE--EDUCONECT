#!/usr/bin/env python3
"""Servidor TTS minimalista para EduConect Rural.
Usa espeak-ng con voz femenina mbrola (es-es).
Escucha en puerto 8081. GET /tts?text=...&rate=150
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import subprocess
import tempfile
import os
import sys

RATE = 155
PITCH = 40
VOICE = "es-es+mbrola-3"  # Voz femenina más natural

class TTSHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/tts":
            params = parse_qs(parsed.query)
            text = params.get("text", [""])[0]
            if not text:
                self.send_error(400, "Missing 'text' parameter")
                return

            rate = int(params.get("rate", [RATE])[0])
            pitch = int(params.get("pitch", [PITCH])[0])

            # Limpiar texto (quitar HTML básico)
            import re
            text = re.sub(r"<[^>]*>", "", text)
            text = re.sub(r"\s+", " ", text).strip()

            if not text:
                self.send_error(400, "Empty text after cleaning")
                return

            tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            tmp.close()

            try:
                result = subprocess.run(
                    ["espeak-ng", "-v", VOICE, "-s", str(rate), "-p", str(pitch),
                     "-w", tmp.name, "--", text],
                    capture_output=True, timeout=15
                )
                if result.returncode != 0:
                    os.unlink(tmp.name)
                    self.send_error(500, f"espeak error: {result.stderr.decode()}")
                    return

                size = os.path.getsize(tmp.name)
                self.send_response(200)
                self.send_header("Content-Type", "audio/wav")
                self.send_header("Content-Length", str(size))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()

                with open(tmp.name, "rb") as f:
                    self.wfile.write(f.read())
            finally:
                try:
                    os.unlink(tmp.name)
                except:
                    pass
        else:
            self.send_error(404)

    def log_message(self, format, *args):
        # Silenciar logs HTTP para no llenar la terminal
        pass

if __name__ == "__main__":
    port = int(os.environ.get("TTS_PORT", "8081"))
    server = HTTPServer(("0.0.0.0", port), TTSHandler)
    print(f"🎤 TTS EduConect: http://0.0.0.0:{port}/tts (voz: {VOICE})", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nTTS server stopped")
