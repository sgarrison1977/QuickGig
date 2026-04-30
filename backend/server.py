from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import math
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
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

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    phone: Optional[str] = None


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


# ============ AUTH ============

@api_router.post("/auth/register")
async def register(data: RegisterIn):
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
):
    query = {}
    if status and status != "all":
        query["status"] = status
    if category and category != "all":
        query["category"] = category
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.jobs.find(query, {"_id": 0}).sort("created_at", -1).limit(200)
    jobs = await cursor.to_list(200)
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
    results = [public_job(j, poster=posters_map.get(j["poster_id"]), distance=dist) for j, dist in filtered]
    # Sort: boosted first, then by distance (if available) or recency
    def sort_key(x):
        boost_rank = 0 if x["is_boosted"] else 1
        dist_rank = x["distance_miles"] if x["distance_miles"] is not None else 1e9
        return (boost_rank, dist_rank)
    results.sort(key=sort_key)
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
    out_posted = [
        public_job(j, poster=user, worker=users_map.get(j.get("worker_id")) if j.get("worker_id") else None)
        for j in posted
    ]
    out_accepted = [
        public_job(j, poster=users_map.get(j["poster_id"]), worker=user) for j in accepted
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
    return public_job(fresh, poster=poster, worker=user)


@api_router.post("/jobs/{job_id}/complete")
async def complete_job(job_id: str, user: dict = Depends(get_current_user)):
    j = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not j:
        raise HTTPException(status_code=404, detail="Job not found")
    if user["id"] not in [j.get("poster_id"), j.get("worker_id")]:
        raise HTTPException(status_code=403, detail="Not your job")
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
    return public_job(fresh, poster=poster, worker=worker)


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
    return [
        {
            "id": m["id"],
            "conversation_id": m["conversation_id"],
            "sender_id": m["sender_id"],
            "text": m["text"],
            "created_at": m["created_at"].isoformat() if m.get("created_at") else None,
        }
        for m in msgs
    ]


@api_router.post("/conversations/{convo_id}/messages")
async def send_message(convo_id: str, data: MessageIn, user: dict = Depends(get_current_user)):
    c = await db.conversations.find_one({"id": convo_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if user["id"] not in [c["poster_id"], c["worker_id"]]:
        raise HTTPException(status_code=403, detail="Not your conversation")
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
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail="Job not completed yet")
    if user["id"] not in [job["poster_id"], job.get("worker_id")]:
        raise HTTPException(status_code=403, detail="Not your job")
    if data.reviewee_id not in [job["poster_id"], job.get("worker_id")] or data.reviewee_id == user["id"]:
        raise HTTPException(status_code=400, detail="Invalid reviewee")
    existing = await db.reviews.find_one(
        {"job_id": data.job_id, "reviewer_id": user["id"]}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already reviewed this job")
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
