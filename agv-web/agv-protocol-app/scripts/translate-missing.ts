import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createTranslator } from '../lib/translator';
import { translateObject } from '../lib/translateWithCache';
import { locales, defaultLocale } from '../i18n';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Add delay function to avoid rate limits
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function translateMissingKeys() {
  const messagesDir = join(process.cwd(), 'messages');
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
              from: defaultLocale,
              to: locale
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
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

// Run the script
if (require.main === module) {
  translateMissingKeys().catch(console.error);
}

export { translateMissingKeys };
