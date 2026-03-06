# AGV Template

A Next.js template project for AGV (AGRIVOLTS) applications with built-in internationalization, translation support, and common configurations.

## Features

- ✅ **Next.js 14** with App Router
- ✅ **TypeScript** for type safety
- ✅ **Tailwind CSS** for styling
- ✅ **Internationalization (i18n)** with 10 supported locales:
  - English (en)
  - Simplified Chinese (zh-CN)
  - Traditional Chinese (zh-TW)
  - Korean (ko)
  - Tagalog (tl)
  - French (fr)
  - German (de)
  - Spanish (es)
  - Arabic (ar)
  - Japanese (ja)
- ✅ **Translation Provider** with Google Cloud Translation API support
- ✅ **Middleware** for automatic locale routing
- ✅ **Navbar** with language switcher
- ✅ **Responsive Design** with modern UI components
- ✅ **Primary Color**: `194 99% 57%` (cyan/blue)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project (for translation API)

### Installation

1. Clone this template:
```bash
git clone <repository-url> your-project-name
cd your-project-name
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Set up environment variables:
Copy `env.example` to `.env.local` and fill in your Firebase credentials:

```bash
cp env.example .env.local
```

Then edit `.env.local` with your actual Firebase project credentials:
- Get `FIREBASE_PROJECT_ID` from your Firebase project settings
- Get `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` from Firebase project settings -> Service Accounts

4. Run the development server:
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
agv-template/
├── app/
│   ├── [locale]/          # Locale-based routing
│   │   ├── layout.tsx     # Locale layout with TranslationProvider
│   │   ├── page.tsx       # Home page
│   │   └── TranslationProvider.tsx
│   ├── api/
│   │   └── translate/     # Translation API endpoint
│   └── globals.css        # Global styles
├── lib/
│   ├── translator.ts      # Translation service
│   └── utils.ts           # Utility functions
├── messages/              # Translation JSON files
│   ├── en.json
│   ├── zh-CN.json
│   ├── zh-TW.json
│   └── ... (other locales)
├── i18n.ts               # Locale configuration
├── middleware.ts          # Locale routing middleware
├── next.config.js         # Next.js configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── tsconfig.json          # TypeScript configuration
```

## Usage

### Using Translations

In your components, use the `useTranslations` hook:

```tsx
'use client';

import { useTranslations } from './TranslationProvider';

export default function MyComponent() {
  const t = useTranslations();
  
  return (
    <div>
      <h1>{t('about.title')}</h1>
      <p>{t('about.description')}</p>
    </div>
  );
}
```

### Adding New Translations

1. Add the translation key to `messages/en.json`
2. Add translations for other locales in their respective JSON files
3. Use the translation key in your components

### Adding New Locales

1. Add the locale to `i18n.ts`:
```typescript
export const locales = [
  'en', 'zh-CN', 'zh-TW', 'ko', 'tl', 'fr', 'de', 'es', 'ar', 'ja', 'new-locale'
] as const;
```

2. Create a new JSON file in `messages/` directory (e.g., `messages/new-locale.json`)
3. Add locale name and flag to `localeNames` and `localeFlags` in `i18n.ts`

## Building for Production

```bash
npm run build
npm start
```

## Customization

### Styling

- Modify `tailwind.config.js` to customize theme colors
- Update `app/globals.css` for global styles
- Use Tailwind utility classes in your components

### Translation API

The template uses Google Cloud Translation API by default. To use a different provider:

1. Implement a new translator class in `lib/translator.ts`
2. Update the `createTranslator()` function to support your provider
3. Set `TRANSLATION_PROVIDER` environment variable

## License

This template is provided as-is for AGV project development.

## Support

For issues or questions, please refer to the main AGV project documentation.
