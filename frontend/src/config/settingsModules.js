export const SETTINGS_MODULES = [
  {
    key: 'departments', label: 'Departments', path: '/settings/departments', api: '/meta/departments',
    description: 'Organizational departments used across HRM.',
    columns: [{ key: 'name', label: 'Name' }, { key: 'parent_id', label: 'Parent Dept ID' }],
    fields: [
      { key: 'name', label: 'Department Name', type: 'text', required: true },
      { key: 'parent_id', label: 'Parent Department', type: 'select-async', optionsEndpoint: '/meta/departments' },
    ],
  },
  {
    key: 'designations', label: 'Designations', path: '/settings/designations', api: '/meta/designations',
    description: 'Job titles within each department.',
    columns: [{ key: 'title', label: 'Title' }, { key: 'department_name', label: 'Department' }, { key: 'grade_level', label: 'Grade' }],
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'department_id', label: 'Department', type: 'select-async', optionsEndpoint: '/meta/departments' },
      { key: 'grade_level', label: 'Grade Level', type: 'text' },
    ],
  },
  {
    key: 'lead-sources', label: 'Lead Sources', path: '/settings/lead-sources', api: '/meta/lead-sources',
    description: 'Where inbound leads originate from.',
    columns: [{ key: 'name', label: 'Name' }],
    fields: [{ key: 'name', label: 'Name', type: 'text', required: true }],
  },
  {
    key: 'pipeline-stages', label: 'Pipeline Stages', path: '/settings/pipeline-stages', api: '/meta/pipeline-stages',
    description: 'The stages deals move through in the sales pipeline.',
    columns: [
      { key: 'name', label: 'Stage' }, { key: 'sequence', label: 'Order' }, { key: 'probability', label: 'Win %' },
      { key: 'is_won', label: 'Won', type: 'boolean' }, { key: 'is_lost', label: 'Lost', type: 'boolean' },
    ],
    fields: [
      { key: 'name', label: 'Stage Name', type: 'text', required: true },
      { key: 'sequence', label: 'Order', type: 'number', required: true },
      { key: 'probability', label: 'Win Probability %', type: 'number' },
      { key: 'is_won', label: 'This is a "Won" stage', type: 'checkbox' },
      { key: 'is_lost', label: 'This is a "Lost" stage', type: 'checkbox' },
    ],
  },
  {
    key: 'leave-types', label: 'Leave Types', path: '/settings/leave-types', api: '/meta/leave-types',
    description: 'Categories of leave employees can request.',
    columns: [{ key: 'name', label: 'Name' }, { key: 'days_allowed', label: 'Days / Year' }, { key: 'is_paid', label: 'Paid', type: 'boolean' }],
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'days_allowed', label: 'Days Allowed / Year', type: 'number' },
      { key: 'is_paid', label: 'Paid Leave', type: 'checkbox' },
    ],
  },
  {
    key: 'roles', label: 'Roles', path: '/settings/roles', api: '/meta/roles',
    description: 'Access roles assignable to user accounts.',
    columns: [
      { key: 'name', label: 'Name' }, { key: 'description', label: 'Description' },
      { key: 'can_access_crm', label: 'CRM', type: 'boolean' }, { key: 'can_access_hrm', label: 'HRM', type: 'boolean' },
      { key: 'can_access_accounts', label: 'Accounts', type: 'boolean' }, { key: 'can_edit', label: 'Can Edit', type: 'boolean' },
    ],
    fields: [
      { key: 'name', label: 'Role Name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'can_access_crm', label: 'CRM Access', type: 'checkbox', checkLabel: 'This role can see the CRM section' },
      { key: 'can_access_hrm', label: 'HRM Access', type: 'checkbox', checkLabel: 'This role can see the HRM section' },
      { key: 'can_access_accounts', label: 'Accounts Access', type: 'checkbox', checkLabel: 'This role can see the Accounts section' },
      { key: 'can_edit', label: 'Can Edit', type: 'checkbox', checkLabel: 'This role can create/edit/delete records (unchecked = view-only everywhere)' },
    ],
  },
];
