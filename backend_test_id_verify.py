"""Regression test for the new paid ID-verification flow."""
import json
import time
import uuid
import httpx

BASE = "http://localhost:8001/api"


def log(name, ok, detail=""):
    mark = "✅" if ok else "❌"
    print(f"{mark} {name} — {detail}")
    return ok


def main():
    results = []
    # Unique fresh email
    tag = uuid.uuid4().hex[:8]
    email = f"olivia.bennett.{tag}@example.com"
    password = "StrongPass!2026"

    with httpx.Client(base_url=BASE, timeout=30.0) as c:
        # a. register with eula_accepted
        r = c.post(
            "/auth/register",
            json={
                "email": email,
                "password": password,
                "name": "Olivia Bennett",
                "display_name": "Olivia Bennett",
                "eula_accepted": True,
                "eula_version": "1.0",
            },
        )
        ok = r.status_code == 200 and "token" in r.json()
        results.append(log("a. POST /auth/register (fresh + eula)", ok, f"HTTP {r.status_code} body_keys={list(r.json().keys()) if ok else r.text[:200]}"))
        if not ok:
            return
        token = r.json()["token"]
        user_id = r.json()["user"]["id"]
        H = {"Authorization": f"Bearer {token}"}

        # b. GET /auth/me returns id_verification_paid: false, is_verified: false
        r = c.get("/auth/me", headers=H)
        me = r.json() if r.status_code == 200 else {}
        ok_me = (
            r.status_code == 200
            and me.get("id_verification_paid") is False
            and me.get("is_verified") is False
        )
        results.append(
            log(
                "b. GET /auth/me exposes id_verification_paid=false & is_verified=false",
                ok_me,
                f"HTTP {r.status_code} id_verification_paid={me.get('id_verification_paid')!r} is_verified={me.get('is_verified')!r}",
            )
        )

        # c. /verify/id/start → 402 with correct detail
        r = c.post(
            "/verify/id/start",
            json={"return_url": "https://example.com"},
            headers=H,
        )
        body = {}
        try:
            body = r.json()
        except Exception:
            pass
        expected_detail = "ID verification requires a one-time $10 purchase. Please complete payment first."
        ok_402 = r.status_code == 402 and body.get("detail") == expected_detail
        results.append(
            log(
                "c. POST /verify/id/start → 402 with paywall detail",
                ok_402,
                f"HTTP {r.status_code} detail={body.get('detail')!r}",
            )
        )

        # d. /billing/checkout with package_id=id_verification → 200 {url, session_id}
        r = c.post(
            "/billing/checkout",
            json={"package_id": "id_verification", "origin_url": "https://example.com"},
            headers=H,
        )
        b = {}
        try:
            b = r.json()
        except Exception:
            pass
        ok_id_chk = (
            r.status_code == 200
            and isinstance(b.get("url"), str)
            and b["url"].startswith("https://")
            and isinstance(b.get("session_id"), str)
            and len(b["session_id"]) > 0
        )
        results.append(
            log(
                "d. POST /billing/checkout id_verification → 200 {url,session_id}",
                ok_id_chk,
                f"HTTP {r.status_code} url={str(b.get('url'))[:60]}... sid={b.get('session_id')}",
            )
        )

        # e1. background_check still works
        r = c.post(
            "/billing/checkout",
            json={"package_id": "background_check", "origin_url": "https://example.com"},
            headers=H,
        )
        b = r.json() if r.status_code == 200 else {}
        ok_bg = (
            r.status_code == 200
            and isinstance(b.get("url"), str)
            and b["url"].startswith("https://")
            and isinstance(b.get("session_id"), str)
        )
        results.append(
            log(
                "e1. POST /billing/checkout background_check → 200",
                ok_bg,
                f"HTTP {r.status_code} sid={b.get('session_id')}",
            )
        )

        # e2. admin login
        r = c.post(
            "/auth/login",
            json={"email": "admin@quickgig.app", "password": "admin123"},
        )
        ok_admin = r.status_code == 200 and "token" in r.json() and r.json()["user"].get("role") == "admin"
        results.append(
            log(
                "e2. POST /auth/login admin@quickgig.app/admin123 → 200",
                ok_admin,
                f"HTTP {r.status_code} role={r.json().get('user',{}).get('role') if r.status_code==200 else r.text[:120]}",
            )
        )

        # e3. GET /api/jobs?category=all&status=open&sort=best → 200
        r = c.get("/jobs", params={"category": "all", "status": "open", "sort": "best"})
        ok_jobs = r.status_code == 200 and isinstance(r.json(), list)
        results.append(
            log(
                "e3. GET /api/jobs?category=all&status=open&sort=best → 200",
                ok_jobs,
                f"HTTP {r.status_code} n_jobs={len(r.json()) if ok_jobs else 'n/a'}",
            )
        )

        # f. id_verification with empty origin → 400
        r = c.post(
            "/billing/checkout",
            json={"package_id": "id_verification", "origin_url": ""},
            headers=H,
        )
        ok_empty = r.status_code == 400
        results.append(
            log(
                "f. id_verification with empty origin_url → 400",
                ok_empty,
                f"HTTP {r.status_code} body={r.text[:160]}",
            )
        )

    passed = sum(1 for ok in results if ok)
    total = len(results)
    print(f"\n{passed}/{total} passed")
    if passed != total:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
