from app.security.passwords import hash_password, new_token, token_hash, validate_password, verify_password


def test_password_hashes_are_salted_and_verifiable() -> None:
    first = hash_password("a sufficiently long password")
    second = hash_password("a sufficiently long password")
    assert first != second
    assert verify_password("a sufficiently long password", first)
    assert not verify_password("another long password", first)
    assert not verify_password("anything", "malformed")


def test_password_length_and_opaque_tokens() -> None:
    try:
        validate_password("short")
    except ValueError:
        pass
    else:
        raise AssertionError("Short password was accepted")
    first, second = new_token(), new_token()
    assert first != second
    assert len(token_hash(first)) == 32
    assert token_hash(first) != token_hash(second)
