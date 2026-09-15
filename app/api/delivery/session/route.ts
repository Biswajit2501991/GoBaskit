import { NextResponse } from 'next/server';
import { requireDeliveryPartner } from '@/lib/staff-auth';
import { PartnerDeliveryService } from '@/services/PartnerDeliveryService';

export async function GET() {
  const auth = await requireDeliveryPartner();
  if (auth.error) return auth.error;
  const staff = auth.staff!;
  const session = await PartnerDeliveryService.sessionFor({
    id: staff.id,
    name: staff.name,
  });
  return NextResponse.json(session);
}
