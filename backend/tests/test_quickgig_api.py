"""QuickGig backend API tests - full flow."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://task-connect-81.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@quickgig.app"
ADMIN_PASSWORD = "admin123"

# tiny base64 placeholder
TINY_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII="


# ---- shared state via module-level dict ----
state = {}


def _post(path, json=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(f"{API}{path}", json=json, headers=h, timeout=15)


def _get(path, token=None, params=None):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(f"{API}{path}", headers=h, params=params, timeout=15)


# ============ HEALTH ============

def test_health():
    r = _get("/")
    assert r.status_code == 200
    assert r.json().get("message")


# ============ AUTH ============

def test_register_user_a():
    suffix = uuid.uuid4().hex[:6]
    email = f"TEST_a_{suffix}@example.com"
    r = _post("/auth/register", {"email": email, "password": "pass1234", "name": "Alice Poster", "phone": "555-0001"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["email"] == email.lower()
    assert data["user"]["is_verified"] is False
    state["user_a"] = data["user"]
    state["token_a"] = data["token"]


def test_register_user_b():
    suffix = uuid.uuid4().hex[:6]
    email = f"TEST_b_{suffix}@example.com"
    r = _post("/auth/register", {"email": email, "password": "pass1234", "name": "Bob Worker"})
    assert r.status_code == 200
    state["user_b"] = r.json()["user"]
    state["token_b"] = r.json()["token"]


def test_register_duplicate_fails():
    r = _post("/auth/register", {"email": state["user_a"]["email"], "password": "pass1234", "name": "Dup"})
    assert r.status_code == 400


def test_login_user_a():
    r = _post("/auth/login", {"email": state["user_a"]["email"], "password": "pass1234"})
    assert r.status_code == 200
    assert r.json()["user"]["id"] == state["user_a"]["id"]


def test_login_wrong_password():
    r = _post("/auth/login", {"email": state["user_a"]["email"], "password": "wrong"})
    assert r.status_code == 401


def test_me_endpoint():
    r = _get("/auth/me", token=state["token_a"])
    assert r.status_code == 200
    assert r.json()["id"] == state["user_a"]["id"]


def test_me_no_token():
    r = _get("/auth/me")
    assert r.status_code == 401


# ============ ID VERIFY ============

def test_create_job_unverified_blocked():
    r = _post("/jobs", {
        "title": "T", "description": "d", "category": "moving",
        "pay_type": "hourly", "pay_amount": 20, "address": "x",
        "latitude": 37.78, "longitude": -122.41
    }, token=state["token_a"])
    assert r.status_code == 403


def test_verify_id_a():
    r = _post("/auth/verify-id", {"id_document": TINY_B64, "selfie": TINY_B64}, token=state["token_a"])
    assert r.status_code == 200
    assert r.json()["is_verified"] is True
    state["user_a"] = r.json()


def test_verify_id_b():
    r = _post("/auth/verify-id", {"id_document": TINY_B64}, token=state["token_b"])
    assert r.status_code == 200
    assert r.json()["is_verified"] is True


# ============ JOBS ============

def test_create_job_after_verify():
    payload = {
        "title": "TEST_Move couch",
        "description": "Need help moving a couch",
        "category": "moving",
        "pay_type": "fixed",
        "pay_amount": 50,
        "address": "SF, CA",
        "latitude": 37.7749,
        "longitude": -122.4194,
        "photos": [],
    }
    r = _post("/jobs", payload, token=state["token_a"])
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["status"] == "open"
    assert j["poster_id"] == state["user_a"]["id"]
    state["job_id"] = j["id"]

    # verify persisted
    r2 = _get(f"/jobs/{j['id']}")
    assert r2.status_code == 200
    assert r2.json()["title"] == payload["title"]


def test_create_far_job_for_distance():
    payload = {
        "title": "TEST_Far job NYC",
        "description": "Far",
        "category": "delivery",
        "pay_type": "hourly",
        "pay_amount": 25,
        "address": "NYC",
        "latitude": 40.7128,
        "longitude": -74.0060,
    }
    r = _post("/jobs", payload, token=state["token_a"])
    assert r.status_code == 200
    state["far_job_id"] = r.json()["id"]


def test_list_jobs_basic():
    r = _get("/jobs")
    assert r.status_code == 200
    ids = [j["id"] for j in r.json()]
    assert state["job_id"] in ids


def test_list_jobs_search():
    r = _get("/jobs", params={"q": "couch"})
    assert r.status_code == 200
    titles = [j["title"] for j in r.json()]
    assert any("couch" in t.lower() for t in titles)


def test_list_jobs_distance_filter():
    # SF coords with 50 mile radius — far NYC job should be excluded
    r = _get("/jobs", params={"lat": 37.7749, "lng": -122.4194, "radius": 50})
    assert r.status_code == 200
    jobs = r.json()
    ids = [j["id"] for j in jobs]
    assert state["job_id"] in ids
    assert state["far_job_id"] not in ids
    # all distances <= 50 and sorted ascending
    dists = [j["distance_miles"] for j in jobs]
    assert all(d is not None and d <= 50 for d in dists)
    assert dists == sorted(dists)


def test_accept_own_job_blocked():
    r = _post(f"/jobs/{state['job_id']}/accept", token=state["token_a"])
    assert r.status_code == 400


def test_accept_job_by_b():
    r = _post(f"/jobs/{state['job_id']}/accept", token=state["token_b"])
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "accepted"
    assert r.json()["worker_id"] == state["user_b"]["id"]


def test_jobs_mine_a():
    r = _get("/jobs/mine", token=state["token_a"])
    assert r.status_code == 200
    posted_ids = [j["id"] for j in r.json()["posted"]]
    assert state["job_id"] in posted_ids


def test_jobs_mine_b():
    r = _get("/jobs/mine", token=state["token_b"])
    assert r.status_code == 200
    accepted_ids = [j["id"] for j in r.json()["accepted"]]
    assert state["job_id"] in accepted_ids


# ============ MESSAGES ============

def test_conversations_auto_created():
    r = _get("/conversations", token=state["token_a"])
    assert r.status_code == 200
    convos = r.json()
    match = [c for c in convos if c["job_id"] == state["job_id"]]
    assert len(match) == 1
    state["convo_id"] = match[0]["id"]


def test_send_and_get_message():
    r = _post(f"/conversations/{state['convo_id']}/messages", {"text": "Hi worker"}, token=state["token_a"])
    assert r.status_code == 200
    r2 = _post(f"/conversations/{state['convo_id']}/messages", {"text": "Hello!"}, token=state["token_b"])
    assert r2.status_code == 200
    r3 = _get(f"/conversations/{state['convo_id']}/messages", token=state["token_a"])
    assert r3.status_code == 200
    msgs = r3.json()
    assert len(msgs) >= 2
    assert msgs[-1]["text"] == "Hello!"


def test_outsider_cannot_read_messages():
    # register an outsider
    r = _post("/auth/register", {"email": f"TEST_out_{uuid.uuid4().hex[:6]}@x.com", "password": "pass1234", "name": "Out"})
    tok = r.json()["token"]
    r2 = _get(f"/conversations/{state['convo_id']}/messages", token=tok)
    assert r2.status_code == 403


# ============ COMPLETE + REVIEW ============

def test_complete_job():
    r = _post(f"/jobs/{state['job_id']}/complete", token=state["token_a"])
    assert r.status_code == 200
    assert r.json()["status"] == "completed"


def test_review_worker():
    r = _post("/reviews", {
        "job_id": state["job_id"],
        "reviewee_id": state["user_b"]["id"],
        "rating": 5,
        "comment": "Great worker"
    }, token=state["token_a"])
    assert r.status_code == 200, r.text


def test_review_updates_rating_avg():
    r = _get(f"/users/{state['user_b']['id']}")
    assert r.status_code == 200
    assert r.json()["rating_avg"] == 5.0
    assert r.json()["rating_count"] == 1


def test_duplicate_review_blocked():
    r = _post("/reviews", {
        "job_id": state["job_id"], "reviewee_id": state["user_b"]["id"], "rating": 4
    }, token=state["token_a"])
    assert r.status_code == 400


def test_get_user_reviews():
    r = _get(f"/reviews/user/{state['user_b']['id']}")
    assert r.status_code == 200
    assert len(r.json()) >= 1
    assert r.json()[0]["rating"] == 5


# ============ ADMIN ============

def test_admin_login():
    r = _post("/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "admin"
    state["admin_token"] = r.json()["token"]


def test_admin_users_list():
    r = _get("/admin/users", token=state["admin_token"])
    assert r.status_code == 200
    emails = [u["email"] for u in r.json()]
    assert state["user_a"]["email"] in emails


def test_admin_users_list_forbidden_for_user():
    r = _get("/admin/users", token=state["token_a"])
    assert r.status_code == 403


def test_admin_stats():
    r = _get("/admin/stats", token=state["admin_token"])
    assert r.status_code == 200
    data = r.json()
    for k in ["users", "verified_users", "jobs_total", "jobs_open", "jobs_completed", "messages"]:
        assert k in data


def test_admin_conversations():
    r = _get("/admin/conversations", token=state["admin_token"])
    assert r.status_code == 200
    ids = [c["id"] for c in r.json()]
    assert state["convo_id"] in ids


def test_admin_view_chat_history():
    r = _get(f"/conversations/{state['convo_id']}/messages", token=state["admin_token"])
    assert r.status_code == 200
    assert len(r.json()) >= 2


def test_admin_ban_user():
    r = _post(f"/admin/users/{state['user_b']['id']}/ban", token=state["admin_token"])
    assert r.status_code == 200
    # banned user cannot login
    r2 = _post("/auth/login", {"email": state["user_b"]["email"], "password": "pass1234"})
    assert r2.status_code == 403


def test_admin_unban_user():
    r = _post(f"/admin/users/{state['user_b']['id']}/unban", token=state["admin_token"])
    assert r.status_code == 200
    r2 = _post("/auth/login", {"email": state["user_b"]["email"], "password": "pass1234"})
    assert r2.status_code == 200


def test_admin_change_password():
    new_pw = "newadminpass1"
    r = _post("/admin/change-password", {"current_password": ADMIN_PASSWORD, "new_password": new_pw}, token=state["admin_token"])
    assert r.status_code == 200
    # login with new
    r2 = _post("/auth/login", {"email": ADMIN_EMAIL, "password": new_pw})
    assert r2.status_code == 200
    # restore
    new_token = r2.json()["token"]
    r3 = _post("/admin/change-password", {"current_password": new_pw, "new_password": ADMIN_PASSWORD}, token=new_token)
    assert r3.status_code == 200


def test_admin_cannot_be_banned():
    r = _get("/admin/users", token=state["admin_token"])
    admin_user = next(u for u in r.json() if u["email"] == ADMIN_EMAIL)
    r2 = _post(f"/admin/users/{admin_user['id']}/ban", token=state["admin_token"])
    assert r2.status_code == 400
