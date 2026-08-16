-- =========================================================================
-- GrowInch PLATFORM (control-plane) schema
-- One database for the whole platform. Tracks which companies exist, which
-- database each one's data lives in, their enabled modules, and the
-- platform-admin logins that can onboard new companies. Every company's own
-- business data (users, leads, employees, invoices, ...) lives in a separate
-- database created per company - see migrations/schema.sql (the tenant schema)
-- and src/routes/platform.routes.js (provisions a new tenant database).
-- =========================================================================
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organizations (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(200) NOT NULL,
  slug              VARCHAR(100) UNIQUE NOT NULL,
  email_domain      VARCHAR(150) UNIQUE NOT NULL, -- e.g. 'acme.com' - any user with this email domain logs into this org's database
  db_name           VARCHAR(100) UNIQUE NOT NULL, -- the Postgres database name holding this org's tenant data
  enabled_crm       BOOLEAN DEFAULT TRUE,
  enabled_hrm       BOOLEAN DEFAULT TRUE,
  enabled_accounts  BOOLEAN DEFAULT TRUE,
  logo_path         VARCHAR(500), -- e.g. '/uploads/xyz.png' - this company's own logo, shown in place of the GrowInch mark once its users log in
  status            VARCHAR(20) DEFAULT 'active', -- active, suspended
  created_at        TIMESTAMP DEFAULT now()
);

CREATE TABLE platform_admins (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at    TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_organizations_email_domain ON organizations(email_domain);
