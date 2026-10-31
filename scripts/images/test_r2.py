import subprocess
from pathlib import Path

import pytest

from r2 import RETRY_WAITS, put


class Wrangler:
    """Fails the first `failures` calls with a non-zero exit, then succeeds; records each command."""

    def __init__(self, failures):
        self.failures = failures
        self.commands = []

    def __call__(self, command, check):
        assert check is True
        self.commands.append(command)
        if len(self.commands) <= self.failures:
            raise subprocess.CalledProcessError(1, command)


def put_with(wrangler, slept):
    put("tia-assets", "w112/x.webp", Path("out/w112/x.webp"), "image/webp", "public, max-age=31536000, immutable", run=wrangler, sleep=slept.append)


def test_a_put_that_succeeds_runs_wrangler_once_without_waiting():
    wrangler, slept = Wrangler(0), []
    put_with(wrangler, slept)
    assert slept == []
    assert wrangler.commands == [
        ["bunx", "wrangler", "r2", "object", "put", "tia-assets/w112/x.webp", "--file", "out/w112/x.webp", "--content-type", "image/webp", "--cache-control", "public, max-age=31536000, immutable", "--remote"]
    ]


def test_a_transient_failure_is_tried_again_after_a_wait():
    wrangler, slept = Wrangler(2), []
    put_with(wrangler, slept)
    assert len(wrangler.commands) == 3 and len(set(map(tuple, wrangler.commands))) == 1  # the same put each time
    assert slept == list(RETRY_WAITS)


def test_a_put_that_keeps_failing_raises_after_its_last_attempt():
    wrangler, slept = Wrangler(99), []
    with pytest.raises(subprocess.CalledProcessError):
        put_with(wrangler, slept)
    assert len(wrangler.commands) == len(RETRY_WAITS) + 1
    assert slept == list(RETRY_WAITS)
