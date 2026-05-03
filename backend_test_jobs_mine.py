"""
Regression test for /api/jobs/mine — verifies new my_review_id field.

Usage: python /app/backend_test_jobs_mine.py
"""
import os
import sys
import asyncio
import httpx
from motor.motor_asyncio import AsyncIOMotorClient

BASE = os.environ.get("BACKEND_URL", "http://localhost:8001/api")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "quickgig_database")

PASS = []
FAIL = []


def ok(label):
    PASS.append(label)
    print(f"  ✅ {label}")


def bad(label, detail=""):
    FAIL.append(f"{label} :: {detail}")
    print(f"  ❌ {label}  ({detail})")


async def main():
    db_client = AsyncIOMotorClient(MONGO_URL)
    db = db_client[DB_NAME]

    async with httpx.AsyncClient(base_url=BASE, timeout=30.0) as c:
        # ============ STEP 1: Admin login + jobs/mine ============
        print("\n=== STEP 1: admin /jobs/mine ===")
        r = await c.post(
            "/auth/login",
            json={"email": "admin@quickgig.app", "password": "admin123"},
        )
        if r.status_code != 200:
            bad("admin login", f"status={r.status_code} body={r.text[:200]}")
            return
        ok(f"admin login → 200 (role={r.json()['user'].get('role')})")
        admin_token = r.json()["token"]

        r = await c.get(
            "/jobs/mine", headers={"Authorization": f"Bearer {admin_token}"}
        )
        if r.status_code != 200:
            bad("admin GET /jobs/mine", f"status={r.status_code} body={r.text[:300]}")
        else:
            ok("admin GET /jobs/mine → 200")
            data = r.json()
            if isinstance(data, dict) and "posted" in data and "accepted" in data:
                ok(f"shape ok (posted={len(data['posted'])} accepted={len(data['accepted'])})")
                # Check my_review_id key exists on every job
                missing_key = []
                for arr_name in ("posted", "accepted"):
                    for j in data[arr_name]:
                        if "my_review_id" not in j:
                            missing_key.append(f"{arr_name}/{j.get('id')}")
                if missing_key:
                    bad("admin: my_review_id key missing", str(missing_key[:5]))
                else:
                    ok("admin: every job has my_review_id key (string OR null)")
                # Validate value types
                for arr_name in ("posted", "accepted"):
                    for j in data[arr_name]:
                        v = j.get("my_review_id")
                        if v is not None and not isinstance(v, str):
                            bad(
                                "admin: my_review_id wrong type",
                                f"job={j.get('id')} val={v!r}",
                            )
            else:
                bad("admin: shape wrong", f"keys={list(data.keys()) if isinstance(data, dict) else type(data)}")

        # ============ STEP 2: Find a user with a reviewed completed job ============
        print("\n=== STEP 2: find a reviewer with a reviewed completed job ===")
        # Find any review whose job is status=completed
        review = None
        async for r_doc in db.reviews.find({}, {"_id": 0}).limit(200):
            j = await db.jobs.find_one(
                {"id": r_doc["job_id"], "status": "completed"}, {"_id": 0}
            )
            if j:
                review = r_doc
                completed_job = j
                break
        if not review:
            bad("find reviewer", "no review found for any completed job")
            print(f"\nFAIL: cannot continue without reviewer test data")
            return
        reviewer_id = review["reviewer_id"]
        ok(
            f"found review id={review['id']} reviewer_id={reviewer_id} "
            f"job_id={review['job_id']}"
        )

        reviewer_doc = await db.users.find_one({"id": reviewer_id}, {"_id": 0})
        if not reviewer_doc:
            bad("find reviewer user", f"user_id={reviewer_id} missing in db")
            return
        reviewer_email = reviewer_doc["email"]
        ok(f"reviewer email = {reviewer_email}")

        # We need to log in as this user — but we don't know their password.
        # Strategy: mint a JWT for them directly using JWT_SECRET (same code as backend).
        import jwt
        from datetime import datetime, timezone, timedelta

        JWT_SECRET = os.environ.get(
            "JWT_SECRET",
            "b3a9f1c8e7d62a4e9f0b7d5c3e1a8f2d6b9c0e4a7d2f5b8c1e6a9f3d0b7c4e2a",
        )
        payload = {
            "sub": reviewer_id,
            "email": reviewer_email,
            "role": reviewer_doc.get("role", "user"),
            "exp": datetime.now(timezone.utc) + timedelta(days=1),
            "type": "access",
        }
        reviewer_token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
        # Quick sanity: GET /auth/me to confirm token works
        r = await c.get(
            "/auth/me", headers={"Authorization": f"Bearer {reviewer_token}"}
        )
        if r.status_code != 200:
            bad(
                "minted JWT for reviewer",
                f"status={r.status_code} body={r.text[:200]}",
            )
            return
        ok(f"minted JWT works (auth/me 200, name={r.json().get('name')})")

        # ============ STEP 3: Call /jobs/mine as that user ============
        r = await c.get(
            "/jobs/mine", headers={"Authorization": f"Bearer {reviewer_token}"}
        )
        if r.status_code != 200:
            bad("reviewer GET /jobs/mine", f"status={r.status_code} body={r.text[:300]}")
            return
        ok("reviewer GET /jobs/mine → 200")
        data = r.json()
        all_jobs = (data.get("posted") or []) + (data.get("accepted") or [])
        ok(
            f"reviewer jobs: posted={len(data['posted'])} accepted={len(data['accepted'])}"
        )

        # Find the target job in either array
        target = next((j for j in all_jobs if j["id"] == review["job_id"]), None)
        if not target:
            bad(
                "find reviewed job in /jobs/mine output",
                f"job_id={review['job_id']} not in user's posted/accepted lists",
            )
        else:
            ok(f"reviewed job present (status={target['status']})")
            mri = target.get("my_review_id")
            if mri == review["id"]:
                ok(
                    f"my_review_id matches review.id ({mri[:8]}…) for completed reviewed job"
                )
            else:
                bad(
                    "my_review_id mismatch",
                    f"expected={review['id']} got={mri!r}",
                )

        # Check OTHER completed jobs the user has NOT reviewed → my_review_id must be None
        # First find their other completed jobs (where they are poster or worker but didn't review)
        other_completed = []
        for j in all_jobs:
            if j["status"] == "completed" and j["id"] != review["job_id"]:
                # Confirm in db that the user has NO review for this job
                rv = await db.reviews.find_one(
                    {"job_id": j["id"], "reviewer_id": reviewer_id}, {"_id": 0}
                )
                if not rv:
                    other_completed.append(j)
        if other_completed:
            print(
                f"  • testing {len(other_completed)} other completed-but-unreviewed jobs"
            )
            unreviewed_ok = True
            for j in other_completed:
                if j.get("my_review_id") is not None:
                    bad(
                        "unreviewed-completed job should have null my_review_id",
                        f"job={j['id']} got={j.get('my_review_id')!r}",
                    )
                    unreviewed_ok = False
            if unreviewed_ok:
                ok(
                    f"all {len(other_completed)} other completed-unreviewed jobs have my_review_id=null"
                )
        else:
            ok("(no other completed-unreviewed jobs to check — skipping)")

        # Also verify all NON-completed jobs have my_review_id=null
        non_completed = [j for j in all_jobs if j["status"] != "completed"]
        if non_completed:
            bad_non = [
                f"{j['id']}({j['status']})={j.get('my_review_id')!r}"
                for j in non_completed
                if j.get("my_review_id") is not None
            ]
            if bad_non:
                bad("non-completed jobs should have my_review_id=null", str(bad_non[:5]))
            else:
                ok(
                    f"all {len(non_completed)} non-completed jobs have my_review_id=null"
                )

        # ============ STEP 4: regression — /jobs filter still works ============
        print("\n=== STEP 4: regression on /jobs filters ===")
        r = await c.get("/jobs?category=all&status=open&sort=best")
        if r.status_code != 200:
            bad("/jobs?... regression", f"status={r.status_code} body={r.text[:200]}")
        else:
            jobs = r.json()
            if isinstance(jobs, list):
                ok(f"/jobs?category=all&status=open&sort=best → 200 ({len(jobs)} jobs)")
                if jobs:
                    j0 = jobs[0]
                    expected_keys = {
                        "id",
                        "title",
                        "status",
                        "pay_type",
                        "pay_amount",
                        "poster_id",
                    }
                    missing = expected_keys - set(j0.keys())
                    if missing:
                        bad("/jobs shape", f"missing keys={missing}")
                    else:
                        ok("/jobs shape ok (id/title/status/pay_type/pay_amount/poster_id present)")
                    # Should NOT have my_review_id (only /jobs/mine adds it)
                    if "my_review_id" in j0:
                        bad(
                            "/jobs leaked my_review_id key",
                            "should only appear on /jobs/mine",
                        )
                    else:
                        ok("/jobs does NOT include my_review_id (correct — only /jobs/mine)")
            else:
                bad("/jobs shape", f"expected list got {type(jobs)}")

    print("\n" + "=" * 60)
    print(f"PASSED: {len(PASS)}")
    print(f"FAILED: {len(FAIL)}")
    if FAIL:
        print("\nFAILURES:")
        for f in FAIL:
            print(f"  - {f}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
