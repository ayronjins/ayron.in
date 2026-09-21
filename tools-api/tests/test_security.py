import ipaddress
import pytest
from app.security import normalize_target, validate_public_ip, validate_redirect_target

@pytest.mark.parametrize("value", [
    "http://localhost",
    "http://127.0.0.1",
    "http://127.1",
    "http://0.0.0.0",
    "http://10.0.0.1",
    "http://172.16.0.1",
    "http://192.168.1.1",
    "http://169.254.169.254",
    "http://[::1]",
    "file:///etc/passwd",
    "gopher://127.0.0.1",
])
def test_private_or_unsafe_targets_are_rejected(value):
    with pytest.raises(ValueError):
        normalize_target(value)

def test_domain_input_gets_https_scheme():
    result = normalize_target("example.com")
    assert result.scheme == "https"
    assert result.hostname == "example.com"

def test_public_ip_is_allowed():
    assert validate_public_ip(ipaddress.ip_address("8.8.8.8")) is True

def test_private_ip_is_rejected():
    with pytest.raises(ValueError):
        validate_public_ip(ipaddress.ip_address("192.168.1.1"))

def test_redirect_to_private_target_is_rejected():
    with pytest.raises(ValueError):
        validate_redirect_target("http://127.0.0.1/admin")

def test_malformed_url_is_rejected():
    with pytest.raises(ValueError):
        normalize_target("https://")
