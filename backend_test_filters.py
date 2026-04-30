"""
Focused backend tests for enhanced GET /api/jobs filters:
  pay_type, min_pay, verified_only, sort

Seeds a deterministic small set of jobs using fresh real-looking users:
  • Two posters: one verified, one unverified.
  • 4 jobs (2 hourly + 2 fixed) at different pay amounts and locations.

Then exercises the test plan from /app/test_result.md.
"""

import os
import time
import uuid
import requests

BASE = "https://task-connect-81.preview.emergentagent.com/api"

# Jobs we will seed (titles tagged with a per-run marker so we can isolate them)
RUN_TAG = f"FT-{uuid.uuid4().hex[:8]}"


def banner(t):
    print(f"\n{'='*70}\n{t}\n{'='*70}")


def expect(cond, msg, fails):
    if cond:
        print(f"  ✅ {msg}")
    else:
        print(f"  ❌ {msg}")
        fails.append(msg)


def register(email, name, phone="555-0100"):
    r = requests.post(
        f"{BASE}/auth/register",
        json={"email": email, "password": "Pa55word!", "name": name, "phone": phone},
        timeout=15,
    )
    if r.status_code == 400:
        # already exists - login instead
        r = requests.post(
            f"{BASE}/auth/login",
            json={"email": email, "password": "Pa55word!"},
            timeout=15,
        )
    r.raise_for_status()
    return r.json()


def verify_id(token):
    r = requests.post(
        f"{BASE}/auth/verify-id",
        json={"id_document": "data:image/png;base64,iVBORw0KGgo="},
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


def post_job(token, *, title, category, pay_type, pay_amount, lat, lng):
    r = requests.post(
        f"{BASE}/jobs",
        json={
            "title": f"{title} [{RUN_TAG}]",
            "description": f"Seeded job for filter tests {RUN_TAG}",
            "category": category,
            "pay_type": pay_type,
            "pay_amount": pay_amount,
            "address": "123 Mission St, San Francisco, CA",
            "latitude": lat,
            "longitude": lng,
            "photos": [],
        },
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


def get_jobs(**params):
    r = requests.get(f"{BASE}/jobs", params=params, timeout=15)
    r.raise_for_status()
    return r.json()


def only_seeded(jobs):
    return [j for j in jobs if RUN_TAG in (j.get("title") or "")]


def main():
    fails = []
    banner("STEP 0 — Register two posters (one verified, one not)")
    ts = int(time.time())
    poster_v = register(f"sarah.miller.{ts}@example.com", "Sarah Miller")
    poster_u = register(f"david.chen.{ts}@example.com", "David Chen")
    print(f"  poster_verified  id={poster_v['user']['id']}")
    print(f"  poster_unverified id={poster_u['user']['id']}")
    # Verify only the first poster
    verify_id(poster_v["token"])
    # Also verify unverified poster *temporarily* so we can post jobs
    # (job posting requires is_verified). After posting we will demote them.
    verify_id(poster_u["token"])

    banner("STEP 1 — Seed 4 deterministic jobs")
    # SF area lat/lng with small offsets so distance differs but radius=any covers all
    jobs = []
    jobs.append(post_job(poster_v["token"], title="Hourly cheap (verified)",
                         category="cleaning", pay_type="hourly", pay_amount=15.0,
                         lat=37.7749, lng=-122.4194))
    jobs.append(post_job(poster_v["token"], title="Hourly pricey (verified)",
                         category="cleaning", pay_type="hourly", pay_amount=45.0,
                         lat=37.7800, lng=-122.4100))
    jobs.append(post_job(poster_u["token"], title="Fixed cheap (unverified)",
                         category="moving", pay_type="fixed", pay_amount=25.0,
                         lat=37.7600, lng=-122.4300))
    jobs.append(post_job(poster_u["token"], title="Fixed pricey (unverified)",
                         category="moving", pay_type="fixed", pay_amount=80.0,
                         lat=37.7900, lng=-122.4000))
    seeded_ids = {j["id"] for j in jobs}
    print(f"  seeded 4 jobs run_tag={RUN_TAG}, ids={list(seeded_ids)[:2]}…")

    banner("STEP 2 — Demote poster_unverified (clear is_verified flag in DB via direct toggle)")
    # We don't have an admin endpoint to unverify; but verify_id is mocked to set True.
    # Use a Mongo direct flip is_verified=False on the unverified poster.
    # Since we can't access mongo directly from test, use a small workaround:
    # the only way is via DB. The test environment exposes MONGO via backend; we'll
    # call it through an admin endpoint if available. Try /admin/users — requires admin.
    # Alternative: register a poster_u WITHOUT verifying — but then they cannot post.
    # Workaround: connect to Mongo directly using env vars from /app/backend/.env.
    try:
        from pymongo import MongoClient
        from dotenv import load_dotenv
        from pathlib import Path
        load_dotenv(Path("/app/backend/.env"))
        m = MongoClient(os.environ["MONGO_URL"])
        m[os.environ["DB_NAME"]].users.update_one(
            {"id": poster_u["user"]["id"]}, {"$set": {"is_verified": False}}
        )
        # confirm
        u = m[os.environ["DB_NAME"]].users.find_one({"id": poster_u["user"]["id"]})
        print(f"  poster_u.is_verified now = {u.get('is_verified')}")
    except Exception as e:
        print(f"  ⚠️ could not directly demote unverified poster: {e}")

    # ---------- TEST 1 — pay_type ----------
    banner("TEST 1 — pay_type filter")
    res = only_seeded(get_jobs(pay_type="hourly"))
    expect(len(res) == 2, f"pay_type=hourly returns 2 seeded jobs (got {len(res)})", fails)
    expect(all(j["pay_type"] == "hourly" for j in res),
           "pay_type=hourly all returned jobs.pay_type==hourly", fails)
    res = only_seeded(get_jobs(pay_type="fixed"))
    expect(len(res) == 2, f"pay_type=fixed returns 2 seeded jobs (got {len(res)})", fails)
    expect(all(j["pay_type"] == "fixed" for j in res),
           "pay_type=fixed all returned jobs.pay_type==fixed", fails)
    res = only_seeded(get_jobs())
    expect(len(res) == 4, f"pay_type omitted → no filter (got {len(res)} of 4)", fails)
    res = only_seeded(get_jobs(pay_type="all"))
    expect(len(res) == 4, f"pay_type=all → no filter (got {len(res)} of 4)", fails)

    # ---------- TEST 8 — invalid pay_type ----------
    banner("TEST 8 — invalid pay_type ignored, no 500")
    try:
        res = get_jobs(pay_type="weekly")
        seeded = only_seeded(res)
        expect(len(seeded) == 4, f"pay_type=weekly ignored, all 4 seeded jobs returned (got {len(seeded)})", fails)
    except requests.HTTPError as e:
        expect(False, f"invalid pay_type produced HTTP error {e}", fails)

    # ---------- TEST 2 — min_pay ----------
    banner("TEST 2 — min_pay filter")
    res = only_seeded(get_jobs(min_pay=20))
    expect(all(j["pay_amount"] >= 20 for j in res),
           f"min_pay=20 → all pay_amount>=20 (got {[j['pay_amount'] for j in res]})", fails)
    expect({j["pay_amount"] for j in res} == {25.0, 45.0, 80.0},
           "min_pay=20 returns exactly 25/45/80 jobs", fails)
    res = only_seeded(get_jobs(min_pay=0))
    expect(len(res) == 4, f"min_pay=0 → no filter (got {len(res)} of 4)", fails)

    # ---------- TEST 6 — min_pay <= 0 ----------
    banner("TEST 6 — min_pay <=0 / negative → no filter")
    res = only_seeded(get_jobs(min_pay=-10))
    expect(len(res) == 4, f"min_pay=-10 → no filter (got {len(res)} of 4)", fails)

    # ---------- TEST 3 — verified_only ----------
    banner("TEST 3 — verified_only filter")
    res = only_seeded(get_jobs(verified_only="true"))
    expect(len(res) == 2,
           f"verified_only=true returns 2 seeded jobs (got {len(res)})", fails)
    expect(all(j["poster"] and j["poster"]["is_verified"] for j in res),
           "verified_only=true → every poster.is_verified===true", fails)
    res = only_seeded(get_jobs(verified_only="false"))
    expect(len(res) == 4, f"verified_only=false → no filter (got {len(res)})", fails)
    res = only_seeded(get_jobs())
    expect(len(res) == 4, "verified_only omitted → no filter", fails)

    # ---------- TEST 7 — verified_only when no jobs match ----------
    banner("TEST 7 — verified_only with empty result set")
    try:
        res = get_jobs(verified_only="true", q="zzzzznevermatchzzzzz")
        expect(isinstance(res, list), "verified_only with no matches returns a list (no 500)", fails)
        expect(len(res) == 0, "verified_only with no matches → []", fails)
    except requests.HTTPError as e:
        expect(False, f"verified_only with empty match produced HTTP error {e}", fails)

    # ---------- TEST 4 — sort ----------
    banner("TEST 4 — sort=new")
    res = only_seeded(get_jobs(sort="new"))
    ts_list = [j["created_at"] for j in res]
    expect(ts_list == sorted(ts_list, reverse=True),
           f"sort=new → created_at DESC (got {ts_list})", fails)

    banner("TEST 4 — sort=pay")
    res = only_seeded(get_jobs(sort="pay"))
    pays = [j["pay_amount"] for j in res]
    expect(pays == sorted(pays, reverse=True),
           f"sort=pay → pay_amount DESC (got {pays})", fails)

    banner("TEST 4 — sort=near with lat/lng")
    res = only_seeded(get_jobs(sort="near", lat=37.7749, lng=-122.4194))
    dists = [j["distance_miles"] for j in res]
    expect(all(d is not None for d in dists),
           f"sort=near with lat/lng → distance_miles populated (got {dists})", fails)
    expect(dists == sorted(dists),
           f"sort=near → distance_miles ASC (got {dists})", fails)

    banner("TEST 4 — sort=best (default)")
    res = only_seeded(get_jobs())  # default sort=best
    expect(len(res) == 4, "sort=best default returns 4 jobs", fails)
    # No boosted jobs exist; with no lat/lng, distance is None for all → tiebreaker is created_at desc
    ts_list = [j["created_at"] for j in res]
    expect(ts_list == sorted(ts_list, reverse=True),
           f"sort=best (no lat/lng, no boosted) → created_at DESC tie-break (got {ts_list})", fails)

    # Now boost one job and ensure it floats to top
    banner("TEST 4b — sort=best honors boosted jobs first")
    boost_target = jobs[2]  # fixed cheap (unverified)
    r = requests.post(
        f"{BASE}/billing/boost-post",
        json={"job_id": boost_target["id"], "plan": "24h"},
        headers={"Authorization": f"Bearer {poster_u['token']}"},
        timeout=15,
    )
    r.raise_for_status()
    res = only_seeded(get_jobs())
    expect(res and res[0]["id"] == boost_target["id"],
           f"boosted job appears first in sort=best (got first id={res[0]['id'] if res else None})", fails)
    expect(res and res[0]["is_boosted"] is True,
           "boosted job has is_boosted=True", fails)

    # ---------- TEST 5 — combined filters ----------
    banner("TEST 5 — combined filters AND together")
    res = only_seeded(get_jobs(pay_type="hourly", min_pay=25, verified_only="true"))
    expect(len(res) == 1,
           f"hourly+min_pay25+verified → 1 match (got {len(res)})", fails)
    if res:
        j = res[0]
        expect(j["pay_type"] == "hourly", "combined: pay_type==hourly", fails)
        expect(j["pay_amount"] >= 25, f"combined: pay_amount>=25 (got {j['pay_amount']})", fails)
        expect(j["poster"]["is_verified"], "combined: poster.is_verified", fails)

    res = only_seeded(get_jobs(pay_type="fixed", min_pay=50))
    expect(len(res) == 1,
           f"fixed + min_pay=50 → 1 match (got {len(res)})", fails)
    if res:
        expect(res[0]["pay_amount"] == 80.0,
               f"fixed+min_pay50 should be the $80 job (got {res[0]['pay_amount']})", fails)

    # combined with q
    banner("Existing param coexistence — q + new filters")
    res = only_seeded(get_jobs(q="pricey", pay_type="hourly"))
    expect(len(res) == 1 and res[0]["pay_amount"] == 45.0,
           f"q='pricey' + pay_type=hourly → only the $45 hourly job (got {[j['pay_amount'] for j in res]})", fails)

    # combined with category
    res = only_seeded(get_jobs(category="moving", min_pay=50))
    expect(len(res) == 1 and res[0]["pay_amount"] == 80.0,
           f"category=moving + min_pay=50 → 1 match $80 (got {[j['pay_amount'] for j in res]})", fails)

    # ---------- SUMMARY ----------
    banner("RESULT")
    if fails:
        print(f"  ❌ {len(fails)} failures:")
        for f in fails:
            print(f"     - {f}")
        return 1
    print("  🎉 ALL FILTER TESTS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
