const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'mail.com',
  'protonmail.com',
  'pm.me',
  'zoho.com',
  'yandex.com',
  'gmx.com',
  'inbox.com',
  'rediffmail.com',
  'qq.com',
  '163.com',
  '126.com',
  'yeah.net',
  'naver.com',
  'daum.net',
  'sina.com',
];

const PERSONAL_DOMAIN_SET = new Set(PERSONAL_EMAIL_DOMAINS);

export interface WorkEmailValidationResult {
  valid: boolean;
  reason?: string;
  domain?: string;
}

export function extractDomain(email: string): string | null {
  if (!email || typeof email !== 'string') return null;
  const atIndex = email.indexOf('@');
  if (atIndex === -1 || atIndex === email.length - 1) return null;
  return email.slice(atIndex + 1).trim().toLowerCase();
}

export function isPersonalEmailDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  return PERSONAL_DOMAIN_SET.has(domain.toLowerCase());
}

export function validateWorkEmail(email: string): WorkEmailValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Email is required' };
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return { valid: false, reason: 'Invalid email format' };
  }

  const domain = extractDomain(normalizedEmail);
  if (!domain) {
    return { valid: false, reason: 'Email domain could not be determined' };
  }

  if (isPersonalEmailDomain(domain)) {
    return { valid: false, reason: 'Personal email domains are not allowed' };
  }

  return {
    valid: true,
    domain,
  };
}

export function getPersonalEmailDomains(): string[] {
  return PERSONAL_EMAIL_DOMAINS;
}

