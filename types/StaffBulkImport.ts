import type { StaffRole } from '@prisma/client';
import { STAFF_ROLES } from '@/types/staff';

export interface StaffTemplateColumn {
  key: keyof StaffTemplateRow;
  header: string;
  description: string;
  sample: string;
  required: boolean;
}

export interface StaffTemplateRow {
  rowNumber: number;
  name: string;
  mobile: string;
  email: string;
  role: string;
  password: string;
  active: string;
}

export const STAFF_TEMPLATE_COLUMNS: StaffTemplateColumn[] = [
  { key: 'name', header: 'Name', description: 'Full name of staff member', sample: 'Priya Sharma', required: true },
  { key: 'mobile', header: 'Mobile', description: '10-digit Indian mobile (unique)', sample: '9876543210', required: true },
  { key: 'email', header: 'Email', description: 'Optional work email (unique if provided)', sample: 'priya@gobaskit.com', required: false },
  { key: 'role', header: 'Role', description: `One of: ${STAFF_ROLES.join(', ')}`, sample: 'ORDER_MANAGER', required: true },
  { key: 'password', header: 'Password', description: 'Min 6 chars; defaults to changeme123 if blank', sample: 'changeme123', required: false },
  { key: 'active', header: 'Active', description: 'TRUE or FALSE', sample: 'TRUE', required: false },
];

export const STAFF_COLUMN_MAP: Record<string, keyof StaffTemplateRow> = {
  Name: 'name',
  Mobile: 'mobile',
  Email: 'email',
  Role: 'role',
  Password: 'password',
  Active: 'active',
};

export function isValidStaffRole(role: string): role is StaffRole {
  return STAFF_ROLES.includes(role as StaffRole);
}
