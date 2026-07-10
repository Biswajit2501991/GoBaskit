-- AlterEnum: add All Super Admin (must commit before the value can be used)
ALTER TYPE "StaffRole" ADD VALUE IF NOT EXISTS 'ALL_SUPER_ADMIN';
