# TZH Sports Centre — Developer Handoff

**Date:** March 2026
**Stack:** Next.js 16 (App Router) · TypeScript · PostgreSQL + Prisma · NextAuth v5 · Tailwind CSS v4

---

## 1. Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- npm

### Setup

```bash
npm install
cp .env.example .env   # Fill in all values (see §2 below)
npx prisma migrate dev  # Run all migrations
npm run db:seed         # Seed initial data (courts, time slots, strings)
npm run dev             # Dev server at http://localhost:3000
```

### Build / Deploy

```bash
npm run build   # runs `prisma generate` then `next build`
npm start
```

---

## 2. Environment Variables

All required — no defaults in production:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | NextAuth session signing secret |
| `NEXTAUTH_URL` | Full app URL (e.g. `https://yourdomain.com`) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob — receipt/image uploads |
| `STRIPE_SECRET_KEY` | Stripe server-side API key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe client-side key |
| `CRON_SECRET` | Shared secret to authenticate cron job calls |
| `SMTP_HOST` | Email server host (optional — for notifications) |
| `SMTP_PORT` | Email server port |
| `SMTP_USER` | Email username |
| `SMTP_PASS` | Email password |
| `SMTP_FROM` | From address for emails |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google Gemini — used for chat assistant feature |

---

## 3. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.1.1 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Database | PostgreSQL via Prisma 5 ORM |
| Auth | NextAuth v5 beta.30 (Credentials provider) |
| Styling | Tailwind CSS v4 + Radix UI (shadcn/ui pattern) |
| i18n | next-intl (EN / ZH / MS) |
| Payments | Stripe (shop) + manual receipt upload (bookings/lessons) |
| File Storage | Vercel Blob |
| AI | Vercel AI SDK + Google Gemini (chat assistant) |
| Testing | Vitest (unit) + Playwright (E2E) |
| Deployment | Vercel (region: `sin1` — Singapore) |

---

## 4. User Roles

Roles are stored as boolean flags on the `User` model. A user can hold multiple roles simultaneously.

| Flag | Access |
|---|---|
| `isAdmin` | Full admin dashboard at `/admin` |
| `isMember` | Member dashboard, lesson booking, absence system |
| `isTrainee` | Trainee-specific features (subset of member) |
| `isTeacher` | Teacher dashboard at `/teacher` (linked via `Teacher` model) |
| `isContentCreator` | Can publish videos on the video platform |

**Important:** `session.user.isAdmin` is available in the JWT session. However, for sensitive operations, always re-query the database — never trust the session flag alone for admin actions.

---

## 5. Authentication

- Login via **email or phone number** + password (bcrypt hashed)
- Sessions are JWT-based (NextAuth Credentials provider)
- Middleware at `middleware.ts` protects `/dashboard`, `/profile`, `/admin`
- Admin routes additionally check `user.isAdmin` by querying the DB inside each API route
- Email verification flow exists (`emailVerifyToken`, `pendingEmail` fields on User)

---

## 6. Database — Model Overview

Schema is in `prisma/schema.prisma`. Key models:

### Core
| Model | Purpose |
|---|---|
| `User` | All users (admin/member/teacher/trainee/guest) |
| `Court` | Badminton/pickleball courts |
| `Booking` | One-off court bookings |
| `RecurringBooking` | Fixed weekly court slots |
| `TimeSlot` | Available booking time slots |

### Lessons
| Model | Purpose |
|---|---|
| `LessonType` | Lesson categories with pricing (per-session or monthly) |
| `LessonTypePricing` | Duration-based pricing tiers per lesson type |
| `LessonSession` | Individual scheduled lesson instances |
| `RecurringLesson` | Weekly lesson templates that generate sessions |
| `LessonRequest` | Member trial/lesson requests |
| `LessonAttendance` | Per-session attendance records |
| `Teacher` / `TeacherPayRate` | Staff and their pay rates per lesson type |
| `TrainingGroup` | Groups of trainees assigned to lessons |

### Payments & Billing
| Model | Purpose |
|---|---|
| `MonthlyPayment` | Monthly billing record per user |
| `PaymentTransaction` | Individual payment entries against a monthly bill |
| `RecurringBookingPayment` | Monthly payment records for recurring court bookings |

### Absence & Replacement System
| Model | Purpose |
|---|---|
| `Absence` | Student absence records (APPLY / LATE_NOTICE / ABSENT / MEDICAL) |
| `ReplacementCredit` | Credit earned from qualifying absences (≥7 days notice) |
| `ReplacementBooking` | Booking of a replacement lesson using a credit |

### Shop & Services
| Model | Purpose |
|---|---|
| `ShopProduct` | Merchandise products |
| `ShopOrder` | Customer orders (Stripe or manual payment) |
| `StringingOrder` | Racket stringing service orders |
| `StringStock` / `StringStockLog` | Stringing inventory management |
| `RacketProfile` | User's saved racket profiles |

### Gamification
| Model | Purpose |
|---|---|
| `GameSession` | Social badminton sessions |
| `SessionAttendance` | Who attended a game session |
| `Match` / `MatchPlayer` | Match results within sessions |
| `PlayerPoints` | Monthly points tally per player |
| `PlayerProfile` | Aggregate stats (win rate, streaks, group) |

### Other
| Model | Purpose |
|---|---|
| `Notification` | In-app notifications per user |
| `AuditLog` | Admin action audit trail |
| `CoachAvailability` | Coach availability slots |
| `TrialRequest` | Public trial lesson requests (no account needed) |
| `Video` / `VideoSubscription` | Video content platform (incomplete — see §10) |

---

## 7. Feature Map

### Public Pages
- `/` — Homepage with pricing, trial request form
- `/booking` — Court booking flow (guest or logged-in)
- `/shop` — Merchandise shop
- `/stringing` — Racket stringing order form
- `/leaderboard` — Player points leaderboard
- `/lessons` — Lesson types info page
- `/terms` — Terms of service

### Member Area (`/member`, `/profile`, `/dashboard`)
- **Member Dashboard** — upcoming lessons, stats cards, overdue billing alert
- **Profile** — personal info, racket profiles, notification preferences, recurring bookings, billing tab
- **Absence system** — apply for absence with notice (earns replacement credits if ≥7 days)
- **Replacement booking** — use replacement credits to book into other sessions

### Teacher Dashboard (`/teacher`)
- View assigned lesson sessions
- Mark attendance
- View upcoming schedule

### Admin Dashboard (`/admin`)
- **Bookings/Lessons Grid** — unified weekly grid, drag-to-reschedule, bulk move
- **Members** — user management, credit balance, role assignment
- **Payments** — monthly billing, record payments, outstanding debts view
- **Recurring Lessons** — manage weekly lesson schedules
- **Lesson Types** — configure lesson categories and pricing
- **Stringing** — order management and stock control
- **Shop** — order management
- **Staff** — teacher management, pay rates, pay summaries
- **Absences** — review medical absences
- **Trial Requests** — manage trial lesson enquiries
- **Training Groups** — organise trainees into lesson groups
- **Leaderboard** — game session and points management
- **Video Subscriptions** — manage user subscriptions to video content
- **Accounts** — user accounts management

---

## 8. API Routes Overview

All routes in `app/api/`. Auth pattern: `await auth()` then check `user.isAdmin` via DB for admin routes.

### Cron Jobs (`app/api/cron/`) — Vercel Cron

| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/expire-bookings` | Daily midnight | Expire unpaid pending bookings past their window |
| `/api/cron/generate-recurring-bills` | 1st of month, 1am | Generate `MonthlyPayment` records for recurring bookings and lessons |
| `/api/cron/check-overdue-bills` | 4th of month, 1am | Mark bills past the 2-day grace window as overdue |
| `/api/cron/credit-expiry` | (manual trigger) | Notify/expire unused replacement credits |

All cron routes check `Authorization: Bearer ${CRON_SECRET}` or `x-cron-secret` header.

### Key API Namespaces

| Path | Purpose |
|---|---|
| `/api/bookings` | Court booking CRUD |
| `/api/recurring-bookings` | Recurring court slot management |
| `/api/payments` | Monthly payment recording |
| `/api/profile/billing` | Student billing summary for profile tab |
| `/api/admin/monthly-payments` | Admin payment management |
| `/api/admin/monthly-payments/outstanding` | Outstanding debts view |
| `/api/admin/lessons` | Admin lesson session management |
| `/api/admin/recurring-lessons` | Admin recurring lesson management |
| `/api/admin/members` | Member management |
| `/api/admin/staff` | Teacher/staff management |
| `/api/admin/stringing` | Stringing order management |
| `/api/absences` | Absence applications and tracking |
| `/api/replacement` | Replacement credit/booking management |
| `/api/shop` | Shop orders |
| `/api/stringing` | Stringing orders (public/member) |
| `/api/upload` | Receipt/image upload to Vercel Blob |
| `/api/receipt` | Receipt review (admin approve/reject) |
| `/api/cron/*` | Scheduled jobs (see above) |

---

## 9. i18n

Translations live in `messages/en.json`, `messages/zh.json`, `messages/ms.json` (~2000 lines each).

**Pattern in components:**
```typescript
import { useTranslations } from 'next-intl'
const t = useTranslations('namespace')
// then: t('key')
```

When adding new UI strings, add to all three files. The locale is stored in `NEXT_LOCALE` cookie and `localStorage`.

---

## 10. Known Incomplete Features

### Videos Section — Hidden, Not Functional
The videos/content creator platform (`/videos`, `Video`, `VideoSubscription` models) was scaffolded but is **intentionally hidden from navigation** (`e336694`). The data models and admin subscription management UI exist, but the actual video viewing experience is incomplete. Do not enable it without finishing the feature.

### Student Billing — Partially Complete
The billing system was implemented in the most recent milestone:
- ✅ `MonthlyPayment` + `PaymentTransaction` models
- ✅ Billing API (`/api/profile/billing`)
- ✅ Profile billing tab (`components/profile/BillingTab.tsx`)
- ✅ Dashboard overdue alert (`components/member/MemberDashboard.tsx`)
- ✅ Admin outstanding debts view (`components/admin/OutstandingDebtsView.tsx`)
- ✅ Receipt upload by students, admin review workflow
- ✅ Cron: `generate-recurring-bills`, `check-overdue-bills`
- ⚠️ The cron `credit-expiry` route exists but is not scheduled in `vercel.json` — add it if replacement credit expiry notifications are needed

---

## 11. Payment Flow

All non-Stripe payments (court bookings, lessons, stringing) use a **manual receipt upload** workflow:

1. User selects TnG or DuitNow as payment method
2. User uploads receipt screenshot (stored in Vercel Blob)
3. Admin reviews and approves/rejects in the admin dashboard
4. Approved receipts mark the booking/order as paid

**Stripe** is used only for the shop (`/shop`). Shop orders go through Stripe Checkout.

**Monthly billing** (for recurring bookings and lesson members):
- Bills are auto-generated on the 1st of each month by cron
- 2-day grace period; overdue marking runs on the 4th
- Students can upload receipts against their monthly bill
- Admins can record partial payments from the Payments tab

---

## 12. File Storage (Vercel Blob)

Receipt screenshots and profile avatars are stored in Vercel Blob via `@vercel/blob`. The `BLOB_READ_WRITE_TOKEN` env var is required. Upload endpoint: `/api/upload`.

---

## 13. Pricing Reference

| Sport | Rate | Notes |
|---|---|---|
| Badminton | RM 7.50 / 30 min | 1-hour minimum |
| Badminton (peak, after 6 PM) | RM 9.00 / 30 min | 1-hour minimum |
| Pickleball | RM 12.50 / 30 min | 2-hour minimum |

Court pricing is also stored on the `Court.hourlyRate` DB field. Business logic for peak hours is in `lib/lesson-config.ts` and `lib/timetable-utils.ts`.

---

## 14. Key Utility Files

| File | Purpose |
|---|---|
| `lib/auth.ts` | NextAuth configuration |
| `lib/prisma.ts` | Prisma client singleton |
| `lib/validation.ts` | Malaysian phone, email, sport, payment method validators |
| `lib/malaysia-time.ts` | Timezone helpers (Asia/Kuala_Lumpur) |
| `lib/lesson-config.ts` | Lesson pricing, court config |
| `lib/lesson-billing-utils.ts` | Billing calculation helpers |
| `lib/recurring-booking-utils.ts` | Recurring booking session generation |
| `lib/timetable-utils.ts` | Timetable/slot conflict helpers |
| `lib/absence.ts` | Absence logic, credit calculation |
| `lib/gamification.ts` | Points calculation |
| `lib/booking-expiration.ts` | Booking expiry logic |
| `lib/email.ts` | Nodemailer email sending |
| `lib/audit.ts` | Admin audit logging |
| `lib/rate-limit.ts` | API rate limiting |
| `lib/stripe.ts` | Stripe client |

---

## 15. Testing

```bash
npm test              # Vitest unit tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:e2e      # Playwright E2E tests
```

Unit tests use Vitest + Testing Library + MSW for API mocking. E2E tests use Playwright against a running dev server.

---

## 16. Deployment

The app is deployed on **Vercel** (region: Singapore `sin1`). The `vercel.json` configures cron jobs.

**Required Vercel settings:**
- All env vars from §2 added to the Vercel project
- PostgreSQL connection string should use a connection pooler (PgBouncer) for serverless — Prisma's `DIRECT_URL` env var is recommended alongside `DATABASE_URL` when using Prisma Accelerate or Supabase pooling
- Vercel Blob storage configured and token set

**Deploy command:** Vercel auto-detects Next.js. Build command is `npm run build` (which runs `prisma generate` first).

---

## 17. Dark Mode

The app supports light/dark mode via `next-themes`. All colours use CSS variables defined in `app/globals.css`. **Never use hardcoded hex values** — use Tailwind semantic classes like `bg-card`, `text-foreground`, `border-border`. Full reference in `.claude/rules/dark-mode.md`.

---

## 18. Recent Significant Changes (last ~3 months)

| Date | Change |
|---|---|
| Mar 2026 | Student debt & payment flow: monthly billing, receipt upload, admin review, outstanding debts view |
| Mar 2026 | Hid videos section (incomplete) |
| Mar 2026 | Teacher dashboard infinite loading fix |
| Feb 2026 | Bulk move bookings/lessons, drag-to-reschedule, grid lesson dialogs |
| Feb 2026 | Video subscriptions platform (partial), booking expiration protection |
| Feb 2026 | Racket presets, shop filters, multi-slot booking, staff system overhaul |
| Feb 2026 | Lesson billing integrated into monthly payments |
| Feb 2026 | Training groups for lesson scheduling |
| Feb 2026 | Attendance tracking, recurring lessons, teacher dashboard, notifications |
| Feb 2026 | Absence + replacement booking system, gamification (points/leaderboard) |
