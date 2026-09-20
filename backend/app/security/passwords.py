"""Scrypt password hashes and opaque one-time token hashes."""

import base64
import hashlib
import hmac
import secrets

_N = 1 << 15
_R = 8
_P = 1
_MAX_MEMORY = 64 * 1024 * 1024


def validate_password(password: str) -> None:
    if len(password) < 12 or len(password) > 128:
        raise ValueError("Use a password of 12 to 128 characters.")


def hash_password(password: str) -> str:
    validate_password(password)
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=_N, r=_R, p=_P, dklen=32, maxmem=_MAX_MEMORY)
    return "scrypt${}${}${}${}${}".format(
        _N, _R, _P,
        base64.urlsafe_b64encode(salt).decode("ascii"),
        base64.urlsafe_b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        algorithm, n, r, p, salt, digest = stored.split("$")
        if (algorithm, int(n), int(r), int(p)) != ("scrypt", _N, _R, _P):
            return False
        salt_bytes = base64.urlsafe_b64decode(salt)
        expected = base64.urlsafe_b64decode(digest)
        if len(salt_bytes) != 16 or len(expected) != 32:
            return False
        actual = hashlib.scrypt(password.encode("utf-8"), salt=salt_bytes, n=_N, r=_R, p=_P, dklen=32, maxmem=_MAX_MEMORY)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError, OverflowError):
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> bytes:
    return hashlib.sha256(token.encode("ascii")).digest()
