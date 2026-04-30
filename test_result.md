#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Add free push notifications to QuickGig using Expo Push Notifications (no Firebase,
  no paid services). Events that should trigger a push:
    1. Worker accepts a job → notify poster
    2. New message in a conversation → notify the other party
    3. Job marked complete → notify the other party
    4. Job cancelled by poster (after being accepted) → notify the worker
    5. New review received → notify the reviewee
  Users should be able to toggle pushes on/off from their Profile screen.
  Tokens must be registered per-user on login/signup and cleared on logout.

backend:
  - task: "Push notification endpoints (register/unregister/settings)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            Added endpoints:
              POST /api/notifications/register-token   (body: {token, platform})
              POST /api/notifications/unregister-token
              GET  /api/notifications/settings
              PUT  /api/notifications/settings         (body: {enabled: bool})
            All require JWT auth. Registering a token also clears that same token
            from any other user (so the same device can only belong to one account
            at a time). Defaults `notifications_enabled` to true on first register.
        - working: true
          agent: "testing"
          comment: |
            VERIFIED — all 12 endpoint behaviour checks pass against the live
            backend at https://task-connect-81.preview.emergentagent.com/api.
              ✅ Unauthenticated POST /notifications/register-token → 401
              ✅ Empty / whitespace-only token → 400 ("Token is required")
              ✅ Valid token register → {"ok": true} (response in ~140ms)
              ✅ GET /notifications/settings after register → {"enabled": true, "has_token": true}
              ✅ PUT /notifications/settings {enabled:false} → {"ok": true, "enabled": false}
              ✅ GET reflects enabled=false; PUT re-enable → enabled=true
              ✅ POST /notifications/unregister-token → {"ok": true};
                 GET shows has_token=false afterwards
              ✅ Token uniqueness: registering FAKE_TOKEN_A on user B clears
                 it from user A (A.has_token becomes false, B.has_token=true)
              ✅ Settings persist across requests; toggle enabled=true after disable works
            Tested with two freshly-registered real-looking accounts
            (sarah.miller.* and david.chen.*).

  - task: "Trigger pushes on core events (accept/message/complete/cancel/review)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            Added `notify_user(user_id, title, body, data)` helper that sends
            fire-and-forget requests to https://exp.host/--/api/v2/push/send using
            httpx. Respects `notifications_enabled` flag and banned users. Hooked
            into: POST /api/jobs/{id}/accept, POST /api/jobs/{id}/complete,
            POST /api/jobs/{id}/cancel, POST /api/conversations/{id}/messages,
            POST /api/reviews. Invalid tokens reported by Expo
            (DeviceNotRegistered) are automatically cleared from the DB.
            NOTE: Real push delivery can only be verified from a physical device
            with a valid ExponentPushToken — but these endpoints must return 200
            for any valid call and must NOT block the main API response even when
            Expo is slow or offline.
        - working: true
          agent: "testing"
          comment: |
            VERIFIED — every notify_user-bearing endpoint returned 200 in well
            under 250ms (asyncio.create_task fire-and-forget never blocks).
            End-to-end flow exercised with FAKE Expo tokens
            ("ExponentPushToken[fake-...]" registered to both users):
              ✅ POST /api/jobs                              200 in ~130ms
              ✅ POST /api/jobs/{id}/accept     (notify A)   200 in ~190ms
              ✅ POST /api/conversations/{id}/messages A→B   200 in ~110ms
              ✅ POST /api/conversations/{id}/messages B→A   200 in ~170ms
              ✅ POST /api/jobs/{id}/complete   (notify B)   200 in ~140ms
              ✅ POST /api/reviews              A→B & B→A    200 in ~150ms
              ✅ POST /api/jobs/{id}/cancel     (notify W)   200 in ~140ms
            Edge cases:
              ✅ Sending message when receiver has notifications_enabled=false
                 → still 200 fast (notify_user short-circuits silently)
              ✅ Sending message when receiver has NO push_token at all
                 → still 200 fast
            All response times remain <3s threshold; no exceptions logged in
            backend.err.log; no 5xx observed. Real Expo delivery cannot be
            verified server-side and was not in scope.

frontend:
  - task: "Expo push registration + settings toggle"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/notifications.ts, /app/frontend/app/(tabs)/profile.tsx, /app/frontend/src/auth.tsx, /app/frontend/app/_layout.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            Created /app/frontend/src/notifications.ts which handles permission
            request, channel setup (Android), token retrieval, and backend
            registration. Hooked into auth signIn/signUp/refresh and into signOut.
            Added a tap handler in /app/frontend/app/_layout.tsx that routes taps
            to the relevant screen (chat / job / profile). Added a Switch card in
            Profile that calls /api/notifications/settings to enable or disable
            pushes. Frontend testing not requested — will be verified manually on
            a real device by the user.


  - task: "Enhanced GET /api/jobs filters (pay_type, min_pay, verified_only, sort)"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: |
            Extended GET /api/jobs with 4 new optional query params:
              • pay_type      "hourly" | "fixed"  (omitted/"all" = any)
              • min_pay       float >= 0          (0 = any, else pay_amount >= N)
              • verified_only bool                (only return jobs whose poster
                                                  has is_verified=True)
              • sort          "best" | "new" | "pay" | "near"
                              best (default) = boosted first, then closest, then
                                               newest
                              new            = created_at desc
                              pay            = pay_amount desc (boosted tiebreaker)
                              near           = distance_miles asc (requires lat/lng
                                               — callers without GPS fall back to
                                               treating distance as infinity so
                                               results still return in stable order)
            Existing params (q, category, radius, lat, lng, status) unchanged.
            Backend limit raised from 200 → 400 jobs so filters have more to narrow.
        - working: true
          agent: "testing"
          comment: |
            VERIFIED — 30/30 filter assertions PASS against the live backend
            (https://task-connect-81.preview.emergentagent.com/api).
            Test harness: /app/backend_test_filters.py
            Seeded a deterministic dataset for a per-run RUN_TAG so assertions
            are isolated:
              • 2 posters: sarah.miller.* (verified) and david.chen.*
                (temporarily verified to post, then is_verified flipped back
                to False directly via Mongo so verified_only assertions are
                meaningful).
              • 4 jobs:
                  Hourly $15 (verified)   Hourly $45 (verified)
                  Fixed  $25 (unverified) Fixed  $80 (unverified)
                with slightly offset lat/lng around SF.

            TEST 1 — pay_type
              ✅ pay_type=hourly  → 2 results, all pay_type==hourly
              ✅ pay_type=fixed   → 2 results, all pay_type==fixed
              ✅ pay_type omitted → no filter (4 of 4)
              ✅ pay_type=all     → no filter (4 of 4)
            TEST 8 — invalid pay_type
              ✅ pay_type=weekly  → ignored gracefully, 200 + 4 results
            TEST 2 / 6 — min_pay
              ✅ min_pay=20 → only $25/$45/$80 returned
              ✅ min_pay=0  → no filter
              ✅ min_pay=-10 → no filter (treated as omitted)
            TEST 3 — verified_only
              ✅ verified_only=true  → 2 results, every poster.is_verified==True
              ✅ verified_only=false → no filter (4)
              ✅ omitted             → no filter (4)
            TEST 7 — verified_only with empty match
              ✅ verified_only=true & q=zzz... → 200 [] (no 500 even when
                 posters_map is empty)
            TEST 4 — sort
              ✅ sort=new  → created_at DESC
              ✅ sort=pay  → pay_amount DESC ([80,45,25,15])
              ✅ sort=near (lat/lng=SF center) → distance_miles ASC
                 ([0.0, 0.62, 1.18, 1.49])
              ✅ sort=best default (no boosted, no lat/lng) → created_at DESC
                 tie-break working
              ✅ sort=best with a boosted job → boosted job floats to position 0
                 (verified by boosting the $25 fixed job via
                 POST /api/billing/boost-post {plan:"24h"})
            TEST 5 — combined filters AND together
              ✅ pay_type=hourly & min_pay=25 & verified_only=true → exactly
                 the $45 hourly verified job
              ✅ pay_type=fixed & min_pay=50 → exactly the $80 fixed job
            Existing params still combine correctly:
              ✅ q=pricey & pay_type=hourly → only $45 hourly
              ✅ category=moving & min_pay=50 → only the $80 moving job

            All responses returned 200 in well under 1s; backend.err.log shows
            no exceptions during the run. Push-notification endpoints were
            NOT re-tested (already verified previously).

metadata:
  created_by: "main_agent"
  version: "1.2"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "Enhanced GET /api/jobs filters (pay_type, min_pay, verified_only, sort)"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        Added 4 new query params to GET /api/jobs: pay_type, min_pay,
        verified_only, sort. Please run focused tests against these:

        SETUP
          • Use any valid user credential (/app/memory/test_credentials.md).
          • If needed, create 4–6 jobs spanning hourly & fixed pay types and
            a mix of pay_amounts ($10 / $20 / $40 / $60). At least one job's
            poster should be is_verified=True and at least one should not be.
            You can mark any user verified via DB or the
            POST /api/auth/verify-id endpoint with any base64 string.

        TESTS
          1. pay_type="hourly"  → all returned jobs.pay_type === "hourly".
             pay_type="fixed"   → all returned jobs.pay_type === "fixed".
             pay_type omitted / "all" → no filtering.
          2. min_pay=20   → every returned job has pay_amount >= 20.
             min_pay=0    → no filtering.
          3. verified_only=true → every job's poster.is_verified === true.
             verified_only=false / omitted → no filtering.
          4. sort=new  → results sorted by created_at DESC.
             sort=pay  → results sorted by pay_amount DESC.
             sort=near + lat/lng provided → results sorted by distance_miles ASC.
             sort=best (default) → boosted jobs first, then distance,
                                   then newest.
          5. Combined filters must AND together (e.g. pay_type=hourly &
             min_pay=25 & verified_only=true → matches all three conditions).
          6. When min_pay is <= 0 or not provided, no pay filter should apply.
          7. verified_only must not break responses when the posters map is
             empty (e.g. no jobs match).
          8. Invalid pay_type (e.g. "weekly") must NOT error — the backend
             should simply ignore unsupported values and return unfiltered.

        Do NOT run frontend tests — UI changes are mounted but user wants to
        verify in person.

    - agent: "testing"
      message: |
        Backend push-notification testing complete — 27/27 push-related tests
        PASS against the live backend.
          • All four /api/notifications/* endpoints behave correctly: auth
            enforced (401), empty/whitespace tokens rejected (400), settings
            persist, unregister clears token, same token cannot belong to two
            users simultaneously (uniqueness preserved).
          • Every notify_user-bearing flow (accept / message / complete /
            cancel / review) returns 200 in <250ms — the asyncio.create_task
            fire-and-forget pattern works as designed; no blocking observed
            even when receiver has fake token, no token, or notifications
            disabled.
          • Backend logs show "POST https://exp.host/--/api/v2/push/send 200"
            so the Expo call itself works (response is just an Expo error for
            the fake token, which is expected and correctly ignored).
          • Real device push delivery NOT verified — out of scope server-side.
        UNRELATED ISSUE FLAGGED: admin@quickgig.app / admin123 returned 401.
        This is unrelated to the push-notif task — admin password appears to
        have been changed in a prior session (test_credentials.md notes this
        and gives a reset procedure). No action required for current scope.

    - agent: "testing"
      message: |
        Filters retest complete — 30/30 assertions PASS for the enhanced
        GET /api/jobs (pay_type, min_pay, verified_only, sort) against the
        live backend. Test harness saved at /app/backend_test_filters.py.
        Seeded 4 deterministic jobs (2 hourly + 2 fixed, $15/$45/$25/$80) by
        two posters (one verified, one demoted via direct Mongo write so the
        verified_only filter is meaningful since job-posting requires
        is_verified=true).
        Highlights:
          • All four new params behave per spec; unrecognised pay_type
            (e.g. "weekly") is ignored gracefully (200, no 500).
          • min_pay<=0 / negative / omitted → no filter applied.
          • verified_only with empty match → 200 [], no crash on empty
            posters_map.
          • sort=new/pay/near work; sort=best floats boosted job to top
            (validated by boosting one job via /api/billing/boost-post).
          • Combined filters AND together (pay_type & min_pay & verified_only).
          • Existing params (q, category, status, lat/lng, radius) still
            cooperate with new ones.
        Push-notification endpoints were intentionally NOT re-tested per
        request — they were verified previously and remain unchanged.
        Backend is ready; main agent can summarise & ship.

        1. AUTH + TOKEN REGISTRATION
           - Log in as a regular user (see /app/memory/test_credentials.md)
           - Call POST /api/notifications/register-token with a FAKE but well-formed
             token "ExponentPushToken[test-xxxx]" — should return {"ok": true}
           - Call GET /api/notifications/settings — expect {"enabled": true, "has_token": true}
           - Call PUT /api/notifications/settings with {"enabled": false} — expect
             {"ok": true, "enabled": false}
           - Call POST /api/notifications/unregister-token — expect {"ok": true}
             and has_token should then be false on subsequent GET.

        2. EVENT TRIGGERS (functional, no real push needed)
           All the following must return 200 and NOT hang or error out even when
           the receiving user has a fake / missing / invalid Expo token:
             a. Two users (A and B). A creates a job; B accepts it.
                → POST /api/jobs/{id}/accept should still succeed.
             b. Either party sends a message in the conversation.
                → POST /api/conversations/{id}/messages should still succeed.
             c. Mark the job completed.
                → POST /api/jobs/{id}/complete should still succeed.
             d. Create a review for the other party.
                → POST /api/reviews should still succeed.
             e. Poster creates a new job, worker accepts, poster cancels.
                → POST /api/jobs/{id}/cancel should still succeed.

        3. EDGE CASES
           - Unauthenticated request to /api/notifications/register-token should
             return 401.
           - Empty token should return 400.
           - Toggling settings must persist across requests.

        Do NOT test real push delivery — that requires a physical device. Focus
        purely on endpoint behaviour, auth, and that events do not break when
        notify_user() is called.
