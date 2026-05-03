"""
Backend test harness for the new Stripe Checkout integration.

Focus: /api/billing/checkout, /api/billing/checkout/status/{id}, /api/webhook/stripe.
We intentionally DO NOT drive the hosted Stripe checkout with a real card —
just verify endpoint behaviour, auth, validation, security (price manipulation
ignored), idempotency, webhook signature validation, and that the
`payment_transactions` collection is populated correctly.
"""

import os
import sys
import time
import json
import base64
import random
import string
import traceback

import httpx
from pymongo import MongoClient

BACKEND_URL = "https://task-connect-81.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "quickgig_database")

mc = MongoClient(MONGO_URL)
db = mc[DB_NAME]

RESULTS = []


def rec(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    flag = "PASS" if ok else "FAIL"
    print(f"[{flag}] {name}  {detail}")


def rand_suffix(n=6):
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def register(name_base, email_base):
    suf = rand_suffix()
    email = f"{email_base}.{suf}@example.com"
    pw = "Passw0rd!" + suf
    r = httpx.post(f"{API}/auth/register",
                   json={"email": email, "password": pw,
                         "name": f"{name_base} {suf.title()}",
                         "phone": "+14155550" + suf[:3]},
                   timeout=20)
    r.raise_for_status()
    data = r.json()
    return data["token"], data["user"], email, pw


def verify_user(token):
    tiny_b64 = base64.b64encode(b"fake-id-document").decode()
    r = httpx.post(f"{API}/auth/verify-id",
                   headers={"Authorization": f"Bearer {token}"},
                   json={"id_document": tiny_b64},
                   timeout=15)
    r.raise_for_status()
    return r.json()


def create_job(token, title="Paint the fence"):
    r = httpx.post(
        f"{API}/jobs",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": title,
            "description": "Weekend paint job",
            "category": "home",
            "pay_type": "hourly",
            "pay_amount": 25.0,
            "address": "500 Market St, San Francisco, CA",
            "latitude": 37.7897,
            "longitude": -122.3972,
            "photos": [],
        },
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ----------- Tests -------------

def test_auth_required():
    r1 = httpx.post(f"{API}/billing/checkout",
                    json={"package_id": "pro_monthly",
                          "origin_url": "https://example.com"},
                    timeout=15)
    ok1 = r1.status_code in (401, 403)
    rec("T1a auth required on POST /billing/checkout",
        ok1, f"status={r1.status_code}")

    r2 = httpx.get(f"{API}/billing/checkout/status/fakesession", timeout=15)
    ok2 = r2.status_code in (401, 403)
    rec("T1b auth required on GET /billing/checkout/status/{id}",
        ok2, f"status={r2.status_code}")


def test_price_manipulation_ignored(token):
    malicious_body = {
        "package_id": "pro_monthly",
        "origin_url": "https://example.com",
        "amount": 0.01,
        "price": 1,
        "currency": "eur",
    }
    r = httpx.post(f"{API}/billing/checkout",
                   headers=auth_headers(token),
                   json=malicious_body, timeout=30)
    if r.status_code != 200:
        rec("T2 price manipulation — checkout create", False,
            f"status={r.status_code} body={r.text[:200]}")
        return None
    data = r.json()
    sid = data.get("session_id")
    txn = db.payment_transactions.find_one({"session_id": sid})
    ok = (txn is not None
          and abs(float(txn.get("amount", 0)) - 4.99) < 0.001
          and txn.get("currency") == "usd"
          and txn.get("package_id") == "pro_monthly")
    detail = (f"session={sid} txn.amount={txn.get('amount') if txn else None} "
              f"txn.currency={txn.get('currency') if txn else None}")
    rec("T2 price manipulation ignored — server uses catalog $4.99 USD",
        ok, detail)
    return sid


def test_invalid_package_id(token):
    r = httpx.post(f"{API}/billing/checkout",
                   headers=auth_headers(token),
                   json={"package_id": "pro_yearly_hacker",
                         "origin_url": "https://example.com"},
                   timeout=15)
    ok = r.status_code in (400, 422)
    rec("T3 invalid package_id rejected",
        ok, f"status={r.status_code}")


def test_missing_origin_url(token):
    r = httpx.post(f"{API}/billing/checkout",
                   headers=auth_headers(token),
                   json={"package_id": "pro_monthly"},
                   timeout=15)
    ok = r.status_code in (400, 422)
    rec("T4a missing origin_url rejected",
        ok, f"status={r.status_code}")

    r2 = httpx.post(f"{API}/billing/checkout",
                    headers=auth_headers(token),
                    json={"package_id": "pro_monthly", "origin_url": ""},
                    timeout=15)
    ok2 = r2.status_code in (400, 422)
    rec("T4b empty origin_url rejected",
        ok2, f"status={r2.status_code}")


def test_boost_ownership(token_owner, other_token):
    job = create_job(other_token, title="Other user's job")
    r = httpx.post(f"{API}/billing/checkout",
                   headers=auth_headers(token_owner),
                   json={"package_id": "boost_24h",
                         "origin_url": "https://example.com",
                         "job_id": job["id"]},
                   timeout=15)
    ok = r.status_code == 403
    rec("T5 boost of another user's job → 403",
        ok, f"status={r.status_code} detail={r.text[:150]}")


def test_boost_missing_job_id(token):
    r = httpx.post(f"{API}/billing/checkout",
                   headers=auth_headers(token),
                   json={"package_id": "boost_24h",
                         "origin_url": "https://example.com"},
                   timeout=15)
    ok = r.status_code == 400
    rec("T6 boost_24h without job_id → 400",
        ok, f"status={r.status_code} detail={r.text[:150]}")


def test_successful_create(token):
    r = httpx.post(f"{API}/billing/checkout",
                   headers=auth_headers(token),
                   json={"package_id": "background_check",
                         "origin_url": "https://task-connect-81.preview.emergentagent.com"},
                   timeout=30)
    if r.status_code != 200:
        rec("T7 successful create", False,
            f"status={r.status_code} body={r.text[:200]}")
        return None
    data = r.json()
    url = data.get("url") or ""
    sid = data.get("session_id")
    ok_url = ("stripe" in url.lower()) and bool(sid)
    rec("T7a response shape — url contains 'stripe' + session_id",
        ok_url,
        f"url_prefix={url[:80]} session_id={sid}")

    txn = db.payment_transactions.find_one({"session_id": sid})
    ok_db = (txn is not None
             and txn.get("status") == "initiated"
             and txn.get("credited") is False
             and txn.get("package_id") == "background_check"
             and abs(float(txn.get("amount", 0)) - 10.00) < 0.001
             and txn.get("currency") == "usd")
    detail = (f"txn={ {k: txn.get(k) for k in ('status','credited','amount','currency','package_id')} if txn else None}")
    rec("T7b payment_transactions row status=initiated, credited=false",
        ok_db, detail)
    return sid


def test_polling_idempotency(token, session_id):
    statuses = []
    errors = []
    for i in range(5):
        try:
            r = httpx.get(f"{API}/billing/checkout/status/{session_id}",
                          headers=auth_headers(token), timeout=30)
            statuses.append(r.status_code)
            if r.status_code == 200:
                j = r.json()
                if j.get("payment_status") != "unpaid":
                    errors.append(f"poll{i} payment_status={j.get('payment_status')}")
                if j.get("credited") is True:
                    errors.append(f"poll{i} credited prematurely")
            else:
                errors.append(f"poll{i} status={r.status_code} body={r.text[:100]}")
        except Exception as e:
            errors.append(f"poll{i} exc={e}")
        time.sleep(0.3)

    count = db.payment_transactions.count_documents({"session_id": session_id})
    txn = db.payment_transactions.find_one({"session_id": session_id})
    ok = (all(s == 200 for s in statuses)
          and not errors
          and count == 1
          and txn
          and txn.get("credited") is False)
    rec("T8 polling 5x idempotent (200 unpaid, 1 DB row, no double-credit)",
        ok,
        f"statuses={statuses} count={count} credited={txn.get('credited') if txn else None} "
        f"errors={errors[:2]}")


def test_webhook_invalid_signature():
    body = json.dumps({"type": "checkout.session.completed",
                       "data": {"object": {"id": "cs_test_fake"}}}).encode()
    r1 = httpx.post(f"{API}/webhook/stripe", content=body,
                    headers={"content-type": "application/json"},
                    timeout=15)
    rec("T9a webhook without Stripe-Signature → 400",
        r1.status_code == 400, f"status={r1.status_code}")

    r2 = httpx.post(f"{API}/webhook/stripe", content=body,
                    headers={"content-type": "application/json",
                             "Stripe-Signature": "t=12345,v1=deadbeef"},
                    timeout=15)
    rec("T9b webhook with bogus Stripe-Signature → 400",
        r2.status_code == 400, f"status={r2.status_code}")


def test_mock_endpoints_still_work(token_verified):
    r1 = httpx.post(f"{API}/billing/subscribe-pro",
                    headers=auth_headers(token_verified), timeout=15)
    ok1 = r1.status_code == 200 and r1.json().get("is_pro") is True
    rec("T10a mock /billing/subscribe-pro still works",
        ok1, f"status={r1.status_code}")

    r2 = httpx.post(f"{API}/billing/background-check",
                    headers=auth_headers(token_verified), timeout=15)
    ok2 = r2.status_code == 200 and r2.json().get("has_background_check") is True
    rec("T10b mock /billing/background-check still works",
        ok2, f"status={r2.status_code}")

    job = create_job(token_verified, title="Boost me")
    r3 = httpx.post(f"{API}/billing/boost-post",
                    headers=auth_headers(token_verified),
                    json={"job_id": job["id"], "plan": "24h"},
                    timeout=15)
    ok3 = r3.status_code == 200 and r3.json().get("is_boosted") is True
    rec("T10c mock /billing/boost-post still works",
        ok3, f"status={r3.status_code}")


def main():
    print("========== Stripe Checkout backend tests ==========")
    print(f"API = {API}")
    print(f"MONGO = {MONGO_URL} DB = {DB_NAME}\n")

    test_auth_required()

    try:
        tokenA, userA, emailA, _pwA = register("Emma Rodriguez", "emma.rodriguez")
        verify_user(tokenA)
        tokenB, userB, emailB, _pwB = register("Liam Thompson", "liam.thompson")
        verify_user(tokenB)
        print(f"  Registered & verified: {emailA} / {emailB}\n")
    except Exception as e:
        rec("SETUP register two users", False, str(e))
        print_summary()
        return

    test_price_manipulation_ignored(tokenA)
    test_invalid_package_id(tokenA)
    test_missing_origin_url(tokenA)
    test_boost_ownership(tokenA, tokenB)
    test_boost_missing_job_id(tokenA)
    sid_b = test_successful_create(tokenA)

    if sid_b:
        test_polling_idempotency(tokenA, sid_b)
    else:
        rec("T8 polling idempotency SKIPPED", False, "T7 failed to create session")

    test_webhook_invalid_signature()
    test_mock_endpoints_still_work(tokenB)
    print_summary()


def print_summary():
    total = len(RESULTS)
    passed = sum(1 for _, ok, _ in RESULTS if ok)
    failed = total - passed
    print("\n========== SUMMARY ==========")
    print(f"Passed: {passed}/{total}")
    if failed:
        print("Failures:")
        for name, ok, detail in RESULTS:
            if not ok:
                print(f"  X {name}  {detail}")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        traceback.print_exc()
        print_summary()
