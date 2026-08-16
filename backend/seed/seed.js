require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const baseConfig = { host: process.env.PGHOST, port: process.env.PGPORT, user: process.env.PGUSER, password: process.env.PGPASSWORD };
const controlPool = new Pool({ ...baseConfig, database: process.env.PGDATABASE });
const DEMO_TENANT_DB = `${process.env.PGDATABASE}_demo`;
const tenantPool = new Pool({ ...baseConfig, database: DEMO_TENANT_DB });

async function seed() {
  const control = await controlPool.connect();
  const tenant = await tenantPool.connect();
  try {
    console.log('Seeding...');

    // ---- Control plane: the demo organization + a platform admin login ----
    // email_domain matches the @company.com addresses seeded below, so logging in
    // with any of them resolves to this organization's own database (DEMO_TENANT_DB).
    await control.query(`DELETE FROM organizations WHERE slug = 'growinch-demo-co'`);
    await control.query(
      `INSERT INTO organizations (name, slug, email_domain, db_name, enabled_crm, enabled_hrm, enabled_accounts)
       VALUES ('GrowInch Demo Co','growinch-demo-co','company.com',$1,true,true,true)`,
      [DEMO_TENANT_DB]
    );

    const pwd = await bcrypt.hash('Password123!', 10);
    await control.query(`DELETE FROM platform_admins WHERE email = 'platform@growinch.tech'`);
    await control.query(
      `INSERT INTO platform_admins (name, email, password_hash) VALUES ('Platform Admin','platform@growinch.tech',$1)`,
      [pwd]
    );

    // ---- Tenant database: everything else (this company's own users/leads/employees/...) ----

    // ---- Roles ----
    // CRM/HRM/Accounts access flags: admin sees all three (exercises the sidebar switcher),
    // everyone else is scoped to their side.
    const roleAccess = {
      admin: { crm: true, hrm: true, accounts: true },
      sales_manager: { crm: true, hrm: false, accounts: false },
      sales_rep: { crm: true, hrm: false, accounts: false },
      hr_manager: { crm: false, hrm: true, accounts: false },
      hr_exec: { crm: false, hrm: true, accounts: false },
      employee: { crm: false, hrm: true, accounts: false },
    };
    for (const [name, access] of Object.entries(roleAccess)) {
      await tenant.query(
        `INSERT INTO roles (name, can_access_crm, can_access_hrm, can_access_accounts) VALUES ($1,$2,$3,$4)
         ON CONFLICT (name) DO UPDATE SET can_access_crm = $2, can_access_hrm = $3, can_access_accounts = $4`,
        [name, access.crm, access.hrm, access.accounts]
      );
    }
    const roleId = async (name) => (await tenant.query('SELECT id FROM roles WHERE name=$1', [name])).rows[0].id;

    // ---- Departments & designations ----
    const deptSales = (await tenant.query(`INSERT INTO departments (name) VALUES ('Sales') RETURNING id`)).rows[0].id;
    const deptHR = (await tenant.query(`INSERT INTO departments (name) VALUES ('Human Resources') RETURNING id`)).rows[0].id;
    const deptEng = (await tenant.query(`INSERT INTO departments (name) VALUES ('Engineering') RETURNING id`)).rows[0].id;

    const desigSalesMgr = (await tenant.query(`INSERT INTO designations (title, department_id) VALUES ('Sales Manager', $1) RETURNING id`, [deptSales])).rows[0].id;
    const desigHRMgr = (await tenant.query(`INSERT INTO designations (title, department_id) VALUES ('HR Manager', $1) RETURNING id`, [deptHR])).rows[0].id;
    const desigEngineer = (await tenant.query(`INSERT INTO designations (title, department_id) VALUES ('Software Engineer', $1) RETURNING id`, [deptEng])).rows[0].id;

    // ---- Employees ----
    const emp1 = (await tenant.query(
      `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, employment_type, status, date_of_joining, ctc_annual)
       VALUES ('EMP-001','Asha','Rao','asha.rao@company.com',$1,$2,'full_time','active','2023-01-15', 1800000) RETURNING id`,
      [deptSales, desigSalesMgr]
    )).rows[0].id;
    const emp2 = (await tenant.query(
      `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, employment_type, status, date_of_joining, ctc_annual)
       VALUES ('EMP-002','Rohan','Mehta','rohan.mehta@company.com',$1,$2,'full_time','active','2022-06-01', 1500000) RETURNING id`,
      [deptHR, desigHRMgr]
    )).rows[0].id;
    const emp3 = (await tenant.query(
      `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, employment_type, status, date_of_joining, ctc_annual)
       VALUES ('EMP-003','Priya','Nair','priya.nair@company.com',$1,$2,'full_time','active','2024-03-11', 1200000) RETURNING id`,
      [deptEng, desigEngineer]
    )).rows[0].id;

    // ---- Users (login accounts) ----
    await tenant.query(
      `INSERT INTO users (name, email, password_hash, role_id) VALUES ('System Admin','admin@company.com',$1,$2)`,
      [pwd, await roleId('admin')]
    );
    await tenant.query(
      `INSERT INTO users (name, email, password_hash, role_id, employee_id) VALUES ('Asha Rao','asha.rao@company.com',$1,$2,$3)`,
      [pwd, await roleId('sales_manager'), emp1]
    );
    await tenant.query(
      `INSERT INTO users (name, email, password_hash, role_id, employee_id) VALUES ('Rohan Mehta','rohan.mehta@company.com',$1,$2,$3)`,
      [pwd, await roleId('hr_manager'), emp2]
    );

    const salesRepUserId = (await tenant.query('SELECT id FROM users WHERE email=$1', ['asha.rao@company.com'])).rows[0].id;

    // ---- CRM lookup data ----
    const sourceWeb = (await tenant.query(`INSERT INTO lead_sources (name) VALUES ('Website') RETURNING id`)).rows[0].id;
    await tenant.query(`INSERT INTO lead_sources (name) VALUES ('Referral'), ('Cold Call'), ('Trade Show')`);

    const stageNew = (await tenant.query(`INSERT INTO pipeline_stages (name, sequence, probability) VALUES ('Qualification',1,10) RETURNING id`)).rows[0].id;
    await tenant.query(`INSERT INTO pipeline_stages (name, sequence, probability) VALUES ('Needs Analysis',2,30),('Proposal',3,60),('Negotiation',4,80),('Closed Won',5,100),('Closed Lost',6,0)`);
    await tenant.query(`UPDATE pipeline_stages SET is_won = true WHERE name = 'Closed Won'`);
    await tenant.query(`UPDATE pipeline_stages SET is_lost = true WHERE name = 'Closed Lost'`);

    // ---- Sample company/contact/lead/deal ----
    const company1 = (await tenant.query(
      `INSERT INTO companies (name, industry, website, phone, city, country, owner_id) VALUES ('Meridian Retail Pvt Ltd','Retail','https://meridianretail.example','+91-22-4000-1000','Mumbai','India',$1) RETURNING id`,
      [salesRepUserId]
    )).rows[0].id;

    const contact1 = (await tenant.query(
      `INSERT INTO contacts (company_id, first_name, last_name, email, phone, designation, is_primary, owner_id) VALUES ($1,'Vikram','Shah','vikram.shah@meridianretail.example','+91-98200-11111','Head of Procurement',true,$2) RETURNING id`,
      [company1, salesRepUserId]
    )).rows[0].id;

    await tenant.query(
      `INSERT INTO leads (name, company_name, email, phone, source_id, status, score, estimated_value, owner_id)
       VALUES ('Meridian Retail - New Inquiry','Meridian Retail Pvt Ltd','contact@meridianretail.example','+91-98200-22222',$1,'new',60,450000,$2)`,
      [sourceWeb, salesRepUserId]
    );

    await tenant.query(
      `INSERT INTO deals (name, company_id, contact_id, stage_id, amount, probability, expected_close_date, owner_id)
       VALUES ('Meridian Retail - POS Rollout',$1,$2,$3,850000,30,CURRENT_DATE + INTERVAL '30 days',$4)`,
      [company1, contact1, stageNew, salesRepUserId]
    );

    // ---- Products ----
    await tenant.query(
      `INSERT INTO products (name, sku, type, unit_price, tax_percent) VALUES
       ('CRM Pro License','SKU-CRM-PRO','product',25000,18),
       ('Onboarding Service Package','SKU-SVC-ONB','service',50000,18)`
    );

    // ---- Support ticket ----
    await tenant.query(
      `INSERT INTO tickets (ticket_number, subject, description, company_id, contact_id, priority, status)
       VALUES ('TCK-DEMO-1','Login issue after upgrade','Customer cannot log in after the recent upgrade.',$1,$2,'high','open')`,
      [company1, contact1]
    );

    // ---- HRM: leave types & holidays ----
    await tenant.query(`INSERT INTO leave_types (name, days_allowed) VALUES ('Casual Leave',12),('Sick Leave',10),('Earned Leave',15)`);
    await tenant.query(`INSERT INTO holidays (name, date) VALUES ('Republic Day','2026-01-26'),('Independence Day','2026-08-15'),('Gandhi Jayanti','2026-10-02')`);

    // ---- HRM: sample job opening + candidate ----
    const job1 = (await tenant.query(
      `INSERT INTO job_openings (title, department_id, employment_type, openings_count, status) VALUES ('Backend Engineer',$1,'full_time',2,'open') RETURNING id`,
      [deptEng]
    )).rows[0].id;
    await tenant.query(
      `INSERT INTO candidates (job_opening_id, name, email, stage, source) VALUES ($1,'Karan Verma','karan.verma@example.com','screening','LinkedIn')`,
      [job1]
    );

    // ---- HRM: sample asset assignment ----
    await tenant.query(
      `INSERT INTO assets (asset_tag, name, category, status, assigned_to, assigned_at) VALUES ('AST-0001','MacBook Pro 14"','laptop','assigned',$1, now())`,
      [emp3]
    );

    // ---- HRM: sample loan/advance request ----
    await tenant.query(
      `INSERT INTO loan_requests (employee_id, loan_type, amount, reason, monthly_deduction, status) VALUES ($1,'salary_advance',50000,'Medical emergency',10000,'pending')`,
      [emp3]
    );

    // ---- Accounts: chart of accounts, sample invoice + payment ----
    const acctBank = (await tenant.query(`INSERT INTO chart_of_accounts (code, name, type) VALUES ('1000','Bank Account','asset') RETURNING id`)).rows[0].id;
    await tenant.query(`INSERT INTO chart_of_accounts (code, name, type) VALUES ('4000','Sales Revenue','income'),('5000','Office Expenses','expense')`);

    const invoice1 = (await tenant.query(
      `INSERT INTO invoices (invoice_number, company_id, contact_id, status, due_date, subtotal, tax_total, total_amount, owner_id)
       VALUES ('INV-DEMO-1',$1,$2,'sent',CURRENT_DATE + INTERVAL '15 days',25000,4500,29500,$3) RETURNING id`,
      [company1, contact1, salesRepUserId]
    )).rows[0].id;
    await tenant.query(
      `INSERT INTO invoice_items (invoice_id, quantity, unit_price, tax_percent, line_total) VALUES ($1,1,25000,18,29500)`,
      [invoice1]
    );
    await tenant.query(
      `INSERT INTO payments (payment_number, type, invoice_id, account_id, amount, method, recorded_by) VALUES ('RCPT-DEMO-1','receipt',$1,$2,15000,'bank_transfer',$3)`,
      [invoice1, acctBank, salesRepUserId]
    );
    await tenant.query(`UPDATE invoices SET amount_paid = 15000, status = 'partially_paid' WHERE id = $1`, [invoice1]);

    // ---- Accounts: sample company expense ----
    await tenant.query(
      `INSERT INTO company_expenses (category, vendor_name, account_id, amount, notes, recorded_by) VALUES ('software','AWS',$1,18500,'Monthly cloud hosting',$2)`,
      [acctBank, salesRepUserId]
    );

    console.log('✅ Seed complete.');
    console.log('   Login with: admin@company.com / Password123!');
    console.log('   Or:         asha.rao@company.com / Password123!  (sales_manager)');
    console.log('   Or:         rohan.mehta@company.com / Password123!  (hr_manager)');
    console.log('   Platform admin: platform@growinch.tech / Password123!');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    control.release();
    tenant.release();
    await controlPool.end();
    await tenantPool.end();
  }
}

seed();
