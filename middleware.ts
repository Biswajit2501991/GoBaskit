import { NextRequest, NextResponse } from 'next/server';

/** Pass the request path into RSC so admin HTML can skip storefront seasonal settings. */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  requestHeaders.set('x-search', request.nextUrl.search);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads/|img/).*)'],
};
