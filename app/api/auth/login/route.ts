import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, signAdminToken, COOKIE_NAME, getStaffFromSession } from '@/lib/auth';
import { adminLoginSchema } from '@/lib/validations';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
  }

  const admin = await prisma.admin.findUnique({ where: { email: parsed.data.email } });
  if (!admin || !admin.isActive) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const valid = await verifyPassword(parsed.data.password, admin.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const token = signAdminToken(admin.id, admin.email);
  const response = NextResponse.json({ success: true, admin: { id: admin.id, name: admin.name, email: admin.email } });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}

export async function GET() {
  const staff = await getStaffFromSession();
  if (!staff) return NextResponse.json({ authenticated: false });
  return NextResponse.json({
    authenticated: true,
    staff: {
      id: staff.id,
      name: staff.name,
      mobile: staff.mobile,
      role: staff.role,
      email: staff.email,
    },
  });
}
