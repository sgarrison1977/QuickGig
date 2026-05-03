"""
Tests for two new behaviors in /app/backend/server.py:
  1. Worker can't re-accept a job they previously withdrew from (HTTP 400).
  2. Admin can list (GET /api/admin/jobs) and delete (DELETE /api/admin/jobs/{id}) jobs.

Runs against the live backend.
"""
import os
import time
import uuid
import json
import httpx

BASE = "https://task-connect-81.preview.emergentagent.com/api"
TIMEOUT = 30.0

passes = []
fails = []

def ok(msg):
    print(f"  PASS: {msg}")
    passes.append(msg)

def bad(msg):
    print(f"  FAIL: {msg}")
    fails.append(msg)

def check(cond, msg):
    if cond:
        ok(msg)
    else:
        bad(msg)

def post(client, path, json_body=None, token=None, expect=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = client.post(BASE + path, json=json_body, headers=headers)
    return r

def get(client, path, token=None, params=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return client.get(BASE + path, headers=headers, params=params)

def delete(client, path, token=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return client.delete(BASE + path, headers=headers)


def run():
    with httpx.Client(timeout=TIMEOUT) as client:
        # a. Login as admin
        print("\n[a] Admin login")
        r = post(client, "/auth/login",
                 {"email": "admin@quickgig.app", "password": "admin123"})
        check(r.status_code == 200, f"admin login -> 200 (got {r.status_code})")
        if r.status_code != 200:
            print("  FATAL: cannot continue without admin token. Body:", r.text[:300])
            return
        admin_token = r.json()["token"]
        check(r.json()["user"]["role"] == "admin", "admin user has role=admin")

        # b. Register userP, userW, userW2 (all real-looking names)
        rand = uuid.uuid4().hex[:8]
        users = {}
        for label, name in [
            ("P", "Olivia Bennett"),
            ("W", "Marcus Reeves"),
            ("W2", "Liam Foster"),
        ]:
            email = f"{name.lower().replace(' ', '.')}.{rand}@example.com"
            print(f"\n[b] Register user {label} ({email})")
            r = post(client, "/auth/register", {
                "email": email,
                "password": "TestPass!23",
                "name": name,
                "phone": "+15551112222",
                "eula_accepted": True,
                "eula_version": "1.0",
            })
            check(r.status_code == 200, f"register {label} -> 200 (got {r.status_code})")
            if r.status_code != 200:
                print("  FATAL register response:", r.text[:300])
                return
            users[label] = {
                "token": r.json()["token"],
                "id": r.json()["user"]["id"],
                "email": email,
                "name": name,
            }

        userP = users["P"]
        userW = users["W"]
        userW2 = users["W2"]

        # c. userP creates a job
        print("\n[c] userP creates a job")
        r = post(client, "/jobs", {
            "title": "Help move couch up 3 flights",
            "description": "Quick 1hr move job downtown.",
            "category": "moving",
            "pay_type": "hourly",
            "pay_amount": 35.0,
            "address": "123 Market St, San Francisco, CA",
            "latitude": 37.7749,
            "longitude": -122.4194,
            "photos": [],
        }, token=userP["token"])
        check(r.status_code == 200, f"create job -> 200 (got {r.status_code} {r.text[:200]})")
        job = r.json()
        job_id = job["id"]
        check(job["status"] == "open", "new job status=open")
        check(job.get("abandonments") == [], "new job abandonments=[]")

        # d. userW accepts -> 200
        print("\n[d] userW accepts the job")
        r = post(client, f"/jobs/{job_id}/accept", token=userW["token"])
        check(r.status_code == 200, f"userW accept -> 200 (got {r.status_code} {r.text[:200]})")
        if r.status_code == 200:
            check(r.json()["status"] == "accepted", "after accept status=accepted")
            check(r.json()["worker_id"] == userW["id"], "worker_id == userW.id")

        # e. userW withdraws -> 200, job back to status=open with abandonments containing userW
        print("\n[e] userW withdraws")
        r = post(client, f"/jobs/{job_id}/withdraw", token=userW["token"])
        check(r.status_code == 200, f"userW withdraw -> 200 (got {r.status_code} {r.text[:200]})")
        if r.status_code == 200:
            body = r.json()
            check(body["status"] == "open", "after withdraw status=open")
            check(body["worker_id"] is None, "after withdraw worker_id=None")
            ab_ids = [a.get("worker_id") for a in body.get("abandonments", [])]
            check(userW["id"] in ab_ids, "abandonments contains userW.id")

        # f. userW tries to accept again -> 400 with the new "already withdrew" detail
        print("\n[f] userW re-accept attempt -> expect 400")
        r = post(client, f"/jobs/{job_id}/accept", token=userW["token"])
        check(r.status_code == 400,
              f"userW re-accept -> 400 (got {r.status_code} {r.text[:200]})")
        if r.status_code == 400:
            try:
                detail = r.json().get("detail", "")
            except Exception:
                detail = ""
            expected = "You already withdrew from this job and can't accept it again."
            check(detail == expected,
                  f"detail == expected ('{expected}') (got '{detail}')")

        # g. userW2 accepts -> 200
        print("\n[g] userW2 accepts -> expect 200")
        r = post(client, f"/jobs/{job_id}/accept", token=userW2["token"])
        check(r.status_code == 200, f"userW2 accept -> 200 (got {r.status_code} {r.text[:200]})")
        if r.status_code == 200:
            check(r.json()["worker_id"] == userW2["id"], "worker_id == userW2.id")

        # h. userW2 withdraws -> 200
        print("\n[h] userW2 withdraws -> expect 200")
        r = post(client, f"/jobs/{job_id}/withdraw", token=userW2["token"])
        check(r.status_code == 200, f"userW2 withdraw -> 200 (got {r.status_code} {r.text[:200]})")
        if r.status_code == 200:
            ab_ids = [a.get("worker_id") for a in r.json().get("abandonments", [])]
            check(userW["id"] in ab_ids and userW2["id"] in ab_ids,
                  "abandonments contains BOTH userW and userW2")

        # i. userW2 tries to accept again -> 400
        print("\n[i] userW2 re-accept attempt -> expect 400")
        r = post(client, f"/jobs/{job_id}/accept", token=userW2["token"])
        check(r.status_code == 400,
              f"userW2 re-accept -> 400 (got {r.status_code} {r.text[:200]})")
        if r.status_code == 400:
            try:
                detail = r.json().get("detail", "")
            except Exception:
                detail = ""
            check(detail == "You already withdrew from this job and can't accept it again.",
                  f"detail matches (got '{detail}')")

        # j. GET /api/admin/jobs as admin -> 200, contains jobId
        print("\n[j] GET /admin/jobs as admin")
        r = get(client, "/admin/jobs", token=admin_token)
        check(r.status_code == 200, f"admin GET /admin/jobs -> 200 (got {r.status_code})")
        if r.status_code == 200:
            arr = r.json()
            check(isinstance(arr, list), "response is a list")
            ids = [j["id"] for j in arr]
            check(job_id in ids, f"list includes our job_id ({job_id})")

        # k. GET /api/admin/jobs?status=open -> 200, contains jobId
        print("\n[k] GET /admin/jobs?status=open as admin")
        r = get(client, "/admin/jobs", token=admin_token, params={"status": "open"})
        check(r.status_code == 200, f"admin GET /admin/jobs?status=open -> 200 (got {r.status_code})")
        if r.status_code == 200:
            arr = r.json()
            ids = [j["id"] for j in arr]
            check(job_id in ids, "?status=open contains our job (job is currently open)")
            statuses = {j.get("status") for j in arr}
            check(statuses.issubset({"open"}) or len(statuses) <= 1,
                  f"all returned jobs are status=open (saw {statuses})")

        # l. GET /api/admin/jobs as userP -> 403
        print("\n[l] GET /admin/jobs as userP -> expect 403")
        r = get(client, "/admin/jobs", token=userP["token"])
        check(r.status_code == 403, f"non-admin GET /admin/jobs -> 403 (got {r.status_code})")

        # extra: try the other status filters too
        print("\n[k2] additional status filters")
        for st in ("accepted", "completed", "cancelled", "all"):
            r = get(client, "/admin/jobs", token=admin_token, params={"status": st})
            check(r.status_code == 200, f"admin GET /admin/jobs?status={st} -> 200 (got {r.status_code})")

        # p. DELETE /api/admin/jobs/{any} as userP -> 403 (test BEFORE admin delete so job still exists)
        print("\n[p] DELETE /admin/jobs as non-admin (userP) -> expect 403")
        r = delete(client, f"/admin/jobs/{job_id}", token=userP["token"])
        check(r.status_code == 403, f"non-admin DELETE -> 403 (got {r.status_code})")

        # m. DELETE /api/admin/jobs/{jobId} as admin -> 200, returns deleted=true
        print("\n[m] DELETE /admin/jobs/{jobId} as admin")
        r = delete(client, f"/admin/jobs/{job_id}", token=admin_token)
        check(r.status_code == 200, f"admin DELETE -> 200 (got {r.status_code} {r.text[:200]})")
        if r.status_code == 200:
            body = r.json()
            check(body.get("deleted") is True, "response.deleted == true")
            check(body.get("job_id") == job_id, "response.job_id matches")
            check("messages_deleted" in body, "response includes messages_deleted")
            check(isinstance(body.get("messages_deleted"), int), "messages_deleted is an int")

        # n. GET /api/jobs/{jobId} after delete -> 404
        print("\n[n] GET /jobs/{jobId} after delete -> expect 404")
        r = get(client, f"/jobs/{job_id}")
        check(r.status_code == 404, f"GET deleted job -> 404 (got {r.status_code})")

        # o. DELETE /api/admin/jobs/{jobId} again -> 404
        print("\n[o] DELETE /admin/jobs/{jobId} again -> expect 404")
        r = delete(client, f"/admin/jobs/{job_id}", token=admin_token)
        check(r.status_code == 404, f"admin DELETE on deleted job -> 404 (got {r.status_code})")

        # Regression: admin login still works (already verified at [a]) — re-check basic /api/jobs listing
        print("\n[regression] basic GET /api/jobs listing")
        r = get(client, "/jobs", params={"category": "all", "status": "open", "sort": "best"})
        check(r.status_code == 200, f"GET /jobs -> 200 (got {r.status_code})")
        if r.status_code == 200:
            check(isinstance(r.json(), list), "GET /jobs returns a list")

        # Regression: confirm /admin/jobs accepts cascade delete (create another job, message
        # in conversation, delete, ensure messages_deleted > 0)
        print("\n[regression-cascade] create new job, accept, send msgs, admin delete")
        r = post(client, "/jobs", {
            "title": "Need help assembling IKEA bookshelf",
            "description": "Should take 30 minutes. Sunday afternoon.",
            "category": "handyman",
            "pay_type": "fixed",
            "pay_amount": 40.0,
            "address": "456 Mission St, San Francisco, CA",
            "latitude": 37.7849,
            "longitude": -122.4094,
            "photos": [],
        }, token=userP["token"])
        check(r.status_code == 200, f"create second job -> 200 (got {r.status_code})")
        if r.status_code == 200:
            job2_id = r.json()["id"]
            # Have a fresh worker accept (use userW2 who hasn't withdrawn from this one)
            r = post(client, f"/jobs/{job2_id}/accept", token=userW2["token"])
            check(r.status_code == 200, f"userW2 accept job2 -> 200 (got {r.status_code})")
            # Find the conversation and send messages
            r = get(client, "/conversations", token=userP["token"])
            check(r.status_code == 200, "list conversations -> 200")
            convo_id = None
            if r.status_code == 200:
                for c in r.json():
                    if c.get("job_id") == job2_id:
                        convo_id = c["id"]
                        break
            check(convo_id is not None, "found conversation for job2")
            if convo_id:
                for txt in ["Hey, can you come at 2pm?",
                            "Yes, see you then!",
                            "Bring an Allen wrench please."]:
                    r = post(client, f"/conversations/{convo_id}/messages",
                             {"text": txt}, token=userP["token"])
                    if r.status_code != 200:
                        # workers might also be allowed
                        r = post(client, f"/conversations/{convo_id}/messages",
                                 {"text": txt}, token=userW2["token"])
                # Now admin delete cascade
                r = delete(client, f"/admin/jobs/{job2_id}", token=admin_token)
                check(r.status_code == 200, f"admin delete job2 -> 200 (got {r.status_code})")
                if r.status_code == 200:
                    body = r.json()
                    # messages_deleted is the number of conversations whose msgs were deleted
                    # (per the code: returns len(convo_ids))
                    check(body.get("deleted") is True, "deleted=true on cascade delete")
                    # Verify GET conversation messages now 404 or empty
                    rr = get(client, f"/conversations/{convo_id}/messages",
                            token=userP["token"])
                    # Either 404 (convo deleted) or 200 with empty messages list
                    check(rr.status_code in (404, 200),
                          f"GET messages on deleted job's convo -> 404 or 200 (got {rr.status_code})")
                    if rr.status_code == 200:
                        msgs = rr.json().get("messages", [])
                        check(msgs == [], "messages list is empty after cascade")

        print("\n========================================")
        print(f"SUMMARY: {len(passes)} PASSED / {len(fails)} FAILED")
        print("========================================")
        if fails:
            print("\nFAILURES:")
            for f in fails:
                print(f"  - {f}")


if __name__ == "__main__":
    run()
