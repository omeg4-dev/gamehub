from gamehub import tls


def test_certificate_names_the_address_it_will_be_served_on(tmp_path):
    cert, key = tls.ensure_cert("192.0.2.36", tmp_path)
    assert cert.exists() and key.exists()
    assert "192.0.2.36" in tls.cert_addresses(cert)


def test_a_second_call_reuses_the_same_certificate(tmp_path):
    """Regenerating on every launch would mean tapping through the browser
    warning on every launch."""
    cert, _ = tls.ensure_cert("192.0.2.36", tmp_path)
    first = cert.read_bytes()
    tls.ensure_cert("192.0.2.36", tmp_path)
    assert cert.read_bytes() == first


def test_a_new_address_forces_a_new_certificate(tmp_path):
    """DHCP hands out a different address and the old cert no longer
    matches the URL, so the phone refuses it outright."""
    cert, _ = tls.ensure_cert("192.0.2.36", tmp_path)
    first = cert.read_bytes()
    tls.ensure_cert("192.0.2.99", tmp_path)
    assert cert.read_bytes() != first
    assert "192.0.2.99" in tls.cert_addresses(cert)


def test_the_key_is_not_readable_by_anyone_else(tmp_path):
    _, key = tls.ensure_cert("192.0.2.36", tmp_path)
    assert key.stat().st_mode & 0o077 == 0
