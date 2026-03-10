import OpenAI from "openai";
import { TranslationServiceClient } from '@google-cloud/translate';

export interface Translator {
  translate(params: { text: string; from: string; to: string }): Promise<string>;
}

export class OpenAITranslator implements Translator {
  private openai: OpenAI;

  constructor(private apiKey: string) {
    this.openai = new OpenAI({
      apiKey: this.apiKey,
    });
  }

  async translate({ text, from, to }: { text: string; from: string; to: string }): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: `You are a professional translator. Translate the following text from ${from} to ${to}. Maintain the original formatting, structure, and meaning. Return only the translated text without any explanations or additional content.\n\nText to translate: ${text}`
        }],
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content?.trim() || text;
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original text on error
    }
  }
}

export class GoogleTranslator implements Translator {
  private translationClient: TranslationServiceClient;
  private projectId: string;
  private location: string;

  constructor(projectId: string) {
    this.projectId = projectId;
    this.location = 'global'; // Use global location for best performance
    
    // Debug authentication
    console.log('🔐 Firebase credentials check:');
    console.log('- Client Email:', process.env.FIREBASE_CLIENT_EMAIL ? '✅ Set' : '❌ Missing');
    console.log('- Private Key:', process.env.FIREBASE_PRIVATE_KEY ? '✅ Set' : '❌ Missing');
    console.log('- Project ID:', projectId);
    
    // Initialize Translation client with explicit Firebase Admin credentials
    this.translationClient = new TranslationServiceClient({
      projectId: projectId,
      credentials: {
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    });
  }

  async translate({ text, from, to }: { text: string; from: string; to: string }): Promise<string> {
    try {
      // Validate input
      if (!text || !text.trim()) {
        return text;
      }

      // Prepare the translation request
      const request = {
        parent: `projects/${this.projectId}/locations/${this.location}`,
        contents: [text],
        mimeType: 'text/plain',
        sourceLanguageCode: from,
        targetLanguageCode: to,
      };

      // Execute the translation
      const [response] = await this.translationClient.translateText(request);
      
      // Extract and return the translated text
      if (response.translations && response.translations.length > 0) {
        const translatedText = response.translations[0].translatedText;
        return translatedText || text; // Return original if translation is empty
      }
      
      return text; // Return original text if no translation
    } catch (error: unknown) {
      console.error('Google Cloud Translation API error:', error);
      
      // Log specific error details for debugging
      const errorCode = (error as { code?: number })?.code;
      if (errorCode === 7) {
        console.error('PERMISSION_DENIED: Check if Cloud Translation API is enabled and service account has proper permissions');
      } else if (errorCode === 8) {
        console.error('RESOURCE_EXHAUSTED: API quota exceeded');
      } else if (errorCode === 3) {
        console.error('INVALID_ARGUMENT: Check language codes and request format');
      }
      
      // Return original text on error to prevent breaking the application
      return text;
    }
  }
}

export class DeepLTranslator implements Translator {
  constructor(private apiKey: string) {}

  async translate({ text, from, to }: { text: string; from: string; to: string }): Promise<string> {
    try {
      const response = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          text,
          source_lang: from.toUpperCase(),
          target_lang: to.toUpperCase()
        })
      });

      if (!response.ok) {
        throw new Error(`DeepL API error: ${response.status}`);
      }

      const data = await response.json();
      return data.translations[0]?.text || text;
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Return original text on error
    }
  }
}

// Factory function to create translator based on environment
export function createTranslator(): Translator {
  const provider = process.env.TRANSLATION_PROVIDER || 'google';
  const apiKey = process.env.TRANSLATION_API_KEY;
  // Use Firebase project ID as Google Cloud project ID
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID environment variable is required for Google Cloud Translation');
  }
  console.log('provider', provider);
  console.log('apiKey', apiKey);
  console.log('projectId', projectId);
  switch (provider) {
    case 'google':
      return new GoogleTranslator(projectId);
    case 'deepl':
      if (!apiKey) {
        throw new Error('TRANSLATION_API_KEY environment variable is required for DeepL');
      }
      return new DeepLTranslator(apiKey);
    case 'openai':
      if (!apiKey) {
        throw new Error('TRANSLATION_API_KEY environment variable is required for OpenAI');
      }
      return new OpenAITranslator(apiKey);
    default:
      return new GoogleTranslator(projectId);
  }
}
