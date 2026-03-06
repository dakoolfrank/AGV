import type { Translator } from './translator';
import { config } from 'dotenv';

// Load environment variables
config();

export async function translateWithCache(
  translator: Translator,
  { text, from, to }: {
    text: string;
    from: string;
    to: string;
  }
): Promise<string> {
  // For now, we'll skip caching and just translate directly
  // You can add Redis caching later if needed
  try {
    const translated = await translator.translate({ text, from, to });
    return translated;
  } catch (error) {
    console.error('Translation error:', error);
    // Fallback to direct translation if cache fails
    return translator.translate({ text, from, to });
  }
}

export async function translateMessage(
  translator: Translator,
  { text, from, to }: {
    text: string;
    from: string;
    to: string;
  }
): Promise<string> {
  return translateWithCache(translator, { text, from, to });
}

export async function translateObject(
  translator: Translator,
  { obj, from, to }: {
    obj: Record<string, unknown>;
    from: string;
    to: string;
  }
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = await translateMessage(translator, { text: value, from, to });
    } else if (typeof value === 'object' && value !== null) {
      result[key] = await translateObject(translator, { obj: value as Record<string, unknown>, from, to });
    } else {
      result[key] = value;
    }
  }
  
  return result;
}
