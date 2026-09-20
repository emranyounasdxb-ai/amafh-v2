"""Replaceable storage boundary for the two supported profile image kinds."""

from pathlib import Path
from uuid import uuid4

from app.core.config import get_settings


class LocalProfileMediaStorage:
    def __init__(self, root: str | Path):
        self.root = Path(root)

    def put(self, content: bytes) -> str:
        self.root.mkdir(parents=True, exist_ok=True)
        key = uuid4().hex
        path = self.root / key
        path.write_bytes(content)
        return key

    def get(self, key: str) -> bytes:
        return (self.root / self._safe_key(key)).read_bytes()

    def delete(self, key: str) -> None:
        (self.root / self._safe_key(key)).unlink(missing_ok=True)

    @staticmethod
    def _safe_key(key: str) -> str:
        if len(key) != 32 or any(char not in '0123456789abcdef' for char in key):
            raise ValueError('Invalid media key')
        return key


def profile_media_storage() -> LocalProfileMediaStorage:
    return LocalProfileMediaStorage(get_settings().profile_media_root)
