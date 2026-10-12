# Location-Based Workforce Attendance Management System

A production-oriented, responsive workforce attendance management application inspired by the workflow patterns of KEKA, with a minimalistic, professional enterprise user experience.

The application manages workers who clock in at assigned physical worksites. Every clock-in is validated against the worksite's configured geofence, requires a fresh attendance selfie, and is routed to the supervisor assigned to that worksite for the relevant workday and shift.

---

## 1. Architecture Summary

The system is constructed as a decoupled client-server architecture:

```
[ Frontend: React 19 + Vite + TypeScript + Tailwind CSS ]
                         │
                  REST API (/api/v1)
                         ▼
[ Backend: Node.js + Express 5 + TypeScript + Zod Validation ]
          │                                  │
          ▼                                  ▼
[ PostgreSQL / Drizzle ORM ]    [ Private Storage Vault ]
(Relational Schema, Audits)    (Selfies, Signed Download URLs)
```

- **Frontend**: Single-page application built with React, Vite, TypeScript, and Tailwind CSS. Provides 4 dedicated role-based interfaces with real-time browser Geolocation tracking, Haversine distance calculations, live webcam selfie capture, and an instant 1-click role switcher for verification.
- **Backend**: Versioned REST API (`/api/v1`) built with Express 5, TypeScript, Zod request body/query validation, JWT session management, and granular role authorization middleware.
- **Database**: 14 normalized PostgreSQL relational tables with UUID keys, foreign key constraints, unique indexes, and version-controlled Drizzle migrations (`drizzle-kit`). Supports both external PostgreSQL and embedded PostgreSQL (PGlite) for zero-setup local execution.
- **Geofence Policy**: Authoritative Haversine calculations executed server-side. Enforces worksite radius (default 20–50m) and max GPS accuracy thresholds (+/- 50m). Rejects out-of-bounds clock-ins with explicit error codes (`OUTSIDE_GEOFENCE`, `LOCATION_ACCURACY_INSUFFICIENT`).
- **Date-Specific Supervisor Preservation**: When attendance is submitted, an approver snapshot is permanently saved on the session record (`supervisor_snapshot_id`). Changes to future rosters do not alter historical supervisor routing. Supervisor reassignment is performed only via explicit, audited transfer actions.

---

## 2. Directory Structure

```
attendance_management/
├── client/                               # Frontend React application
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── attendance/               # CameraCapture & viewfinder
│   │   │   ├── common/                   # Modal, StatCard, StatusBadge
│   │   │   └── layout/                   # AppShell, Sidebar, Header
│   │   ├── context/                      # AuthContext & test accounts
│   │   ├── lib/                          # Typed API client & utilities
│   │   ├── views/
│   │   │   ├── admin/                    # RosterPlanner, Worksites, Leaves, Reports
│   │   │   ├── auth/                     # LoginView with 1-click role buttons
│   │   │   ├── supervisor/               # ApprovalsQueue, Regularizations
│   │   │   └── worker/                   # ClockInView, MyAttendance, LeaveApply
│   │   ├── App.tsx                       # Main application router
│   │   ├── index.css                     # Tailwind CSS tokens
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/                               # Backend Node.js REST API
│   ├── drizzle/                          # Generated SQL migration scripts
│   │   └── 0000_flowery_sumo.sql
│   ├── src/
│   │   ├── controllers/                  # Auth, Assignment, Attendance, Leave, etc.
│   │   ├── database/                     # Schema, db connection pool, seed data
│   │   ├── middleware/                   # JWT auth, requireRole, validation
│   │   ├── routes/                       # REST API v1 router
│   │   ├── services/                     # Private selfie storage & signing
│   │   ├── tests/                        # Workflow integration test suite
│   │   ├── utils/                        # Haversine formula, audit logger
│   │   └── server.ts                     # Express entry point
│   ├── drizzle.config.ts
│   ├── package.json
│   └── tsconfig.json
│
└── README.md
```

---

## 3. Database Schema and Migrations

The database schema is fully normalized into 14 tables in PostgreSQL:

1. **`organizations`**: Multi-tenant organizations, timezones, default geofence radius (m), accuracy limits, clock-out toggles.
2. **`users`**: Workforce employees with employee code, hashed passwords (`bcryptjs`), contact information.
3. **`user_roles`**: Role memberships (`SUPER_ADMIN`, `ADMIN`, `SUPERVISOR`, `WORKER`).
4. **`worksites`**: Physical worksite coordinates (authoritative latitude/longitude), custom perimeter radius, max accuracy threshold.
5. **`site_assignments`**: Daily shift assignments modeled by date, shift times, status (`DRAFT`, `PUBLISHED`, `CANCELLED`, `COMPLETED`), and assigned supervisor.
6. **`site_assignment_workers`**: Worker membership per daily assignment.
7. **`attendance_sessions`**: Daily clock-in sessions with status (`PENDING`, `APPROVED`, `REJECTED`), idempotency keys, and **immutable supervisor snapshot** (`supervisor_snapshot_id`).
8. **`attendance_events`**: Immutable event logs for `CLOCK_IN` and `CLOCK_OUT` recording captured coordinates, calculated distance, accuracy, and selfie object keys.
9. **`approval_actions`**: Decisions recorded by supervisors (`APPROVED`, `REJECTED`, `TRANSFERRED`) with mandatory notes.
10. **`attendance_adjustment_requests`**: Regularization workflow for timestamp corrections with worker justification.
11. **`leave_types`**: Configurable leave policies (Casual Leave, Sick Leave, Earned Leave, Unpaid Leave).
12. **`leave_requests`**: Absence requests routed directly to the administrative queue.
13. **`notifications`**: In-app notifications with read status.
14. **`audit_logs`**: Tamper-evident audit trail capturing actor, action, before/after values, timestamps, and IP addresses.

### Running Migrations

```bash
cd server
npm run db:generate   # Generates version-controlled SQL in server/drizzle/
npm run db:migrate    # Executes migrations against target DATABASE_URL
```

---

## 4. API Documentation (REST API v1)

All endpoints reside under `/api/v1`. Authenticated endpoints require `Authorization: Bearer <token>`.

### Authentication
- `POST /auth/login`: Authenticate with email and password. Returns JWT token, user roles, and organization profile.
- `POST /auth/logout`: Invalidate session and create an audit log.
- `GET /auth/me`: Fetch authenticated user profile and roles.

### Users & Directory (Super Admin, Admin)
- `GET /users`: List workforce users and roles.
- `POST /users`: Create new employee with roles.
- `GET /users/:id`: Get employee details.
- `PATCH /users/:id`: Update employee profile or roles.
- `POST /users/:id/deactivate`: Deactivate account with audit log.

### Worksites (Super Admin, Admin)
- `GET /worksites`: List all worksites with coordinates and geofences.
- `POST /worksites`: Create worksite with coordinates (`latitude`, `longitude`, `radiusMeters`).
- `PATCH /worksites/:id`: Update worksite coordinates or radius.
- `POST /worksites/:id/deactivate`: Deactivate worksite.

### Daily Assignments & Roster Engine
- `GET /assignments?date=YYYY-MM-DD`: List daily roster assignments with attached workers.
- `POST /assignments`: Create draft assignment for worksite, supervisor, shift, and workers.
- `PUT /assignments/:id/workers`: Update worker membership with leave conflict checks.
- `POST /assignments/:id/publish`: Publish roster to allow worker attendance.
- `POST /assignments/:id/cancel`: Cancel roster with mandatory reason.
- `GET /workers/me/assignments`: Fetch today's published assignments for the logged-in worker.

### Attendance & Verification
- `POST /attendance/photo-upload-auth`: Issue short-lived upload authorization token.
- `POST /attendance/upload-photo`: Upload attendance selfie to private storage vault.
- `POST /attendance/clock-in`: Submit coordinates, accuracy, selfie key, and idempotency key. Validates geofence and creates `PENDING` session.
- `POST /attendance/:id/clock-out`: Record clock-out event for eligible session.
- `GET /attendance/me`: Worker's attendance history and approval statuses.
- `GET /attendance/pending-approvals`: Supervisor's queue of pending clock-ins.
- `POST /attendance/:id/approve`: Approve clock-in with optional note.
- `POST /attendance/:id/reject`: Reject clock-in with **mandatory non-empty reason**.
- `POST /attendance/:id/transfer`: Re-route approval to replacement supervisor with audit entry.

### Regularization (Attendance Correction)
- `POST /attendance/:id/regularization`: Worker or supervisor requests adjustment with proposed timestamps and reason.
- `GET /regularization/pending`: Supervisor queue of pending adjustments.
- `POST /regularization/:id/approve`: Approve adjustment transactionally.
- `POST /regularization/:id/reject`: Reject adjustment with note.

### Leave Management
- `GET /leave/types`: List active leave types.
- `POST /leave/requests`: Worker applies for leave (dates, half/full day, mandatory note).
- `GET /leave/requests/me`: Worker's personal leave applications.
- `GET /leave/requests/pending`: **Direct Admin review queue** (independent of supervisor).
- `POST /leave/requests/:id/approve`: Admin approves leave.
- `POST /leave/requests/:id/reject`: Admin rejects leave with note.
- `POST /leave/requests/:id/cancel`: Worker withdraws pending leave.

### Reports & Audit
- `GET /reports/attendance`: Filter historical records by date, site, worker, and status.
- `GET /reports/attendance/export`: Download sanitized CSV report (with spreadsheet formula injection protection).
- `GET /audit-logs`: Query immutable system audit history.
- `GET /notifications`: Retrieve in-app notifications.
- `POST /notifications/:id/read`: Mark notification as read.
- `GET /storage/file?token=...`: Stream attendance selfie with short-lived signed access token.

---

## 5. Local Setup Instructions

### Prerequisites
- Node.js v18+ (tested on Node v24)
- npm v10+

### Step 1: Start Backend
```bash
cd server
npm install
npm run dev
```
*Note: If `DATABASE_URL` is not set in `.env`, the server automatically connects to embedded PostgreSQL (PGlite) with auto-migration and seeds 4 test accounts and sample worksites.*

### Step 2: Start Frontend
```bash
cd client
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 6. Seed Accounts for All 4 Roles

The application seeds four primary accounts with password `Password123!`:

| Role | Email | Password | Primary Screen |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin@enterprise.com` | `Password123!` | Global Overview, Policies, User Management, Worksites |
| **Admin** | `admin@enterprise.com` | `Password123!` | Roster Planner, Worksites, Leave Approvals Queue, CSV Reports |
| **Supervisor** | `supervisor@enterprise.com` | `Password123!` | Pending Clock-in Queue, Selfie Evidence Inspector, Regularization |
| **Worker** | `worker@enterprise.com` | `Password123!` | Geofence Clock-In, Selfie Viewfinder, My Attendance, Leave Apply |

*The top navigation bar contains instant 1-click role switcher buttons for rapid evaluation.*

---

## 7. Automated Test Suite Results

The automated integration test suite (`server/src/tests/workflow.test.ts`) tests all core business rules against the live API:

```bash
npx tsx src/tests/workflow.test.ts
```

Output:
```
🧪 Running Location-Based Attendance System Integration Tests...

Test 1: Haversine Geofence Calculations
- Distance for ~10m delta: 10.01m
  ✅ Correctly validated within 20m radius
- Distance for ~500m delta: 452.67m
  ✅ Correctly rejected outside 20m radius

Test 2: Authentication & Multi-Role Verification
  ✅ Worker authenticated successfully
  ✅ Supervisor authenticated successfully
  ✅ Worker retrieved assignment: Morning Standard Shift at Metro Logistics Terminal A

Test 3: Clock-In Geofence Security Enforcement
  ✅ Correctly blocked clock-in outside geofence with OUTSIDE_GEOFENCE error code
  ✅ Correctly blocked clock-in with poor GPS accuracy with LOCATION_ACCURACY_INSUFFICIENT

Test 4: Valid Clock-in, Supervisor Snapshot & Approval Flow
  ✅ Clock-in accepted in PENDING status
  ✅ Supervisor Snapshot ID captured: immutable preservation verified
  ✅ Assigned supervisor successfully received pending approval in queue
  ✅ Supervisor successfully approved attendance
  ✅ Worker views updated APPROVED attendance in history

Test 5: Leave Request & Admin Approval Flow
  ✅ Worker submitted leave request
  ✅ Admin found leave in direct Admin review queue (independent of daily supervisor)
  ✅ Admin approved leave request successfully

🎉 ALL 5 INTEGRATION TEST SUITES PASSED FLAWLESSLY!
```

---

## 8. Deployment Guide

### Backend Deployment (Node.js / Container / Cloud Run)
1. Build TypeScript:
   ```bash
   cd server && npm run build
   ```
2. Set production environment variables in host:
   - `PORT=5000`
   - `DATABASE_URL=postgresql://user:password@db-host:5432/dbname`
   - `JWT_SECRET=<32+ char random secret>`
   - `STORAGE_SECRET=<32+ char random secret>`
3. Run migrations on release:
   ```bash
   npm run db:migrate
   ```
4. Start process:
   ```bash
   node dist/server.js
   ```

### Frontend Deployment (Vercel / Netlify / Cloudflare Pages)
1. Build static assets:
   ```bash
   cd client && npm run build
   ```
2. Serve the generated `client/dist/` directory with client-side routing fallback (`/* -> index.html`).
3. Set environment variable:
   - `VITE_API_URL=https://api.yourdomain.com/api/v1`

---

## 9. Known Limitations & Edge Case Handling

1. **Browser Geolocation in Desktop Environments**: Desktop browsers estimate coordinates using Wi-Fi BSSID or IP geolocation, which may report lower accuracy (+/- 20–100m). For testing without physical attendance at the configured worksite, the UI provides a **"Simulate On-Site GPS (Demo)"** toggle that submits exact worksite coordinates.
2. **Camera Hardware**: In headless testing environments or browsers without webcam permissions, a **"Test Snapshot"** button generates a verified canvas frame so end-to-end clock-in testing can proceed.
3. **Face Biometrics vs Attendance Selfie**: Per prompt instructions, the application validates fresh camera selfie capture and securely stores it in private vaults; facial biometric verification or anti-spoofing is not claimed without dedicated biometric hardware/APIs.

---

## 10. Client Decisions & Extensibility

- **Direct Admin Approval of Clock-Ins**: Supported via the `allowAdminClockInApproval` configuration flag in `organizations`.
- **Clock-Out Requirement**: Configurable per organization via `clockOutEnabled` (enabled by default).
- **Object Storage Backend**: Easily configured between private S3-compatible cloud storage (AWS S3, MinIO, Cloudflare R2) and secure server-managed signed vaults.
