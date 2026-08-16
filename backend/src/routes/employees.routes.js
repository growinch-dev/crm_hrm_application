const express = require('express');
const { buildCrudRouter } = require('../utils/crudFactory');

const router = express.Router();

const selectSql = `
  SELECT employees.*, departments.name as department_name, designations.title as designation_title,
         mgr.first_name as manager_first_name, mgr.last_name as manager_last_name
  FROM employees
  LEFT JOIN departments ON departments.id = employees.department_id
  LEFT JOIN designations ON designations.id = employees.designation_id
  LEFT JOIN employees mgr ON mgr.id = employees.manager_id`;

router.use('/', buildCrudRouter({
  table: 'employees',
  columns: [
    'employee_code', 'first_name', 'last_name', 'email', 'phone', 'gender', 'date_of_birth', 'date_of_joining',
    'department_id', 'designation_id', 'manager_id', 'employment_type', 'status', 'address',
    'emergency_contact_name', 'emergency_contact_phone', 'ctc_annual', 'bank_account_no',
  ],
  searchable: ['first_name', 'last_name', 'email', 'employee_code'],
  selectSql,
  defaultSort: 'employees.created_at DESC',
}));

module.exports = router;
