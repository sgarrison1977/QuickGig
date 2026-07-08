"""Tests for Google Play / App Store reviewer seed account.

Verifies:
  1. Login with reviewer credentials returns 200 + JWT + user payload.
  2. /api/auth/me with token returns reviewer profile with expected fields.
  3. Reviewer account survives backend restart (idempotent seed_reviewer()).
  4. Idempotency — no duplicate documents after multiple restarts.
  5. Wrong password returns 401 (password is hashed & enforced).
"""

import os
import time
import subprocess
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
from dotenv import load_dotenv

# Load backend env for DB access
load_dotenv("/app/backend/.env")

REVIEWER_EMAIL = "googleplay.reviewer@quickgig.app"
REVIEWER_PASSWORD = "GooglePlay2026!"
WRONG_PASSWORD = "wrong-password-xyz"


# --- Auth: Login with valid reviewer credentials ---
class TestReviewerLogin:
    def test_login_success_returns_token_and_user(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": REVIEWER_EMAIL, "password": REVIEWER_PASSWORD},
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        body = r.json()
        assert "token" in body and isinstance(body["token"], str) and len(body["token"]) > 20
        assert "user" in body
        user = body["user"]
        assert user["email"] == REVIEWER_EMAIL
        assert user["name"] == "Google Play Reviewer"
        assert user["is_verified"] is True
        assert user["role"] == "user"
        assert user.get("banned", False) is False

    def test_login_wrong_password_returns_401(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": REVIEWER_EMAIL, "password": WRONG_PASSWORD},
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"

    def test_login_wrong_email_returns_401(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": "nonexistent-reviewer@quickgig.app", "password": REVIEWER_PASSWORD},
        )
        assert r.status_code == 401


# --- /api/auth/me with reviewer token ---
class TestReviewerMe:
    @pytest.fixture(scope="class")
    def reviewer_token(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": REVIEWER_EMAIL, "password": REVIEWER_PASSWORD},
        )
        assert r.status_code == 200
        return r.json()["token"]

    def test_me_returns_reviewer_profile(self, api_client, base_url, reviewer_token):
        r = api_client.get(
            f"{base_url}/api/auth/me",
            headers={"Authorization": f"Bearer {reviewer_token}"},
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        user = r.json()
        assert user["email"] == REVIEWER_EMAIL
        assert user["name"] == "Google Play Reviewer"
        assert user["is_verified"] is True
        assert user["role"] == "user"
        assert user.get("banned", False) is False
        # Ensure Mongo _id is not leaked
        assert "_id" not in user
        # Ensure password_hash is not leaked
        assert "password_hash" not in user
        assert "password" not in user

    def test_me_without_token_returns_401(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/me")
        assert r.status_code in (401, 403)


# --- Persistence: survives backend restart ---
class TestReviewerPersistence:
    def _login(self, api_client, base_url):
        return api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": REVIEWER_EMAIL, "password": REVIEWER_PASSWORD},
        )

    def _wait_for_backend(self, api_client, base_url, timeout=60):
        deadline = time.time() + timeout
        last_err = None
        while time.time() < deadline:
            try:
                r = api_client.get(f"{base_url}/api/", timeout=5)
                if r.status_code == 200:
                    return True
            except Exception as e:
                last_err = e
            time.sleep(1)
        raise RuntimeError(f"Backend did not come back up in {timeout}s: {last_err}")

    def test_login_works_after_restart(self, api_client, base_url):
        # Confirm login works pre-restart
        pre = self._login(api_client, base_url)
        assert pre.status_code == 200

        # Restart backend via supervisor
        result = subprocess.run(
            ["sudo", "supervisorctl", "restart", "backend"],
            capture_output=True, text=True, timeout=30,
        )
        assert result.returncode == 0, f"supervisorctl failed: {result.stderr}"

        # Wait for backend to come back
        self._wait_for_backend(api_client, base_url)

        # Login again after restart
        post = self._login(api_client, base_url)
        assert post.status_code == 200, f"Post-restart login failed: {post.status_code} {post.text}"
        assert post.json()["user"]["email"] == REVIEWER_EMAIL

    def test_double_restart_no_duplicate(self, api_client, base_url):
        # Restart backend twice more, then check Mongo for exactly ONE document
        for _ in range(2):
            subprocess.run(
                ["sudo", "supervisorctl", "restart", "backend"],
                capture_output=True, text=True, timeout=30,
            )
            self._wait_for_backend(api_client, base_url)

        # Query Mongo directly
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        assert mongo_url and db_name, "MONGO_URL / DB_NAME missing from env"

        async def count_reviewer_docs():
            client = AsyncIOMotorClient(mongo_url)
            try:
                db = client[db_name]
                count = await db.users.count_documents({"email": REVIEWER_EMAIL})
                docs = await db.users.find({"email": REVIEWER_EMAIL}, {"_id": 0, "email": 1, "role": 1, "name": 1}).to_list(10)
                return count, docs
            finally:
                client.close()

        count, docs = asyncio.get_event_loop().run_until_complete(count_reviewer_docs())
        assert count == 1, f"Expected exactly 1 reviewer doc, found {count}: {docs}"
        assert docs[0]["role"] == "user"
        assert docs[0]["name"] == "Google Play Reviewer"

        # Sanity: login still works
        r = self._login(api_client, base_url)
        assert r.status_code == 200
