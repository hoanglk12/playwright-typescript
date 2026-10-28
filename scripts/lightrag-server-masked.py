"""Run lightrag-server with the LLM/embedding endpoint hostnames masked in console and lightrag.log output."""
import logging
import os
import re
import sys
from urllib.parse import urlparse

MASK = "***"
LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}

_pattern = None


def host_pattern():
    hosts = set()
    for name, value in os.environ.items():
        if name.upper().endswith("_BINDING_HOST") and value:
            hostname = urlparse(value if "://" in value else f"//{value}").hostname
            if hostname and hostname not in LOOPBACK_HOSTS:
                hosts.add(hostname)
    if not hosts:
        return None
    alternatives = sorted((re.escape(h) for h in hosts), key=len, reverse=True)
    return re.compile("|".join(alternatives), re.IGNORECASE)


def mask(text):
    if _pattern is None or not isinstance(text, str):
        return text
    return _pattern.sub(MASK, text)


class MaskedStream:
    def __init__(self, stream):
        self._stream = stream

    def write(self, text):
        self._stream.write(mask(text))
        return len(text)

    def writelines(self, lines):
        self._stream.writelines(mask(line) for line in lines)

    def __getattr__(self, name):
        return getattr(self._stream, name)


_format = logging.Formatter.format
logging.Formatter.format = lambda self, record: mask(_format(self, record))

if __name__ == "__main__":
    # ascii_colors binds sys.stdout as a default argument at import time, so the
    # splash screen only goes through the proxy if it is installed before lightrag loads.
    sys.stdout = MaskedStream(sys.stdout)
    sys.stderr = MaskedStream(sys.stderr)

    from lightrag.api.lightrag_server import main

    _pattern = host_pattern()
    sys.argv[0] = "lightrag-server"
    sys.exit(main())
