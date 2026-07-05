import { NextRequest, NextResponse } from 'next/server';
import { staffMobileCheckSchema } from '@/lib/validations';
import { normalizeMobile, isValidIndianMobile } from '@/utils/mobile';
import { StaffService } from '@/services/StaffService';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = staffMobileCheckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
  }

  const mobile = normalizeMobile(parsed.data.mobile);
  if (!isValidIndianMobile(mobile)) {
    return NextResponse.json({ isStaff: false });
  }

  const staff = await StaffService.findByMobile(mobile);
  return NextResponse.json({
    isStaff: Boolean(staff),
    staffName: staff?.name ?? null,
  });
}
