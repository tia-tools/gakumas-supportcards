"""Writes one object to the R2 bucket. The only module here that uploads anything."""

from __future__ import annotations

import subprocess
from pathlib import Path


def put(bucket: str, key: str, path: Path, content_type: str, cache_control: str) -> None:
    """`wrangler r2 object put`, with the Wrangler login locally or CLOUDFLARE_API_TOKEN in CI. The
    Cache-Control is stored with the object and comes back on every download (docs/adr/0003)."""
    subprocess.run(
        ["bunx", "wrangler", "r2", "object", "put", f"{bucket}/{key}", "--file", str(path), "--content-type", content_type, "--cache-control", cache_control, "--remote"],
        check=True,
    )
