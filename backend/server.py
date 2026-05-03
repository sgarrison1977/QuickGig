from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=False)

import os
import uuid
import math
import logging
import asyncio
import bcrypt
import httpx
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Any, Dict

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr


# -------- DB --------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# -------- App --------
app = FastAPI(title="QuickGig API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

JWT_ALGORITHM = "HS256"


# ============ HELPERS ============

USER_PROJECTION = {"_id": 0, "password_hash": 0, "id_document": 0}


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 3958.8  # miles
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def public_user(u: dict) -> dict:
    """Strip sensitive fields from user dict."""
    if not u:
        return u
    # Mongo returns naive datetimes — make tz-aware before comparing
    pro_exp = u.get("pro_expires_at")
    if isinstance(pro_exp, datetime) and pro_exp.tzinfo is None:
        pro_exp = pro_exp.replace(tzinfo=timezone.utc)
    is_pro_active = bool(u.get("is_pro", False)) and (pro_exp is None or pro_exp > datetime.now(timezone.utc))
    return {
        "id": u["id"],
        "email": u.get("email"),
        "name": u.get("name"),
        "phone": u.get("phone"),
        "bio": u.get("bio", ""),
        "avatar": u.get("avatar"),
        "is_verified": u.get("is_verified", False),
        "role": u.get("role", "user"),
        "banned": u.get("banned", False),
        "rating_avg": u.get("rating_avg", 0.0),
        "rating_count": u.get("rating_count", 0),
        "jobs_completed": u.get("jobs_completed", 0),
        "is_pro": is_pro_active,
        "pro_expires_at": pro_exp.isoformat() if isinstance(pro_exp, datetime) else None,
        "has_background_check": u.get("has_background_check", False),
        "id_verification_paid": bool(u.get("id_verification_paid", False)),
        "created_at": u.get("created_at").isoformat() if u.get("created_at") else None,
    }


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if user.get("banned"):
            raise HTTPException(status_code=403, detail="Account banned")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_admin_user(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ============ MODELS ============

CURRENT_EULA_VERSION = "1.0"


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    phone: Optional[str] = None
    eula_accepted: bool = False
    eula_version: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class IDUploadIn(BaseModel):
    id_document: str  # base64
    selfie: Optional[str] = None


class ProfileUpdateIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None  # base64


class JobIn(BaseModel):
    title: str
    description: str
    category: str
    pay_type: Literal["hourly", "fixed"]
    pay_amount: float
    address: str
    latitude: float
    longitude: float
    photos: List[str] = []  # base64 list


class MessageIn(BaseModel):
    text: str


class ReviewIn(BaseModel):
    job_id: str
    reviewee_id: str
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = ""


class AdminPasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class BoostIn(BaseModel):
    job_id: str
    plan: Literal["24h", "48h"]


class PushTokenIn(BaseModel):
    token: str
    platform: Optional[str] = None  # ios / android / web


class NotifSettingsIn(BaseModel):
    enabled: bool


# ============ PUSH NOTIFICATIONS (Expo free service) ============

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# Chat auto-closes this many hours after a job is marked complete (safety)
CHAT_CLOSE_HOURS = 8


async def chat_close_info(convo: dict) -> Dict[str, Any]:
    """Return {closes_at, is_closed} for a conversation based on the job's
    completed_at timestamp. Chat only ever closes for completed jobs."""
    job_id = convo.get("job_id")
    if not job_id:
        return {"closes_at": None, "is_closed": False}
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0, "status": 1, "completed_at": 1})
    if not job:
        return {"closes_at": None, "is_closed": False}
    if job.get("status") != "completed":
        return {"closes_at": None, "is_closed": False}
    completed_at = job.get("completed_at")
    if not isinstance(completed_at, datetime):
        return {"closes_at": None, "is_closed": False}
    # Motor returns naive datetimes from Mongo — force UTC-aware for comparison
    if completed_at.tzinfo is None:
        completed_at = completed_at.replace(tzinfo=timezone.utc)
    closes_at = completed_at + timedelta(hours=CHAT_CLOSE_HOURS)
    now = datetime.now(timezone.utc)
    return {"closes_at": closes_at.isoformat(), "is_closed": now >= closes_at}


async def _send_expo_push(messages: List[Dict[str, Any]]):
    """POST to Expo push API. Never raises — logs on failure."""
    if not messages:
        return
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={
                    "accept": "application/json",
                    "accept-encoding": "gzip, deflate",
                    "content-type": "application/json",
                },
            )
            if r.status_code >= 400:
                logging.warning(f"Expo push failed {r.status_code}: {r.text[:200]}")
            else:
                # Cleanup: remove invalid tokens reported by Expo
                try:
                    data = r.json().get("data") or []
                    for idx, item in enumerate(data):
                        if (
                            isinstance(item, dict)
                            and item.get("status") == "error"
                            and item.get("details", {}).get("error")
                            == "DeviceNotRegistered"
                        ):
                            bad_token = messages[idx].get("to")
                            if bad_token:
                                await db.users.update_many(
                                    {"push_token": bad_token},
                                    {"$set": {"push_token": None}},
                                )
                except Exception:
                    pass
    except Exception as e:
        logging.warning(f"Expo push exception: {e}")


async def notify_user(
    user_id: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
):
    """Queue a single push to a user (respects opt-in + valid Expo token)."""
    if not user_id:
        return
    u = await db.users.find_one(
        {"id": user_id}, {"_id": 0, "push_token": 1, "notifications_enabled": 1, "banned": 1}
    )
    if not u:
        return
    if u.get("banned"):
        return
    if u.get("notifications_enabled") is False:
        return
    token = u.get("push_token")
    if not token or not isinstance(token, str) or not token.startswith("ExponentPushToken"):
        return
    msg = {
        "to": token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {},
        "channelId": "default",
        "priority": "high",
    }
    # Fire-and-forget (non-blocking)
    asyncio.create_task(_send_expo_push([msg]))


# ============ AUTH ============

@api_router.post("/auth/register")
async def register(data: RegisterIn):
    if not data.eula_accepted:
        raise HTTPException(
            status_code=400,
            detail="You must accept the End User License Agreement to create an account.",
        )
    email = data.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name.strip(),
        "phone": data.phone or "",
        "bio": "",
        "avatar": None,
        "id_document": None,
        "is_verified": False,
        "role": "user",
        "banned": False,
        "rating_avg": 0.0,
        "rating_count": 0,
        "jobs_completed": 0,
        "created_at": datetime.now(timezone.utc),
        "eula_accepted_at": datetime.now(timezone.utc),
        "eula_version": data.eula_version or CURRENT_EULA_VERSION,
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, email, "user")
    return {"token": token, "user": public_user(user_doc)}


@api_router.post("/auth/login")
async def login(data: LoginIn):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("banned"):
        raise HTTPException(status_code=403, detail="Account banned. Contact support.")
    token = create_access_token(user["id"], user["email"], user.get("role", "user"))
    return {"token": token, "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api_router.post("/auth/verify-id")
async def verify_id(data: IDUploadIn, user: dict = Depends(get_current_user)):
    # Mocked verification: just mark user verified
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"id_document": data.id_document, "is_verified": True}},
    )
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(fresh)


@api_router.put("/auth/profile")
async def update_profile(data: ProfileUpdateIn, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.dict().items() if v is not None}
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(fresh)


# ============ PUSH NOTIFICATIONS ENDPOINTS ============

@api_router.post("/notifications/register-token")
async def register_push_token(data: PushTokenIn, user: dict = Depends(get_current_user)):
    token = (data.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")
    # Clear this token from any other account (user switched device/account)
    await db.users.update_many(
        {"push_token": token, "id": {"$ne": user["id"]}},
        {"$set": {"push_token": None}},
    )
    update: Dict[str, Any] = {
        "push_token": token,
        "push_platform": data.platform or "",
        "push_token_updated_at": datetime.now(timezone.utc),
    }
    # Default to enabled if not previously set
    if user.get("notifications_enabled") is None:
        update["notifications_enabled"] = True
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    return {"ok": True}


@api_router.post("/notifications/unregister-token")
async def unregister_push_token(user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"push_token": None}})
    return {"ok": True}


@api_router.put("/notifications/settings")
async def update_notif_settings(data: NotifSettingsIn, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"notifications_enabled": bool(data.enabled)}}
    )
    return {"ok": True, "enabled": bool(data.enabled)}


@api_router.get("/notifications/settings")
async def get_notif_settings(user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {
        "enabled": full.get("notifications_enabled", True) if full else True,
        "has_token": bool(full and full.get("push_token")),
    }


# ============ JOBS ============

def public_job(j: dict, poster: Optional[dict] = None, worker: Optional[dict] = None,
               distance: Optional[float] = None) -> dict:
    boosted_until = j.get("boosted_until")
    if isinstance(boosted_until, datetime) and boosted_until.tzinfo is None:
        boosted_until = boosted_until.replace(tzinfo=timezone.utc)
    is_boosted = bool(boosted_until and isinstance(boosted_until, datetime) and boosted_until > datetime.now(timezone.utc))
    return {
        "id": j["id"],
        "title": j["title"],
        "description": j["description"],
        "category": j["category"],
        "pay_type": j["pay_type"],
        "pay_amount": j["pay_amount"],
        "address": j["address"],
        "latitude": j["latitude"],
        "longitude": j["longitude"],
        "photos": j.get("photos", []),
        "status": j["status"],
        "poster_id": j["poster_id"],
        "worker_id": j.get("worker_id"),
        "poster": public_user(poster) if poster else None,
        "worker": public_user(worker) if worker else None,
        "distance_miles": round(distance, 2) if distance is not None else None,
        "is_boosted": is_boosted,
        "boosted_until": boosted_until.isoformat() if isinstance(boosted_until, datetime) else None,
        "created_at": j["created_at"].isoformat() if isinstance(j.get("created_at"), datetime) else j.get("created_at"),
        "accepted_at": j["accepted_at"].isoformat() if isinstance(j.get("accepted_at"), datetime) else j.get("accepted_at"),
        "completed_at": j["completed_at"].isoformat() if isinstance(j.get("completed_at"), datetime) else j.get("completed_at"),
        "abandonments": [
            {
                "worker_id": a.get("worker_id"),
                "worker_name": a.get("worker_name", ""),
                "withdrew_at": a["withdrew_at"].isoformat()
                if isinstance(a.get("withdrew_at"), datetime)
                else a.get("withdrew_at"),
            }
            for a in (j.get("abandonments") or [])
        ],
    }


@api_router.post("/jobs")
async def create_job(data: JobIn, user: dict = Depends(get_current_user)):
    if not user.get("is_verified"):
        raise HTTPException(status_code=403, detail="Please verify your ID before posting jobs")
    job_id = str(uuid.uuid4())
    doc = {
        "id": job_id,
        "title": data.title,
        "description": data.description,
        "category": data.category,
        "pay_type": data.pay_type,
        "pay_amount": data.pay_amount,
        "address": data.address,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "photos": data.photos,
        "status": "open",
        "poster_id": user["id"],
        "worker_id": None,
        "created_at": datetime.now(timezone.utc),
        "accepted_at": None,
        "completed_at": None,
    }
    await db.jobs.insert_one(doc)
    return public_job(doc, poster=user)


@api_router.get("/jobs")
async def list_jobs(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: Optional[float] = None,  # miles
    category: Optional[str] = None,
    q: Optional[str] = None,
    status: Optional[str] = "open",
    pay_type: Optional[str] = None,        # "hourly" | "fixed" | "all"
    min_pay: Optional[float] = None,       # minimum pay amount
    verified_only: Optional[bool] = False, # posters with is_verified=True only
    sort: Optional[str] = "best",          # best | new | pay | near
):
    query: Dict[str, Any] = {}
    if status and status != "all":
        query["status"] = status
    if category and category != "all":
        query["category"] = category
    if pay_type and pay_type in ("hourly", "fixed"):
        query["pay_type"] = pay_type
    if min_pay is not None and min_pay > 0:
        query["pay_amount"] = {"$gte": float(min_pay)}
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.jobs.find(query, {"_id": 0}).sort("created_at", -1).limit(400)
    jobs = await cursor.to_list(400)
    # Pre-filter by distance and collect poster_ids
    filtered: list = []
    for j in jobs:
        dist = None
        if lat is not None and lng is not None:
            dist = haversine_miles(lat, lng, j["latitude"], j["longitude"])
            if radius is not None and dist > radius:
                continue
        filtered.append((j, dist))
    poster_ids = list({j["poster_id"] for j, _ in filtered})
    posters_map = {}
    if poster_ids:
        async for u in db.users.find({"id": {"$in": poster_ids}}, USER_PROJECTION):
            posters_map[u["id"]] = u
    # Optional: verified-only posters
    if verified_only:
        filtered = [
            (j, d) for (j, d) in filtered
            if posters_map.get(j["poster_id"], {}).get("is_verified")
        ]
    results = [public_job(j, poster=posters_map.get(j["poster_id"]), distance=dist) for j, dist in filtered]
    # Sorting
    now_ts = datetime.now(timezone.utc).timestamp()

    def parse_ts(x: Any) -> float:
        if isinstance(x, datetime):
            return x.timestamp()
        return 0.0

    if sort == "new":
        results.sort(key=lambda x: -parse_ts(
            datetime.fromisoformat(x["created_at"]) if x.get("created_at") else None
        ) if x.get("created_at") else -now_ts)
    elif sort == "pay":
        results.sort(key=lambda x: (-(x.get("pay_amount") or 0), 0 if x["is_boosted"] else 1))
    elif sort == "near":
        results.sort(key=lambda x: (
            x["distance_miles"] if x["distance_miles"] is not None else 1e9,
            0 if x["is_boosted"] else 1,
        ))
    else:  # "best" — boosted first, then closer, then newer
        def best_key(x):
            boost_rank = 0 if x["is_boosted"] else 1
            dist_rank = x["distance_miles"] if x["distance_miles"] is not None else 1e9
            created = x.get("created_at")
            created_ts = 0.0
            if created:
                try:
                    created_ts = datetime.fromisoformat(created).timestamp()
                except Exception:
                    created_ts = 0.0
            return (boost_rank, dist_rank, -created_ts)
        results.sort(key=best_key)
    return results


@api_router.get("/jobs/mine")
async def my_jobs(user: dict = Depends(get_current_user)):
    posted = await db.jobs.find({"poster_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    accepted = await db.jobs.find({"worker_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    # Batch fetch related users
    worker_ids = list({j["worker_id"] for j in posted if j.get("worker_id")})
    poster_ids = list({j["poster_id"] for j in accepted})
    other_ids = list(set(worker_ids + poster_ids))
    users_map = {}
    if other_ids:
        async for u in db.users.find({"id": {"$in": other_ids}}, USER_PROJECTION):
            users_map[u["id"]] = u

    # Find which completed jobs the current user has already reviewed
    completed_job_ids = [
        j["id"] for j in (posted + accepted) if j.get("status") == "completed"
    ]
    my_review_map: Dict[str, str] = {}
    if completed_job_ids:
        async for r in db.reviews.find(
            {"job_id": {"$in": completed_job_ids}, "reviewer_id": user["id"]},
            {"_id": 0, "id": 1, "job_id": 1},
        ):
            my_review_map[r["job_id"]] = r["id"]

    def with_review(d: dict, j: dict) -> dict:
        if j.get("status") == "completed":
            d["my_review_id"] = my_review_map.get(j["id"])
        else:
            d["my_review_id"] = None
        return d

    out_posted = [
        with_review(
            public_job(j, poster=user, worker=users_map.get(j.get("worker_id")) if j.get("worker_id") else None),
            j,
        )
        for j in posted
    ]
    out_accepted = [
        with_review(
            public_job(j, poster=users_map.get(j["poster_id"]), worker=user),
            j,
        )
        for j in accepted
    ]
    return {"posted": out_posted, "accepted": out_accepted}


@api_router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    j = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    poster = await db.users.find_one({"id": j["poster_id"]}, {"_id": 0})
    worker = await db.users.find_one({"id": j["worker_id"]}, {"_id": 0}) if j.get("worker_id") else None
    return public_job(j, poster=poster, worker=worker)


@api_router.post("/jobs/{job_id}/accept")
async def accept_job(job_id: str, user: dict = Depends(get_current_user)):
    if not user.get("is_verified"):
        raise HTTPException(status_code=403, detail="Verify your ID before accepting jobs")
    j = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    if j["status"] != "open":
        raise HTTPException(status_code=400, detail="Job is not open")
    if j["poster_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot accept your own job")

    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {"status": "accepted", "worker_id": user["id"], "accepted_at": datetime.now(timezone.utc)}},
    )

    # auto-create conversation
    convo_id = str(uuid.uuid4())
    await db.conversations.insert_one({
        "id": convo_id,
        "job_id": job_id,
        "poster_id": j["poster_id"],
        "worker_id": user["id"],
        "last_message_at": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc),
    })

    fresh = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    poster = await db.users.find_one({"id": j["poster_id"]}, {"_id": 0})
    # 🔔 Notify poster that their job was accepted
    await notify_user(
        j["poster_id"],
        "🎉 Your job was accepted!",
        f"{user.get('name') or 'Someone'} accepted \"{j['title']}\". Tap to chat.",
        {"type": "job_accepted", "job_id": job_id, "conversation_id": convo_id},
    )
    return public_job(fresh, poster=poster, worker=user)


@api_router.post("/jobs/{job_id}/complete")
async def complete_job(job_id: str, user: dict = Depends(get_current_user)):
    j = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    # Only the POSTER can mark a job complete. Workers cannot self-confirm the
    # job was done — this prevents a worker from closing a job the poster
    # hasn't actually received yet.
    if j.get("poster_id") != user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Only the job poster can mark this job complete.",
        )
    if j["status"] != "accepted":
        raise HTTPException(status_code=400, detail="Job is not in accepted state")
    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc)}},
    )
    # increment counts
    if j.get("worker_id"):
        await db.users.update_one({"id": j["worker_id"]}, {"$inc": {"jobs_completed": 1}})
    fresh = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    poster = await db.users.find_one({"id": j["poster_id"]}, {"_id": 0})
    worker = await db.users.find_one({"id": j["worker_id"]}, {"_id": 0}) if j.get("worker_id") else None
    # 🔔 Notify the worker that the job was marked complete
    if j.get("worker_id"):
        await notify_user(
            j["worker_id"],
            "✅ Job marked complete",
            f"\"{j['title']}\" was marked complete. Leave a review!",
            {"type": "job_completed", "job_id": job_id},
        )
    return public_job(fresh, poster=poster, worker=worker)


@api_router.post("/jobs/{job_id}/withdraw")
async def withdraw_job(job_id: str, user: dict = Depends(get_current_user)):
    """Worker withdraws / backs out of a job they accepted.
    The job goes back to status="open" so a new worker can pick it up, and the
    abandonment is recorded so the poster can still leave a review on the
    flaky worker (e.g., no-show)."""
    j = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    if j.get("worker_id") != user["id"]:
        raise HTTPException(
            status_code=403,
            detail="Only the worker who accepted this job can withdraw.",
        )
    if j["status"] != "accepted":
        raise HTTPException(
            status_code=400,
            detail="Can only withdraw from a job that's in progress.",
        )
    abandonment_record = {
        "worker_id": user["id"],
        "worker_name": user.get("name", ""),
        "withdrew_at": datetime.now(timezone.utc),
    }
    await db.jobs.update_one(
        {"id": job_id},
        {
            "$set": {
                "status": "open",
                "worker_id": None,
                "accepted_at": None,
            },
            "$push": {"abandonments": abandonment_record},
        },
    )
    # 🔔 Notify the poster
    await notify_user(
        j["poster_id"],
        "⚠️ Worker withdrew",
        f"{user.get('name') or 'A worker'} backed out of \"{j['title']}\". Your job is back open.",
        {"type": "job_withdrawn", "job_id": job_id, "worker_id": user["id"]},
    )
    fresh = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    poster = await db.users.find_one({"id": j["poster_id"]}, {"_id": 0})
    return public_job(fresh, poster=poster, worker=None)


@api_router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: str, user: dict = Depends(get_current_user)):
    j = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    if j["poster_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only poster can cancel")
    if j["status"] == "completed":
        raise HTTPException(status_code=400, detail="Already completed")
    await db.jobs.update_one({"id": job_id}, {"$set": {"status": "cancelled"}})
    # 🔔 Notify the worker if job was already accepted
    if j.get("worker_id"):
        await notify_user(
            j["worker_id"],
            "🚫 Job was cancelled",
            f"The poster cancelled \"{j['title']}\".",
            {"type": "job_cancelled", "job_id": job_id},
        )
    return {"ok": True}


# ============ MESSAGES ============

@api_router.get("/conversations")
async def list_conversations(user: dict = Depends(get_current_user)):
    cursor = db.conversations.find(
        {"$or": [{"poster_id": user["id"]}, {"worker_id": user["id"]}]},
        {"_id": 0},
    ).sort("last_message_at", -1)
    convos = await cursor.to_list(200)
    if not convos:
        return []
    other_ids = list({(c["worker_id"] if c["poster_id"] == user["id"] else c["poster_id"]) for c in convos})
    job_ids = list({c["job_id"] for c in convos})
    convo_ids = [c["id"] for c in convos]
    users_map = {}
    if other_ids:
        async for u in db.users.find({"id": {"$in": other_ids}}, USER_PROJECTION):
            users_map[u["id"]] = u
    jobs_map = {}
    if job_ids:
        async for j in db.jobs.find({"id": {"$in": job_ids}}, {"_id": 0}):
            jobs_map[j["id"]] = j
    # Last messages via aggregation
    last_msgs_map = {}
    if convo_ids:
        pipeline = [
            {"$match": {"conversation_id": {"$in": convo_ids}}},
            {"$sort": {"created_at": -1}},
            {"$group": {"_id": "$conversation_id", "text": {"$first": "$text"}}},
        ]
        async for m in db.messages.aggregate(pipeline):
            last_msgs_map[m["_id"]] = m.get("text", "")
    results = []
    for c in convos:
        other_id = c["worker_id"] if c["poster_id"] == user["id"] else c["poster_id"]
        other = users_map.get(other_id)
        job = jobs_map.get(c["job_id"])
        results.append({
            "id": c["id"],
            "job_id": c["job_id"],
            "job_title": job["title"] if job else "Job",
            "other_user": public_user(other) if other else None,
            "last_message": last_msgs_map.get(c["id"], ""),
            "last_message_at": c["last_message_at"].isoformat() if c.get("last_message_at") else None,
        })
    return results


@api_router.get("/conversations/{convo_id}/messages")
async def get_messages(convo_id: str, user: dict = Depends(get_current_user)):
    c = await db.conversations.find_one({"id": convo_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if user["id"] not in [c["poster_id"], c["worker_id"]] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your conversation")
    cursor = db.messages.find({"conversation_id": convo_id}, {"_id": 0}).sort("created_at", 1)
    msgs = await cursor.to_list(1000)
    close = await chat_close_info(c)
    return {
        "messages": [
            {
                "id": m["id"],
                "conversation_id": m["conversation_id"],
                "sender_id": m["sender_id"],
                "text": m["text"],
                "created_at": m["created_at"].isoformat() if m.get("created_at") else None,
            }
            for m in msgs
        ],
        "chat_closes_at": close["closes_at"],
        "chat_is_closed": close["is_closed"],
        "chat_close_hours": CHAT_CLOSE_HOURS,
    }


@api_router.post("/conversations/{convo_id}/messages")
async def send_message(convo_id: str, data: MessageIn, user: dict = Depends(get_current_user)):
    c = await db.conversations.find_one({"id": convo_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if user["id"] not in [c["poster_id"], c["worker_id"]]:
        raise HTTPException(status_code=403, detail="Not your conversation")
    # Safety: chat auto-closes 8 hours after the job is marked complete
    close = await chat_close_info(c)
    if close["is_closed"]:
        raise HTTPException(
            status_code=403,
            detail=f"Chat closed {CHAT_CLOSE_HOURS} hours after job completion for safety",
        )
    msg = {
        "id": str(uuid.uuid4()),
        "conversation_id": convo_id,
        "sender_id": user["id"],
        "text": data.text,
        "created_at": datetime.now(timezone.utc),
    }
    await db.messages.insert_one(msg)
    await db.conversations.update_one(
        {"id": convo_id}, {"$set": {"last_message_at": datetime.now(timezone.utc)}}
    )
    # 🔔 Notify the other party of the new message
    other_id = c["worker_id"] if c["poster_id"] == user["id"] else c["poster_id"]
    preview = (data.text or "").strip()
    if len(preview) > 120:
        preview = preview[:117] + "..."
    await notify_user(
        other_id,
        f"💬 {user.get('name') or 'New message'}",
        preview or "Sent you a message",
        {"type": "message", "conversation_id": convo_id},
    )
    return {
        "id": msg["id"],
        "conversation_id": convo_id,
        "sender_id": msg["sender_id"],
        "text": msg["text"],
        "created_at": msg["created_at"].isoformat(),
    }


# ============ REVIEWS ============

@api_router.post("/reviews")
async def create_review(data: ReviewIn, user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": data.job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    poster_id = job["poster_id"]
    worker_id = job.get("worker_id")
    abandonment_worker_ids = [
        a.get("worker_id") for a in (job.get("abandonments") or []) if a.get("worker_id")
    ]
    # Anyone who was involved with this job at any point is allowed to be
    # reviewed: the current worker, the poster, or any worker who abandoned.
    valid_participants = set(
        [poster_id] + ([worker_id] if worker_id else []) + abandonment_worker_ids
    )

    # The reviewer must be a participant too.
    if user["id"] not in valid_participants:
        raise HTTPException(status_code=403, detail="Not your job")
    if data.reviewee_id == user["id"] or data.reviewee_id not in valid_participants:
        raise HTTPException(status_code=400, detail="Invalid reviewee")

    # Gating: a review is only allowed if
    #   (a) the job was completed (classic happy path), OR
    #   (b) there's an abandonment pair on this job linking the reviewer and reviewee
    is_completed_review = job["status"] == "completed" and (
        user["id"] in [poster_id, worker_id] and data.reviewee_id in [poster_id, worker_id]
    )
    # Abandonment case: poster reviewing an abandoned worker, or abandoned worker reviewing poster.
    is_abandonment_review = (
        user["id"] == poster_id and data.reviewee_id in abandonment_worker_ids
    ) or (
        user["id"] in abandonment_worker_ids and data.reviewee_id == poster_id
    )
    if not (is_completed_review or is_abandonment_review):
        raise HTTPException(
            status_code=400,
            detail="Reviews are only allowed after a job is completed or if a worker withdrew.",
        )

    existing = await db.reviews.find_one(
        {
            "job_id": data.job_id,
            "reviewer_id": user["id"],
            "reviewee_id": data.reviewee_id,
        },
        {"_id": 0},
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already reviewed this person for this job")
    review = {
        "id": str(uuid.uuid4()),
        "job_id": data.job_id,
        "reviewer_id": user["id"],
        "reviewee_id": data.reviewee_id,
        "rating": data.rating,
        "comment": data.comment or "",
        "created_at": datetime.now(timezone.utc),
    }
    await db.reviews.insert_one(review)
    # Recalc reviewee rating avg via aggregation (efficient, bounded memory)
    pipeline = [
        {"$match": {"reviewee_id": data.reviewee_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]
    agg = await db.reviews.aggregate(pipeline).to_list(1)
    if agg:
        avg = round(agg[0].get("avg") or 0, 2)
        count = agg[0].get("count") or 0
    else:
        avg, count = 0, 0
    await db.users.update_one(
        {"id": data.reviewee_id},
        {"$set": {"rating_avg": avg, "rating_count": count}},
    )
    # 🔔 Notify reviewee of the new review
    stars = "⭐" * int(data.rating)
    await notify_user(
        data.reviewee_id,
        f"{stars} New {data.rating}-star review",
        f"{user.get('name') or 'Someone'} left you a review",
        {"type": "review", "job_id": data.job_id, "user_id": data.reviewee_id},
    )
    return {"id": review["id"], "ok": True}


@api_router.get("/reviews/user/{user_id}")
async def get_user_reviews(user_id: str):
    cursor = db.reviews.find({"reviewee_id": user_id}, {"_id": 0}).sort("created_at", -1)
    reviews = await cursor.to_list(500)
    if not reviews:
        return []
    reviewer_ids = list({r["reviewer_id"] for r in reviews})
    reviewers_map = {}
    async for u in db.users.find({"id": {"$in": reviewer_ids}}, USER_PROJECTION):
        reviewers_map[u["id"]] = u
    out = []
    for r in reviews:
        reviewer = reviewers_map.get(r["reviewer_id"])
        out.append({
            "id": r["id"],
            "rating": r["rating"],
            "comment": r["comment"],
            "reviewer": public_user(reviewer) if reviewer else None,
            "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
        })
    return out


@api_router.get("/reviews/job/{job_id}")
async def get_job_reviews(job_id: str, user: dict = Depends(get_current_user)):
    cursor = db.reviews.find({"job_id": job_id}, {"_id": 0})
    return [{"reviewer_id": r["reviewer_id"], "reviewee_id": r["reviewee_id"], "rating": r["rating"]}
            for r in await cursor.to_list(100)]


# ============ USERS PUBLIC ============

@api_router.get("/users/{user_id}")
async def get_public_user(user_id: str):
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return public_user(u)


# ============ ADMIN ============

@api_router.get("/admin/users")
async def admin_list_users(admin: dict = Depends(get_admin_user)):
    cursor = db.users.find({}, {"_id": 0, "password_hash": 0, "id_document": 0}).sort("created_at", -1)
    users = await cursor.to_list(1000)
    return [public_user(u) for u in users]


@api_router.post("/admin/users/{user_id}/ban")
async def admin_ban_user(user_id: str, admin: dict = Depends(get_admin_user)):
    u = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if u.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Cannot ban admin")
    await db.users.update_one({"id": user_id}, {"$set": {"banned": True}})
    return {"ok": True}


@api_router.post("/admin/users/{user_id}/unban")
async def admin_unban_user(user_id: str, admin: dict = Depends(get_admin_user)):
    await db.users.update_one({"id": user_id}, {"$set": {"banned": False}})
    return {"ok": True}


@api_router.get("/admin/conversations")
async def admin_list_conversations(admin: dict = Depends(get_admin_user)):
    cursor = db.conversations.find({}, {"_id": 0}).sort("last_message_at", -1)
    convos = await cursor.to_list(500)
    if not convos:
        return []
    user_ids = list({c["poster_id"] for c in convos} | {c["worker_id"] for c in convos})
    job_ids = list({c["job_id"] for c in convos})
    users_map = {}
    if user_ids:
        async for u in db.users.find({"id": {"$in": user_ids}}, USER_PROJECTION):
            users_map[u["id"]] = u
    jobs_map = {}
    if job_ids:
        async for j in db.jobs.find({"id": {"$in": job_ids}}, {"_id": 0}):
            jobs_map[j["id"]] = j
    out = []
    for c in convos:
        poster = users_map.get(c["poster_id"])
        worker = users_map.get(c["worker_id"])
        job = jobs_map.get(c["job_id"])
        out.append({
            "id": c["id"],
            "job_id": c["job_id"],
            "job_title": job["title"] if job else "Job",
            "poster": public_user(poster) if poster else None,
            "worker": public_user(worker) if worker else None,
            "last_message_at": c["last_message_at"].isoformat() if c.get("last_message_at") else None,
        })
    return out


@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(get_admin_user)):
    return {
        "users": await db.users.count_documents({}),
        "verified_users": await db.users.count_documents({"is_verified": True}),
        "banned_users": await db.users.count_documents({"banned": True}),
        "jobs_total": await db.jobs.count_documents({}),
        "jobs_open": await db.jobs.count_documents({"status": "open"}),
        "jobs_completed": await db.jobs.count_documents({"status": "completed"}),
        "messages": await db.messages.count_documents({}),
    }


@api_router.get("/admin/revenue")
async def admin_revenue(admin: dict = Depends(get_admin_user)):
    """Returns revenue analytics from payment_transactions:
       - totals (all-time, 7d, 30d) for paid + refunded
       - breakdown by package
       - daily series for last 30 days
       - top customers
    """
    now = datetime.now(timezone.utc)
    d7 = now - timedelta(days=7)
    d30 = now - timedelta(days=30)

    # Paid filter: only count transactions that actually paid
    paid_filter = {"payment_status": "paid"}

    # ---- Top-level totals ----
    async def _sum(filt: Dict[str, Any]) -> Dict[str, float]:
        pipeline = [
            {"$match": filt},
            {
                "$group": {
                    "_id": None,
                    "amount": {"$sum": "$amount"},
                    "count": {"$sum": 1},
                }
            },
        ]
        out = await db.payment_transactions.aggregate(pipeline).to_list(1)
        if not out:
            return {"amount": 0.0, "count": 0}
        return {
            "amount": float(out[0].get("amount") or 0),
            "count": int(out[0].get("count") or 0),
        }

    totals_all = await _sum(paid_filter)
    totals_7d = await _sum({**paid_filter, "created_at": {"$gte": d7}})
    totals_30d = await _sum({**paid_filter, "created_at": {"$gte": d30}})

    refunds_all = await _sum({"refunded": True})
    refunds_30d = await _sum({"refunded": True, "refunded_at": {"$gte": d30}})

    # ---- By package ----
    by_pkg_pipeline = [
        {"$match": paid_filter},
        {
            "$group": {
                "_id": "$package_id",
                "amount": {"$sum": "$amount"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"amount": -1}},
    ]
    by_pkg_raw = await db.payment_transactions.aggregate(by_pkg_pipeline).to_list(20)
    pkg_label = {
        "pro_monthly": "Pro Worker (30 days)",
        "background_check": "Background Check",
        "boost_24h": "Boost · 24h",
        "boost_48h": "Boost · 48h",
    }
    by_package = [
        {
            "package_id": r["_id"],
            "label": pkg_label.get(r["_id"], r["_id"]),
            "amount": float(r["amount"] or 0),
            "count": int(r["count"] or 0),
        }
        for r in by_pkg_raw
    ]

    # ---- Daily series (last 30 days, including 0-days) ----
    daily_pipeline = [
        {"$match": {**paid_filter, "created_at": {"$gte": d30}}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                },
                "amount": {"$sum": "$amount"},
                "count": {"$sum": 1},
            }
        },
    ]
    daily_raw = await db.payment_transactions.aggregate(daily_pipeline).to_list(100)
    daily_map = {r["_id"]: r for r in daily_raw}
    daily_series = []
    for i in range(30):
        day = (now - timedelta(days=29 - i)).strftime("%Y-%m-%d")
        rec = daily_map.get(day)
        daily_series.append(
            {
                "date": day,
                "amount": float(rec["amount"]) if rec else 0.0,
                "count": int(rec["count"]) if rec else 0,
            }
        )

    # ---- Top 10 customers (by paid amount) ----
    top_pipeline = [
        {"$match": paid_filter},
        {
            "$group": {
                "_id": "$user_id",
                "amount": {"$sum": "$amount"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"amount": -1}},
        {"$limit": 10},
    ]
    top_raw = await db.payment_transactions.aggregate(top_pipeline).to_list(10)
    top_user_ids = [r["_id"] for r in top_raw if r.get("_id")]
    users_map = {}
    if top_user_ids:
        async for u in db.users.find(
            {"id": {"$in": top_user_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1}
        ):
            users_map[u["id"]] = u
    top_customers = [
        {
            "user_id": r["_id"],
            "name": users_map.get(r["_id"], {}).get("name", "Unknown"),
            "email": users_map.get(r["_id"], {}).get("email", ""),
            "amount": float(r["amount"] or 0),
            "count": int(r["count"] or 0),
        }
        for r in top_raw
    ]

    net_all = round(totals_all["amount"] - refunds_all["amount"], 2)
    return {
        "totals": {
            "all_time": totals_all,
            "last_7_days": totals_7d,
            "last_30_days": totals_30d,
            "refunds_all_time": refunds_all,
            "refunds_30_days": refunds_30d,
            "net_all_time": net_all,
        },
        "by_package": by_package,
        "daily_series_30d": daily_series,
        "top_customers": top_customers,
        "currency": "usd",
        "generated_at": now.isoformat(),
    }


@api_router.get("/admin/revenue/transactions")
async def admin_recent_transactions(
    admin: dict = Depends(get_admin_user), limit: int = 50
):
    """Last N transactions for the admin ledger view."""
    cursor = db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    rows = await cursor.to_list(limit)
    user_ids = list({r.get("user_id") for r in rows if r.get("user_id")})
    users_map: Dict[str, Dict[str, Any]] = {}
    if user_ids:
        async for u in db.users.find(
            {"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1}
        ):
            users_map[u["id"]] = u
    return [
        {
            "id": r.get("id"),
            "session_id": r.get("session_id"),
            "user_id": r.get("user_id"),
            "user_name": users_map.get(r.get("user_id", ""), {}).get("name", "—"),
            "user_email": users_map.get(r.get("user_id", ""), {}).get("email", ""),
            "package_id": r.get("package_id"),
            "kind": r.get("kind"),
            "amount": float(r.get("amount") or 0),
            "currency": r.get("currency", "usd"),
            "status": r.get("status"),
            "payment_status": r.get("payment_status"),
            "credited": bool(r.get("credited")),
            "refunded": bool(r.get("refunded")),
            "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
        }
        for r in rows
    ]


@api_router.post("/admin/change-password")
async def admin_change_password(data: AdminPasswordChange, admin: dict = Depends(get_admin_user)):
    full = await db.users.find_one({"id": admin["id"]}, {"_id": 0})
    if not verify_password(data.current_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await db.users.update_one(
        {"id": admin["id"]}, {"$set": {"password_hash": hash_password(data.new_password)}}
    )
    return {"ok": True}


# ============ BILLING (MOCKED — wire real Stripe here when ready) ============

PRO_PRICE_CENTS = 499       # $4.99/mo
BG_CHECK_CENTS = 1000       # $10 one-time
BOOST_24H_CENTS = 200       # $2
BOOST_48H_CENTS = 500       # $5


@api_router.get("/billing/catalog")
async def billing_catalog():
    return {
        "pro_monthly": {"cents": PRO_PRICE_CENTS, "label": "$4.99 / month"},
        "background_check": {"cents": BG_CHECK_CENTS, "label": "$10 one-time"},
        "boost_24h": {"cents": BOOST_24H_CENTS, "label": "$2 • 24 hrs"},
        "boost_48h": {"cents": BOOST_48H_CENTS, "label": "$5 • 48 hrs"},
        "mocked": True,
    }


@api_router.post("/billing/subscribe-pro")
async def subscribe_pro(user: dict = Depends(get_current_user)):
    # MOCK: mark pro active for 30 days
    expires = datetime.now(timezone.utc) + timedelta(days=30)
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"is_pro": True, "pro_expires_at": expires}},
    )
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(fresh)


@api_router.post("/billing/cancel-pro")
async def cancel_pro(user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"is_pro": False, "pro_expires_at": None}},
    )
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(fresh)


@api_router.post("/billing/background-check")
async def purchase_background_check(user: dict = Depends(get_current_user)):
    # MOCK: instantly mark background-check complete
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"has_background_check": True}},
    )
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(fresh)


@api_router.post("/billing/boost-post")
async def boost_post(data: BoostIn, user: dict = Depends(get_current_user)):
    j = await db.jobs.find_one({"id": data.job_id}, {"_id": 0})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    if j["poster_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the poster can boost")
    hours = 24 if data.plan == "24h" else 48
    existing = j.get("boosted_until")
    if isinstance(existing, datetime) and existing.tzinfo is None:
        existing = existing.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    base = existing if isinstance(existing, datetime) and existing > now else now
    new_until = base + timedelta(hours=hours)
    await db.jobs.update_one({"id": data.job_id}, {"$set": {"boosted_until": new_until}})
    fresh = await db.jobs.find_one({"id": data.job_id}, {"_id": 0})
    poster = await db.users.find_one({"id": fresh["poster_id"]}, {"_id": 0})
    return public_job(fresh, poster=poster)


# ============ STRIPE PAYMENTS (real) ============
# Catalog of fixed packages — amounts are NEVER taken from the frontend
STRIPE_PACKAGES = {
    "pro_monthly": {"amount": 4.99, "label": "QuickGig Pro · 30 days", "kind": "pro"},
    "background_check": {"amount": 10.00, "label": "Background Check Badge", "kind": "bg"},
    "id_verification": {"amount": 10.00, "label": "ID Verification (Stripe Identity)", "kind": "id_paid"},
    "boost_24h": {"amount": 2.00, "label": "Boost · 24 hrs", "kind": "boost", "hours": 24},
    "boost_48h": {"amount": 5.00, "label": "Boost · 48 hrs", "kind": "boost", "hours": 48},
}


def _stripe_client(http_request: Request):
    """Returns the official stripe-python module configured with our API key,
    pointed at the real Stripe API. We explicitly reset api_base because the
    emergentintegrations module overrides it to a proxy that 404s on retrieve."""
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    import stripe  # type: ignore
    stripe.api_key = api_key
    stripe.api_base = "https://api.stripe.com"
    return stripe


class CheckoutIn(BaseModel):
    package_id: Literal[
        "pro_monthly", "background_check", "id_verification", "boost_24h", "boost_48h"
    ]
    origin_url: str
    job_id: Optional[str] = None  # required when package is a boost


@api_router.post("/billing/checkout")
async def create_checkout(
    data: CheckoutIn,
    http_request: Request,
    user: dict = Depends(get_current_user),
):
    pkg = STRIPE_PACKAGES.get(data.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Unknown package")

    metadata: Dict[str, str] = {
        "user_id": user["id"],
        "package_id": data.package_id,
        "kind": pkg["kind"],
    }
    if pkg["kind"] == "boost":
        if not data.job_id:
            raise HTTPException(status_code=400, detail="job_id required for boost")
        j = await db.jobs.find_one({"id": data.job_id}, {"_id": 0, "poster_id": 1})
        if not j or j["poster_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not your job")
        metadata["job_id"] = data.job_id
        metadata["hours"] = str(pkg["hours"])

    origin = (data.origin_url or "").rstrip("/")
    if not origin:
        raise HTTPException(status_code=400, detail="origin_url required")
    success_url = f"{origin}/billing/return?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/billing/cancel?package={data.package_id}"

    stripe = _stripe_client(http_request)
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {"name": pkg["label"]},
                        "unit_amount": int(round(float(pkg["amount"]) * 100)),
                    },
                    "quantity": 1,
                }
            ],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
        )
    except Exception as e:
        logging.warning(f"Stripe session create failed: {e}")
        raise HTTPException(status_code=502, detail=f"Stripe error: {str(e)[:200]}")

    # Record the transaction (status: initiated) BEFORE returning the URL
    await db.payment_transactions.insert_one(
        {
            "id": str(uuid.uuid4()),
            "session_id": session.id,
            "user_id": user["id"],
            "package_id": data.package_id,
            "kind": pkg["kind"],
            "amount": float(pkg["amount"]),
            "currency": "usd",
            "metadata": metadata,
            "status": "initiated",
            "payment_status": "unpaid",
            "credited": False,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
    )
    return {"url": session.url, "session_id": session.id}


async def _credit_transaction_if_paid(session_id: str, http_request: Request) -> Dict[str, Any]:
    """Idempotent credit: only flips the user/job flag once per session.
    Uses stripe-python directly because emergentintegrations.get_checkout_status
    is unreliable (intermittent 404s + pydantic metadata validation errors).
    """
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    import stripe  # type: ignore
    stripe.api_key = api_key

    try:
        sess = stripe.checkout.Session.retrieve(session_id)
    except Exception as e:
        # Don't block the frontend — return last-known state so polling keeps working
        logging.warning(f"Stripe session retrieve failed for {session_id}: {e}")
        return {
            "session_id": session_id,
            "status": txn.get("status", "open"),
            "payment_status": txn.get("payment_status", "unpaid"),
            "amount_total": int(float(txn.get("amount", 0)) * 100),
            "currency": txn.get("currency", "usd"),
            "credited": bool(txn.get("credited", False)),
        }

    s_status = (sess.get("status") if hasattr(sess, "get") else getattr(sess, "status", None)) or "open"
    s_payment_status = (
        sess.get("payment_status") if hasattr(sess, "get") else getattr(sess, "payment_status", None)
    ) or "unpaid"
    amount_total = (
        sess.get("amount_total") if hasattr(sess, "get") else getattr(sess, "amount_total", None)
    ) or 0
    currency = (
        sess.get("currency") if hasattr(sess, "get") else getattr(sess, "currency", None)
    ) or "usd"

    update: Dict[str, Any] = {
        "status": s_status,
        "payment_status": s_payment_status,
        "updated_at": datetime.now(timezone.utc),
    }

    # Capture payment_intent so we can later find this txn on refund webhooks
    pi = (sess.get("payment_intent") if hasattr(sess, "get") else getattr(sess, "payment_intent", None))
    if pi and not txn.get("payment_intent"):
        update["payment_intent"] = pi

    if s_payment_status == "paid" and not txn.get("credited"):
        kind = txn.get("kind")
        meta = txn.get("metadata") or {}
        user_id = meta.get("user_id")
        if kind == "pro" and user_id:
            existing = await db.users.find_one({"id": user_id}, {"_id": 0, "pro_expires_at": 1})
            now = datetime.now(timezone.utc)
            current = existing.get("pro_expires_at") if existing else None
            if isinstance(current, datetime):
                if current.tzinfo is None:
                    current = current.replace(tzinfo=timezone.utc)
                base = current if current > now else now
            else:
                base = now
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"is_pro": True, "pro_expires_at": base + timedelta(days=30)}},
            )
        elif kind == "bg" and user_id:
            await db.users.update_one(
                {"id": user_id}, {"$set": {"has_background_check": True}}
            )
        elif kind == "id_paid" and user_id:
            # Grant the user a one-time entitlement to start a Stripe Identity session.
            # Cleared after successful verification (see /verify/id/status).
            await db.users.update_one(
                {"id": user_id}, {"$set": {"id_verification_paid": True}}
            )
        elif kind == "boost":
            job_id = meta.get("job_id")
            hours = int(meta.get("hours") or 24)
            if job_id:
                jdoc = await db.jobs.find_one({"id": job_id}, {"_id": 0, "boosted_until": 1})
                now = datetime.now(timezone.utc)
                existing = jdoc.get("boosted_until") if jdoc else None
                if isinstance(existing, datetime):
                    if existing.tzinfo is None:
                        existing = existing.replace(tzinfo=timezone.utc)
                    base = existing if existing > now else now
                else:
                    base = now
                await db.jobs.update_one(
                    {"id": job_id},
                    {"$set": {"boosted_until": base + timedelta(hours=hours)}},
                )
        update["credited"] = True

    await db.payment_transactions.update_one(
        {"session_id": session_id}, {"$set": update}
    )
    return {
        "session_id": session_id,
        "status": s_status,
        "payment_status": s_payment_status,
        "amount_total": int(amount_total or 0),
        "currency": currency,
        "credited": bool(update.get("credited", txn.get("credited", False))),
    }


@api_router.get("/billing/checkout/status/{session_id}")
async def checkout_status(
    session_id: str, http_request: Request, user: dict = Depends(get_current_user)
):
    return await _credit_transaction_if_paid(session_id, http_request)


async def _revoke_transaction(txn: Dict[str, Any]) -> None:
    """Reverse a previously-credited transaction (called on refund)."""
    if not txn or not txn.get("credited"):
        return
    kind = txn.get("kind")
    meta = txn.get("metadata") or {}
    user_id = meta.get("user_id")
    amount = float(txn.get("amount", 0) or 0)
    if kind == "pro" and user_id:
        # Subtract 30 days from pro_expires_at; if it goes into the past, revoke is_pro
        u = await db.users.find_one({"id": user_id}, {"_id": 0, "pro_expires_at": 1})
        cur = u.get("pro_expires_at") if u else None
        now = datetime.now(timezone.utc)
        if isinstance(cur, datetime):
            if cur.tzinfo is None:
                cur = cur.replace(tzinfo=timezone.utc)
            new_exp = cur - timedelta(days=30)
        else:
            new_exp = now - timedelta(days=1)
        if new_exp <= now:
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"is_pro": False, "pro_expires_at": None}},
            )
        else:
            await db.users.update_one(
                {"id": user_id}, {"$set": {"pro_expires_at": new_exp}}
            )
    elif kind == "bg" and user_id:
        await db.users.update_one(
            {"id": user_id}, {"$set": {"has_background_check": False}}
        )
    elif kind == "id_paid" and user_id:
        # Revoke the prepaid ID-verification entitlement on refund.
        # Note: if the user already completed verification (is_verified=True),
        # we leave the badge intact — but we still clear the prepaid flag so
        # they can't start another session for free.
        await db.users.update_one(
            {"id": user_id}, {"$set": {"id_verification_paid": False}}
        )
    elif kind == "boost":
        job_id = meta.get("job_id")
        hours = int(meta.get("hours") or 24)
        if job_id:
            j = await db.jobs.find_one({"id": job_id}, {"_id": 0, "boosted_until": 1})
            cur = j.get("boosted_until") if j else None
            if isinstance(cur, datetime):
                if cur.tzinfo is None:
                    cur = cur.replace(tzinfo=timezone.utc)
                new_until = cur - timedelta(hours=hours)
            else:
                new_until = datetime.now(timezone.utc) - timedelta(hours=1)
            await db.jobs.update_one(
                {"id": job_id}, {"$set": {"boosted_until": new_until}}
            )
    await db.payment_transactions.update_one(
        {"id": txn["id"]},
        {
            "$set": {
                "credited": False,
                "refunded": True,
                "refunded_amount": amount,
                "refunded_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    logging.info(f"Revoked txn {txn.get('id')} kind={kind} for user={user_id}")


@api_router.post("/webhook/stripe")
async def stripe_webhook(http_request: Request):
    """Verifies Stripe-Signature and reacts to checkout.session.* events
    plus identity.verification_session.* events (real ID verification)."""
    sig = http_request.headers.get("Stripe-Signature") or http_request.headers.get(
        "stripe-signature"
    )
    body = await http_request.body()
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    if not secret:
        # No secret configured — refuse all webhooks rather than silently accepting
        raise HTTPException(status_code=500, detail="Webhook secret not configured")
    if not sig:
        raise HTTPException(status_code=400, detail="Missing signature")

    stripe = _stripe_client(http_request)
    try:
        event = stripe.Webhook.construct_event(body, sig, secret)
    except Exception as e:
        logging.warning(f"Stripe webhook signature failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    etype = event.get("type") if hasattr(event, "get") else getattr(event, "type", None)
    if etype in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        try:
            obj = event["data"]["object"]
            session_id = obj.get("id") if hasattr(obj, "get") else getattr(obj, "id", None)
            if session_id:
                await _credit_transaction_if_paid(session_id, http_request)
        except Exception as e:
            logging.warning(f"Webhook credit failed: {e}")
    elif etype == "checkout.session.expired":
        try:
            obj = event["data"]["object"]
            session_id = obj.get("id") if hasattr(obj, "get") else getattr(obj, "id", None)
            if session_id:
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {
                        "$set": {
                            "status": "expired",
                            "payment_status": "unpaid",
                            "updated_at": datetime.now(timezone.utc),
                        }
                    },
                )
        except Exception:
            pass
    elif etype in ("charge.refunded", "charge.refund.updated"):
        # Auto-revoke Pro / BG / Boost when a charge is refunded
        try:
            obj = event["data"]["object"]
            pi = obj.get("payment_intent") if hasattr(obj, "get") else getattr(obj, "payment_intent", None)
            if pi:
                txn = await db.payment_transactions.find_one(
                    {"payment_intent": pi}, {"_id": 0}
                )
                if txn:
                    await _revoke_transaction(txn)
        except Exception as e:
            logging.warning(f"Refund webhook error: {e}")
    elif etype and etype.startswith("identity.verification_session."):
        try:
            obj = event["data"]["object"]
            vs_id = obj.get("id") if hasattr(obj, "get") else getattr(obj, "id", None)
            vs_status = obj.get("status") if hasattr(obj, "get") else getattr(obj, "status", None)
            meta = obj.get("metadata") if hasattr(obj, "get") else getattr(obj, "metadata", None) or {}
            user_id = meta.get("user_id") if isinstance(meta, dict) else None
            if vs_id:
                await db.id_verifications.update_one(
                    {"session_id": vs_id},
                    {
                        "$set": {
                            "status": vs_status,
                            "updated_at": datetime.now(timezone.utc),
                        }
                    },
                )
            if vs_status == "verified" and user_id:
                await db.users.update_one(
                    {"id": user_id},
                    {"$set": {"is_verified": True, "id_verified_at": datetime.now(timezone.utc)}},
                )
        except Exception as e:
            logging.warning(f"Identity webhook error: {e}")
    return {"received": True}


# ============ STRIPE IDENTITY (Real ID Verification) ============

class IdVerifyStartIn(BaseModel):
    return_url: Optional[str] = None  # frontend origin, used for return_url on the hosted flow


@api_router.post("/verify/id/start")
async def start_id_verification(
    data: IdVerifyStartIn,
    http_request: Request,
    user: dict = Depends(get_current_user),
):
    """Creates a Stripe Identity VerificationSession and returns a hosted URL.
    Pricing: $1.50 per verification billed automatically to your Stripe account
    — but the user must pay $10 via /billing/checkout (package_id=id_verification)
    BEFORE we will start a session, so the cost is covered."""
    if user.get("is_verified"):
        return {"already_verified": True}
    if not user.get("id_verification_paid"):
        raise HTTPException(
            status_code=402,
            detail="ID verification requires a one-time $10 purchase. Please complete payment first.",
        )
    stripe = _stripe_client(http_request)
    return_origin = (data.return_url or "").rstrip("/")
    try:
        kwargs: Dict[str, Any] = {
            "type": "document",
            "metadata": {"user_id": user["id"]},
            "options": {
                "document": {
                    "allowed_types": ["driving_license", "passport", "id_card"],
                    "require_matching_selfie": True,
                    "require_live_capture": True,
                }
            },
        }
        if return_origin:
            kwargs["return_url"] = f"{return_origin}/verify-id/return?vs={{VERIFICATION_SESSION_ID}}"
        vs = stripe.identity.VerificationSession.create(**kwargs)
    except Exception as e:
        logging.warning(f"Stripe Identity create failed: {e}")
        raise HTTPException(status_code=502, detail=f"Stripe error: {str(e)[:200]}")

    await db.id_verifications.insert_one(
        {
            "id": str(uuid.uuid4()),
            "session_id": vs.id,
            "user_id": user["id"],
            "status": vs.status,
            "client_secret": vs.client_secret,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
    )
    return {"url": vs.url, "session_id": vs.id, "client_secret": vs.client_secret, "status": vs.status}


@api_router.get("/verify/id/status/{session_id}")
async def get_id_verification_status(
    session_id: str, http_request: Request, user: dict = Depends(get_current_user)
):
    rec = await db.id_verifications.find_one({"session_id": session_id}, {"_id": 0})
    if not rec or rec.get("user_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Verification not found")
    stripe = _stripe_client(http_request)
    try:
        vs = stripe.identity.VerificationSession.retrieve(session_id)
        st = vs.status
    except Exception as e:
        logging.warning(f"Identity retrieve failed: {e}")
        st = rec.get("status", "requires_input")

    if st != rec.get("status"):
        await db.id_verifications.update_one(
            {"session_id": session_id},
            {"$set": {"status": st, "updated_at": datetime.now(timezone.utc)}},
        )
    if st == "verified":
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$set": {
                    "is_verified": True,
                    "id_verified_at": datetime.now(timezone.utc),
                    # Consume the prepaid entitlement now that verification succeeded
                    "id_verification_paid": False,
                }
            },
        )
    return {"session_id": session_id, "status": st, "verified": st == "verified"}


# ============ SEED + STARTUP ============

async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@quickgig.app").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email}, {"_id": 0})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "QuickGig Admin",
            "phone": "",
            "bio": "",
            "avatar": None,
            "id_document": None,
            "is_verified": True,
            "role": "admin",
            "banned": False,
            "rating_avg": 0.0,
            "rating_count": 0,
            "jobs_completed": 0,
            "created_at": datetime.now(timezone.utc),
        })
    else:
        # ensure role is admin (don't overwrite password if already exists - changeable from panel)
        if existing.get("role") != "admin":
            await db.users.update_one({"email": admin_email}, {"$set": {"role": "admin"}})


@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("id", unique=True)
        await db.jobs.create_index("id", unique=True)
        await db.jobs.create_index("status")
        await db.conversations.create_index("id", unique=True)
        await db.messages.create_index("conversation_id")
        await db.reviews.create_index([("reviewee_id", 1)])
    except Exception as e:
        logging.warning(f"Index error: {e}")
    await seed_admin()


@api_router.get("/")
async def root():
    return {"message": "QuickGig API", "version": "1.0"}


# include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
