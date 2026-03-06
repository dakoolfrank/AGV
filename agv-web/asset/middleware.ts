import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n';

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
    '/'
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

  // Handle admin routes - let client-side authentication handle it
  const isAdminRoute = pathname.includes('/admin');
  
  if (isAdminRoute) {
    // For admin routes, we'll let the client-side AdminAuthWrapper handle authentication
    // This prevents the double redirect issue
    // The AdminAuthWrapper will show the login form if not authenticated
  }

  // Handle locale redirects for non-admin routes
  if (!pathnameHasLocale && !isAdminRoute) {
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

