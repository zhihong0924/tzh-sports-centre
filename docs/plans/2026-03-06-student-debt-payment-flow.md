# Student Debt & Payment Flow Improvement Plan

Created: 2026-03-06
Status: PENDING
Approved: Yes
Iterations: 2
Worktree: No
Type: Feature

## Summary

**Goal:** Give students visibility into what they owe and let them upload payment receipts; auto-generate recurring booking bills at the start of each month with a 2-day payment deadline; give admins a cross-month view of outstanding debts and tools to record partial payments.

**Architecture:**
- **Recurring billing cron:** On the 1st of each month, calculate each user's recurring booking total, create/update their MonthlyPayment record, and send an in-app notification with the amount and a link to pay. Deadline is always the 3rd. After the 3rd, unpaid bills trigger a reminder to the student and an alert to admins.
- **Student billing view:** Profile tab + dashboard card showing what's owed, breakdown by type, payment history, and a "Pay Now" receipt upload flow.
- **Admin tools:** Cross-month outstanding debt views (list + matrix), "Show All Unpaid" filter, receipt verification, and the existing partial payment recording UI (type exact amount + method).
- **Receipt flow:** Student uploads → pending PaymentTransaction created → admin approves (calls existing payment recording endpoint) → MonthlyPayment updated.

**Tech Stack:** Next.js API routes, Prisma, React components, existing i18n (next-intl), existing Notification model.

## Scope

### In Scope
- Monthly recurring billing cron (auto on 1st + admin manual trigger)
- Overdue detection after the 3rd: reminder to student + alert to admin
- Student billing API (monthly breakdown — lessons, bookings, recurring, shop orders)
- Profile > Billing tab (all logged-in users with any activity, not just trainees)
- Member dashboard billing summary card (amount owed this month, trainee dashboard only)
- Admin outstanding debts view (cross-month, sorted by total owed)
- Admin month-by-month matrix view (students x months)
- Admin "Show All Unpaid" filter on existing payments page
- Student receipt upload from billing tab (for recurring billing payments)
- Admin receipt verification (approve/reject) with partial amount support
- Auth fix for `/api/upload/receipt` endpoint
- Prisma migration for PaymentTransaction receipt fields

### Out of Scope
- Stripe/online payment processing
- Email/SMS notifications (in-app only)
- Auto-generated PDF invoices
- Changing billing rates or lesson billing logic

## Context for Implementer

> Write for an implementer who has never seen the codebase.

- **Patterns to follow:**
  - Admin API auth: `app/api/admin/monthly-payments/route.ts:59-64` — `auth()` + `isAdmin()` check
  - Student API auth: `app/api/profile/notifications/route.ts:6-13` — `auth()` + `session.user.id`
  - Profile tab pattern: `app/profile/page.tsx:216-240` — tabs array with icons
  - Notification creation: see `prisma/schema.prisma` Notification model; create via `prisma.notification.create()`
  - Receipt upload: `app/booking/page.tsx` — POST FormData to `/api/upload/receipt`, get `url` back
  - Billing calculation: `lib/lesson-billing-utils.ts` + `lib/recurring-booking-utils.ts`
  - Cron endpoint pattern: `app/api/cron/credit-expiry/route.ts` — CRON_SECRET header check; registered in `vercel.json`
  - Monthly payment recording: `app/api/admin/monthly-payments/route.ts` POST — upserts MonthlyPayment, creates PaymentTransaction

- **Conventions:**
  - Components organized by domain: `components/admin/`, `components/member/`, `components/profile/`
  - API error format: `{ error: 'message' }` with appropriate status code
  - i18n translations in `messages/{en,zh,ms}.json`
  - Theme-aware Tailwind colors only (see `.claude/rules/dark-mode.md`)
  - Production code under 400 lines; 600 is hard limit — extract components proactively

- **Key files:**
  - `components/admin/PaymentsContent.tsx` — admin monthly payments UI (1052 lines — DO NOT add significant code here, extract new components)
  - `app/api/admin/monthly-payments/route.ts` — GET/POST/PATCH for monthly payments
  - `app/api/admin/monthly-payments/breakdown.ts` — per-user detailed breakdown helper
  - `lib/lesson-billing-utils.ts` — `getLessonBillingForMonth()` and `calculateUserLessonCharges()`
  - `lib/recurring-booking-utils.ts` — `calculateHours()`, `calculateBookingAmount()`, `countSessionsInMonth()`
  - `components/member/MemberDashboard.tsx` — trainee dashboard (at `/training`)
  - `components/member/StatsCards.tsx` — 3-card stat grid on trainee dashboard
  - `app/profile/page.tsx` — profile page; `TabType` union line 31, `validTabs` array line 72, tabs rendered line 216
  - `prisma/schema.prisma` — MonthlyPayment, PaymentTransaction, RecurringBooking, ShopOrder, Notification models
  - `app/api/upload/receipt/route.ts` — receipt upload to Vercel Blob (currently NO auth — needs fix)
  - `vercel.json` — cron config (already has expire-bookings cron at `0 0 * * *`)

- **Gotchas:**
  - `MonthlyPayment` records are currently only created when admin records a payment. After this work, they will also be pre-created by the billing cron on the 1st of each month for users with recurring bookings.
  - `validTabs` on line 72 of `app/profile/page.tsx` MUST include `"billing"` — if only the tabs array is updated, URL deep-links like `/profile?tab=billing` silently fall back to the default tab.
  - `PaymentsContent.tsx` is already 1052 lines — any admin UI additions MUST be in separate component files.
  - `/api/upload/receipt` currently has zero auth protection — any unauthenticated user can upload to Vercel Blob.
  - `ShopOrder` debts are NOT in the `MonthlyPayment` system — they must be aggregated separately.
  - The billing tab should be visible to ALL logged-in users (not just trainees) — anyone can have recurring court bookings.
  - Recurring booking billing amounts are computed from `countSessionsInMonth()` × hourly rate — see `lib/recurring-booking-utils.ts`.

- **Domain context:**
  - **Recurring booking billing flow (NEW):** On the 1st of each month, calculate each active recurring booking user's total for the month → create MonthlyPayment record → send notification → deadline is 3rd → overdue check on 4th.
  - **Existing billing types:** one-time bookings (Booking.totalAmount), recurring bookings (sessions × rate), lessons (LessonSession, per_session or monthly billing), shop orders (ShopOrder.total, separate from MonthlyPayment).
  - Admin records payments via the existing POST `/api/admin/monthly-payments` — supports partial amounts (enter exact RM amount received). This is already functional; the plan exposes it better, not replaces it.
  - `MonthlyPayment.status` values: `"unpaid"`, `"partial"`, `"paid"`.
  - `PaymentTransaction` records each payment event; linked to `MonthlyPayment`.

## Runtime Environment
- **Start command:** `npm run dev`
- **Port:** 3000
- **Health check:** `http://localhost:3000`

## Progress Tracking
- [x] Task 1: Student Billing API
- [x] Task 2: Profile Billing Tab (all users)
- [x] Task 3: Dashboard Billing Summary (trainee dashboard)
- [x] Task 4: Admin Outstanding Debts & Multi-Month Views
- [x] Task 5: Student Receipt Upload & Auth Fix
- [x] Task 6: Monthly Recurring Billing Cron & Overdue Alerts
**Total Tasks:** 6 | **Completed:** 6 | **Remaining:** 0

## Implementation Tasks

### Task 1: Student Billing API

**Objective:** Create an API endpoint returning the authenticated user's billing data for a given month (lessons, bookings, recurring, shop orders). Supports summary-only mode (for dashboard card) and all-unpaid query (for outstanding alert).

**Dependencies:** None

**Files:**
- Create: `app/api/profile/billing/route.ts`

**Key Decisions / Notes:**
- Reuse `getLessonBillingForMonth` from `lib/lesson-billing-utils.ts` and `calculateHours`/`calculateBookingAmount`/`countSessionsInMonth` from `lib/recurring-booking-utils.ts`.
- Mirror the calculation in `app/api/admin/monthly-payments/route.ts:141-175` but for the single authenticated user.
- **ShopOrder:** Query `ShopOrder` where `userId = session.user.id`, `paymentStatus != 'paid'`, and `createdAt` falls in the month. Add as `type: "shop"` items. Shop totals are separate from `MonthlyPayment.paidAmount` — sum them separately in the response summary.
- **Query params:**
  - `?month=N&year=N` — specific month (default: current month)
  - `?summary=true` — return ONLY `{ totalAmount, paidAmount, unpaidAmount, status }`, no breakdown array (dashboard card uses this)
  - `?all_unpaid=true` — return `[{ month, year, unpaidAmount }]` across all months; returns `[]` if no unpaid months
- Auth: `session.user.id` only — no admin check.

**Definition of Done:**
- [ ] `GET /api/profile/billing?month=3&year=2026` returns breakdown including shop orders for authenticated user
- [ ] `GET /api/profile/billing?summary=true` returns only `{ totalAmount, paidAmount, unpaidAmount, status }` (no breakdown array)
- [ ] `GET /api/profile/billing?all_unpaid=true` returns `[]` when no unpaid months; returns `[{ month, year, unpaidAmount }]` when unpaid months exist
- [ ] Returns 401 for unauthenticated requests
- [ ] No diagnostics errors

**Verify:**
- Test against running dev server (curl or browser)

---

### Task 2: Profile Billing Tab (all users)

**Objective:** Add a "Billing" tab to the profile page visible to ALL logged-in users (not just trainees), showing monthly charge breakdown, payment history, outstanding months, and a "Pay Now" button linking to the receipt upload flow.

**Dependencies:** Task 1

**Files:**
- Create: `components/profile/BillingTab.tsx`
- Modify: `app/profile/page.tsx` — add `"billing"` to `TabType` union (line 31) AND `validTabs` array (line 72); add billing to tabs array (not gated by isTrainee); import `BillingTab`
- Modify: `messages/en.json`, `messages/zh.json`, `messages/ms.json` — add billing tab label

**Key Decisions / Notes:**
- Add `"billing"` to BOTH `TabType` union AND `validTabs` array — if only the tabs array is updated, `/profile?tab=billing` URL deep-links silently fall back to default.
- Billing tab is visible to all logged-in users (anyone can have recurring court bookings, not just trainees). Show an empty state with helpful text if the user has no billing history.
- Icon: `Receipt` from lucide-react.
- **UI sections:**
  1. **Outstanding months alert** (top, if any): Red/amber banner — "You have unpaid bills for: March 2026 (RM300), February 2026 (RM150). View Details."
  2. **Month selector** — same month/year nav as admin PaymentsContent, defaulting to current month
  3. **Summary card** — Total Due, Paid, Remaining, status badge (paid/partial/unpaid). If billing was auto-generated for the month (Task 6), show payment deadline: "Due by 3rd of this month"
  4. **Breakdown table** — date, type (lesson/booking/recurring/shop), description, amount
  5. **Payment history** — list of PaymentTransactions for the month (date, amount, method, status badge for pending_verification receipts)
  6. **Pay Now button** — visible when unpaidAmount > 0; links to receipt upload dialog (Task 5)

**Definition of Done:**
- [ ] Billing tab appears for ALL logged-in users (not gated by isTrainee)
- [ ] Navigating to `/profile?tab=billing` directly opens the billing tab
- [ ] Outstanding months alert shows correctly when multiple months have unpaid balances
- [ ] Monthly breakdown table shows all charge types
- [ ] Payment history lists recorded transactions
- [ ] Empty state shown when user has no billing history
- [ ] Month navigation works (previous/next)
- [ ] No diagnostics errors

**Verify:**
- playwright-cli on running app

---

### Task 3: Dashboard Billing Summary (trainee dashboard only)

**Objective:** Add a "Balance Due" stat card to the member training dashboard showing the current month's owed amount at a glance, linking to the profile billing tab.

**Dependencies:** Task 1, Task 2

**Files:**
- Modify: `components/member/StatsCards.tsx` — add fourth `billingAmount` / `billingStatus` prop and card
- Modify: `components/member/MemberDashboard.tsx` — fetch billing summary, pass to StatsCards; add overdue banner
- Modify: `messages/en.json`, `messages/zh.json`, `messages/ms.json` — card labels

**Key Decisions / Notes:**
- Fetch `/api/profile/billing?summary=true&month=<current>&year=<current>`. On failure, show neutral state `"—"` — do NOT crash the dashboard. Wrap fetch in try/catch independent of the main lesson fetch.
- Card colors: green (paid / RM0), red (unpaid), amber (partial).
- Clicking the card navigates to `/profile?tab=billing`.
- Also show a dismissible overdue banner (session-only) if current month bill is overdue (past the 3rd and still unpaid): "⚠️ Your recurring booking payment of RM{X} was due on the 3rd. Pay now →"

**Definition of Done:**
- [ ] 4th stat card shows current month balance with correct color coding
- [ ] Clicking card opens `/profile?tab=billing` (billing tab, not default tab)
- [ ] Overdue banner appears after the 3rd when bill is unpaid
- [ ] Billing fetch failure shows neutral state without breaking dashboard
- [ ] No diagnostics errors

**Verify:**
- playwright-cli on running app

---

### Task 4: Admin Outstanding Debts & Multi-Month Views

**Objective:** Give admins three new views: an all-unpaid cross-month list, a month-by-month matrix, and a "Show All Unpaid" toggle on the existing payments page. Admin partial payment recording is already supported by the existing "Record Payment" dialog (input exact amount + method) — no code change needed for that, just ensure it's accessible from the new views.

**Dependencies:** None

**Files:**
- Create: `app/api/admin/monthly-payments/outstanding/route.ts`
- Create: `components/admin/OutstandingDebtsView.tsx`
- Modify: `components/admin/PaymentsContent.tsx` — add toggle button ONLY (< 20 lines), delegate to `OutstandingDebtsView`
- Modify: `messages/en.json`, `messages/zh.json`, `messages/ms.json`

**Key Decisions / Notes:**
- **Outstanding API (`/api/admin/monthly-payments/outstanding`):**
  - Returns all users with unpaid MonthlyPayment records across any month in the lookback window.
  - **Performance:** Query existing `MonthlyPayment` records where `status != 'paid'` — do NOT recalculate billing live for past months. For the current month, also include users with active recurring bookings who don't have a MonthlyPayment record yet (show estimated amount).
  - Response per user: `{ userId, name, uid, phone, email, totalOwed, months: [{ month, year, totalAmount, paidAmount, unpaidAmount, status }] }`
  - Support `?months=6` lookback (default 6).

- **OutstandingDebtsView.tsx:**
  - Two sub-views toggled by tab/button: "List" and "Matrix".
  - **List view:** sorted by total owed descending. Each row: name, UID, contact, total owed, which months. Expandable to see per-month amounts. "Record Payment" button opens the existing payment recording dialog (reuse component from PaymentsContent or trigger the same API call).
  - **Matrix view:** students as rows, last N months as columns. Cell colors: green (paid), red (RM amount owed), amber (partial RM), gray (no bookings). Clicking a cell navigates to that student's breakdown for that month.

- **PaymentsContent.tsx change:** Add one toggle button "Show All Unpaid" — when active, render `<OutstandingDebtsView />` in place of the monthly list. Keep change minimal.

**Definition of Done:**
- [ ] `GET /api/admin/monthly-payments/outstanding` returns cross-month unpaid data (no timeout — uses stored MonthlyPayment records)
- [ ] List view shows all users with unpaid balances sorted by amount, with expandable per-month detail
- [ ] Matrix view renders students × months with color-coded cells
- [ ] "Show All Unpaid" toggle in PaymentsContent switches to OutstandingDebtsView
- [ ] "Record Payment" in OutstandingDebtsView correctly records partial amounts (uses existing POST endpoint)
- [ ] No diagnostics errors

**Verify:**
- playwright-cli on admin payments page

---

### Task 5: Student Receipt Upload & Auth Fix

**Objective:** Let students upload payment receipts from the billing tab, creating a pending transaction for admin review. Fix the unauthenticated upload endpoint.

**Dependencies:** Task 2

**Files:**
- Modify: `prisma/schema.prisma` — add `receiptUrl String? @map("receipt_url")` and `verificationStatus String? @map("verification_status")` to `PaymentTransaction`
- Create: `prisma/migrations/<timestamp>_add_receipt_fields/migration.sql` (generated by `npx prisma migrate dev`)
- Modify: `app/api/upload/receipt/route.ts` — add auth check at top
- Create: `app/api/profile/billing/upload-receipt/route.ts` — student submits receipt metadata
- Create: `components/profile/BillingReceiptDialog.tsx` — "Pay Now" dialog with method select + upload
- Create: `components/admin/ReceiptReviewDialog.tsx` — admin views receipt image, approves or rejects
- Modify: `components/profile/BillingTab.tsx` — wire "Pay Now" to BillingReceiptDialog
- Modify: `components/admin/PaymentsContent.tsx` — add receipt pending badge to user rows ONLY (minimal); import ReceiptReviewDialog

**Key Decisions / Notes:**
- **Schema:** `verificationStatus` nullable — `null` = no receipt uploaded; `"pending_verification"` = awaiting admin; `"approved"` = paid; `"rejected"` = student must re-upload. Null-safe: admin queries must use `verificationStatus: 'pending_verification'` not just truthy check.
- **Auth fix:** Add to top of `/api/upload/receipt/route.ts`: `const session = await auth(); if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })`. Booking and stringing flows already send auth cookies — no breakage.
- **Student upload flow:**
  1. Click "Pay Now" on BillingTab → opens `BillingReceiptDialog`
  2. Select payment method (TnG / DuitNow / bank_transfer), enter amount paid, upload receipt image, optional notes
  3. Upload to `/api/upload/receipt` → get `url`
  4. POST `/api/profile/billing/upload-receipt` → `{ month, year, amount, paymentMethod, receiptUrl, notes }`
  5. Endpoint creates `PaymentTransaction` with `verificationStatus: 'pending_verification'`, `receiptUrl`. Does NOT update `MonthlyPayment.paidAmount` yet.
  6. Rate limit: reject if a `pending_verification` transaction already exists for that user/month.
- **Admin approval flow:**
  - Badge shows on user row in PaymentsContent when pending receipt exists.
  - Admin opens `ReceiptReviewDialog` — shows receipt image, amount, method.
  - Approve: calls existing POST `/api/admin/monthly-payments` with the receipt's amount and method (same code path as manual recording). Then updates PaymentTransaction `verificationStatus` to `approved`. MonthlyPayment.paidAmount is updated by the existing endpoint.
  - Reject: updates `verificationStatus` to `rejected`. Student can re-upload.
  - Admin can also type a DIFFERENT amount in the approve dialog if the actual amount differs from what student entered.

**Definition of Done:**
- [ ] `npx prisma migrate dev` succeeds — PaymentTransaction has `receiptUrl` and `verificationStatus` fields
- [ ] `POST /api/upload/receipt` returns 401 for unauthenticated requests
- [ ] Student can upload receipt from BillingTab with method + amount selection
- [ ] Duplicate pending upload for same user/month is rejected with clear error
- [ ] Admin sees pending receipt badge on user row in PaymentsContent
- [ ] Admin can open ReceiptReviewDialog, view image, approve or reject
- [ ] After approval, `MonthlyPayment.paidAmount` is updated and `PaymentTransaction.verificationStatus = 'approved'`
- [ ] No diagnostics errors

**Verify:**
- End-to-end: upload receipt as student → verify badge appears for admin → approve → verify balance updated

---

### Task 6: Monthly Recurring Billing Cron & Overdue Alerts

**Objective:** Automatically generate recurring booking bills on the 1st of each month, notify users, and send overdue reminders after the 3rd (payment deadline).

**Dependencies:** Task 1

**Files:**
- Create: `app/api/cron/generate-recurring-bills/route.ts` — billing generation cron + manual trigger handler
- Create: `app/api/admin/billing/generate-month/route.ts` — admin-only manual trigger endpoint
- Modify: `vercel.json` — add two cron entries
- Modify: `messages/en.json`, `messages/zh.json`, `messages/ms.json` — notification message strings

**Key Decisions / Notes:**

- **Billing generation cron** (`/api/cron/generate-recurring-bills`):
  - Schedule: `0 1 1 * *` (1am UTC on 1st of each month = 9am MYT)
  - For each user with at least one active `RecurringBooking`:
    1. Calculate total for the current month using `countSessionsInMonth()` × hourly rate (same logic as existing monthly payments)
    2. Upsert `MonthlyPayment` record for this user/month (set `totalAmount`, `status: 'unpaid'`, `bookingsCount`)
    3. Create `Notification`: type `"billing_generated"`, message `"Your recurring booking bill for {month} is RM{amount}. Due by the 3rd."`, link `/profile?tab=billing`
    4. Skip if MonthlyPayment already exists and status is not `"unpaid"` (i.e. already partly/fully paid — don't overwrite)
  - Protect with `CRON_SECRET` header check.

- **Admin manual trigger** (`/api/admin/billing/generate-month`):
  - POST with `{ month, year }` — runs the same logic as the cron for the specified month.
  - Admin-only (isAdmin check).
  - Returns: `{ generated: N, skipped: N, users: [...] }`.
  - Add a "Generate Bills" button to PaymentsContent (or OutstandingDebtsView) that calls this endpoint. Minimal UI: button + confirmation dialog.

- **Overdue alerts cron** (`/api/cron/generate-recurring-bills` handles this too, or a separate endpoint):
  - Schedule: `0 1 4 * *` (1am UTC on 4th of each month = 9am MYT on 4th)
  - For each MonthlyPayment from the PREVIOUS month (i.e., this is the 4th so check month-1) where status != 'paid':
    - Create student Notification: type `"payment_overdue"`, message `"Your payment of RM{amount} for {month} is overdue. Please pay now."`, link `/profile?tab=billing`
    - Create admin Notification (to all admins): type `"admin_overdue_alert"`, message `"{name} (UID {uid}) has an overdue payment of RM{amount} for {month}."`
    - Skip if overdue notification already sent for this user/month.
  - Can be a second cron path in the same file, or a separate file — implementer's choice based on code length.

- **vercel.json entries:**
  ```json
  { "path": "/api/cron/generate-recurring-bills", "schedule": "0 1 1 * *" },
  { "path": "/api/cron/check-overdue-bills", "schedule": "0 1 4 * *" }
  ```

**Definition of Done:**
- [ ] `POST /api/admin/billing/generate-month` creates MonthlyPayment records and notifications for all users with active recurring bookings
- [ ] Calling the endpoint twice for the same month does not overwrite already-paid records
- [ ] Users with active recurring bookings receive a "billing_generated" in-app notification with the correct amount
- [ ] After the 3rd, unpaid users receive an overdue notification; all admins receive an alert notification
- [ ] `vercel.json` has both cron entries
- [ ] No diagnostics errors

**Verify:**
- Call generate endpoint manually, verify MonthlyPayment records and notifications created
- Call overdue endpoint manually, verify notifications created for unpaid records only

## Testing Strategy

- **Unit:** Billing calculation utilities (already tested); test `countSessionsInMonth` edge cases
- **Integration:** API endpoints return correct shapes; partial payment recording updates MonthlyPayment correctly
- **Manual/E2E (playwright-cli):**
  - Student sees billing tab with breakdown and "Pay Now" button
  - Student uploads receipt → pending state shown
  - Admin sees badge → opens receipt dialog → approves → balance updates
  - Admin triggers manual billing generation → MonthlyPayment records created
  - Admin sees outstanding debts list and matrix view
  - Overdue banner appears on dashboard after 3rd

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PaymentsContent.tsx exceeds line limit | High | High | Extract OutstandingDebtsView and ReceiptReviewDialog as separate files; PaymentsContent only adds toggle + badge (<30 lines) |
| Admin outstanding API slow/timeout | Medium | High | Only query existing MonthlyPayment records (no live recalculation for past months) |
| Billing cron runs twice (duplicate bills) | Low | Medium | Skip if MonthlyPayment already exists and status != 'unpaid'; idempotent upsert |
| Receipt upload abuse (unauthenticated) | High | Medium | Auth fix on /api/upload/receipt is mandatory prerequisite; done in Task 5 |
| PaymentTransaction migration breaks existing data | Low | Low | Nullable fields; npx prisma migrate dev; null-safe queries |
| Dashboard billing fetch crashes dashboard | Medium | Medium | Independent try/catch; neutral "—" state on error |
| Overdue alerts sent multiple times | Low | Low | Check for existing notification of same type+month before creating |

## Goal Verification

### Truths
1. On the 1st of each month, users with recurring bookings receive a bill notification with amount and deadline
2. After the 3rd, unpaid users receive an overdue reminder; admins see an alert
3. Students can view their monthly billing breakdown on a dedicated profile tab (visible to all users)
4. Students can upload payment receipts; balance updates only after admin approval
5. Admins can record partial payments by typing the exact amount received
6. Admins can see all outstanding debts across all months in a list and matrix view
7. The member dashboard shows current month balance at a glance

### Artifacts
1. `app/api/profile/billing/route.ts` — student billing API
2. `components/profile/BillingTab.tsx` + `BillingReceiptDialog.tsx` — student billing UI
3. `components/admin/OutstandingDebtsView.tsx` + `ReceiptReviewDialog.tsx` — admin views
4. `app/api/admin/monthly-payments/outstanding/route.ts` — cross-month admin API
5. `app/api/admin/billing/generate-month/route.ts` — admin manual billing trigger
6. `app/api/cron/generate-recurring-bills/route.ts` — billing + overdue crons

### Key Links
1. Billing cron → `countSessionsInMonth()` → MonthlyPayment upsert → Notification
2. Student billing tab → `GET /api/profile/billing` → MonthlyPayment + ShopOrder aggregation
3. Receipt upload → `/api/upload/receipt` → PaymentTransaction (pending) → admin approve → POST `/api/admin/monthly-payments`
4. OutstandingDebtsView → `GET /api/admin/monthly-payments/outstanding` (MonthlyPayment records only, no live calc)
5. Admin "Generate Bills" → `POST /api/admin/billing/generate-month` → same logic as cron

## Open Questions
None.
