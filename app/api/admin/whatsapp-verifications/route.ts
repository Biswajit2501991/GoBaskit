import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/lib/staff-auth';
import { WhatsAppVerificationService } from '@/services/WhatsAppVerificationService';
import type { WhatsAppVerificationStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  const auth = await requireStaffPermission('verification:view');
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as WhatsAppVerificationStatus | null;
  const validStatuses = ['PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED'];
  const data = await WhatsAppVerificationService.listAdmin({
    search: searchParams.get('search') || undefined,
    status: status && validStatuses.includes(status) ? status : undefined,
    page: Number(searchParams.get('page') || 1),
    pageSize: Number(searchParams.get('pageSize') || 20),
  });

  return NextResponse.json(data);
}
