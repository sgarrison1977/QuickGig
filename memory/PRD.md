# QuickGig — Product Requirements Document

## Overview
QuickGig is an Expo React Native marketplace mobile app for posting and accepting small local jobs (lawn care, cleaning, painting, handyman, moving, pet care, errands, etc.). Both job posters ("offerers") and workers verify ID for safety, browse/accept gigs nearby, chat in-app, and rate each other after completion. Payments are arranged directly between parties — no payment integration.

## Tech Stack
- Frontend: Expo Router (React Native, SDK 54), AsyncStorage, expo-location, expo-image-picker, lucide-react-native
- Backend: FastAPI (Python), MongoDB (Motor), JWT auth (PyJWT), bcrypt
- Visual style: Neo-Brutalist Play (hard black borders, hard offset shadows, vibrant pastels: coral / mint / butter yellow / lilac)

## Core Features
1. **Auth** — Email/password register & login (JWT Bearer in AsyncStorage). Mocked ID verification (upload photo → instantly marked verified).
2. **Post a Job** — Title, description, category (8 options), pay type (hourly/fixed) + amount, address + GPS coordinates, up to 4 photos. Verified users only.
3. **Browse Jobs** — Search bar, category chips, distance radius filter (5/10/25/50/100mi using device GPS + Haversine). Sorted by distance.
4. **Job Lifecycle** — `open → accepted → completed` (or cancelled by poster). Worker cannot accept own job; must be verified.
5. **In-app Messaging** — Conversation auto-created on accept. Polling-based chat (5s).
6. **Ratings & Reviews** — 1–5 stars + optional comment after completion. Recalculates user's `rating_avg` & `rating_count`.
7. **Profiles** — Public profile shows verified badge, rating average, completed jobs count, review list.
8. **Admin Panel** — Separate `/admin` login (default admin@quickgig.app / admin123). Tabs: Stats, Users (ban/unban), Chats (view any conversation), Settings (change admin password).

## Non-Goals
- Payment processing (intentionally excluded per spec)
- Real ID provider integration (mocked for MVP)

## API Surface (FastAPI, all under `/api`)
Auth: `/auth/register`, `/auth/login`, `/auth/me`, `/auth/verify-id`, `/auth/profile`
Jobs: `/jobs` (POST, GET), `/jobs/mine`, `/jobs/{id}`, `/jobs/{id}/accept|complete|cancel`
Messaging: `/conversations`, `/conversations/{id}/messages` (GET, POST)
Reviews: `/reviews` (POST), `/reviews/user/{id}`
Admin: `/admin/users`, `/admin/users/{id}/ban|unban`, `/admin/conversations`, `/admin/stats`, `/admin/change-password`

## Data Model (MongoDB)
- `users` — id, email (unique), password_hash, name, phone, bio, avatar(b64), is_verified, role(user|admin), banned, rating_avg, rating_count, jobs_completed
- `jobs` — id, title, description, category, pay_type, pay_amount, address, latitude, longitude, photos[b64], status, poster_id, worker_id, timestamps
- `conversations` — id, job_id, poster_id, worker_id, last_message_at
- `messages` — id, conversation_id, sender_id, text, created_at
- `reviews` — id, job_id, reviewer_id, reviewee_id, rating, comment, created_at

## Smart Business Enhancement (built-in)
- **Verified Badge as trust currency**: Verified users get a visible blue ShieldCheck on every card and profile, increasing acceptance rates. This dual-side trust signal becomes a viral driver — both posters and workers want it, lifting conversions without ad spend.

## Test Credentials (see /app/memory/test_credentials.md)
- Admin: `admin@quickgig.app` / `admin123`
