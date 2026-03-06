import { Locale } from '@/i18n';

/**
 * Add locale prefix to a path
 * @param path - The path to add locale to (e.g., "/admin/kols")
 * @param locale - The locale to add (e.g., "en")
 * @returns The localized path (e.g., "/en/admin/kols")
 */
export function addLocaleToPath(path: string, locale: Locale): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Add locale prefix
  return `/${locale}/${cleanPath}`;
}

/**
 * Remove locale prefix from a path
 * @param path - The path with locale (e.g., "/en/admin/kols")
 * @returns The path without locale (e.g., "/admin/kols")
 */
export function removeLocaleFromPath(path: string): string {
  // Match locale pattern at the beginning of the path
  const localePattern = /^\/[a-z]{2}(-[A-Z]{2})?/;
  return path.replace(localePattern, '') || '/';
}

/**
 * Get the current locale from a pathname
 * @param pathname - The current pathname (e.g., "/en/admin/kols")
 * @returns The locale or 'en' as default
 */
export function getLocaleFromPath(pathname: string): Locale {
  const match = pathname.match(/^\/([a-z]{2}(-[A-Z]{2})?)/);
  return (match?.[1] as Locale) || 'en';
}

/**
 * Create a locale-aware navigation link
 * @param href - The base href (e.g., "/admin/kols")
 * @param locale - The current locale
 * @returns The localized href
 */
export function createLocalizedHref(href: string, locale: Locale): string {
  return addLocaleToPath(href, locale);
}

/**
 * Check if a pathname matches a navigation item (considering locale)
 * @param pathname - Current pathname
 * @param href - Navigation item href
 * @returns Whether the navigation item is active
 */
export function isActiveNavItem(pathname: string, href: string): boolean {
  const currentPath = removeLocaleFromPath(pathname);
  const targetPath = removeLocaleFromPath(href);
  
  // Exact match for root admin
  if (href === '/admin' && currentPath === '/admin') {
    return true;
  }
  
  // For other paths, check if current path starts with target path
  return currentPath.startsWith(targetPath) && targetPath !== '/';
}
