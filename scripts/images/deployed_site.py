"""Asks the deployed site which thumbnails it serves. The only module here that talks to it."""

from __future__ import annotations

import urllib.error
import urllib.request
from typing import Callable

from thumbnail import THUMBNAIL_PREFIX

DEFAULT_BASE_URL = "https://gakumas-supportcards.tia.run"


def served_by(base_url: str) -> Callable[[str], bool]:
    """`exists(file_name)`: True on 200, False on 404. Any other status raises, so a server error
    is never read as "missing" and answered with uploads."""

    def exists(file_name: str) -> bool:
        req = urllib.request.Request(f"{base_url.rstrip('/')}/img/{THUMBNAIL_PREFIX}{file_name}", method="HEAD", headers={"User-Agent": "gakumas-supportcards-images/0.1"})
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                return res.status == 200
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False
            raise

    return exists
