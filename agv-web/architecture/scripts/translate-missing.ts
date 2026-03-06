import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createTranslator } from '../src/lib/translator';
import { translateObject } from '../src/lib/translateWithCache';
import { locales, defaultLocale, Locale } from '../src/i18n';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Map our locale codes to Google Cloud Translation API language codes
function mapLocaleToGoogleLanguageCode(locale: Locale): string {
  const mapping: Record<Locale, string> = {
    'en': 'en',
    'zh-CN': 'zh-CN',
    'zh-TW': 'zh-TW',
    'ko': 'ko',
    'tl': 'fil', // Tagalog is 'fil' in Google Cloud Translation
    'fr': 'fr',
    'de': 'de',
    'es': 'es',
    'ar': 'ar',
    'ja': 'ja'
  };
  return mapping[locale] || locale;
}

// Add delay function to avoid rate limits
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function translateMissingKeys() {
  const messagesDir = join(process.cwd(), 'src', 'messages');
  const sourceFile = join(messagesDir, `${defaultLocale}.json`);
  
  if (!existsSync(sourceFile)) {
    console.error(`Source file not found: ${sourceFile}`);
    return;
  }

  const sourceMessages = JSON.parse(readFileSync(sourceFile, 'utf-8'));
  console.log(`Loaded source messages from ${defaultLocale}.json`);

  for (const locale of locales) {
    if (locale === defaultLocale) continue;

    const targetFile = join(messagesDir, `${locale}.json`);
    let targetMessages: Record<string, any> = {};

    // Load existing translations if file exists
    if (existsSync(targetFile)) {
      targetMessages = JSON.parse(readFileSync(targetFile, 'utf-8'));
      console.log(`Loaded existing translations for ${locale}`);
    }

    // Find missing keys
    const missingKeys = findMissingKeys(sourceMessages, targetMessages);
    
    if (missingKeys.length === 0) {
      console.log(`No missing keys for ${locale}`);
      continue;
    }

    console.log(`Found ${missingKeys.length} missing keys for ${locale}`);

    try {
      const translator = createTranslator();
      
      // Add delay before starting translation to avoid rate limits
      console.log(`⏳ Starting translation for ${locale} (${missingKeys.length} keys)...`);
      await delay(1000); // 1 second delay
      
      // Translate missing keys
      for (const keyPath of missingKeys) {
        const value = getNestedValue(sourceMessages, keyPath);
        if (typeof value === 'string') {
          try {
            const translated = await translateObject(translator, {
              obj: { [keyPath]: value },
              from: mapLocaleToGoogleLanguageCode(defaultLocale),
              to: mapLocaleToGoogleLanguageCode(locale)
            });
            
            setNestedValue(targetMessages, keyPath, Object.values(translated)[0]);
            console.log(`✅ Translated: ${keyPath}`);
            
            // Add small delay between translations to avoid rate limits
            await delay(500); // 0.5 second delay between translations
          } catch (error) {
            console.error(`❌ Failed to translate ${keyPath}:`, error);
            // Keep the original value if translation fails
          }
        }
      }

      // Write updated translations
      writeFileSync(targetFile, JSON.stringify(targetMessages, null, 2));
      console.log(`Updated ${targetFile}`);
      
    } catch (error) {
      console.error(`Error translating ${locale}:`, error);
    }
  }
}

function findMissingKeys(source: Record<string, any>, target: Record<string, any>, prefix = ''): string[] {
  const missing: string[] = [];
  
  for (const [key, value] of Object.entries(source)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      missing.push(...findMissingKeys(value, target[key], fullKey));
    } else if (Array.isArray(value)) {
      // Handle arrays
      if (!Array.isArray(target[key])) {
        target[key] = [];
      }
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === 'string') {
          const arrayKey = `${fullKey}.${i}`;
          if (!target[key][i] || target[key][i] === '' || isEnglishPlaceholder(target[key][i], value[i])) {
            missing.push(arrayKey);
          }
        }
      }
    } else if (typeof value === 'string') {
      // Check if key is missing, empty, or contains English placeholder
      if (!(key in target) || target[key] === '' || isEnglishPlaceholder(target[key], value)) {
        missing.push(fullKey);
      }
    }
  }
  
  return missing;
}

function isEnglishPlaceholder(targetValue: any, sourceValue: any): boolean {
  if (typeof targetValue !== 'string' || typeof sourceValue !== 'string') {
    return false;
  }
  
  // If target value is exactly the same as source (English), it's a placeholder
  if (targetValue === sourceValue) {
    return true;
  }
  
  // Check for common English patterns in non-English files
  const englishPatterns = [
    /^[A-Za-z\s&\-''"",.:!?()0-9]+$/, // Only English letters, spaces, and basic punctuation
    /\b(the|and|or|of|in|to|for|with|on|at|by|from|as|is|are|was|were|The|And|Or|Of|In|To|For|With|On|At|By|From|As|Is|Are|Was|Were)\b/,
    /\b(Join|Apply|Partner|Fund|Community|Institution|Contributor|G3|FUND|RWA|KOL)\b/,
  ];
  
  return englishPatterns.some(pattern => pattern.test(targetValue));
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (current === undefined || current === null) {
      return undefined;
    }
    // Handle array access (e.g., "features.0")
    if (Array.isArray(current)) {
      const index = parseInt(key, 10);
      if (!isNaN(index) && index >= 0 && index < current.length) {
        return current[index];
      }
      return undefined;
    }
    // Handle object access
    if (typeof current === 'object' && key in current) {
      return current[key];
    }
    return undefined;
  }, obj);
}

function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  
  // Navigate to the parent object/array
  const target = keys.reduce((current, key) => {
    if (current === undefined || current === null) {
      return undefined;
    }
    // Handle array access
    if (Array.isArray(current)) {
      const index = parseInt(key, 10);
      if (!isNaN(index) && index >= 0 && index < current.length) {
        return current[index];
      }
      return undefined;
    }
    // Handle object access
    if (typeof current === 'object' && key in current) {
      return current[key];
    }
    return undefined;
  }, obj);
  
  if (target === undefined || target === null) {
    return;
  }
  
  // Set the value - handle both array and object cases
  if (Array.isArray(target)) {
    const index = parseInt(lastKey, 10);
    if (!isNaN(index) && index >= 0) {
      // Ensure array is large enough
      while (target.length <= index) {
        target.push('');
      }
      target[index] = value;
    }
  } else if (typeof target === 'object') {
    target[lastKey] = value;
  }
}

// Run the script
translateMissingKeys().catch(console.error);

export { translateMissingKeys };
