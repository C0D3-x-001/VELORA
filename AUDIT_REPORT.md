# Velora — Complete Production-Readiness Audit Report

---

## 1. Executive Summary

| Metric | Score |
|--------|-------|
| **Overall Health** | 42/100 |
| **Production Readiness** | 30/100 |
| **Security** | 25/100 |
| **Performance** | 55/100 |
| **Code Quality** | 50/100 |
| **UI/UX** | 65/100 |
| **Scalability** | 40/100 |

Velora has a well-structured architecture and polished UI, but has **critical security vulnerabilities** that would allow any user to steal credits, access other users' data, and bypass authentication. The codebase also has several race conditions in the financial (credit) system, missing input validation, and memory leaks that would cause instability in production.

**Total findings: 118**
- Critical: 10
- High: 19
- Medium: 43
- Low: 46

---

## 2. Critical Issues

### SECURITY — These must be fixed before any deployment.

| # | Issue | File(s) | Impact |
|---|-------|---------|--------|
| 1 | **Admin routes have NO authorization** — any authenticated user can steal credits, view all users, modify plans | `routes/admin.js` (all endpoints) | Complete privilege escalation. Any user becomes admin. |
| 2 | **Real secrets committed to disk** — Clerk secret key, Supabase service role key, NVIDIA API key, Gemini API key are all real (not placeholders) in `.env` files | `server/.env`, `client/.env` | If repo is pushed anywhere, all credentials are compromised. Service role key bypasses all RLS. |
| 3 | **Subtitles endpoint has NO authentication** — mounted before `authMiddleware`, accepts arbitrary userId/projectId/fileName | `app.js:53-67` | Any unauthenticated user can enumerate and download subtitle files for any user. |
| 4 | **SSRF via YouTube URL** — user-supplied URL passed directly to `yt-dlp` with no validation that it's actually a YouTube URL | `routes/projects.js:32-43` | Attacker can probe internal network services (e.g., AWS metadata endpoint). |
| 5 | **Clerk webhook has NO signature verification** — accepts any POST, logs body, returns 200 | `routes/webhooks.js:19-22` | Attacker can forge user creation/deletion events. |
| 6 | **Auth hooks called inside try-catch** — violates Rules of Hooks, can cause infinite render loops | `client/src/lib/auth.jsx:20-42` | React crash or infinite loop when Clerk state changes. |
| 7 | **SettingsPage NPE crash** — `user.fullName` accessed without optional chaining when `user` is undefined | `client/src/pages/Settings/SettingsPage.jsx:180` | Page crash on load. |
| 8 | **ResultsPage undefined reference** — `CheckCircle2` component used but never imported | `client/src/pages/Results/ResultsPage.jsx:96` | Runtime ReferenceError when copy button is clicked. |
| 9 | **Payment webhook hardcodes plan to "creator"** — regardless of which plan the user subscribed to | `services/payment.js:87-103, 118-123` | All paying users get "creator" plan regardless of what they paid for. |
| 10 | **Stripe webhook signature bypass** — `constructEvent` called but secret may be undefined; mock always passes | `routes/webhooks.js:6-17`, `config/stripe.js:23` | Payment events can be forged in misconfigured environments. |

---

## 3. High Priority Issues

### Must fix before launch.

| # | Issue | File(s) | Impact |
|---|-------|---------|--------|
| 1 | **Credit system billing discrepancy** — `CREDIT_COSTS.clip` shows different prices than `calculateCreditsForClips` charges (45s: 12 vs 13, 90s: 20 vs 22, 120s: 25 vs 30) | `config/credits.js:12-19 vs 41-50` | Users see one price, get charged another. Legal/billing issue. |
| 2 | **No input validation on ANY route** — Zod is installed but unused; `calculateCredits(undefined, undefined)` returns NaN which propagates through credit system | All routes | NaN balances, broken credit deductions, database corruption. |
| 3 | **Credit race condition in admin adjust** — read-then-update without optimistic locking | `routes/admin.js:106-131` | Two concurrent admin calls corrupt credit balances. |
| 4 | **Credit transaction log failure swallowed** — credits deducted but no audit trail if log insert fails | `services/credit.js:47-57` | Financial data inconsistency. Impossible to reconcile or refund. |
| 5 | **`addCredits`/`refundCredits` retry doesn't verify success** — optimistic lock retry without conditional update | `services/credit.js:89-103, 143-157` | Credits can be double-credited or lost on retry. |
| 6 | **`uncaughtException` handler doesn't exit** — server continues in undefined state | `app.js:33-35` | Data corruption, security bypass, memory inconsistency. |
| 7 | **`getTransactionStats` fetches ALL transactions** — no DB aggregation, loads everything into memory | `services/credit.js:214-232` | OOM for users with many transactions. Slow queries. |
| 8 | **Timing attack on password verification** — uses `===` instead of `timingSafeEqual` | `routes/auth.js:22-26` | Brute-force password hash character-by-character. |
| 9 | **Error messages leak internals** — raw DB error messages returned to client in production | All route handlers | Exposes table names, column names, SQL syntax to attackers. |
| 10 | **Clips caption-style has no ownership check** — any user can modify any clip | `routes/clips.js:78-90` | Unauthorized data modification. |
| 11 | **Toast module-level singleton with uncleared timeouts** — memory leak on unmount | `components/ui/Toast/Toast.jsx:13-23` | "Can't update unmounted component" warnings, potential crashes. |
| 12 | **Silent auth failure in API interceptor** — token fetch errors are caught and ignored, requests go out unauthenticated | `lib/api.js:11-18` | Confusing 401 errors, no re-authentication prompt. |
| 13 | **ErrorBoundary → markClerkFailed can cause infinite render loop** | `main.jsx:77-82` | App becomes unresponsive. |
| 14 | **ResultsPage downloads entire video into memory** for each clip download | `pages/Results/ResultsPage.jsx:47-61` | Memory spike for large clips (200MB+). |
| 15 | **CreateProjectPage: 10GB file loaded entirely into memory** — no streaming upload | `pages/CreateProject/CreateProjectPage.jsx:375-377` | OOM on large file uploads. |
| 16 | **SettingsPage infinite re-render** — effect dependencies are unstable object references | `pages/Settings/SettingsPage.jsx:169-183` | Endless state resets, page unusable. |
| 17 | **SettingsPage hard-coded bio** — overwrites user's saved bio on every settings load | `pages/Settings/SettingsPage.jsx:181` | User cannot clear their bio. |
| 18 | **Webhook Stripe error leaks secret** — returns `Webhook Error: ${err.message}` | `routes/webhooks.js:15` | Aids attacker in bypassing signature verification. |
| 19 | **`clips.js` regeneration has no concurrency guard** — two rapid requests race on same clip | `routes/clips.js:60-71` | Corrupted clip records, wasted resources. |

---

## 4. Medium Priority Issues

### Fix shortly after launch.

| # | Issue | File(s) |
|---|-------|---------|
| 1 | Rate limiter is in-memory — doesn't work across instances, resets on restart | `middleware/rateLimiter.js` |
| 2 | `mockClient` returns incomplete chains — no `.delete()`, `.update()`, `.single()` etc. | `config/supabase.js:16-29` |
| 3 | `mockClient.from().single()` returns `{ data: [], error: null }` instead of single object | `config/supabase.js:31-46` |
| 4 | No validation of `amount` in `addCredits`/`refundCredits` — negative amounts decrease balance | `services/credit.js:66, 120` |
| 5 | Double refund possible on crash recovery — `refundedProjects` Set is in-memory | `services/project.js:217-236, 678-704` |
| 6 | Temporary files not cleaned on crash — no periodic cleanup of orphans | `routes/clips.js:281-284` |
| 7 | `walkAllPaths` has no depth limit — recursive with no guard | `services/storage.js:35-50` |
| 8 | Morgan logging in production — logs all request details including potential secrets | `app.js:44` |
| 9 | Clerk webhook logs full request body (PII) to console | `routes/webhooks.js:19-22` |
| 10 | `errorHandler` leaks stack traces if `NODE_ENV` isn't exactly `"development"` | `middleware/errorHandler.js:25-27` |
| 11 | Mock transcript used on transcription failure — user charged for fake clips | `services/project.js:386-394` |
| 12 | No file extension validation against content (magic bytes) on uploads | `routes/projects.js:19-28` |
| 13 | `handleCreditsPurchased` — balance update not atomic | `services/payment.js:166-177` |
| 14 | Payment webhook has no idempotency — duplicate deliveries create duplicate records | `services/payment.js:58-85` |
| 15 | Dev mode bypasses all authentication — if Clerk misconfigured in prod, everyone is dev_user_001 | `middleware/auth.js:89-99` |
| 16 | `verifyPassword` doesn't check `password_hash` existence | `routes/auth.js:22-26` |
| 17 | CORS origin not validated — requires `CLIENT_URL` env var in production | `app.js:43` |
| 18 | `json({ limit: "50mb" })` excessive body limit enables DoS | `app.js:70` |
| 19 | Missing DB indexes on `clips(status)`, `credit_transactions(type)`, `subscriptions(status)`, `processing_jobs(status)`, `payments(stripe_payment_id)` | `schema.sql` |
| 20 | RLS policies use 3-level nested subqueries — severe performance on large tables | `schema.sql:177-183` |
| 21 | `processing_jobs.updated_at` trigger missing — column never auto-updates | `schema.sql` |
| 22 | `payments.status` / `subscriptions.plan` have no CHECK constraints | `schema.sql` |
| 23 | `credit_packages.stripe_price_id` has no UNIQUE — duplicate Stripe IDs possible | `schema.sql` |
| 24 | `payments.stripe_payment_id` has no UNIQUE — duplicate payment records possible | `schema.sql` |
| 25 | No CSRF protection (low risk today with Bearer tokens, but fragile if cookies added) | — |
| 26 | `BillingPage` shows full error if either credits or billing query fails | `pages/Billing/BillingPage.jsx:49-64` |
| 27 | `BillingPage` upgrade button uses hardcoded fallback plan ID `"starter"` | `pages/Billing/BillingPage.jsx:103` |
| 28 | `CreateProjectPage` effect runs on every render due to unstable deps | `pages/CreateProject/CreateProjectPage.jsx:290-301` |
| 29 | `CreateProjectPage` orphaned project on partial failure | `pages/CreateProject/CreateProjectPage.jsx:386-389` |
| 30 | `ProcessingPage` tip rotation interval runs forever | `pages/Processing/ProcessingPage.jsx:154-159` |
| 31 | `ProcessingPage` polling effect restarts on every status change | `pages/Processing/ProcessingPage.jsx:170-175` |
| 32 | `DashboardPage` retry buttons do the same thing | `pages/Dashboard/DashboardPage.jsx:238` |
| 33 | `useScrollReveal` effect re-runs on every render due to inline options object | `hooks/useScrollReveal.js:30` |
| 34 | `queryClient.js` is dead code — never imported | `lib/queryClient.js` |
| 35 | `MobileNav.jsx` is dead code — never imported | `components/layout/MobileNav.jsx` |
| 36 | `ClerkAuthContext.jsx` — `ClerkAuthProvider` exported but never used | `lib/ClerkAuthContext.jsx:4` |
| 37 | `useEstimateMonthlyCredits` named like query but is a mutation | `hooks/queries.js:79-83` |
| 38 | `useDeleteAccount` has no `onSuccess` handler — no redirect/invalidation after deletion | `hooks/queries.js:144-146` |
| 39 | `useUpdateEmail`/`useUpdatePassword` have no cache invalidation | `hooks/queries.js:148-153` |
| 40 | `auth.jsx` `RedirectToSignIn` does side effect during render | `lib/auth.jsx:56-62` |
| 41 | `ErrorBoundary` buttons use `onMouseOver`/`onMouseOut` on wrong target | `components/ErrorBoundary.jsx:86-87` |
| 42 | `ErrorBoundary` renders stack trace in production | `components/ErrorBoundary.jsx:29` |
| 43 | `w-4.5 h-4.5` invalid Tailwind class in 5+ files | Multiple files |

---

## 5. Low Priority Improvements

| # | Issue | File(s) |
|---|-------|---------|
| 1 | `date-fns` listed as dependency but unused | `client/package.json` |
| 2 | `formatDuration` duplicated in `utils.js` and `clipValidation.js` with different formats | `lib/utils.js`, `lib/clipValidation.js` |
| 3 | `getErrorMessage` always returns its fallback — never processes the actual error | `lib/utils.js:62-64` |
| 4 | `formatDuration`/`formatNumber` silently return "0:00"/"0" for NaN input | `lib/utils.js:8-22` |
| 5 | `Spinner` `color` prop partially broken — always uses `text-primary` | `components/ui/Spinner/Spinner.jsx:9` |
| 6 | `Modal` body overflow lock not reference-counted — multiple modals conflict | `components/ui/Modal/Modal.jsx:7-12` |
| 7 | `Modal` has no focus trap — tab escapes to behind overlay | `components/ui/Modal/Modal.jsx` |
| 8 | `EmptyState` spreads `action` object as props without validation | `components/ui/EmptyState/EmptyState.jsx:39` |
| 9 | `Badge` silent no-op for unknown variants | `components/ui/Badge/Badge.jsx:20-33` |
| 10 | `Button` `loading` prop not destructured from `forwardRef` — passes to DOM | `components/ui/Button/Button.jsx:23` |
| 11 | `LandingPage` hash anchors overlap fixed header | `pages/Landing/LandingPage.jsx:131-134` |
| 12 | `LandingPage` footer links break cross-page navigation | `pages/Landing/LandingPage.jsx:540-552` |
| 13 | `DashboardPage` redundant `.slice(0, 5)` — API already limits to 5 | `pages/Dashboard/DashboardPage.jsx:416` |
| 14 | `ResultsPage` duplicate `getPlatformLabel` calls | `pages/Results/ResultsPage.jsx:575-583` |
| 15 | `SignupPage` `w-4.5 h-4.5` invalid Tailwind class | `pages/Auth/SignupPage.jsx:41` |
| 16 | `ProcessingPage` stuck detection only on render, not timer | `pages/Processing/ProcessingPage.jsx:203-204` |
| 17 | `ProcessingPage` auto-redirect delay is arbitrary | `pages/Processing/ProcessingPage.jsx:182` |
| 18 | `SettingsPage` minimal email validation (`@` check only) | `pages/Settings/SettingsPage.jsx:228` |
| 19 | `AppLayout` mobile overlay no `role="dialog"` or keyboard escape | `components/layout/AppLayout.jsx:116-157` |
| 20 | `index.css` FOUC — hardcoded dark theme on `<body>` | `client/index.html:13` |
| 21 | `eslint.config.js` `react/jsx-uses-react` not needed with new JSX transform | `client/eslint.config.js:52` |
| 22 | `package.json` lint script uses `--ext` (ignored by ESLint 9) | `client/package.json:10` |
| 23 | `index.css` caption style classes may be dead code | `client/src/index.css:247-274` |
| 24 | `vite.config.js` `@` alias uses filesystem path — fragile on Windows | `client/vite.config.js:21-23` |
| 25 | `CREDIT_COSTS_LABELS` only used server-side in one route — could be client-only | `config/credits.js:22-31` |
| 26 | `syncUser` in `services/auth.js` is dead code | `services/auth.js:3-20` |
| 27 | `verifyPassword`/`hashPassword` — parallel auth system conflicting with Clerk | `routes/auth.js:16-26` |
| 28 | `unhandledRejection` handler doesn't exit | `app.js:29-31` |
| 29 | `logStartupHealth` spawns yt-dlp without cleanup | `app.js:83-94` |
| 30 | `env.js` config object has fragile closure methods | `config/env.js:71-81` |
| 31 | `migrate.js` splits SQL on `;` — fragile parsing | `database/migrate.js:18-21` |
| 32 | `mockClient` `.then()` chain doesn't handle rejection handler | `config/supabase.js:26` |
| 33 | `probeVideo` resolves with zeroes instead of rejecting on error | `services/video.js:69-101` |
| 34 | `addCaptions` path not sanitized for FFmpeg filter string | `services/video.js:60-67` |
| 35 | `helmet` `crossOriginResourcePolicy: false` weakens isolation | `app.js:42` |
| 36 | No `Content-Security-Policy` customization in production | `app.js:42` |
| 37 | `SkeletonDashboard`/`SkeletonBilling` etc. add to bundle regardless of usage | `components/ui/Skeleton/Skeleton.jsx` |
| 38 | `index.css` `!important` on focus border overrides all consumers | `client/src/index.css:89` |
| 39 | Clerk-specific CSS class overrides are hardcoded — fragile if Clerk updates | `client/src/index.css:119-176` |
| 40 | `useCountUp` doesn't trigger if element conditionally rendered | `hooks/useScrollReveal.js:39-67` |
| 41 | `useCountUp` RAF loop has race between `entries.forEach` and ref update | `hooks/useScrollReveal.js:55` |
| 42 | `theme.jsx` `toggleTheme` doesn't support "system" → "dark" → "system" cycle | `lib/theme.jsx:48` |
| 43 | `vite.config.js` `/api` proxy is superset of `/api/v1` — could proxy unintended requests | `client/vite.config.js:14-17` |
| 44 | `Toast` dismiss button has no `aria-label` | `components/ui/Toast/Toast.jsx:38-52` |
| 45 | `AppLayout` mobile overlay recreated on every open/close (no CSS toggle) | `components/layout/AppLayout.jsx:116-157` |
| 46 | `clipValidation.js` no input validation for NaN/negative values | `lib/clipValidation.js:12` |

---

## 6. Positive Findings

| Area | Details |
|------|---------|
| **Architecture** | Clean separation: `/client` + `/server` monorepo, Vite middleware on single port, lazy routes, modular service layer |
| **Credit System** | Optimistic locking in `reserveCredits`, idempotency keys in schema, comprehensive transaction logging, admin audit table |
| **Design System** | Consistent tokens, responsive skeletons, dark/light mode, well-structured component library (Card, Button, Badge, Input, Toast, Modal, EmptyState, Skeleton) |
| **AI Pipeline** | Graceful fallback chain (NVIDIA → Gemini → mock), bounded concurrency, stuck recovery, 30-min timeout, structured logging |
| **Error Handling** | ErrorBoundary with recovery UI, `getErrorMessage` helper (though currently broken), global error handlers |
| **UI Polish** | Modern SaaS design, smooth animations, staggered reveals, responsive layouts, comprehensive FAQ |
| **Database Schema** | Well-normalized tables, appropriate constraints, updated_at triggers, RLS policies, migration system |
| **Config Architecture** | `plans.js` central config, `credits.js` cost tiers, environment-based feature flags |

---

## 7. Recommendations

### Phase 1: Security Hardening (Days 1–2)
1. **Rotate ALL secrets** in `.env` files. Add `.env` to `.gitignore`. Create `.env.example` with placeholders.
2. **Add admin middleware** — create `requireAdmin` middleware that checks `users.is_admin` column. Apply to all `/api/v1/admin/*` routes.
3. **Move subtitles route** after `authMiddleware` and add ownership verification.
4. **Add Svix signature verification** to Clerk webhook handler.
5. **Add input validation** with Zod on all routes — especially `POST /projects`, `POST /credits/estimate`, `POST /clips/:id/regenerate`.
6. **Sanitize error messages** — return generic "Internal server error" for 500s, log details server-side only.

### Phase 2: Credit System Fixes (Days 2–3)
7. **Fix billing discrepancy** — align `calculateCreditsForClips` with `CREDIT_COSTS.clip` or remove the duplicate.
8. **Add optimistic locking** to `admin/credits/adjust`, `addCredits`, and `refundCredits`.
9. **Validate `amount` is positive** in `addCredits`/`refundCredits`.
10. **Make transaction log failure throw** instead of silently swallowing — credits should not be deducted without a record.
11. **Add idempotency** to payment webhook handlers.

### Phase 3: Critical Bug Fixes (Days 3–4)
12. **Fix `auth.jsx`** — restructure to always call hooks unconditionally, branch on `clerkAvailable` after.
13. **Fix `SettingsPage`** — add optional chaining on `user`, remove hard-coded bio, stabilize effect dependencies.
14. **Fix `ResultsPage`** — import `CheckCircle2` or replace with existing `CheckCircle`.
15. **Fix `payment.js`** — read actual plan from Stripe price ID instead of hardcoding "creator".
16. **Fix `ErrorBoundary` in `main.jsx`** — use a ref to prevent re-triggering `markClerkFailed`.
17. **Fix `Toast.jsx`** — clear timeouts on unmount, consider using a library (sonner, react-hot-toast).

### Phase 4: Performance & Stability (Days 4–5)
18. **Add DB indexes** on frequently queried columns.
19. **Replace `getTransactionStats`** with a DB aggregation query.
20. **Make `uncaughtException` handler exit** the process.
21. **Add periodic temp file cleanup** for orphaned uploads.
22. **Add concurrency guard** for clip regeneration.

### Phase 5: Code Quality (Days 5–6)
23. **Remove dead code**: `queryClient.js`, `MobileNav.jsx`, `ClerkAuthContext.jsx` export, `syncUser`, `CREDIT_COSTS_LABELS` (move to client).
24. **Fix invalid Tailwind classes** (`w-4.5` → `w-5` or `w-4`).
25. **Fix `formatDuration`/`formatNumber`** NaN handling.
26. **Remove `date-fns`** dependency if unused.
27. **Add ESLint rule** for no-console in production.
