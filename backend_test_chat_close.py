"""
Backend tests for "Chat auto-closes 8h after job completion" safety feature.

Runs against the live backend defined in /app/frontend/.env
(EXPO_PUBLIC_BACKEND_URL + /api).

Uses motor to directly mutate a job's completed_at timestamp to simulate
the 9-hour-old completion needed to cross the 8h close window.
"""

import asyncio
import os
import random
import string
import sys
import time
from datetime import datetime, timedelta, timezone

import httpx
from motor.motor_asyncio import AsyncIOMotorClient


# ---- CONFIG ----
BACKEND_URL = "https://task-connect-81.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "quickgig_database"
ADMIN_EMAIL = "admin@quickgig.app"
ADMIN_PASSWORD = "admin123"


def rand(n: int = 6) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


PASSES: list[str] = []
FAILS: list[str] = []


def ok(msg: str) -> None:
    PASSES.append(msg)
    print(f"  ✅ {msg}")


def fail(msg: str) -> None:
    FAILS.append(msg)
    print(f"  ❌ {msg}")


def section(name: str) -> None:
    print(f"\n=== {name} ===")


async def register(client: httpx.AsyncClient, email: str, name: str) -> dict:
    r = await client.post(
        f"{API}/auth/register",
        json={"email": email, "password": "Passw0rd!", "name": name, "phone": "415-555-0000"},
    )
    r.raise_for_status()
    return r.json()


async def login_admin(client: httpx.AsyncClient) -> str:
    r = await client.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    if r.status_code != 200:
        print(f"  ⚠️  admin login failed ({r.status_code}): {r.text[:160]}")
        return ""
    return r.json()["token"]


async def verify_id(client: httpx.AsyncClient, token: str) -> None:
    r = await client.post(
        f"{API}/auth/verify-id",
        headers={"Authorization": f"Bearer {token}"},
        json={"id_document": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="},
    )
    r.raise_for_status()


async def create_job(client: httpx.AsyncClient, token: str, title: str) -> dict:
    r = await client.post(
        f"{API}/jobs",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": title,
            "description": "Help with apartment move. Easy and quick.",
            "category": "moving",
            "pay_type": "hourly",
            "pay_amount": 25.0,
            "address": "123 Market St, San Francisco, CA",
            "latitude": 37.7749,
            "longitude": -122.4194,
            "photos": [],
        },
    )
    r.raise_for_status()
    return r.json()


async def accept_job(client: httpx.AsyncClient, token: str, job_id: str) -> dict:
    r = await client.post(
        f"{API}/jobs/{job_id}/accept",
        headers={"Authorization": f"Bearer {token}"},
    )
    r.raise_for_status()
    return r.json()


async def complete_job(client: httpx.AsyncClient, token: str, job_id: str) -> dict:
    r = await client.post(
        f"{API}/jobs/{job_id}/complete",
        headers={"Authorization": f"Bearer {token}"},
    )
    r.raise_for_status()
    return r.json()


async def cancel_job(client: httpx.AsyncClient, token: str, job_id: str) -> dict:
    r = await client.post(
        f"{API}/jobs/{job_id}/cancel",
        headers={"Authorization": f"Bearer {token}"},
    )
    r.raise_for_status()
    return r.json()


async def send_msg(client: httpx.AsyncClient, token: str, convo_id: str, text: str) -> httpx.Response:
    return await client.post(
        f"{API}/conversations/{convo_id}/messages",
        headers={"Authorization": f"Bearer {token}"},
        json={"text": text},
    )


async def get_msgs(client: httpx.AsyncClient, token: str, convo_id: str) -> httpx.Response:
    return await client.get(
        f"{API}/conversations/{convo_id}/messages",
        headers={"Authorization": f"Bearer {token}"},
    )


async def list_convos(client: httpx.AsyncClient, token: str) -> list:
    r = await client.get(
        f"{API}/conversations",
        headers={"Authorization": f"Bearer {token}"},
    )
    r.raise_for_status()
    return r.json()


async def main() -> int:
    mongo = AsyncIOMotorClient(MONGO_URL)
    db = mongo[DB_NAME]

    async with httpx.AsyncClient(timeout=20.0) as client:
        stamp = int(time.time())
        suffix = rand(5)

        # ---- Register users ----
        section("SETUP: register poster (A) and worker (B)")
        a_email = f"sarah.miller.{stamp}.{suffix}@quickgig-test.com"
        b_email = f"david.chen.{stamp}.{suffix}@quickgig-test.com"

        a = await register(client, a_email, "Sarah Miller")
        b = await register(client, b_email, "David Chen")
        a_token, a_user = a["token"], a["user"]
        b_token, b_user = b["token"], b["user"]
        print(f"  A.id={a_user['id']}   B.id={b_user['id']}")

        # Both need to be verified to post/accept
        await verify_id(client, a_token)
        await verify_id(client, b_token)
        ok("registered two fresh users and marked both verified")

        # ---- SCENARIO 1: Accept → chat open (not completed) ----
        section("SCENARIO 1: before completion, chat is open")
        job = await create_job(client, a_token, f"Help move sofa {suffix}")
        job_id = job["id"]
        accepted = await accept_job(client, b_token, job_id)
        convos = await list_convos(client, a_token)
        convo = next((c for c in convos if c["job_id"] == job_id), None)
        if not convo:
            fail("conversation was not auto-created after accept")
            return 1
        convo_id = convo["id"]
        ok(f"conversation auto-created ({convo_id[:8]}…) for job {job_id[:8]}…")

        r = await get_msgs(client, a_token, convo_id)
        if r.status_code != 200:
            fail(f"GET messages before completion returned {r.status_code}")
            return 1
        body = r.json()
        if not isinstance(body, dict):
            fail(f"GET messages did not return an object; got {type(body).__name__}")
            return 1
        ok("GET /conversations/{id}/messages returns OBJECT (not array)")

        for k in ("messages", "chat_closes_at", "chat_is_closed", "chat_close_hours"):
            if k not in body:
                fail(f"missing key '{k}' in GET messages response")
        if body.get("chat_close_hours") == 8:
            ok("chat_close_hours == 8")
        else:
            fail(f"chat_close_hours expected 8, got {body.get('chat_close_hours')}")
        if body.get("chat_closes_at") is None and body.get("chat_is_closed") is False:
            ok("before completion: chat_closes_at=null & chat_is_closed=false")
        else:
            fail(f"pre-completion expected null/false, got closes_at={body.get('chat_closes_at')} is_closed={body.get('chat_is_closed')}")

        r = await send_msg(client, a_token, convo_id, "Hi, when can you come?")
        if r.status_code == 200:
            ok("POST message before completion returns 200")
        else:
            fail(f"POST message before completion should be 200, got {r.status_code}: {r.text[:140]}")

        r = await send_msg(client, b_token, convo_id, "Any time today after 3pm.")
        if r.status_code != 200:
            fail(f"B→A pre-completion message failed: {r.status_code}")

        # ---- SCENARIO 2: After completion but inside 8h window ----
        section("SCENARIO 2: right after completion, still within 8h window")
        await complete_job(client, a_token, job_id)

        r = await get_msgs(client, a_token, convo_id)
        if r.status_code != 200:
            fail(
                f"GET messages after completion → {r.status_code}: {r.text[:200]} "
                "(BLOCKING BUG — chat_close_info timezone comparison)"
            )
            # continue anyway to verify the rest of the flow
            body = {}
        else:
            body = r.json()
        closes_at = body.get("chat_closes_at")
        is_closed = body.get("chat_is_closed")
        if closes_at and is_closed is False:
            try:
                dt = datetime.fromisoformat(closes_at.replace("Z", "+00:00"))
                delta = (dt - datetime.now(timezone.utc)).total_seconds() / 3600
                if 7.5 <= delta <= 8.5:
                    ok(f"chat_closes_at is ~{delta:.2f}h in future (≈ completed_at + 8h)")
                else:
                    fail(f"chat_closes_at delta {delta:.2f}h outside expected 7.5–8.5h window")
            except Exception as e:
                fail(f"chat_closes_at not ISO parseable: {closes_at} ({e})")
        else:
            fail(f"post-completion expected closes_at set & is_closed=false, got closes_at={closes_at} is_closed={is_closed}")

        # Make sure the previously posted messages are preserved in the response
        if isinstance(body.get("messages"), list) and len(body["messages"]) >= 2:
            ok(f"history preserved after completion ({len(body['messages'])} msgs visible)")
        else:
            fail(f"expected at least 2 messages in history, got {body.get('messages')}")

        r = await send_msg(client, b_token, convo_id, "Thanks — on my way now.")
        if r.status_code == 200:
            ok("POST message within 8h window still 200")
        else:
            fail(f"POST within 8h window returned {r.status_code}: {r.text[:140]}")

        # ---- SCENARIO 3: Patch completed_at to 9h ago → closed ----
        section("SCENARIO 3: patch completed_at to 9h ago → chat closed")
        nine_hours_ago = datetime.now(timezone.utc) - timedelta(hours=9)
        res = await db.jobs.update_one(
            {"id": job_id}, {"$set": {"completed_at": nine_hours_ago}}
        )
        if res.modified_count != 1:
            fail(f"failed to patch completed_at via Mongo (matched={res.matched_count})")
            return 1
        ok(f"Mongo: patched job.completed_at = {nine_hours_ago.isoformat()}")

        r = await get_msgs(client, a_token, convo_id)
        if r.status_code != 200:
            fail(
                f"GET messages after patch → {r.status_code}: {r.text[:200]} "
                "(BLOCKING BUG — chat_close_info timezone comparison)"
            )
            body = {}
        else:
            body = r.json()
        if body.get("chat_is_closed") is True:
            ok("chat_is_closed=true after completed_at backdated 9h")
        else:
            fail(f"expected chat_is_closed=true, got {body.get('chat_is_closed')}")
        closes_at = body.get("chat_closes_at")
        try:
            dt = datetime.fromisoformat(closes_at.replace("Z", "+00:00"))
            if dt < datetime.now(timezone.utc):
                ok(f"chat_closes_at is in the past ({dt.isoformat()})")
            else:
                fail(f"chat_closes_at should be in the past, got {dt.isoformat()}")
        except Exception as e:
            fail(f"chat_closes_at unparseable: {closes_at} ({e})")

        if isinstance(body.get("messages"), list) and len(body["messages"]) >= 3:
            ok(f"reading history still works when closed ({len(body['messages'])} msgs)")
        else:
            fail(f"history should be readable after close; got {body.get('messages')}")

        # Poster attempts to send → 403 with safety detail
        r = await send_msg(client, a_token, convo_id, "Can I still write?")
        if r.status_code == 403:
            detail = ""
            try:
                detail = r.json().get("detail", "")
            except Exception:
                detail = r.text
            if "safety" in detail.lower() and "8" in detail:
                ok(f"POST after close → 403 with expected safety detail: '{detail}'")
            else:
                fail(f"POST after close → 403 but detail unexpected: '{detail}'")
        else:
            fail(f"POST after close should be 403, got {r.status_code}: {r.text[:140]}")

        # Worker also blocked
        r = await send_msg(client, b_token, convo_id, "Me neither?")
        if r.status_code == 403:
            ok("worker also blocked with 403 on closed chat")
        else:
            fail(f"worker POST after close expected 403, got {r.status_code}")

        # Non-member still 403 (not-your-conversation) — verify security boundary still works
        c_email = f"other.user.{stamp}.{suffix}@quickgig-test.com"
        c = await register(client, c_email, "Other Person")
        r = await send_msg(client, c["token"], convo_id, "hijack")
        if r.status_code == 403:
            ok("non-participant still blocked (403) on closed chat (auth boundary intact)")
        else:
            fail(f"non-participant POST expected 403, got {r.status_code}")

        # ---- SCENARIO 4: Admin can still READ after close ----
        section("SCENARIO 4: admin can read closed chat history")
        admin_token = await login_admin(client)
        if not admin_token:
            fail("admin login failed (admin123) — cannot verify admin read after close")
        else:
            r = await get_msgs(client, admin_token, convo_id)
            if r.status_code == 200:
                b = r.json()
                if b.get("chat_is_closed") is True and isinstance(b.get("messages"), list):
                    ok(f"admin GET messages on closed chat → 200 with {len(b['messages'])} msgs (is_closed=true)")
                else:
                    fail(f"admin GET returned 200 but shape unexpected: keys={list(b)}")
            else:
                fail(f"admin GET closed chat expected 200, got {r.status_code}: {r.text[:140]}")

        # ---- SCENARIO 5: Non-completed job keeps chat_is_closed=false ----
        section("SCENARIO 5: non-completed jobs stay open (open / cancelled)")

        # 5a. open job (never completed) → open
        job_open = await create_job(client, a_token, f"Pack boxes {suffix}")
        await accept_job(client, b_token, job_open["id"])
        convos = await list_convos(client, a_token)
        convo_open = next(c for c in convos if c["job_id"] == job_open["id"])
        r = await get_msgs(client, a_token, convo_open["id"])
        body = r.json()
        if body.get("chat_is_closed") is False and body.get("chat_closes_at") is None:
            ok("accepted-but-not-completed job → chat stays open")
        else:
            fail(f"accepted-not-completed expected open, got closes_at={body.get('chat_closes_at')} is_closed={body.get('chat_is_closed')}")

        r = await send_msg(client, a_token, convo_open["id"], "Hi — still good for today?")
        if r.status_code == 200:
            ok("POST works on open (not-completed) chat")
        else:
            fail(f"POST on open chat expected 200, got {r.status_code}")

        # 5b. cancelled job → still open per spec
        job_cancel = await create_job(client, a_token, f"Throwaway {suffix}")
        await accept_job(client, b_token, job_cancel["id"])
        convos = await list_convos(client, a_token)
        convo_cancel = next(c for c in convos if c["job_id"] == job_cancel["id"])
        await cancel_job(client, a_token, job_cancel["id"])
        r = await get_msgs(client, a_token, convo_cancel["id"])
        body = r.json()
        if body.get("chat_is_closed") is False and body.get("chat_closes_at") is None:
            ok("cancelled job → chat_is_closed=false, chat_closes_at=null")
        else:
            fail(f"cancelled job expected open, got closes_at={body.get('chat_closes_at')} is_closed={body.get('chat_is_closed')}")

        r = await send_msg(client, a_token, convo_cancel["id"], "Sorry about that.")
        if r.status_code == 200:
            ok("POST works on cancelled-but-not-completed chat")
        else:
            fail(f"POST on cancelled chat expected 200, got {r.status_code}")

    # ---- SUMMARY ----
    print("\n" + "=" * 60)
    print(f"PASSED: {len(PASSES)}")
    print(f"FAILED: {len(FAILS)}")
    if FAILS:
        print("\nFAILURES:")
        for f in FAILS:
            print(f"  ❌ {f}")
    return 0 if not FAILS else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
