# GrowInch &middot; CRM + HRM Suite

A full-stack CRM + HRM application covering all 28 requested modules, built with **React**, **Node.js/Express**, and **PostgreSQL**.

```
CRM (13 modules)                         HRM (15 modules)
1. Lead Management                       1. Employee Management
2. Customer/Company Management           2. Organization & Departments
3. Contact Management                    3. Recruitment
4. Opportunity/Deal Management           4. Employee Onboarding
5. Sales Pipeline                        5. Attendance
6. Activities & Follow-ups               6. Leave Management
7. Quotation Management                  7. Holiday Management
8. Sales Order Management                8. Payroll
9. Product/Service Management            9. Expenses
10. Customer Communication               10. Performance Management
11. Customer Support/Ticketing           11. Training
12. CRM Reports & Dashboard              12. Employee Documents
13. Document Upload                      13. Asset Management
                                          14. Exit/Offboarding
                                          15. HR Reports & Dashboard
```

Every module above has a working database table, REST API, and a real screen in the UI you can create/edit/delete records from — plus dashboards, a sales pipeline board, an itemized quotation → sales order flow, ticket comment threads, and payroll run generation.

---

## 1. Architecture

```
app/
├── backend/                  Node.js + Express + PostgreSQL API
│   ├── migrations/schema.sql   Full DB schema (all 28 modules)
│   ├── seed/seed.js            Demo roles, users, employees, sample CRM/HRM records
│   └── src/
│       ├── routes/             One file per module/domain (28 modules + auth/users/meta)
│       ├── middleware/auth.js  JWT auth + role guard
│       ├── utils/crudFactory.js  Generic CRUD router (list/get/create/update/delete,
│       │                         pagination, search, filtering) reused by most modules
│       └── index.js            App entry point, mounts every route
│
└── frontend/                 React (Vite) SPA
    └── src/
        ├── config/            Per-module field/column definitions (drives the generic UI)
        ├── pages/GenericListPage.jsx   Config-driven list + create/edit/delete screen
        ├── pages/*.jsx         Custom screens for flows that need more than plain CRUD:
        │                       dashboards, Kanban pipeline, quotation/order builders,
        │                       ticket threads, payroll runs, document upload
        └── components/         DataTable, FormModal, Sidebar, Layout, Pill, etc.
```

**Why config-driven?** Rather than hand-building 24+ nearly-identical CRUD screens, most
modules are defined as data (`src/config/*.js`: table columns, form fields, field types,
dropdown sources) and rendered by one generic list/form component. The handful of modules
that need real custom logic — the sales pipeline board, quotations with line items,
ticket comment threads, payroll generation — get their own page.

---

## 2. Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (a `docker-compose.yml` is included if you'd rather not install it locally)

## 3. Setup

### 3.1 Start PostgreSQL

Using Docker:
```bash
docker compose up -d
```
This starts Postgres on `localhost:5432` with database `crm_hrm`, user `postgres`, password `postgres`.

Or point the backend at any Postgres instance you already have — just edit `backend/.env`.

### 3.2 Backend

```bash
cd backend
cp .env.example .env      # edit if your DB credentials differ
npm install
npm run migrate           # creates all tables
npm run seed               # loads demo roles/users/sample data
npm run dev                # starts the API on http://localhost:4000
```

### 3.3 Frontend

```bash
cd frontend
npm install
npm run dev                # starts the app on http://localhost:5173
```

Open **http://localhost:5173** — the Vite dev server proxies `/api` to the backend automatically.

### 3.4 Log in

The seed script creates three demo accounts (password for all: `Password123!`):

| Email                     | Role          |
|---------------------------|---------------|
| admin@company.com         | admin         |
| asha.rao@company.com      | sales_manager |
| rohan.mehta@company.com   | hr_manager    |

---

## 4. What's in each layer

### Database
`backend/migrations/schema.sql` defines every table for all 28 modules, with foreign keys,
indexes, and a shared `documents` table (used by both CRM module 13 and HRM module 12) and a
shared `activity_log` table for auditing. Run `npm run migrate` any time you want to reset
the schema — it drops and recreates the `public` schema first.

### API
Every module is mounted under `/api/crm/...` or `/api/hrm/...` (see `backend/src/index.js`).
All routes except `/api/auth/*` require a `Bearer` JWT. Most modules use the generic CRUD
factory (`backend/src/utils/crudFactory.js`), which gives you for free:
- `GET /api/.../` — paginated list, `?q=` free-text search, `?column=value` filters
- `GET /api/.../:id` — single record
- `POST /api/.../` — create
- `PUT /api/.../:id` — update
- `DELETE /api/.../:id` — delete

Modules with real business logic have hand-written routes on top of/instead of the factory:
- **Leads** → `POST /api/crm/leads/:id/convert` (creates Company + Contact + Deal in one transaction)
- **Deals** → `GET /api/crm/deals/view/pipeline` (Kanban board grouped by stage)
- **Quotations** → full line-item CRUD with tax/subtotal calculation, `POST /:id/convert-to-order`
- **Tickets** → `GET/POST /api/crm/tickets/:id/comments`
- **Leave / Expenses** → `POST /:id/approve`, `POST /:id/reject`
- **Assets** → `POST /:id/assign`, `POST /:id/return`
- **Payroll** → `POST /api/hrm/payroll/runs/:id/generate` (creates payslips for every active employee)
- **Offboarding** → completing an offboarding record automatically sets the employee's status to `exited`

### Frontend
- `src/config/crmModules.js`, `hrmModules.js`, `settingsModules.js` — field/column definitions
- `src/pages/GenericListPage.jsx` — renders any module from its config: search, pagination,
  create/edit modal (built from the field list), delete confirmation, and optional custom
  row actions (e.g. "Approve" / "Reject" / "Convert")
- Custom pages: `CrmDashboard`, `HrmDashboard`, `DealsPipeline` (Kanban), `Quotations`,
  `SalesOrders`, `Tickets`, `Payroll`, `Documents`, `Users`

---

## 5. Extending it

**Add a field to an existing module:** add a column to the table in `schema.sql`, add it to
the `columns` whitelist in the module's backend route (or the generic router config), and
add it to the `fields`/`columns` arrays in the matching frontend config file. No new
components needed.

**Add a brand-new simple module:** add a table, mount a `buildCrudRouter(...)` route in the
backend, add a config entry in the matching frontend config file, and add one line to
`App.jsx` (or nothing at all if it's picked up from the `CRM_MODULES`/`HRM_MODULES` array,
which `App.jsx` already maps over).

---

## 6. Production notes

This is a fully working local/dev build. Before deploying it for real use:
- Set a strong, unique `JWT_SECRET` in `backend/.env`
- Put the API behind HTTPS and set `CORS_ORIGIN` to your real frontend origin
- Move file uploads (`backend/uploads/`) to object storage (S3, GCS, etc.) instead of local disk
- Add rate limiting and stricter input validation on the API
- Review role-based access — currently every authenticated user can hit every endpoint;
  `middleware/auth.js` exports an `authorize(...roles)` helper ready to apply per-route
- Replace the payroll basic/allowance/tax split in `payroll.routes.js` with your real
  payroll policy — it currently uses a simple illustrative 50/30/10/10 split of annual CTC
