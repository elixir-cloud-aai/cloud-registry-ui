"""A service for the end-to-end tests: any `/<key>/service-info` serves a service
info, which the registry fetches as it would a real service's. `PUT` on such a
path changes what it serves: JSON fields replace those of the document;
`{"status": 503}` answers with that status from then on."""

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8191
SUFFIX = "/service-info"
# what each key was changed to
changes: dict[str, dict] = {}


def document(key: str) -> dict:
    """Get the service info of a key, with its changes.

    Args:
        key: The path before `/service-info`.

    Returns:
        The document, unique to the key.
    """
    return {
        "id": f"org.example.e2e.{key}",
        "name": f"Imported {key}",
        "type": {"group": "org.ga4gh", "artifact": "tes", "version": "1.1.0"},
        "description": "A service for the end-to-end tests",
        "organization": {"name": "E2E Org", "url": "https://example.org"},
        "contactUrl": "mailto:support@example.org",
        "documentationUrl": "https://docs.example.org",
        "environment": "test",
        "version": "1.0.0",
        **changes.get(key, {}),
    }


class Handler(BaseHTTPRequestHandler):
    """Serve and change service info."""

    def key(self) -> str | None:
        """Get the key of the request's path.

        Returns:
            The key, if the path is that of a service info.
        """
        if not self.path.endswith(SUFFIX):
            return None
        return self.path.removesuffix(SUFFIX).strip("/") or None

    def answer(self, status: int, body: dict | None = None) -> None:
        """Send a response.

        Args:
            status: HTTP status.
            body: JSON body, if any.
        """
        data = json.dumps(body).encode() if body is not None else b""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        """Serve a service info."""
        key = self.key()
        if key is None:
            self.answer(404, {"message": "Not found"})
            return
        served = document(key)
        status = served.pop("status", 200)
        self.answer(status, served if status == 200 else None)

    def do_PUT(self) -> None:  # noqa: N802
        """Change a service info."""
        key = self.key()
        if key is None:
            self.answer(404, {"message": "Not found"})
            return
        length = int(self.headers.get("Content-Length", 0))
        changes.setdefault(key, {}).update(json.loads(self.rfile.read(length)))
        self.answer(200, document(key))

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        """Log nothing for each request."""


if __name__ == "__main__":
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()
