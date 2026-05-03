"""Backend test for updated job lifecycle:
- POST /api/jobs/{id}/complete → POSTER-ONLY
- NEW POST /api/jobs/{id}/withdraw → WORKER-ONLY
- POST /api/reviews now allows abandonment-pair reviews
- GET /api/jobs/{id} includes abandonments[]
"""
import os
import sys
import time
import uuid
import random
import string
import httpx
from pymongo import MongoClient

BASE = "https://task-connect-81.preview.emergentagent.com/api"
MONGO = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB = os.environ.get("DB_NAME", "quickgig_database")

mc = MongoClient(MONGO)
db = mc[DB]

PASS = 0
FAIL = 0
FAILURES = []


def check(cond, label, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS: {label}")
    else:
        FAIL += 1
        FAILURES.append(f"{label} :: {extra}")
        print(f"  FAIL: {label} :: {extra}")


def rand_suffix(n=6):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def register(name_first, name_last):
    suffix = rand_suffix()
    email = f"{name_first.lower()}.{name_last.lower()}.{suffix}@example.com"
    payload = {
        "email": email,
        "password": "Passw0rd!2026",
        "name": f"{name_first} {name_last}",
        "phone": "+15551234567",
        "eula_accepted": True,
        "eula_version": "1.0",
    }
    r = httpx.post(f"{BASE}/auth/register", json=payload, timeout=30)
    r.raise_for_status()
    data = r.json()
    return data["token"], data["user"], email


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def verify_user(user_id):
    """Mark user is_verified=True directly via DB so they can post/accept jobs."""
    db.users.update_one({"id": user_id}, {"$set": {"is_verified": True}})


def main():
    print("=" * 70)
    print("JOB LIFECYCLE / WITHDRAW / REVIEW TESTS")
    print(f"BASE: {BASE}")
    print("=" * 70)

    # a. Register users
    print("\n--- a. Register userP, userW, userW2 ---")
    pToken, pUser, pEmail = register("Olivia", "Bennett")
    wToken, wUser, wEmail = register("Marcus", "Reeves")
    w2Token, w2User, w2Email = register("Liam", "Foster")
    print(f"  poster:  {pUser['id']}  ({pEmail})")
    print(f"  worker:  {wUser['id']}  ({wEmail})")
    print(f"  worker2: {w2User['id']}  ({w2Email})")

    verify_user(pUser["id"])
    verify_user(wUser["id"])
    verify_user(w2User["id"])
    check(True, "registered + verified 3 users")

    # b. userP creates a job
    print("\n--- b. userP creates a job ---")
    job_payload = {
        "title": "Help move couch from garage",
        "description": "Need 1 strong helper for ~30 min.",
        "category": "moving",
        "pay_type": "fixed",
        "pay_amount": 40.0,
        "address": "742 Evergreen Terrace, Springfield",
        "latitude": 37.7749,
        "longitude": -122.4194,
        "photos": [],
    }
    r = httpx.post(f"{BASE}/jobs", json=job_payload, headers=auth(pToken), timeout=30)
    check(r.status_code == 200, "create job 200", f"got {r.status_code} body={r.text[:200]}")
    if r.status_code != 200:
        print("Cannot continue without job"); sys.exit(1)
    job = r.json()
    job_id = job["id"]
    check(job["status"] == "open", "new job status=open", f"got {job['status']}")
    check(isinstance(job.get("abandonments"), list), "abandonments key present", f"got {job.get('abandonments')}")
    check(len(job["abandonments"]) == 0, "abandonments empty initially", f"got {job['abandonments']}")

    # c. userW accepts
    print("\n--- c. userW accepts job ---")
    r = httpx.post(f"{BASE}/jobs/{job_id}/accept", headers=auth(wToken), timeout=30)
    check(r.status_code == 200, "worker accepts 200", f"got {r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        check(body["status"] == "accepted", "status=accepted", f"got {body['status']}")
        check(body.get("worker_id") == wUser["id"], "worker_id == userW", f"got {body.get('worker_id')}")

    # d. userW calls /complete -> 403 (poster-only)
    print("\n--- d. userW calls /complete (should 403) ---")
    r = httpx.post(f"{BASE}/jobs/{job_id}/complete", headers=auth(wToken), timeout=30)
    check(r.status_code == 403, "worker /complete -> 403", f"got {r.status_code} body={r.text[:200]}")
    if r.status_code == 403:
        try:
            detail = r.json().get("detail")
        except Exception:
            detail = ""
        check(
            detail == "Only the job poster can mark this job complete.",
            "403 detail is exact",
            f"got {detail!r}",
        )

    # e. userW calls /withdraw -> 200
    print("\n--- e. userW calls /withdraw (should 200) ---")
    r = httpx.post(f"{BASE}/jobs/{job_id}/withdraw", headers=auth(wToken), timeout=30)
    check(r.status_code == 200, "worker /withdraw -> 200", f"got {r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        check(body["status"] == "open", "withdraw -> status=open", f"got {body['status']}")
        check(body.get("worker_id") is None, "withdraw -> worker_id=null", f"got {body.get('worker_id')}")
        check(body.get("accepted_at") is None, "withdraw -> accepted_at=null", f"got {body.get('accepted_at')}")
        ab = body.get("abandonments") or []
        check(len(ab) == 1, "abandonments length=1 after withdraw", f"got {len(ab)} -> {ab}")
        if ab:
            check(ab[0].get("worker_id") == wUser["id"], "abandonments[0].worker_id == userW", f"got {ab[0].get('worker_id')}")
            check(ab[0].get("worker_name") == wUser["name"], "abandonments[0].worker_name == userW.name", f"got {ab[0].get('worker_name')!r}")
            check(bool(ab[0].get("withdrew_at")), "abandonments[0].withdrew_at present", f"got {ab[0].get('withdrew_at')!r}")

    # Edge: userW2 (not the worker) trying to withdraw should be 403/400. But there's no worker now.
    # The job is back to open; withdraw should 400 (status not accepted)
    print("\n--- e2. /withdraw on open job by w2 -> 400 ---")
    r = httpx.post(f"{BASE}/jobs/{job_id}/withdraw", headers=auth(w2Token), timeout=30)
    check(r.status_code in (400, 403), "withdraw on open job -> 400 or 403", f"got {r.status_code} body={r.text[:200]}")
    # Specifically: since worker_id is None, the 403 check (worker_id != user) triggers first
    # The detail should be the 403 "Only the worker..."
    if r.status_code == 403:
        try:
            detail = r.json().get("detail")
        except Exception:
            detail = ""
        check("Only the worker who accepted" in (detail or ""), "non-worker withdraw 403 detail correct", f"got {detail!r}")

    # f. userW2 accepts
    print("\n--- f. userW2 accepts ---")
    r = httpx.post(f"{BASE}/jobs/{job_id}/accept", headers=auth(w2Token), timeout=30)
    check(r.status_code == 200, "userW2 accepts 200", f"got {r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        check(body["status"] == "accepted", "status=accepted again", f"got {body['status']}")
        check(body.get("worker_id") == w2User["id"], "worker_id == userW2", f"got {body.get('worker_id')}")

    # Non-worker (userW) trying to withdraw now -> 403
    print("\n--- f2. non-worker (userW) /withdraw -> 403 ---")
    r = httpx.post(f"{BASE}/jobs/{job_id}/withdraw", headers=auth(wToken), timeout=30)
    check(r.status_code == 403, "non-worker /withdraw -> 403", f"got {r.status_code} body={r.text[:200]}")
    if r.status_code == 403:
        try:
            detail = r.json().get("detail")
        except Exception:
            detail = ""
        check(
            detail == "Only the worker who accepted this job can withdraw.",
            "403 withdraw detail exact",
            f"got {detail!r}",
        )

    # g. userP /complete -> 200
    print("\n--- g. userP /complete (should 200) ---")
    r = httpx.post(f"{BASE}/jobs/{job_id}/complete", headers=auth(pToken), timeout=30)
    check(r.status_code == 200, "poster /complete -> 200", f"got {r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        check(body["status"] == "completed", "status=completed", f"got {body['status']}")
        check(body.get("worker_id") == w2User["id"], "worker_id remains userW2", f"got {body.get('worker_id')}")

    # /complete on non-accepted job -> 400
    print("\n--- g2. /complete again -> 400 ---")
    r = httpx.post(f"{BASE}/jobs/{job_id}/complete", headers=auth(pToken), timeout=30)
    check(r.status_code == 400, "/complete on completed job -> 400", f"got {r.status_code} body={r.text[:200]}")

    # /withdraw on completed job by w2 -> 400
    print("\n--- g3. w2 /withdraw on completed job -> 400 ---")
    r = httpx.post(f"{BASE}/jobs/{job_id}/withdraw", headers=auth(w2Token), timeout=30)
    check(r.status_code == 400, "/withdraw on completed -> 400", f"got {r.status_code} body={r.text[:200]}")
    if r.status_code == 400:
        try:
            detail = r.json().get("detail")
        except Exception:
            detail = ""
        check(
            detail == "Can only withdraw from a job that's in progress.",
            "400 withdraw detail exact",
            f"got {detail!r}",
        )

    # h. userP review of userW2 (current worker) -> 200
    print("\n--- h. userP reviews userW2 (current worker) -> 200 ---")
    r = httpx.post(
        f"{BASE}/reviews",
        json={"job_id": job_id, "reviewee_id": w2User["id"], "rating": 5, "comment": "Excellent!"},
        headers=auth(pToken),
        timeout=30,
    )
    check(r.status_code == 200, "poster reviews current worker -> 200", f"got {r.status_code} body={r.text[:200]}")

    # i. userP reviews userW (abandoned worker) on same job -> 200
    print("\n--- i. userP reviews userW (abandoned) -> 200 ---")
    r = httpx.post(
        f"{BASE}/reviews",
        json={"job_id": job_id, "reviewee_id": wUser["id"], "rating": 1, "comment": "Bailed on me."},
        headers=auth(pToken),
        timeout=30,
    )
    check(r.status_code == 200, "poster reviews abandoned worker -> 200", f"got {r.status_code} body={r.text[:200]}")

    # j. userW (abandoner) reviews poster -> 200
    print("\n--- j. userW (abandoner) reviews poster -> 200 ---")
    r = httpx.post(
        f"{BASE}/reviews",
        json={"job_id": job_id, "reviewee_id": pUser["id"], "rating": 4, "comment": "Communication ok."},
        headers=auth(wToken),
        timeout=30,
    )
    check(r.status_code == 200, "abandoned worker reviews poster -> 200", f"got {r.status_code} body={r.text[:200]}")

    # k. userW reviews poster AGAIN -> 400
    print("\n--- k. userW reviews poster AGAIN -> 400 ---")
    r = httpx.post(
        f"{BASE}/reviews",
        json={"job_id": job_id, "reviewee_id": pUser["id"], "rating": 4, "comment": "second"},
        headers=auth(wToken),
        timeout=30,
    )
    check(r.status_code == 400, "duplicate review -> 400", f"got {r.status_code} body={r.text[:200]}")
    if r.status_code == 400:
        try:
            detail = r.json().get("detail")
        except Exception:
            detail = ""
        check(
            detail == "You already reviewed this person for this job",
            "400 dup detail exact",
            f"got {detail!r}",
        )

    # l. GET /jobs/{id} -> abandonments[] present
    print("\n--- l. GET /jobs/{id} -> abandonments present ---")
    r = httpx.get(f"{BASE}/jobs/{job_id}", timeout=30)
    check(r.status_code == 200, "GET /jobs/{id} -> 200", f"got {r.status_code}")
    if r.status_code == 200:
        body = r.json()
        ab = body.get("abandonments") or []
        check(isinstance(ab, list), "abandonments is list", f"got {type(ab)}")
        check(len(ab) == 1, "abandonments length 1", f"got {len(ab)}")
        if ab:
            check(ab[0].get("worker_id") == wUser["id"], "abandonments[0].worker_id == userW", f"got {ab[0].get('worker_id')}")
            check(ab[0].get("worker_name") == wUser["name"], "abandonments[0].worker_name == userW.name", f"got {ab[0].get('worker_name')!r}")
            check(bool(ab[0].get("withdrew_at")), "abandonments[0].withdrew_at present", f"got {ab[0].get('withdrew_at')}")

    # Regression checks
    print("\n--- REGRESSION: admin login + /jobs filter ---")
    r = httpx.post(
        f"{BASE}/auth/login",
        json={"email": "admin@quickgig.app", "password": "admin123"},
        timeout=30,
    )
    check(r.status_code == 200, "admin login -> 200", f"got {r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        check(body["user"]["role"] == "admin", "admin role=admin", f"got {body['user'].get('role')}")

    r = httpx.get(f"{BASE}/jobs?category=all&status=open&sort=best", timeout=30)
    check(r.status_code == 200, "/jobs?category=all&status=open&sort=best -> 200", f"got {r.status_code}")
    if r.status_code == 200:
        jobs_list = r.json()
        check(isinstance(jobs_list, list), "jobs listing is array", f"got {type(jobs_list)}")
        # Verify all jobs include abandonments key
        all_have_ab = all("abandonments" in j and isinstance(j["abandonments"], list) for j in jobs_list)
        check(all_have_ab, "all jobs include abandonments[] (regression)", f"jobs count={len(jobs_list)}")

    # Negative: non-existent job withdraw -> 404
    print("\n--- negative: /withdraw on non-existent job -> 404 ---")
    r = httpx.post(f"{BASE}/jobs/{uuid.uuid4()}/withdraw", headers=auth(wToken), timeout=30)
    check(r.status_code == 404, "/withdraw nonexistent -> 404", f"got {r.status_code}")

    print("\n" + "=" * 70)
    print(f"RESULT: {PASS} PASSED / {FAIL} FAILED")
    if FAILURES:
        print("\nFAILURES:")
        for f in FAILURES:
            print(f"  - {f}")
    print("=" * 70)
    return FAIL


if __name__ == "__main__":
    sys.exit(main())
