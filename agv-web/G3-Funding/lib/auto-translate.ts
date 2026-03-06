'use client';

// Helper to automatically wrap text with TranslatedText component
export function autoTranslate(text: string, fallback?: string): string {
  if (typeof window === 'undefined') return text; // Server-side fallback
  
  // This will be used by a future script to automatically wrap hardcoded text
  return text;
}

// Usage example for components:
// Instead of: <h1>Welcome to our site</h1>
// Use: <h1><TranslatedText text="Welcome to our site" /></h1>

export const TranslationHelpers = {
  // Common patterns for easy replacement
  wrapHeading: (text: string) => `<TranslatedText text="${text}" />`,
  wrapParagraph: (text: string) => `<TranslatedText text="${text}" />`,
  wrapButton: (text: string) => `<TranslatedText text="${text}" />`,
};
