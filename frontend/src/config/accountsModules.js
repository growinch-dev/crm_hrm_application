export const ACCOUNTS_MODULES = [
  {
    key: 'chart-of-accounts', num: 1, label: 'Chart of Accounts', path: '/accounts/chart-of-accounts', api: '/accounts/chart-of-accounts',
    description: 'The ledger accounts money moves through.',
    columns: [
      { key: 'code', label: 'Code', type: 'mono' },
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type', type: 'pill' },
      { key: 'is_active', label: 'Active', type: 'boolean' },
    ],
    fields: [
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'type', label: 'Type', type: 'select', options: ['asset', 'liability', 'equity', 'income', 'expense'], required: true },
      { key: 'is_active', label: 'Active', type: 'checkbox' },
    ],
  },
];

export const ACCOUNTS_CUSTOM_PAGES = [
  { key: 'invoices', num: 2, label: 'Invoices', path: '/accounts/invoices-page' },
  { key: 'payments', num: 3, label: 'Payments', path: '/accounts/payments-page' },
  { key: 'company-expenses', num: 4, label: 'Company Expenses', path: '/accounts/expenses-page' },
  { key: 'ledger', num: 5, label: 'Ledger', path: '/accounts/ledger-page' },
];
