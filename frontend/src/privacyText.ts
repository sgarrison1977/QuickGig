// Single source of truth for the QuickGig Privacy Policy.
// Bump PRIVACY_VERSION whenever data practices materially change.

export const PRIVACY_VERSION = "1.0";
export const PRIVACY_EFFECTIVE_DATE = "June 1, 2025";

export const PRIVACY_TEXT = `QUICKGIG PRIVACY POLICY

Version ${PRIVACY_VERSION}
Effective ${PRIVACY_EFFECTIVE_DATE}

This Privacy Policy explains what information QuickGig ("we", "us") collects, how we use it, and the choices you have. It works alongside our End User License Agreement ("EULA") — please read both. By using the App you consent to the practices described here.

1. INFORMATION WE COLLECT

a. Information you provide directly
   • Account: name, email, phone (optional), password (stored only as a salted hash), profile photo, bio.
   • Job content: titles, descriptions, photos, addresses, hourly/total prices.
   • Messages: every chat message you send is stored on our servers.
   • Reviews & ratings: text and 1–5 star ratings you leave for other users.
   • Optional ID verification: when you choose to verify your identity, you submit a government-issued ID and a selfie directly to our processor (Stripe Identity). QuickGig itself never sees the ID image — only a verified/unverified result and basic metadata (e.g., first/last name match status).

b. Information we collect automatically
   • Device & technical: device model, OS version, app version, language, time zone, push-notification token (if you enable notifications), IP address, crash logs.
   • Location (if you grant permission): we use your approximate or precise location to sort jobs by distance. We do NOT continuously track your location and we do not store a location history; the latest coordinate is used for the current request and discarded shortly after.
   • Usage analytics: anonymous events such as which screens you opened and which buttons you tapped, used only to improve the app.

c. Information from third parties
   • Stripe (payments & identity): when you pay for Pro Worker, Background Check, ID Verification, or Boost, Stripe shares with us limited information about the transaction (status, last-4 of card, billing email). Stripe — not QuickGig — handles your full payment-card details.
   • Background-check vendor: if/when a background-check provider is integrated, we receive only the pass/fail result; we do not see the underlying records.

2. HOW WE USE INFORMATION

We use information to:
   • Operate the App: create accounts, list jobs, deliver messages, run search and ranking.
   • Process paid features: route Stripe payments, mark accounts as Pro/Background-checked/Boosted.
   • Match Workers and Job Posters: show nearby gigs and relevant search results.
   • Communicate with you: send transactional emails and (if you opt in) push notifications about messages, accepted jobs, and important updates.
   • Keep the platform safe: prevent fraud, scams, harassment, spam, and policy violations. As stated in EULA §3, our authorized personnel CAN access chat history when investigating reports.
   • Improve the App: analyze aggregate usage, fix bugs, design new features.
   • Comply with law: respond to lawful requests, court orders, and subpoenas; enforce our terms.

We do NOT sell your personal information to advertisers.

3. WHO WE SHARE WITH

   • Other users: the parts of your profile that are designed to be public — name, photo, bio, ratings, and the jobs you post or accept — are visible to other users. Your email, phone, and password are NEVER shown to other users.
   • Service providers under contract:
        – Stripe (payments and Stripe Identity verification)
        – MongoDB Atlas / cloud database hosting
        – Push-notification delivery (Expo Push)
        – Email delivery (transactional)
        – Crash & error logging
     Each is bound to use your data only to provide their service to us.
   • Law enforcement and legal process: when required by valid legal process or to protect users from imminent harm.
   • Business transfers: if QuickGig is sold or merged, your information may transfer to the new owner under terms at least as protective as this policy.

4. CHAT PRIVACY

Chats between users are stored on our servers and ARE NOT end-to-end encrypted. Per EULA §3, QuickGig admins, moderators, support staff, and authorized contractors can read chat history for safety, fraud prevention, payment-dispute investigation, and legal compliance. Do not share full payment-card numbers, banking credentials, or government ID numbers in chat.

5. LOCATION DATA

Location is used in real time to power distance-based search ("Find jobs near me"). It is not collected in the background, not used for advertising, and not sold. You can disable location any time in your phone's privacy settings — the App will still function but distance filters will not be available.

6. PUSH NOTIFICATIONS

If you enable notifications, we store an Expo push token on our servers tied to your account. We use it only to send transactional alerts (new messages, accepted jobs, completed jobs, payment receipts). You can disable notifications at any time in the App's profile screen or in your phone's settings.

7. DATA RETENTION

   • Account data: kept while your account is active and for up to 12 months after deletion (so we can resolve disputes and comply with tax/legal obligations).
   • Messages: retained while the related job is active and for up to 24 months after the job ends (or longer if needed for an open investigation).
   • Payment records: retained as long as required by law (typically 7 years).
   • Verification records (Stripe Identity): retained by Stripe per their policy; we keep only the verified/unverified flag.

8. YOUR RIGHTS & CHOICES

Depending on where you live (CCPA, CPRA, GDPR, etc.), you may have the right to:
   • Access the data we hold about you.
   • Correct inaccurate data.
   • Delete your account and associated data ("right to be forgotten"), subject to retention obligations above.
   • Object to or restrict certain processing.
   • Export a portable copy of your data.
   • Opt out of marketing emails (we currently do not send marketing emails — only transactional).

To exercise any right, email support@quickgig.app from the email registered on your account. We will verify your identity and respond within 30 days.

9. SECURITY

We use industry-standard safeguards: HTTPS in transit, encryption at rest for the database, salted-and-hashed passwords (bcrypt), least-privilege internal access, and regular dependency updates. No system is 100% secure — please choose a strong unique password and don't share your account.

10. CHILDREN

QuickGig is not directed to children under 18. We do not knowingly collect personal information from anyone under 18. If you believe a minor has registered, contact support@quickgig.app and we will delete the account.

11. INTERNATIONAL USERS

QuickGig is operated from the United States. If you use the App from outside the US, your information is transferred to and processed in the US. By using the App you consent to that transfer.

12. CHANGES TO THIS POLICY

We may update this Policy from time to time. The new effective date will be shown at the top, and material changes will be communicated in-app or by email. Your continued use of the App after the new effective date constitutes acceptance of the updated Policy.

13. CONTACT US

Questions, requests, or complaints about this Policy:
support@quickgig.app

— End of Policy —`;
