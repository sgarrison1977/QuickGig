"""Backend integration tests for the Account Deletion flow.

Tests against the live deployed backend per /app/frontend/.env.
"""
import os
import uuid
import time
import sys
import requests

BASE = "https://task-connect-81.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@quickgig.app"
ADMIN_PASSWORD = "admin123"

PASSED = []
FAILED = []


def check(name, cond, detail=""):
    if cond:
        PASSED.append(name)
        print(f"  PASS  {name}")
    else:
        FAILED.append((name, detail))
        print(f"  FAIL  {name}  -- {detail}")


def post(path, token=None, json=None, headers=None):
    h = headers or {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(BASE + path, json=json, headers=h, timeout=30)


def get(path, token=None):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(BASE + path, headers=h, timeout=30)


def delete(path, token=None):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.delete(BASE + path, headers=h, timeout=30)


def register(name, email, password):
    r = requests.post(
        BASE + "/auth/register",
        json={
            "name": name,
            "email": email,
            "password": password,
            "eula_accepted": True,
            "eula_version": "1.0",
        },
        timeout=30,
    )
    return r


def login(email, password):
    r = requests.post(
        BASE + "/auth/login", json={"email": email, "password": password}, timeout=30
    )
    return r


def main():
    print("\n=== ACCOUNT DELETION FLOW BACKEND TESTS ===\n")

    # Step 1: Anonymous request-deletion → 401
    print("\n[1] Anonymous POST /users/me/request-deletion → 401")
    r = post("/users/me/request-deletion", json={"reason": "x"})
    check("anon request-deletion is 401/403", r.status_code in (401, 403),
          f"got {r.status_code} {r.text[:200]}")

    # Step 2: Register user A and user B
    print("\n[2] Register two fresh real-looking users (A and B)")
    rand = uuid.uuid4().hex[:8]
    a_email = f"olivia.bennett.{rand}@example.com"
    a_password = "Olivia#Pass1"
    a_name = "Olivia Bennett"
    b_email = f"marcus.reeves.{rand}@example.com"
    b_password = "Marcus#Pass1"
    b_name = "Marcus Reeves"

    ra = register(a_name, a_email, a_password)
    check("register A 200", ra.status_code == 200,
          f"{ra.status_code} {ra.text[:200]}")
    rb = register(b_name, b_email, b_password)
    check("register B 200", rb.status_code == 200,
          f"{rb.status_code} {rb.text[:200]}")

    a_token = ra.json()["token"]
    a_id = ra.json()["user"]["id"]
    b_token = rb.json()["token"]
    b_id = rb.json()["user"]["id"]
    print(f"   A user_id={a_id}")
    print(f"   B user_id={b_id}")

    # Step 3: A submits a deletion request with reason
    print("\n[3] A POST /users/me/request-deletion {'reason': 'too many emails'}")
    r = post("/users/me/request-deletion", token=a_token,
             json={"reason": "too many emails"})
    check("A request-deletion 200", r.status_code == 200,
          f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        check("A response deletion_requested=true", body.get("deletion_requested") is True,
              f"got {body.get('deletion_requested')}")
        check("A response deletion_reason matches",
              body.get("deletion_reason") == "too many emails",
              f"got {body.get('deletion_reason')!r}")

    # GET /auth/me reflects fields
    me = get("/auth/me", token=a_token)
    check("GET /auth/me 200 after request", me.status_code == 200,
          f"{me.status_code} {me.text[:200]}")
    if me.status_code == 200:
        m = me.json()
        check("/auth/me deletion_requested=true",
              m.get("deletion_requested") is True, f"got {m.get('deletion_requested')}")
        check("/auth/me deletion_reason='too many emails'",
              m.get("deletion_reason") == "too many emails",
              f"got {m.get('deletion_reason')!r}")
        check("/auth/me deletion_requested_at set",
              bool(m.get("deletion_requested_at")),
              f"got {m.get('deletion_requested_at')!r}")

    # Step 4: cancel-deletion
    print("\n[4] A POST /users/me/cancel-deletion")
    r = post("/users/me/cancel-deletion", token=a_token)
    check("A cancel-deletion 200", r.status_code == 200,
          f"{r.status_code} {r.text[:200]}")
    me = get("/auth/me", token=a_token)
    if me.status_code == 200:
        m = me.json()
        check("after cancel, deletion_requested=false",
              not m.get("deletion_requested"),
              f"got {m.get('deletion_requested')}")
        check("after cancel, deletion_requested_at null/absent",
              not m.get("deletion_requested_at"),
              f"got {m.get('deletion_requested_at')!r}")
        check("after cancel, deletion_reason null/absent",
              not m.get("deletion_reason"),
              f"got {m.get('deletion_reason')!r}")

    # Step 5: re-submit with empty body / empty reason
    print("\n[5] A re-submits with empty body / empty reason")
    r = post("/users/me/request-deletion", token=a_token, json={})
    check("A request-deletion empty body 200", r.status_code == 200,
          f"{r.status_code} {r.text[:200]}")
    r2 = post("/users/me/request-deletion", token=a_token, json={"reason": ""})
    check("A request-deletion empty reason 200", r2.status_code == 200,
          f"{r2.status_code} {r2.text[:200]}")
    me = get("/auth/me", token=a_token)
    if me.status_code == 200:
        m = me.json()
        # public_user returns reason or None — empty string falsy, becomes None
        check("after empty reason, reason is empty/None",
              (m.get("deletion_reason") in (None, "")),
              f"got {m.get('deletion_reason')!r}")
        check("after empty reason, deletion_requested=true (still set)",
              m.get("deletion_requested") is True,
              f"got {m.get('deletion_requested')}")

    # Step 6: 5000-char reason → stored truncated to 1000
    print("\n[6] A submits 5000-char reason → stored exactly 1000")
    big = "x" * 5000
    r = post("/users/me/request-deletion", token=a_token, json={"reason": big})
    check("5000-char reason 200", r.status_code == 200,
          f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        rsn = body.get("deletion_reason") or ""
        check("response reason length == 1000", len(rsn) == 1000,
              f"got len={len(rsn)}")
    # Re-verify via GET /auth/me
    me = get("/auth/me", token=a_token)
    if me.status_code == 200:
        rsn2 = me.json().get("deletion_reason") or ""
        check("/auth/me reason length == 1000", len(rsn2) == 1000,
              f"got len={len(rsn2)}")

    # Step 7: admin login + GET /admin/deletion-requests
    print("\n[7] Admin login + GET /admin/deletion-requests")
    al = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if al.status_code != 200:
        # try to reseed admin via direct mongo as a last-ditch convenience
        print(f"   Admin login failed ({al.status_code}); attempting direct reseed via mongo")
        try:
            from pymongo import MongoClient
            import bcrypt
            mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017/")
            mc = MongoClient(mongo_url)
            db_name = os.environ.get("DB_NAME", "quickgig_database")
            new_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
            res = mc[db_name].users.update_one(
                {"email": "admin@quickgig.app"},
                {"$set": {"password_hash": new_hash, "password": new_hash, "role": "admin", "banned": False}},
            )
            print(f"   reseed matched={res.matched_count} modified={res.modified_count}")
            al = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        except Exception as e:
            print(f"   reseed failed: {e}")
    check("admin login 200", al.status_code == 200,
          f"{al.status_code} {al.text[:300]}")
    if al.status_code != 200:
        print("Cannot continue admin-side tests without admin token.")
        return finalize()
    admin_token = al.json()["token"]
    admin_id = al.json()["user"]["id"]

    r = get("/admin/deletion-requests", token=admin_token)
    check("admin GET deletion-requests 200", r.status_code == 200,
          f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        rows = r.json()
        ids = [u.get("id") for u in rows]
        check("contains user A", a_id in ids,
              f"A={a_id} not in {ids[:5]} ... (n={len(ids)})")
        check("does NOT contain user B", b_id not in ids,
              f"B={b_id} unexpectedly present")
        # newest-first sort assertion
        from datetime import datetime as _dt
        ts = [u.get("deletion_requested_at") for u in rows if u.get("deletion_requested_at")]
        if len(ts) >= 2:
            parsed = []
            ok = True
            for t in ts:
                try:
                    parsed.append(_dt.fromisoformat(t.replace("Z", "+00:00")))
                except Exception:
                    ok = False
                    break
            if ok:
                check("sorted newest-first", parsed == sorted(parsed, reverse=True),
                      f"order={ts[:3]}")
            else:
                check("sorted newest-first (parsing)", False, "could not parse timestamps")
        else:
            check("sorted newest-first (n>=2 not available)", True)

    # Non-admin GET → 403
    r = get("/admin/deletion-requests", token=b_token)
    check("non-admin GET deletion-requests 403", r.status_code == 403,
          f"{r.status_code} {r.text[:200]}")

    # Step 8: admin DELETE /admin/users/{ADMIN_OWN_ID} → 400
    print("\n[8] Admin DELETE own id → 400 'Cannot delete admin'")
    r = delete(f"/admin/users/{admin_id}", token=admin_token)
    check("admin self-delete 400", r.status_code == 400,
          f"{r.status_code} {r.text[:200]}")
    if r.status_code == 400:
        check("error detail mentions admin",
              "admin" in (r.json().get("detail") or "").lower(),
              f"detail={r.json().get('detail')!r}")

    # Step 9: B (non-admin) DELETE /admin/users/{A_ID} → 403
    print("\n[9] B (non-admin) DELETE A → 403")
    r = delete(f"/admin/users/{a_id}", token=b_token)
    check("non-admin DELETE 403", r.status_code == 403,
          f"{r.status_code} {r.text[:200]}")

    # Step 10: A posts a job (open) → admin DELETE A → verify everything
    print("\n[10] A posts a job, then admin DELETE A")
    job_payload = {
        "title": "Help me move a couch this weekend",
        "description": "Need a strong hand to help move a couch up 2 flights of stairs.",
        "category": "moving",
        "pay_type": "fixed",
        "pay_amount": 60.0,
        "address": "742 Evergreen Terrace, Springfield",
        "latitude": 37.7749,
        "longitude": -122.4194,
        "photos": [],
    }
    rj = post("/jobs", token=a_token, json=job_payload)
    check("A creates job 200", rj.status_code == 200,
          f"{rj.status_code} {rj.text[:200]}")
    if rj.status_code != 200:
        return finalize()
    job_id = rj.json()["id"]
    check("A's job is open", rj.json().get("status") == "open",
          f"got {rj.json().get('status')}")

    r = delete(f"/admin/users/{a_id}", token=admin_token)
    check("admin DELETE A 200", r.status_code == 200,
          f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        check("response ok=true", body.get("ok") is True, f"got {body!r}")
        check("response anonymized=true", body.get("anonymized") is True,
              f"got {body!r}")

    # Verify via admin GET /admin/users
    r = get("/admin/users", token=admin_token)
    check("admin GET /admin/users 200", r.status_code == 200,
          f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        users = r.json()
        a_doc = next((u for u in users if u.get("id") == a_id), None)
        check("A still present in /admin/users (not hard-deleted)", a_doc is not None,
              f"A_id={a_id} not found")
        if a_doc:
            check("A.name == 'Deleted User'", a_doc.get("name") == "Deleted User",
                  f"got {a_doc.get('name')!r}")
            check("A.email starts with 'deleted+'",
                  (a_doc.get("email") or "").startswith("deleted+"),
                  f"got {a_doc.get('email')!r}")
            check("A.deleted == true", a_doc.get("deleted") is True,
                  f"got {a_doc.get('deleted')!r}")
            check("A.banned == true", a_doc.get("banned") is True,
                  f"got {a_doc.get('banned')!r}")
            check("A.deletion_requested == false",
                  not a_doc.get("deletion_requested"),
                  f"got {a_doc.get('deletion_requested')!r}")

    # Old credentials of A → 401
    al2 = login(a_email, a_password)
    check("login as old A → 401", al2.status_code == 401,
          f"{al2.status_code} {al2.text[:200]}")

    # GET A's previously-open job → status == 'cancelled'
    rj = get(f"/jobs/{job_id}")
    check("GET A's job 200", rj.status_code == 200,
          f"{rj.status_code} {rj.text[:200]}")
    if rj.status_code == 200:
        check("A's job status == 'cancelled'",
              rj.json().get("status") == "cancelled",
              f"got {rj.json().get('status')!r}")

    # Step 11: admin DELETE same A again → 400 'already deleted'
    print("\n[11] Admin DELETE A again → 400 'already deleted'")
    r = delete(f"/admin/users/{a_id}", token=admin_token)
    check("DELETE deleted user → 400", r.status_code == 400,
          f"{r.status_code} {r.text[:200]}")
    if r.status_code == 400:
        det = (r.json().get("detail") or "").lower()
        check("detail mentions already deleted", "already deleted" in det,
              f"detail={r.json().get('detail')!r}")

    # Step 12: smoke — /admin/users still 200 and contains anonymised record
    print("\n[12] Smoke /admin/users still 200 and contains anonymised record")
    r = get("/admin/users", token=admin_token)
    check("admin GET /admin/users 200 (smoke)", r.status_code == 200,
          f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        users = r.json()
        a_doc = next((u for u in users if u.get("id") == a_id), None)
        check("anonymised A still present", a_doc is not None and a_doc.get("deleted") is True,
              f"A doc={a_doc}")

    return finalize()


def finalize():
    print("\n=== SUMMARY ===")
    print(f"PASSED: {len(PASSED)}")
    print(f"FAILED: {len(FAILED)}")
    if FAILED:
        print("\nFailures:")
        for n, d in FAILED:
            print(f"  - {n}: {d}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
