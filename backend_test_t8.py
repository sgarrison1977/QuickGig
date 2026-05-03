"""
T8 retest — GET /api/billing/checkout/status/{session_id}

Verifies:
  1. POST /api/billing/checkout creates a real session (200 + url + session_id)
  2. GET /api/billing/checkout/status/{session_id} returns 200 on first poll
     with expected shape.
  3. Polling 5 more times stays 200; payment_status="unpaid";
     credited stays False; no duplicate DB writes.
  4. Webhook with invalid signature still returns 400.
"""
import os
import sys
import time
import uuid
import json
import httpx
from pymongo import MongoClient

# Backend URL (public via ingress)
BASE_URL = "https://task-connect-81.preview.emergentagent.com/api"

# Direct Mongo for verification
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "quickgig_database")
mc = MongoClient(MONGO_URL)
db = mc[DB_NAME]

PASSED = 0
FAILED = 0
FAILS = []


def ok(label):
    global PASSED
    PASSED += 1
    print(f"  PASS  {label}")


def bad(label, detail=""):
    global FAILED
    FAILED += 1
    FAILS.append(f"{label} — {detail}")
    print(f"  FAIL  {label}  {detail}")


def register_user():
    suffix = uuid.uuid4().hex[:8]
    email = f"noah.patel.{suffix}@example.com"
    password = "Str0ng#Pass!2026"
    r = httpx.post(
        f"{BASE_URL}/auth/register",
        json={"email": email, "password": password, "name": f"Noah Patel {suffix[:4]}", "phone": ""},
        timeout=30,
    )
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    tok = r.json()["token"]
    uid = r.json()["user"]["id"]
    return email, password, tok, uid


def main():
    print("T8 RETEST — GET /api/billing/checkout/status/{session_id}")
    print(f"Backend: {BASE_URL}\n")

    # --- Step 1: setup user ---
    email, pw, token, user_id = register_user()
    print(f"User: {email}  id={user_id}")
    headers = {"Authorization": f"Bearer {token}"}

    # --- Step 2: create a checkout session (any package) ---
    # Use pro_monthly to avoid needing a job_id
    origin_url = "https://task-connect-81.preview.emergentagent.com"
    r = httpx.post(
        f"{BASE_URL}/billing/checkout",
        headers=headers,
        json={"package_id": "pro_monthly", "origin_url": origin_url},
        timeout=60,
    )
    if r.status_code != 200:
        bad("Create checkout session", f"status={r.status_code} body={r.text[:400]}")
        print("\nCannot continue without a session.")
        sys.exit(1)

    body = r.json()
    session_id = body.get("session_id")
    checkout_url = body.get("url", "")
    if not session_id:
        bad("Create checkout returns session_id", f"body={body}")
        sys.exit(1)
    if "stripe" not in checkout_url.lower():
        bad("Checkout URL contains 'stripe'", f"url={checkout_url}")
    else:
        ok("POST /api/billing/checkout -> 200 with stripe URL + session_id")
    print(f"  session_id={session_id}")

    # Wait a small moment — Stripe sometimes needs a heartbeat before retrieve works
    time.sleep(0.5)

    # --- Step 3: first status poll ---
    r1 = httpx.get(
        f"{BASE_URL}/billing/checkout/status/{session_id}",
        headers=headers,
        timeout=30,
    )
    print(f"  Poll #1 status_code={r1.status_code}")
    if r1.status_code != 200:
        bad("First poll returns 200", f"status={r1.status_code} body={r1.text[:400]}")
    else:
        ok("First poll GET status/{session_id} -> 200 (no 500)")
        data1 = r1.json()
        # Verify expected shape
        required_keys = {"session_id", "status", "payment_status", "amount_total", "currency", "credited"}
        missing = required_keys - set(data1.keys())
        if missing:
            bad("Response shape includes all required keys", f"missing={missing}; got={list(data1.keys())}")
        else:
            ok("Response shape has session_id/status/payment_status/amount_total/currency/credited")
        # session_id matches
        if data1.get("session_id") != session_id:
            bad("session_id echoed matches", f"got={data1.get('session_id')}")
        else:
            ok("session_id echoed in response matches requested id")
        # payment_status should be unpaid (nobody has paid)
        if data1.get("payment_status") != "unpaid":
            bad("payment_status=='unpaid' on fresh session", f"got={data1.get('payment_status')}")
        else:
            ok("payment_status == 'unpaid' on fresh unpaid session")
        # credited must be False (no payment completed)
        if data1.get("credited") is not False:
            bad("credited == False on fresh session", f"got={data1.get('credited')}")
        else:
            ok("credited == False on fresh unpaid session")
        # currency sanity
        if str(data1.get("currency", "")).lower() != "usd":
            bad("currency == 'usd'", f"got={data1.get('currency')}")
        else:
            ok("currency == 'usd'")

    # --- Step 4: capture DB state BEFORE 5 more polls ---
    txn_before = db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn_before:
        bad("payment_transactions row exists", "not found in Mongo")
        sys.exit(1)
    else:
        ok(f"payment_transactions row exists (status={txn_before.get('status')}, credited={txn_before.get('credited')})")

    # Count how many payment_transactions docs exist for this session (should be exactly 1)
    count_before = db.payment_transactions.count_documents({"session_id": session_id})
    if count_before != 1:
        bad("Exactly 1 payment_transactions row for session", f"count={count_before}")
    else:
        ok("Exactly 1 payment_transactions row before additional polls")
    credited_before = bool(txn_before.get("credited", False))
    pro_before = bool((db.users.find_one({"id": user_id}, {"_id": 0, "is_pro": 1}) or {}).get("is_pro", False))

    # --- Step 5: poll 5 more times ---
    statuses = []
    payment_statuses = []
    credited_values = []
    for i in range(5):
        rr = httpx.get(
            f"{BASE_URL}/billing/checkout/status/{session_id}",
            headers=headers,
            timeout=30,
        )
        statuses.append(rr.status_code)
        if rr.status_code == 200:
            j = rr.json()
            payment_statuses.append(j.get("payment_status"))
            credited_values.append(j.get("credited"))
        else:
            payment_statuses.append(None)
            credited_values.append(None)
        time.sleep(0.2)
    print(f"  Polls #2-6 status codes: {statuses}")
    print(f"  Polls #2-6 payment_status: {payment_statuses}")
    print(f"  Polls #2-6 credited: {credited_values}")

    if all(s == 200 for s in statuses):
        ok("All 5 subsequent polls returned 200 (no 500s)")
    else:
        bad("All 5 subsequent polls return 200", f"codes={statuses}")

    if all(ps == "unpaid" for ps in payment_statuses):
        ok("All subsequent polls report payment_status='unpaid'")
    else:
        bad("All subsequent polls have payment_status='unpaid'", f"got={payment_statuses}")

    if all(c is False for c in credited_values):
        ok("credited stays False across all polls (no premature credit)")
    else:
        bad("credited stays False across all polls", f"got={credited_values}")

    # --- Step 6: verify no duplicate DB writes ---
    count_after = db.payment_transactions.count_documents({"session_id": session_id})
    if count_after == 1:
        ok("Still exactly 1 payment_transactions row after 6 polls (no duplicates)")
    else:
        bad("No duplicate payment_transactions rows", f"count_before={count_before} count_after={count_after}")

    txn_after = db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if bool(txn_after.get("credited", False)) == credited_before == False:
        ok("payment_transactions.credited remains False in DB")
    else:
        bad("payment_transactions.credited remains False", f"before={credited_before} after={txn_after.get('credited')}")

    pro_after = bool((db.users.find_one({"id": user_id}, {"_id": 0, "is_pro": 1}) or {}).get("is_pro", False))
    if pro_before is False and pro_after is False:
        ok("User.is_pro still False (no premature crediting)")
    else:
        bad("User.is_pro should remain False", f"before={pro_before} after={pro_after}")

    # --- Step 7: webhook with invalid signature still returns 400 ---
    r = httpx.post(
        f"{BASE_URL}/webhook/stripe",
        headers={"Stripe-Signature": "t=123,v1=bogus"},
        content=b'{"id":"evt_bogus","type":"checkout.session.completed","data":{"object":{"id":"cs_test_x"}}}',
        timeout=30,
    )
    if r.status_code == 400:
        ok("Webhook with invalid signature -> 400")
    else:
        bad("Webhook with invalid signature -> 400", f"got={r.status_code} body={r.text[:200]}")

    # --- Step 8: webhook with NO signature header -> 400 (sanity) ---
    r = httpx.post(
        f"{BASE_URL}/webhook/stripe",
        content=b'{"id":"evt_x"}',
        timeout=30,
    )
    if r.status_code == 400:
        ok("Webhook with NO Stripe-Signature -> 400 (sanity)")
    else:
        # Acceptable other 4xx too, but spec says 400
        bad("Webhook with no signature -> 400", f"got={r.status_code}")

    # --- Summary ---
    print("\n" + "=" * 60)
    print(f"RESULT: {PASSED} PASSED / {FAILED} FAILED")
    if FAILS:
        print("Failures:")
        for f in FAILS:
            print(f"  - {f}")
    print("=" * 60)
    sys.exit(0 if FAILED == 0 else 1)


if __name__ == "__main__":
    main()
