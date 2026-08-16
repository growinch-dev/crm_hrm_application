import {
  UserPlus, Building2, Contact, CalendarClock, Package, MessageSquare, LayoutDashboard,
  Kanban, FileText, ShoppingCart, LifeBuoy, FileUp,
  Users, Briefcase, UserSearch, ClipboardList, Clock, CalendarOff, PartyPopper, Wallet,
  Receipt, Star, Target, GraduationCap, BookOpen, Laptop, LogOut, HandCoins,
  BookOpenCheck, CreditCard, ScrollText,
  Building, IdCard, Radio, GitBranch, CalendarDays, ShieldCheck, FolderOpen,
} from 'lucide-react';

export const SIDEBAR_ICONS = {
  // CRM
  leads: UserPlus,
  companies: Building2,
  contacts: Contact,
  activities: CalendarClock,
  products: Package,
  communications: MessageSquare,
  'crm-dashboard': LayoutDashboard,
  deals: Kanban,
  quotations: FileText,
  'sales-orders': ShoppingCart,
  tickets: LifeBuoy,
  documents: FileUp,

  // HRM
  employees: Users,
  'job-openings': Briefcase,
  candidates: UserSearch,
  onboarding: ClipboardList,
  attendance: Clock,
  'leave-requests': CalendarOff,
  loans: HandCoins,
  holidays: PartyPopper,
  expenses: Receipt,
  'performance-reviews': Star,
  goals: Target,
  'training-programs': GraduationCap,
  'training-enrollments': BookOpen,
  assets: Laptop,
  offboarding: LogOut,
  'hr-dashboard': LayoutDashboard,
  payroll: Wallet,
  'employee-documents': FileUp,

  // Accounts
  'chart-of-accounts': BookOpenCheck,
  invoices: FileText,
  payments: CreditCard,
  ledger: ScrollText,

  // Settings
  departments: Building,
  designations: IdCard,
  'lead-sources': Radio,
  'pipeline-stages': GitBranch,
  'leave-types': CalendarDays,
  roles: ShieldCheck,
  users: Users,
  'company-documents': FolderOpen,
};
