import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - files with extensions (static files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ]
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes and static files
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Skip static files
  if (pathname.includes('.')) {
    return NextResponse.next();
  }

  // Check if pathname already has a locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (!pathnameHasLocale) {
    // Get locale from cookie or default to English
    const locale = request.cookies.get('NEXT_LOCALE')?.value || defaultLocale;
    
    // Redirect to the same pathname with locale
    const url = new URL(`/${locale}${pathname}`, request.url);
    const response = NextResponse.redirect(url);
    
    // Set/update the locale cookie
    response.cookies.set('NEXT_LOCALE', locale, { 
      path: '/', 
      maxAge: 60 * 60 * 24 * 365 // 1 year
    });
    
    return response;
  }

  return NextResponse.next();
}

