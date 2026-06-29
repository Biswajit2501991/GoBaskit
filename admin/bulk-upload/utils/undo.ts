import type { ImportBatchRecord } from '@/types/BulkUpload';

export function canUndoBatch(batch: ImportBatchRecord): boolean {
  return new Date(batch.expiresAt).getTime() > Date.now();
}
