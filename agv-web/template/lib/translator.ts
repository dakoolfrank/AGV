import { config } from 'dotenv';
import { TranslationServiceClient } from '@google-cloud/translate';

// Load environment variables
config();

export interface Translator {
  translate(params: { text: string; from: string; to: string }): Promise<string>;
}

export class GoogleTranslator implements Translator {
  private translationClient: TranslationServiceClient;
  private projectId: string;
  private location: string;

  constructor(projectId: string) {
    this.projectId = projectId;
    this.location = 'global';
    
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
      if (!text || !text.trim()) {
        return text;
      }

      const request = {
        parent: `projects/${this.projectId}/locations/${this.location}`,
        contents: [text],
        mimeType: 'text/plain',
        sourceLanguageCode: from,
        targetLanguageCode: to,
      };

      const [response] = await this.translationClient.translateText(request);
      
      if (response.translations && response.translations.length > 0) {
        const translatedText = response.translations[0].translatedText;
        return translatedText || text;
      }
      
      return text;
    } catch (error: unknown) {
      console.error('Google Cloud Translation API error:', error);
      return text;
    }
  }
}

// Factory function to create translator based on environment
export function createTranslator(): Translator {
  const provider = process.env.TRANSLATION_PROVIDER || 'google';
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID environment variable is required for Google Cloud Translation');
  }

  switch (provider) {
    case 'google':
      return new GoogleTranslator(projectId);
    default:
      return new GoogleTranslator(projectId);
  }
}
