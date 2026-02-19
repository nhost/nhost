"""Auto-consent service for OIDC conformance testing.

Replaces the browser-based consent page. When the auth service redirects here
with a request_id, this service automatically:
1. Signs in as the demo user to obtain a JWT
2. Approves the OAuth2 authorization request
3. Redirects to the callback URI (back to the conformance suite)

This eliminates the need for a real browser or /etc/hosts modifications.
The entire redirect chain stays within the Docker network.
"""

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

AUTH_URL = os.environ.get("AUTH_URL", "http://auth:4000")
DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "demo@example.com")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "Demo1234")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("auto-consent")


class ConsentHandler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        request_id = params.get("request_id", [None])[0]

        if not request_id:
            self.send_error(400, "Missing request_id parameter")
            return

        log.info("Handling consent for request_id=%s", request_id)

        try:
            redirect_uri = self._complete_consent(request_id)
        except Exception:
            log.exception("Failed to complete consent flow")
            self.send_error(500, "Consent flow failed")
            return

        log.info("Redirecting to %s", redirect_uri)
        self.send_response(302)
        self.send_header("Location", redirect_uri)
        self.end_headers()

    def _complete_consent(self, request_id):
        # Step 1: Sign in to get a JWT.
        signin_payload = json.dumps(
            {"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
        ).encode()
        req = urllib.request.Request(
            f"{AUTH_URL}/signin/email-password",
            data=signin_payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req) as resp:
            signin_result = json.loads(resp.read())
        access_token = signin_result["session"]["accessToken"]

        # Step 2: Approve the OAuth2 request.
        consent_payload = json.dumps({"requestId": request_id}).encode()
        req = urllib.request.Request(
            f"{AUTH_URL}/oauth2/login",
            data=consent_payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {access_token}",
            },
        )
        with urllib.request.urlopen(req) as resp:
            consent_result = json.loads(resp.read())

        return consent_result["redirectUri"]

    def log_message(self, format, *args):  # noqa: A002
        log.info(format, *args)


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 8080), ConsentHandler)
    log.info("Auto-consent service listening on :8080 (auth=%s)", AUTH_URL)
    server.serve_forever()
