"""
Regression test for v1.0.1 Play Store submission:
- Verify backend billing endpoints STILL WORK (unchanged) even though the
  frontend UI has hidden them behind MONETIZATION_ENABLED=false.
- The reviewer login must work so Play Console reviewers can sign in.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://task-connect-81.preview.emergentagent.com").rstrip("/")
REVIEWER_EMAIL = "googleplay.reviewer@quickgig.app"
REVIEWER_PW = "GooglePlay2026!"


@pytest.fixture(scope="module")
def reviewer_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": REVIEWER_EMAIL, "password": REVIEWER_PW},
        timeout=15,
    )
    assert r.status_code == 200, f"reviewer login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data or "access_token" in data, data
    return data.get("token") or data.get("access_token")


class TestBillingEndpointsUntouched:
    """Backend Stripe endpoints must remain reachable and healthy for the
    web/iOS TestFlight paths and the future Play Billing bridge."""

    def test_billing_catalog_public(self):
        r = requests.get(f"{BASE_URL}/api/billing/catalog", timeout=10)
        assert r.status_code == 200
        body = r.json()
        # catalog should mention the 3 SKUs
        text = str(body).lower()
        assert "pro" in text or "monthly" in text
        assert "background" in text or "bg" in text or "boost" in text

    def test_billing_checkout_requires_auth(self):
        # Unauthed call must NOT succeed silently. Any non-2xx is fine.
        r = requests.post(
            f"{BASE_URL}/api/billing/checkout",
            json={"package_id": "pro_monthly", "origin_url": "https://example.com"},
            timeout=10,
        )
        assert r.status_code in (401, 403, 422), f"expected auth failure, got {r.status_code}"

    def test_billing_checkout_auth_ok(self, reviewer_token):
        # Authed call must reach the handler (may still fail on Stripe live
        # keys or return a 200/4xx from validation — the point is the route
        # is wired up and NOT 404).
        r = requests.post(
            f"{BASE_URL}/api/billing/checkout",
            headers={"Authorization": f"Bearer {reviewer_token}"},
            json={"package_id": "pro_monthly", "origin_url": "https://example.com"},
            timeout=20,
        )
        assert r.status_code != 404, "billing/checkout endpoint has been removed!"
        # Accept anything except 5xx server crash / route removed.
        assert r.status_code < 500 or "stripe" in r.text.lower(), f"unexpected: {r.status_code} {r.text[:300]}"

    def test_billing_checkout_bad_package(self, reviewer_token):
        r = requests.post(
            f"{BASE_URL}/api/billing/checkout",
            headers={"Authorization": f"Bearer {reviewer_token}"},
            json={"package_id": "nonexistent_pkg", "origin_url": "https://example.com"},
            timeout=15,
        )
        # pydantic validation on Literal package_id -> 422; if pydantic allows it, handler returns 400
        assert r.status_code in (400, 422), f"expected validation error, got {r.status_code} {r.text[:200]}"


class TestReviewerAccount:
    def test_login_reviewer(self, reviewer_token):
        assert reviewer_token
        # sanity check: reviewer can hit /api/auth/me
        r = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {reviewer_token}"},
            timeout=10,
        )
        assert r.status_code == 200
        me = r.json()
        assert me.get("email") == REVIEWER_EMAIL

    def test_jobs_list_accessible(self, reviewer_token):
        r = requests.get(
            f"{BASE_URL}/api/jobs?status=open",
            headers={"Authorization": f"Bearer {reviewer_token}"},
            timeout=10,
        )
        assert r.status_code == 200
        assert isinstance(r.json(), list)
