import { NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';

export async function GET() {
  const auth = await requireStaffPermission('verification:view');
  if (auth.error) return auth.error;

  const pendingCount = await WhatsAppVerificationService.getPendingCount();
  return NextResponse.json({ pendingCount });
}
