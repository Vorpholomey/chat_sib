"""Small in-process rate limiters for auth endpoints (per server process)."""

from __future__ import annotations

from collections import defaultdict, deque
from time import monotonic


class SlidingWindowLimiter:
    def __init__(self, max_requests: int, window_seconds: float) -> None:
        self._max = max_requests
        self._window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = monotonic()
        cutoff = now - self._window
        q = self._hits[key]
        while q and q[0] < cutoff:
            q.popleft()
        if len(q) >= self._max:
            return False
        q.append(now)
        return True


# Stricter on login (credential stuffing); looser on register (still bounded).
login_limiter = SlidingWindowLimiter(max_requests=20, window_seconds=60.0)
register_limiter = SlidingWindowLimiter(max_requests=8, window_seconds=60.0)
