-- =========================================================================
-- CRM + HRM  |  PostgreSQL TENANT schema
-- Applied once per company database (see migrations/control-plane-schema.sql
-- for the separate, single platform-wide database that tracks which company
-- owns which database and routes logins to it).
-- =========================================================================
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================================
-- CORE / AUTH  (shared by CRM + HRM)
-- =========================================================================
CREATE TABLE roles (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(50) UNIQUE NOT NULL,   -- admin, sales_manager, sales_rep, hr_manager, hr_exec, employee
  description   TEXT,
  can_access_crm BOOLEAN DEFAULT TRUE,
  can_access_hrm BOOLEAN DEFAULT TRUE,
  can_access_accounts BOOLEAN DEFAULT TRUE,
  can_edit BOOLEAN DEFAULT TRUE -- false = view-only across the whole application (no create/edit/delete)
);

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id       INTEGER REFERENCES roles(id),
  employee_id   INTEGER, -- fk added later once employees table exists
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at    TIMESTAMP DEFAULT now(),
  updated_at    TIMESTAMP DEFAULT now()
);

-- Generic document/attachment store used by CRM (module 13), HRM (module 12), and company-wide docs
CREATE TABLE documents (
  id               SERIAL PRIMARY KEY,
  related_to_type  VARCHAR(50) NOT NULL,   -- 'lead','company','contact','deal','employee','ticket','policy', etc.
  related_to_id    INTEGER,                -- NULL for company-wide documents not tied to a specific record
  file_name        VARCHAR(255) NOT NULL,
  file_path        VARCHAR(500) NOT NULL,
  file_type        VARCHAR(100),
  file_size        INTEGER,
  doc_category     VARCHAR(100),
  uploaded_by      INTEGER REFERENCES users(id),
  uploaded_at      TIMESTAMP DEFAULT now()
);

-- In-app notifications (bell dropdown), optionally emailed via mailer.js
CREATE TABLE notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50),
  title       VARCHAR(255) NOT NULL,
  body        TEXT,
  link        VARCHAR(255),
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT now()
);

-- Password reset tokens (forgot/reset password flow)
CREATE TABLE password_reset_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(255) UNIQUE NOT NULL,   -- SHA-256 hash of the raw token, raw token never stored
  expires_at  TIMESTAMP NOT NULL,
  used_at     TIMESTAMP,
  created_at  TIMESTAMP DEFAULT now()
);

-- Generic activity/audit log usable across every module
CREATE TABLE activity_log (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER REFERENCES users(id),
  action           VARCHAR(50),
  entity_type      VARCHAR(50),
  entity_id        INTEGER,
  details          JSONB,
  created_at       TIMESTAMP DEFAULT now()
);

-- =========================================================================
-- CRM MODULE 2/3 : Companies & Contacts
-- =========================================================================
CREATE TABLE companies (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  industry      VARCHAR(100),
  website       VARCHAR(200),
  phone         VARCHAR(50),
  email         VARCHAR(150),
  billing_address TEXT,
  shipping_address TEXT,
  city          VARCHAR(100),
  state         VARCHAR(100),
  country       VARCHAR(100),
  annual_revenue NUMERIC(15,2),
  employee_count INTEGER,
  owner_id      INTEGER REFERENCES users(id),
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT now(),
  updated_at    TIMESTAMP DEFAULT now()
);

CREATE TABLE contacts (
  id            SERIAL PRIMARY KEY,
  company_id    INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100),
  email         VARCHAR(150),
  phone         VARCHAR(50),
  designation   VARCHAR(100),
  department    VARCHAR(100),
  is_primary    BOOLEAN DEFAULT FALSE,
  owner_id      INTEGER REFERENCES users(id),
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT now(),
  updated_at    TIMESTAMP DEFAULT now()
);

-- =========================================================================
-- CRM MODULE 1 : Lead Management
-- =========================================================================
CREATE TABLE lead_sources (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE leads (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  company_name  VARCHAR(200),
  email         VARCHAR(150),
  phone         VARCHAR(50),
  source_id     INTEGER REFERENCES lead_sources(id),
  status        VARCHAR(50) DEFAULT 'new',  -- new, contacted, qualified, unqualified, converted
  score         INTEGER DEFAULT 0,
  estimated_value NUMERIC(15,2),
  owner_id      INTEGER REFERENCES users(id),
  converted_contact_id INTEGER REFERENCES contacts(id),
  converted_company_id INTEGER REFERENCES companies(id),
  converted_deal_id     INTEGER,
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT now(),
  updated_at    TIMESTAMP DEFAULT now()
);

-- =========================================================================
-- CRM MODULE 5 : Sales Pipeline  (stages)  +  MODULE 4 : Deals
-- =========================================================================
CREATE TABLE pipeline_stages (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  sequence     INTEGER NOT NULL,
  probability  INTEGER DEFAULT 0,  -- % likelihood to close
  is_won       BOOLEAN DEFAULT FALSE,
  is_lost      BOOLEAN DEFAULT FALSE
);

CREATE TABLE deals (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  company_id    INTEGER REFERENCES companies(id),
  contact_id    INTEGER REFERENCES contacts(id),
  stage_id      INTEGER REFERENCES pipeline_stages(id),
  amount        NUMERIC(15,2) DEFAULT 0,
  probability   INTEGER DEFAULT 0,
  expected_close_date DATE,
  status        VARCHAR(30) DEFAULT 'open', -- open, won, lost
  lost_reason   VARCHAR(255),
  owner_id      INTEGER REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT now(),
  updated_at    TIMESTAMP DEFAULT now()
);

ALTER TABLE leads ADD CONSTRAINT fk_lead_deal FOREIGN KEY (converted_deal_id) REFERENCES deals(id);

-- =========================================================================
-- CRM MODULE 6 : Activities & Follow-ups
-- =========================================================================
CREATE TABLE activities (
  id              SERIAL PRIMARY KEY,
  type            VARCHAR(30) NOT NULL, -- call, meeting, task, email, follow_up
  subject         VARCHAR(255) NOT NULL,
  related_to_type VARCHAR(50),          -- lead, deal, contact, company
  related_to_id   INTEGER,
  due_date        TIMESTAMP,
  status          VARCHAR(30) DEFAULT 'pending', -- pending, completed, cancelled
  priority        VARCHAR(20) DEFAULT 'medium',
  assigned_to     INTEGER REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);

-- =========================================================================
-- CRM MODULE 9 : Products / Services
-- =========================================================================
CREATE TABLE products (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  sku           VARCHAR(100) UNIQUE,
  type          VARCHAR(20) DEFAULT 'product', -- product, service
  category      VARCHAR(100),
  unit_price    NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_percent   NUMERIC(5,2) DEFAULT 0,
  description   TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT now()
);

-- =========================================================================
-- CRM MODULE 7 : Quotation Management
-- =========================================================================
CREATE TABLE quotations (
  id             SERIAL PRIMARY KEY,
  quote_number   VARCHAR(50) UNIQUE NOT NULL,
  deal_id        INTEGER REFERENCES deals(id),
  company_id     INTEGER REFERENCES companies(id),
  contact_id     INTEGER REFERENCES contacts(id),
  status         VARCHAR(30) DEFAULT 'draft', -- draft, sent, accepted, rejected, expired
  valid_until    DATE,
  subtotal       NUMERIC(15,2) DEFAULT 0,
  tax_total      NUMERIC(15,2) DEFAULT 0,
  total_amount   NUMERIC(15,2) DEFAULT 0,
  notes          TEXT,
  owner_id       INTEGER REFERENCES users(id),
  created_at     TIMESTAMP DEFAULT now(),
  updated_at     TIMESTAMP DEFAULT now()
);

CREATE TABLE quotation_items (
  id             SERIAL PRIMARY KEY,
  quotation_id   INTEGER REFERENCES quotations(id) ON DELETE CASCADE,
  product_id     INTEGER REFERENCES products(id),
  quantity       NUMERIC(10,2) DEFAULT 1,
  unit_price     NUMERIC(15,2) NOT NULL,
  tax_percent    NUMERIC(5,2) DEFAULT 0,
  line_total     NUMERIC(15,2) NOT NULL
);

-- =========================================================================
-- CRM MODULE 8 : Sales Order Management
-- =========================================================================
CREATE TABLE sales_orders (
  id             SERIAL PRIMARY KEY,
  order_number   VARCHAR(50) UNIQUE NOT NULL,
  quotation_id   INTEGER REFERENCES quotations(id),
  company_id     INTEGER REFERENCES companies(id),
  contact_id     INTEGER REFERENCES contacts(id),
  status         VARCHAR(30) DEFAULT 'pending', -- pending, confirmed, shipped, delivered, cancelled
  order_date     DATE DEFAULT CURRENT_DATE,
  total_amount   NUMERIC(15,2) DEFAULT 0,
  owner_id       INTEGER REFERENCES users(id),
  created_at     TIMESTAMP DEFAULT now(),
  updated_at     TIMESTAMP DEFAULT now()
);

CREATE TABLE sales_order_items (
  id             SERIAL PRIMARY KEY,
  sales_order_id INTEGER REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id     INTEGER REFERENCES products(id),
  quantity       NUMERIC(10,2) DEFAULT 1,
  unit_price     NUMERIC(15,2) NOT NULL,
  line_total     NUMERIC(15,2) NOT NULL
);

-- =========================================================================
-- ACCOUNTS : Core Accounting (Chart of Accounts, Invoices, Payments)
-- =========================================================================
CREATE TABLE chart_of_accounts (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20) UNIQUE NOT NULL,
  name        VARCHAR(150) NOT NULL,
  type        VARCHAR(20) NOT NULL, -- asset, liability, equity, income, expense
  is_active   BOOLEAN DEFAULT TRUE
);

CREATE TABLE invoices (
  id              SERIAL PRIMARY KEY,
  invoice_number  VARCHAR(50) UNIQUE NOT NULL,
  company_id      INTEGER REFERENCES companies(id),
  contact_id      INTEGER REFERENCES contacts(id),
  sales_order_id  INTEGER REFERENCES sales_orders(id),
  status          VARCHAR(30) DEFAULT 'draft', -- draft, sent, partially_paid, paid, overdue, cancelled
  invoice_date    DATE DEFAULT CURRENT_DATE,
  due_date        DATE,
  subtotal        NUMERIC(15,2) DEFAULT 0,
  tax_total       NUMERIC(15,2) DEFAULT 0,
  total_amount    NUMERIC(15,2) DEFAULT 0,
  amount_paid     NUMERIC(15,2) DEFAULT 0,
  owner_id        INTEGER REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);

CREATE TABLE invoice_items (
  id           SERIAL PRIMARY KEY,
  invoice_id   INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  product_id   INTEGER REFERENCES products(id),
  quantity     NUMERIC(10,2) DEFAULT 1,
  unit_price   NUMERIC(15,2) NOT NULL,
  tax_percent  NUMERIC(5,2) DEFAULT 0,
  line_total   NUMERIC(15,2) NOT NULL
);

CREATE TABLE payments (
  id              SERIAL PRIMARY KEY,
  payment_number  VARCHAR(50) UNIQUE NOT NULL,
  type            VARCHAR(20) NOT NULL, -- receipt (money in), payment (money out)
  invoice_id      INTEGER REFERENCES invoices(id),
  account_id      INTEGER REFERENCES chart_of_accounts(id),
  party_name      VARCHAR(200),
  amount          NUMERIC(15,2) NOT NULL,
  payment_date    DATE DEFAULT CURRENT_DATE,
  method          VARCHAR(30), -- cash, bank_transfer, upi, cheque, card
  reference_no    VARCHAR(100),
  notes           TEXT,
  recorded_by     INTEGER REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT now()
);

-- Company-level expenses (rent, utilities, software, etc.) - distinct from HRM's
-- per-employee expense_claims reimbursements below.
CREATE SEQUENCE company_expenses_number_seq;
CREATE TABLE company_expenses (
  id              SERIAL PRIMARY KEY,
  expense_number  VARCHAR(50) UNIQUE NOT NULL DEFAULT ('EXP-' || nextval('company_expenses_number_seq')),
  category        VARCHAR(100), -- rent, utilities, software, travel, marketing, other
  vendor_name     VARCHAR(200),
  account_id      INTEGER REFERENCES chart_of_accounts(id),
  amount          NUMERIC(15,2) NOT NULL,
  expense_date    DATE DEFAULT CURRENT_DATE,
  status          VARCHAR(30) DEFAULT 'unpaid', -- unpaid, paid
  notes           TEXT,
  recorded_by     INTEGER REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT now()
);

-- =========================================================================
-- CRM MODULE 10 : Customer Communication
-- =========================================================================
CREATE TABLE communications (
  id              SERIAL PRIMARY KEY,
  type            VARCHAR(20) NOT NULL, -- email, call, sms, whatsapp, meeting_note
  direction       VARCHAR(10) DEFAULT 'outbound', -- inbound, outbound
  related_to_type VARCHAR(50),
  related_to_id   INTEGER,
  subject         VARCHAR(255),
  body            TEXT,
  contact_id      INTEGER REFERENCES contacts(id),
  logged_by       INTEGER REFERENCES users(id),
  occurred_at     TIMESTAMP DEFAULT now()
);

-- =========================================================================
-- CRM MODULE 11 : Customer Support / Ticketing
-- =========================================================================
CREATE TABLE tickets (
  id             SERIAL PRIMARY KEY,
  ticket_number  VARCHAR(50) UNIQUE NOT NULL,
  subject        VARCHAR(255) NOT NULL,
  description    TEXT,
  company_id     INTEGER REFERENCES companies(id),
  contact_id     INTEGER REFERENCES contacts(id),
  priority       VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
  status         VARCHAR(30) DEFAULT 'open',   -- open, in_progress, on_hold, resolved, closed
  category       VARCHAR(100),
  assigned_to    INTEGER REFERENCES users(id),
  created_at     TIMESTAMP DEFAULT now(),
  updated_at     TIMESTAMP DEFAULT now(),
  resolved_at    TIMESTAMP
);

CREATE TABLE ticket_comments (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id),
  comment     TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT now()
);

-- =========================================================================
-- HRM MODULE 2 : Organization & Departments
-- =========================================================================
CREATE TABLE departments (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  parent_id   INTEGER REFERENCES departments(id),
  head_employee_id INTEGER, -- fk added after employees created
  created_at  TIMESTAMP DEFAULT now()
);

CREATE TABLE designations (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(150) NOT NULL,
  department_id INTEGER REFERENCES departments(id),
  grade_level   VARCHAR(50)
);

-- =========================================================================
-- HRM MODULE 1 : Employee Management
-- =========================================================================
CREATE TABLE employees (
  id                SERIAL PRIMARY KEY,
  employee_code     VARCHAR(50) UNIQUE NOT NULL,
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100),
  email             VARCHAR(150) UNIQUE,
  phone             VARCHAR(50),
  gender            VARCHAR(20),
  date_of_birth     DATE,
  date_of_joining   DATE,
  department_id     INTEGER REFERENCES departments(id),
  designation_id    INTEGER REFERENCES designations(id),
  manager_id        INTEGER REFERENCES employees(id),
  employment_type   VARCHAR(30) DEFAULT 'full_time', -- full_time, part_time, contract, intern
  status            VARCHAR(30) DEFAULT 'active',     -- active, on_leave, exited
  address           TEXT,
  emergency_contact_name  VARCHAR(150),
  emergency_contact_phone VARCHAR(50),
  ctc_annual        NUMERIC(15,2),
  bank_account_no   VARCHAR(50),
  created_at        TIMESTAMP DEFAULT now(),
  updated_at        TIMESTAMP DEFAULT now()
);

ALTER TABLE departments ADD CONSTRAINT fk_dept_head FOREIGN KEY (head_employee_id) REFERENCES employees(id);
ALTER TABLE users ADD CONSTRAINT fk_user_employee FOREIGN KEY (employee_id) REFERENCES employees(id);

-- =========================================================================
-- HRM MODULE 3 : Recruitment
-- =========================================================================
CREATE TABLE job_openings (
  id             SERIAL PRIMARY KEY,
  title          VARCHAR(200) NOT NULL,
  department_id  INTEGER REFERENCES departments(id),
  employment_type VARCHAR(30) DEFAULT 'full_time',
  openings_count INTEGER DEFAULT 1,
  status         VARCHAR(30) DEFAULT 'open', -- open, on_hold, closed
  description    TEXT,
  posted_date    DATE DEFAULT CURRENT_DATE,
  created_at     TIMESTAMP DEFAULT now()
);

CREATE TABLE candidates (
  id              SERIAL PRIMARY KEY,
  job_opening_id  INTEGER REFERENCES job_openings(id),
  name            VARCHAR(150) NOT NULL,
  email           VARCHAR(150),
  phone           VARCHAR(50),
  resume_path     VARCHAR(500),
  stage           VARCHAR(50) DEFAULT 'applied', -- applied, screening, interview, offer, hired, rejected
  source          VARCHAR(100),
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);

-- =========================================================================
-- HRM MODULE 4 : Employee Onboarding
-- =========================================================================
CREATE TABLE onboarding_tasks (
  id           SERIAL PRIMARY KEY,
  employee_id  INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  task_name    VARCHAR(255) NOT NULL,
  category     VARCHAR(100), -- documentation, IT setup, training, HR
  status       VARCHAR(30) DEFAULT 'pending', -- pending, in_progress, done
  due_date     DATE,
  assigned_to  INTEGER REFERENCES users(id),
  created_at   TIMESTAMP DEFAULT now()
);

-- =========================================================================
-- HRM MODULE 5 : Attendance
-- =========================================================================
CREATE TABLE attendance (
  id           SERIAL PRIMARY KEY,
  employee_id  INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  check_in     TIME,
  check_out    TIME,
  status       VARCHAR(30) DEFAULT 'present', -- present, absent, half_day, wfh, on_leave
  work_hours   NUMERIC(5,2),
  notes        TEXT,
  UNIQUE(employee_id, date)
);

-- =========================================================================
-- HRM MODULE 6 : Leave Management
-- =========================================================================
CREATE TABLE leave_types (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) UNIQUE NOT NULL,
  days_allowed  NUMERIC(5,1) DEFAULT 0,
  is_paid       BOOLEAN DEFAULT TRUE
);

CREATE TABLE leave_requests (
  id             SERIAL PRIMARY KEY,
  employee_id    INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id  INTEGER REFERENCES leave_types(id),
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  total_days     NUMERIC(5,1),
  reason         TEXT,
  status         VARCHAR(30) DEFAULT 'pending', -- pending, approved, rejected, cancelled
  approved_by    INTEGER REFERENCES users(id),
  applied_at     TIMESTAMP DEFAULT now()
);

-- =========================================================================
-- HRM MODULE 7 : Holiday Management
-- =========================================================================
CREATE TABLE holidays (
  id       SERIAL PRIMARY KEY,
  name     VARCHAR(150) NOT NULL,
  date     DATE NOT NULL,
  type     VARCHAR(30) DEFAULT 'public', -- public, optional
  UNIQUE(date, name)
);

-- =========================================================================
-- HRM MODULE 8 : Payroll
-- =========================================================================
CREATE TABLE payroll_runs (
  id          SERIAL PRIMARY KEY,
  month       INTEGER NOT NULL,
  year        INTEGER NOT NULL,
  status      VARCHAR(30) DEFAULT 'draft', -- draft, processed, paid
  processed_at TIMESTAMP,
  UNIQUE(month, year)
);

CREATE TABLE payslips (
  id              SERIAL PRIMARY KEY,
  payroll_run_id  INTEGER REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id     INTEGER REFERENCES employees(id),
  basic_salary    NUMERIC(15,2) DEFAULT 0,
  allowances      NUMERIC(15,2) DEFAULT 0,
  deductions      NUMERIC(15,2) DEFAULT 0,
  tax             NUMERIC(15,2) DEFAULT 0,
  net_pay         NUMERIC(15,2) DEFAULT 0,
  status          VARCHAR(30) DEFAULT 'pending', -- pending, paid
  paid_at         TIMESTAMP
);

-- =========================================================================
-- HRM MODULE 9 : Expenses
-- =========================================================================
CREATE TABLE expense_claims (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  category      VARCHAR(100), -- travel, food, accommodation, misc
  amount        NUMERIC(15,2) NOT NULL,
  expense_date  DATE NOT NULL,
  description   TEXT,
  receipt_path  VARCHAR(500),
  status        VARCHAR(30) DEFAULT 'pending', -- pending, approved, rejected, reimbursed
  approved_by   INTEGER REFERENCES users(id),
  submitted_at  TIMESTAMP DEFAULT now()
);

-- =========================================================================
-- HRM : Loans & Advances
-- =========================================================================
CREATE TABLE loan_requests (
  id                   SERIAL PRIMARY KEY,
  employee_id          INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  loan_type            VARCHAR(30) DEFAULT 'salary_advance', -- salary_advance, personal_loan
  amount               NUMERIC(15,2) NOT NULL,
  reason               TEXT,
  requested_date       DATE DEFAULT CURRENT_DATE,
  monthly_deduction    NUMERIC(15,2),
  status               VARCHAR(30) DEFAULT 'pending', -- pending, approved, rejected, disbursed, closed
  approved_by          INTEGER REFERENCES users(id),
  disbursed_date       DATE,
  outstanding_balance  NUMERIC(15,2),
  created_at           TIMESTAMP DEFAULT now()
);

-- =========================================================================
-- HRM MODULE 10 : Performance Management
-- =========================================================================
CREATE TABLE performance_reviews (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id   INTEGER REFERENCES users(id),
  review_period VARCHAR(50), -- e.g. 'Q1 2026'
  rating        NUMERIC(3,1), -- 1.0 - 5.0
  strengths     TEXT,
  improvements  TEXT,
  status        VARCHAR(30) DEFAULT 'draft', -- draft, submitted, acknowledged
  created_at    TIMESTAMP DEFAULT now()
);

CREATE TABLE goals (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  target_date   DATE,
  progress      INTEGER DEFAULT 0, -- 0-100
  status        VARCHAR(30) DEFAULT 'in_progress', -- in_progress, completed, missed
  created_at    TIMESTAMP DEFAULT now()
);

-- =========================================================================
-- HRM MODULE 11 : Training
-- =========================================================================
CREATE TABLE trainings (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  trainer      VARCHAR(150),
  start_date   DATE,
  end_date     DATE,
  status       VARCHAR(30) DEFAULT 'scheduled', -- scheduled, ongoing, completed, cancelled
  created_at   TIMESTAMP DEFAULT now()
);

CREATE TABLE training_enrollments (
  id           SERIAL PRIMARY KEY,
  training_id  INTEGER REFERENCES trainings(id) ON DELETE CASCADE,
  employee_id  INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  status       VARCHAR(30) DEFAULT 'enrolled', -- enrolled, completed, dropped
  score        NUMERIC(5,2),
  UNIQUE(training_id, employee_id)
);

-- =========================================================================
-- HRM MODULE 12 : Employee Documents  (uses shared `documents` table above)
-- =========================================================================

-- =========================================================================
-- HRM MODULE 13 : Asset Management
-- =========================================================================
CREATE TABLE assets (
  id             SERIAL PRIMARY KEY,
  asset_tag      VARCHAR(100) UNIQUE NOT NULL,
  name           VARCHAR(200) NOT NULL,
  category       VARCHAR(100), -- laptop, phone, furniture, other
  serial_number  VARCHAR(150),
  purchase_date  DATE,
  purchase_cost  NUMERIC(15,2),
  status         VARCHAR(30) DEFAULT 'available', -- available, assigned, maintenance, retired
  assigned_to    INTEGER REFERENCES employees(id),
  assigned_at    TIMESTAMP,
  created_at     TIMESTAMP DEFAULT now()
);

-- =========================================================================
-- HRM MODULE 14 : Exit / Offboarding
-- =========================================================================
CREATE TABLE offboarding (
  id                   SERIAL PRIMARY KEY,
  employee_id          INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  resignation_date     DATE,
  last_working_day     DATE,
  reason               TEXT,
  status               VARCHAR(30) DEFAULT 'initiated', -- initiated, in_progress, completed
  exit_interview_notes TEXT,
  clearance_it         BOOLEAN DEFAULT FALSE,
  clearance_finance    BOOLEAN DEFAULT FALSE,
  clearance_assets     BOOLEAN DEFAULT FALSE,
  created_at           TIMESTAMP DEFAULT now()
);

-- =========================================================================
-- INDEXES
-- =========================================================================
CREATE INDEX idx_leads_owner ON leads(owner_id);
CREATE INDEX idx_deals_stage ON deals(stage_id);
CREATE INDEX idx_deals_owner ON deals(owner_id);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_activities_related ON activities(related_to_type, related_to_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_documents_related ON documents(related_to_type, related_to_id);
CREATE INDEX idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_employees_department ON employees(department_id);
CREATE INDEX idx_payslips_run ON payslips(payroll_run_id);
CREATE INDEX idx_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_invoices_company ON invoices(company_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_loan_requests_employee ON loan_requests(employee_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
