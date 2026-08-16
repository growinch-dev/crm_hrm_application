require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { authenticate } = require('./middleware/auth');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const masterDataRoutes = require('./routes/masterData.routes');
const documentsRoutes = require('./routes/documents.routes');

// CRM modules
const leadsRoutes = require('./routes/leads.routes');
const companiesRoutes = require('./routes/companies.routes');
const contactsRoutes = require('./routes/contacts.routes');
const dealsRoutes = require('./routes/deals.routes');
const activitiesRoutes = require('./routes/activities.routes');
const productsRoutes = require('./routes/products.routes');
const quotationsRoutes = require('./routes/quotations.routes');
const salesOrdersRoutes = require('./routes/salesOrders.routes');
const communicationsRoutes = require('./routes/communications.routes');
const ticketsRoutes = require('./routes/tickets.routes');
const crmDashboardRoutes = require('./routes/crmDashboard.routes');

// HRM modules
const employeesRoutes = require('./routes/employees.routes');
const recruitmentRoutes = require('./routes/recruitment.routes');
const onboardingRoutes = require('./routes/onboarding.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const leaveRoutes = require('./routes/leave.routes');
const holidaysRoutes = require('./routes/holidays.routes');
const payrollRoutes = require('./routes/payroll.routes');
const expensesRoutes = require('./routes/expenses.routes');
const performanceRoutes = require('./routes/performance.routes');
const trainingRoutes = require('./routes/training.routes');
const assetsRoutes = require('./routes/assets.routes');
const offboardingRoutes = require('./routes/offboarding.routes');
const hrDashboardRoutes = require('./routes/hrDashboard.routes');
const loansRoutes = require('./routes/loans.routes');

// Accounts
const accountsRoutes = require('./routes/accounts.routes');

// Platform (SaaS tenant onboarding, super-admin only) + Notifications
const platformRoutes = require('./routes/platform.routes');
const notificationsRoutes = require('./routes/notifications.routes');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Public
app.use('/api/auth', authRoutes);

// Everything below requires a valid JWT
app.use('/api', authenticate);

app.use('/api/users', usersRoutes);
app.use('/api/meta', masterDataRoutes);
app.use('/api/documents', documentsRoutes);

// --- CRM ---
app.use('/api/crm/leads', leadsRoutes);
app.use('/api/crm/companies', companiesRoutes);
app.use('/api/crm/contacts', contactsRoutes);
app.use('/api/crm/deals', dealsRoutes);
app.use('/api/crm/activities', activitiesRoutes);
app.use('/api/crm/products', productsRoutes);
app.use('/api/crm/quotations', quotationsRoutes);
app.use('/api/crm/sales-orders', salesOrdersRoutes);
app.use('/api/crm/communications', communicationsRoutes);
app.use('/api/crm/tickets', ticketsRoutes);
app.use('/api/crm/dashboard', crmDashboardRoutes);

// --- HRM ---
app.use('/api/hrm/employees', employeesRoutes);
app.use('/api/hrm/recruitment', recruitmentRoutes);
app.use('/api/hrm/onboarding', onboardingRoutes);
app.use('/api/hrm/attendance', attendanceRoutes);
app.use('/api/hrm/leave', leaveRoutes);
app.use('/api/hrm/holidays', holidaysRoutes);
app.use('/api/hrm/payroll', payrollRoutes);
app.use('/api/hrm/expenses', expensesRoutes);
app.use('/api/hrm/performance', performanceRoutes);
app.use('/api/hrm/training', trainingRoutes);
app.use('/api/hrm/assets', assetsRoutes);
app.use('/api/hrm/offboarding', offboardingRoutes);
app.use('/api/hrm/dashboard', hrDashboardRoutes);
app.use('/api/hrm/loans', loansRoutes);

// --- Accounts ---
app.use('/api/accounts', accountsRoutes);

// --- Platform admin + Notifications ---
app.use('/api/platform', platformRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT,"0.0.0.0", () => {
  console.log(`🚀 CRM+HRM API listening on port ${PORT}`);
});
