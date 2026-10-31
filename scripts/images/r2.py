"""Writes one object to the R2 bucket. The only module here that uploads anything."""

from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path
from typing import Callable, Sequence

# Seconds to wait before the second and the third attempt. The R2 API sometimes fails one put
# with a transient error (2026-10-31: `500`, code 10500 "Internal authentication error" after 21
# good puts with the same login, issue #70); a long upload must not stop on it.
RETRY_WAITS: tuple[float, ...] = (5.0, 20.0)


def put(
    bucket: str,
    key: str,
    path: Path,
    content_type: str,
    cache_control: str,
    run: Callable[..., object] = subprocess.run,
    sleep: Callable[[float], None] = time.sleep,
    waits: Sequence[float] = RETRY_WAITS,
) -> None:
    """`wrangler r2 object put`, with the Wrangler login locally or CLOUDFLARE_API_TOKEN in CI. The
    Cache-Control is stored with the object and comes back on every download (docs/adr/0003).

    A failed put is tried again after each of `waits`, then the last failure is raised. Writing the
    same key from the same file is idempotent, and the call returns only once the object is
    written, so the order the callers keep (a master before its public rendition, icons before
    sheets, the index last) holds through retries."""
    command = ["bunx", "wrangler", "r2", "object", "put", f"{bucket}/{key}", "--file", str(path), "--content-type", content_type, "--cache-control", cache_control, "--remote"]
    for wait in waits:
        try:
            run(command, check=True)
            return
        except subprocess.CalledProcessError as e:
            print(f"put {key} failed (exit {e.returncode}); trying again in {wait:g} s", file=sys.stderr)
            sleep(wait)
    run(command, check=True)
