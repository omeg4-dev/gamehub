"""Throwaway. Answers one question: does an Android phone in Brave emit
deviceorientation events on a self-signed HTTPS LAN origin?"""
import http.server, json, ssl, subprocess, os

HERE = os.path.dirname(os.path.abspath(__file__))
IP = json.loads(subprocess.run(
    ["ip", "-j", "route", "get", "192.0.2.1"],
    capture_output=True, text=True).stdout)[0]["prefsrc"]

# Not in HERE: this server hands out every file in HERE to anyone on the LAN,
# and the private key is one file.
KEYS = os.path.expanduser("~/.local/state/gamehub/spike")
os.makedirs(KEYS, mode=0o700, exist_ok=True)
CERT = os.path.join(KEYS, "cert.pem")
KEY = os.path.join(KEYS, "key.pem")

if not os.path.exists(CERT):
    old = os.umask(0o077)
    try:
        subprocess.run([
            "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", KEY, "-out", CERT, "-days", "3", "-subj", "/CN=" + IP,
            "-addext", f"subjectAltName=IP:{IP}"], check=True)
    finally:
        os.umask(old)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        print(body.decode(), flush=True)
        self.send_response(204)
        self.end_headers()

    def log_message(self, *a):
        pass


httpd = http.server.HTTPServer((IP, 8799), Handler)
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(CERT, KEY)
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
print(f"open https://{IP}:8799/  on the phone", flush=True)
httpd.serve_forever()
