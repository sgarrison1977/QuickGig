"""
QuickGig backend tests — focused on:
  1. Push notification endpoints (register / unregister / settings)
  2. notify_user() hooks on accept / message / complete / cancel / review
     — must NEVER block or break the 200 OK response even when push tokens
       are fake or missing.
"""

import os
import time
import uuid
import json
import requests

BASE = "https://task-connect-81.preview.emergentagent.com/api"
TIMEOUT = 30

results = []


def log(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    line = f"[{status}] {name}"
    if detail:
        line += f"  ({detail})"
    print(line)
    results.append({"name": name, "ok": ok, "detail": detail})
    return ok


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def register_user(email, password, name):
    r = requests.post(
        f"{BASE}/auth/register",
        json={"email": email, "password": password, "name": name},
        timeout=TIMEOUT,
    )
    if r.status_code == 400 and "already registered" in r.text.lower():
        # fallback to login
        lr = requests.post(
            f"{BASE}/auth/login",
            json={"email": email, "password": password},
            timeout=TIMEOUT,
        )
        lr.raise_for_status()
        return lr.json()
    r.raise_for_status()
    return r.json()


def login(email, password):
    r = requests.post(
        f"{BASE}/auth/login",
        json={"email": email, "password": password},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return r.json()


def verify_id(token):
    r = requests.post(
        f"{BASE}/auth/verify-id",
        json={"id_document": "data:image/png;base64,AAAA"},
        headers=auth_header(token),
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return r.json()


# -----------------------------------------------------------
# 0. Provision two fresh real-looking users and an admin login
# -----------------------------------------------------------
suffix = uuid.uuid4().hex[:8]
USER_A = {
    "email": f"sarah.miller.{suffix}@quickgig-test.com",
    "password": "SecurePass!2026",
    "name": "Sarah Miller",
}
USER_B = {
    "email": f"david.chen.{suffix}@quickgig-test.com",
    "password": "SecurePass!2026",
    "name": "David Chen",
}

print("=" * 70)
print("Setup: creating fresh test users")
print("=" * 70)

ra = register_user(USER_A["email"], USER_A["password"], USER_A["name"])
rb = register_user(USER_B["email"], USER_B["password"], USER_B["name"])
TOKEN_A = ra["token"]
TOKEN_B = rb["token"]
USER_A_ID = ra["user"]["id"]
USER_B_ID = rb["user"]["id"]
log("setup: register/login two users", True, f"A={USER_A_ID[:8]} B={USER_B_ID[:8]}")

# Admin login
ADMIN_EMAIL = "admin@quickgig.app"
ADMIN_PASSWORD = "admin123"
try:
    admin_resp = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    log("setup: admin login", admin_resp.get("user", {}).get("role") == "admin")
except Exception as e:
    log("setup: admin login", False, str(e))

# Verify IDs so users can post / accept jobs
try:
    verify_id(TOKEN_A)
    verify_id(TOKEN_B)
    log("setup: verify IDs (mocked)", True)
except Exception as e:
    log("setup: verify IDs (mocked)", False, str(e))


# =========================================================================
# 1. Push notification endpoint tests
# =========================================================================

print()
print("=" * 70)
print("1. Push notification endpoints")
print("=" * 70)

FAKE_TOKEN_A = f"ExponentPushToken[fake-{suffix}-A]"
FAKE_TOKEN_B = f"ExponentPushToken[fake-{suffix}-B]"

# 1a. Unauthenticated register-token → 401
r = requests.post(
    f"{BASE}/notifications/register-token",
    json={"token": FAKE_TOKEN_A},
    timeout=TIMEOUT,
)
log("1a. unauthenticated register-token → 401/403",
    r.status_code in (401, 403),
    f"got {r.status_code}")

# 1b. Empty token → 400
r = requests.post(
    f"{BASE}/notifications/register-token",
    json={"token": ""},
    headers=auth_header(TOKEN_A),
    timeout=TIMEOUT,
)
log("1b. empty token → 400", r.status_code == 400, f"got {r.status_code}: {r.text[:120]}")

# 1c. Whitespace-only token → 400 (extra robustness)
r = requests.post(
    f"{BASE}/notifications/register-token",
    json={"token": "   "},
    headers=auth_header(TOKEN_A),
    timeout=TIMEOUT,
)
log("1c. whitespace token → 400", r.status_code == 400, f"got {r.status_code}")

# 1d. Register valid token
t0 = time.time()
r = requests.post(
    f"{BASE}/notifications/register-token",
    json={"token": FAKE_TOKEN_A, "platform": "ios"},
    headers=auth_header(TOKEN_A),
    timeout=TIMEOUT,
)
elapsed = time.time() - t0
ok = r.status_code == 200 and r.json().get("ok") is True
log("1d. register valid token → {ok:true}", ok, f"status={r.status_code} elapsed={elapsed:.2f}s body={r.text[:120]}")

# 1e. GET settings → has_token=true, enabled=true
r = requests.get(
    f"{BASE}/notifications/settings",
    headers=auth_header(TOKEN_A),
    timeout=TIMEOUT,
)
body = r.json() if r.ok else {}
ok = (
    r.status_code == 200
    and body.get("has_token") is True
    and body.get("enabled") is True
)
log("1e. GET settings after register → has_token=true, enabled=true",
    ok, f"body={body}")

# 1f. PUT settings disable
r = requests.put(
    f"{BASE}/notifications/settings",
    json={"enabled": False},
    headers=auth_header(TOKEN_A),
    timeout=TIMEOUT,
)
body = r.json() if r.ok else {}
ok = r.status_code == 200 and body.get("ok") is True and body.get("enabled") is False
log("1f. PUT settings {enabled:false}", ok, f"body={body}")

# 1g. GET settings reflects disable
r = requests.get(f"{BASE}/notifications/settings", headers=auth_header(TOKEN_A), timeout=TIMEOUT)
body = r.json() if r.ok else {}
log("1g. GET settings reflects enabled=false",
    body.get("enabled") is False and body.get("has_token") is True,
    f"body={body}")

# 1h. PUT settings re-enable
r = requests.put(
    f"{BASE}/notifications/settings",
    json={"enabled": True},
    headers=auth_header(TOKEN_A),
    timeout=TIMEOUT,
)
body = r.json() if r.ok else {}
log("1h. PUT settings {enabled:true}",
    r.status_code == 200 and body.get("enabled") is True, f"body={body}")

# 1i. unregister-token clears token
r = requests.post(
    f"{BASE}/notifications/unregister-token",
    headers=auth_header(TOKEN_A),
    timeout=TIMEOUT,
)
ok = r.status_code == 200 and r.json().get("ok") is True
log("1i. unregister-token → ok:true", ok, f"status={r.status_code} body={r.text[:120]}")

# 1j. settings shows has_token=false after unregister
r = requests.get(f"{BASE}/notifications/settings", headers=auth_header(TOKEN_A), timeout=TIMEOUT)
body = r.json() if r.ok else {}
log("1j. has_token=false after unregister",
    body.get("has_token") is False, f"body={body}")

# 1k. Re-register tokens for both A and B (will be used for event-trigger tests)
r1 = requests.post(
    f"{BASE}/notifications/register-token",
    json={"token": FAKE_TOKEN_A, "platform": "ios"},
    headers=auth_header(TOKEN_A),
    timeout=TIMEOUT,
)
r2 = requests.post(
    f"{BASE}/notifications/register-token",
    json={"token": FAKE_TOKEN_B, "platform": "android"},
    headers=auth_header(TOKEN_B),
    timeout=TIMEOUT,
)
log("1k. re-register fake tokens for both users",
    r1.status_code == 200 and r2.status_code == 200,
    f"A={r1.status_code} B={r2.status_code}")

# 1l. Re-registering same token under user B should clear from A (uniqueness)
# Register the SAME token on B and verify A.has_token becomes false
r = requests.post(
    f"{BASE}/notifications/register-token",
    json={"token": FAKE_TOKEN_A, "platform": "android"},
    headers=auth_header(TOKEN_B),
    timeout=TIMEOUT,
)
ok_register = r.status_code == 200
ra = requests.get(f"{BASE}/notifications/settings", headers=auth_header(TOKEN_A), timeout=TIMEOUT)
rb = requests.get(f"{BASE}/notifications/settings", headers=auth_header(TOKEN_B), timeout=TIMEOUT)
log(
    "1l. token transferred to B → A.has_token=false, B.has_token=true",
    ok_register
    and ra.json().get("has_token") is False
    and rb.json().get("has_token") is True,
    f"A={ra.json()} B={rb.json()}",
)

# Restore: re-register A's own distinct token
requests.post(
    f"{BASE}/notifications/register-token",
    json={"token": FAKE_TOKEN_A, "platform": "ios"},
    headers=auth_header(TOKEN_A),
    timeout=TIMEOUT,
)
# Reset B's token to its own
requests.post(
    f"{BASE}/notifications/register-token",
    json={"token": FAKE_TOKEN_B, "platform": "android"},
    headers=auth_header(TOKEN_B),
    timeout=TIMEOUT,
)


# =========================================================================
# 2. Event triggers — must return 200 quickly even when push token is fake
# =========================================================================

print()
print("=" * 70)
print("2. Event triggers (notify_user must not block / fail)")
print("=" * 70)


def time_request(method, url, **kwargs):
    t0 = time.time()
    r = requests.request(method, url, timeout=TIMEOUT, **kwargs)
    return r, time.time() - t0


# 2a. A creates a job
job_payload = {
    "title": "Help moving furniture this Saturday",
    "description": "Need help moving a sofa and 3 boxes from a 2nd-floor apartment.",
    "category": "moving",
    "pay_type": "hourly",
    "pay_amount": 35.0,
    "address": "1234 Mission St, San Francisco, CA",
    "latitude": 37.7621,
    "longitude": -122.4194,
    "photos": [],
}
r, dt = time_request("POST", f"{BASE}/jobs", headers=auth_header(TOKEN_A), json=job_payload)
ok = r.status_code == 200
job1 = r.json() if ok else {}
log("2a. user A creates job", ok, f"status={r.status_code} dt={dt:.2f}s")

# 2b. B accepts → notify_user(poster) — should not hang
job1_id = job1.get("id")
r, dt = time_request("POST", f"{BASE}/jobs/{job1_id}/accept", headers=auth_header(TOKEN_B))
log(
    "2b. user B accepts job (notify A) → 200 fast",
    r.status_code == 200 and dt < 3.0,
    f"status={r.status_code} dt={dt:.2f}s",
)

# Get conversation id
r = requests.get(f"{BASE}/conversations", headers=auth_header(TOKEN_A), timeout=TIMEOUT)
convos = r.json() if r.ok else []
convo_id = next((c["id"] for c in convos if c.get("job_id") == job1_id), None)
log("2c. conversation auto-created on accept", bool(convo_id), f"convo_id={convo_id}")

# 2d. A sends a message → notify B
r, dt = time_request(
    "POST",
    f"{BASE}/conversations/{convo_id}/messages",
    headers=auth_header(TOKEN_A),
    json={"text": "Hi David, I can be ready by 10am Saturday. Sound good?"},
)
log("2d. send message A→B → 200 fast",
    r.status_code == 200 and dt < 3.0, f"status={r.status_code} dt={dt:.2f}s")

# 2e. B sends a message → notify A
r, dt = time_request(
    "POST",
    f"{BASE}/conversations/{convo_id}/messages",
    headers=auth_header(TOKEN_B),
    json={"text": "10am works great. I'll bring straps and gloves."},
)
log("2e. send message B→A → 200 fast",
    r.status_code == 200 and dt < 3.0, f"status={r.status_code} dt={dt:.2f}s")

# 2f. A marks complete → notify B
r, dt = time_request("POST", f"{BASE}/jobs/{job1_id}/complete", headers=auth_header(TOKEN_A))
log("2f. job complete (poster) → 200 fast",
    r.status_code == 200 and dt < 3.0, f"status={r.status_code} dt={dt:.2f}s")

# 2g. A reviews B → notify B
r, dt = time_request(
    "POST",
    f"{BASE}/reviews",
    headers=auth_header(TOKEN_A),
    json={
        "job_id": job1_id,
        "reviewee_id": USER_B_ID,
        "rating": 5,
        "comment": "Great worker, super reliable. Thanks David!",
    },
)
log("2g. create review A→B → 200 fast",
    r.status_code == 200 and dt < 3.0, f"status={r.status_code} dt={dt:.2f}s")

# 2h. B reviews A
r, dt = time_request(
    "POST",
    f"{BASE}/reviews",
    headers=auth_header(TOKEN_B),
    json={
        "job_id": job1_id,
        "reviewee_id": USER_A_ID,
        "rating": 5,
        "comment": "Easy job, friendly poster.",
    },
)
log("2h. create review B→A → 200 fast",
    r.status_code == 200 and dt < 3.0, f"status={r.status_code} dt={dt:.2f}s")

# 2i. New job + accept + cancel by poster → notify worker on cancel
job_payload2 = dict(job_payload, title="Quick yard cleanup")
r, dt = time_request("POST", f"{BASE}/jobs", headers=auth_header(TOKEN_A), json=job_payload2)
job2_id = r.json()["id"] if r.ok else None
log("2i.1 second job created", r.status_code == 200, f"status={r.status_code}")

r, dt = time_request("POST", f"{BASE}/jobs/{job2_id}/accept", headers=auth_header(TOKEN_B))
log("2i.2 second job accepted by B",
    r.status_code == 200 and dt < 3.0, f"status={r.status_code} dt={dt:.2f}s")

r, dt = time_request("POST", f"{BASE}/jobs/{job2_id}/cancel", headers=auth_header(TOKEN_A))
log("2i.3 poster cancels accepted job (notify worker) → 200 fast",
    r.status_code == 200 and dt < 3.0, f"status={r.status_code} dt={dt:.2f}s")


# 2j. Edge case: notify_user with a DISABLED user must not block
# Disable B's notifications, send a message; should still return fast.
requests.put(
    f"{BASE}/notifications/settings",
    json={"enabled": False},
    headers=auth_header(TOKEN_B),
    timeout=TIMEOUT,
)
# create job + accept to get convo
job_payload3 = dict(job_payload, title="Wash my car this evening")
r = requests.post(f"{BASE}/jobs", headers=auth_header(TOKEN_A), json=job_payload3, timeout=TIMEOUT)
j3id = r.json()["id"]
r = requests.post(f"{BASE}/jobs/{j3id}/accept", headers=auth_header(TOKEN_B), timeout=TIMEOUT)
convos = requests.get(f"{BASE}/conversations", headers=auth_header(TOKEN_A), timeout=TIMEOUT).json()
c3 = next((c["id"] for c in convos if c.get("job_id") == j3id), None)
r, dt = time_request(
    "POST",
    f"{BASE}/conversations/{c3}/messages",
    headers=auth_header(TOKEN_A),
    json={"text": "Heading over now."},
)
log("2j. message to user with notifications disabled → still 200 fast",
    r.status_code == 200 and dt < 3.0, f"status={r.status_code} dt={dt:.2f}s")

# 2k. Edge case: receiver has NO push token at all
requests.post(
    f"{BASE}/notifications/unregister-token",
    headers=auth_header(TOKEN_B),
    timeout=TIMEOUT,
)
r, dt = time_request(
    "POST",
    f"{BASE}/conversations/{c3}/messages",
    headers=auth_header(TOKEN_A),
    json={"text": "Just arrived at the address."},
)
log("2k. message to user with NO push token → still 200 fast",
    r.status_code == 200 and dt < 3.0, f"status={r.status_code} dt={dt:.2f}s")


# Summary
print()
print("=" * 70)
passed = sum(1 for x in results if x["ok"])
failed = sum(1 for x in results if not x["ok"])
print(f"RESULTS: {passed} passed / {failed} failed / {len(results)} total")
for x in results:
    if not x["ok"]:
        print(f"  FAIL: {x['name']} — {x['detail']}")
print("=" * 70)
