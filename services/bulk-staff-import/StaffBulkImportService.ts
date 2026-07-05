import type { StaffRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { isValidStaffRole, type StaffTemplateRow } from '@/types/StaffBulkImport';
import { normalizeMobile, isValidIndianMobile } from '@/utils/mobile';
import { StaffService } from '@/services/StaffService';
import { AuditService } from '@/services/AuditService';
import { parseStaffSpreadsheetBuffer } from './parseStaffSpreadsheet';

export interface StaffImportRowResult {
  rowNumber: number;
  name: string;
  mobile: string;
  email: string | null;
  role: string;
  valid: boolean;
  errors: string[];
}

export interface StaffImportPreview {
  rows: StaffImportRowResult[];
  summary: { total: number; valid: number; invalid: number };
}

export interface StaffImportReport {
  total: number;
  created: number;
  failed: number;
  errors: Array<{ rowNumber: number; mobile?: string; errors: string[] }>;
}

function parseActive(val: string): boolean {
  if (!val) return true;
  const v = val.toLowerCase();
  if (['false', 'no', '0', 'n'].includes(v)) return false;
  return true;
}

export class StaffBulkImportService {
  static parseBuffer(buffer: ArrayBuffer) {
    return parseStaffSpreadsheetBuffer(buffer);
  }

  static async preview(rows: StaffTemplateRow[]): Promise<StaffImportPreview> {
    const existingMobiles = new Set<string>();
    const existingEmails = new Set<string>();
    const dbStaff = await prisma.staffAccount.findMany({
      where: { deletedAt: null },
      select: { mobile: true, email: true },
    });
    for (const s of dbStaff) {
      existingMobiles.add(s.mobile);
      if (s.email) existingEmails.add(s.email.toLowerCase());
    }

    const fileMobiles = new Map<string, number>();
    const fileEmails = new Map<string, number>();
    const results: StaffImportRowResult[] = [];

    for (const row of rows) {
      const errors: string[] = [];
      const mobile = normalizeMobile(row.mobile);
      const email = row.email?.trim().toLowerCase() || null;

      if (!row.name?.trim()) errors.push('Name is required');
      if (!mobile) errors.push('Mobile is required');
      else if (!isValidIndianMobile(mobile)) errors.push('Invalid mobile number');
      if (!row.role?.trim()) errors.push('Role is required');
      else if (!isValidStaffRole(row.role.trim())) errors.push(`Invalid role: ${row.role}`);
      if (row.password && row.password.length < 6) errors.push('Password must be at least 6 characters');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format');

      if (mobile && fileMobiles.has(mobile)) {
        errors.push(`Duplicate mobile in file (row ${fileMobiles.get(mobile)})`);
      }
      if (email && fileEmails.has(email)) {
        errors.push(`Duplicate email in file (row ${fileEmails.get(email)})`);
      }
      if (mobile && existingMobiles.has(mobile)) errors.push('Mobile already exists in database');
      if (email && existingEmails.has(email)) errors.push('Email already exists in database');

      if (mobile) fileMobiles.set(mobile, row.rowNumber);
      if (email) fileEmails.set(email, row.rowNumber);

      results.push({
        rowNumber: row.rowNumber,
        name: row.name?.trim() ?? '',
        mobile,
        email,
        role: row.role?.trim() ?? '',
        valid: errors.length === 0,
        errors,
      });
    }

    const valid = results.filter((r) => r.valid).length;
    return {
      rows: results,
      summary: { total: results.length, valid, invalid: results.length - valid },
    };
  }

  static async importValidRows(
    rows: StaffTemplateRow[],
    actorStaffId: string,
  ): Promise<StaffImportReport> {
    const preview = await this.preview(rows);
    const validRows = preview.rows.filter((r) => r.valid);
    const invalidRows = preview.rows.filter((r) => !r.valid);

    if (validRows.length === 0) {
      return {
        total: preview.summary.total,
        created: 0,
        failed: invalidRows.length,
        errors: invalidRows.map((r) => ({ rowNumber: r.rowNumber, mobile: r.mobile, errors: r.errors })),
      };
    }

    const rowMap = new Map(rows.map((r) => [r.rowNumber, r]));

    try {
      const created = await prisma.$transaction(async (tx) => {
        let count = 0;
        for (const valid of validRows) {
          const source = rowMap.get(valid.rowNumber)!;
          const mobile = normalizeMobile(source.mobile);
          const password = source.password?.trim() || 'changeme123';
          await tx.staffAccount.create({
            data: {
              name: source.name.trim(),
              mobile,
              email: valid.email,
              role: source.role.trim() as StaffRole,
              passwordHash: await hashPassword(password),
              permissions: [],
              active: parseActive(source.active),
            },
          });
          StaffService.invalidateMobileCache(mobile);
          count++;
        }
        return count;
      });

      await AuditService.log({
        staffId: actorStaffId,
        action: 'staff_bulk_import',
        entity: 'staff_accounts',
        meta: { created, failed: invalidRows.length },
      });

      return {
        total: preview.summary.total,
        created,
        failed: invalidRows.length,
        errors: invalidRows.map((r) => ({ rowNumber: r.rowNumber, mobile: r.mobile, errors: r.errors })),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      return {
        total: preview.summary.total,
        created: 0,
        failed: preview.summary.total,
        errors: [{ rowNumber: 0, errors: [message] }],
      };
    }
  }
}
