import type { NextRequest } from 'next/server';

export function getRequestMeta(req: NextRequest) {
  return {
    ip:
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      undefined,
    userAgent: req.headers.get('user-agent') || undefined,
  };
}
