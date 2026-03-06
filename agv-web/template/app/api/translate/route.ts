import { NextRequest, NextResponse } from 'next/server';
import { createTranslator } from '@/lib/translator';

export async function POST(request: NextRequest) {
  try {
    const { text, from, to } = await request.json();

    if (!text || !from || !to) {
      return NextResponse.json(
        { error: 'Missing required parameters: text, from, to' },
        { status: 400 }
      );
    }

    const translator = createTranslator();
    const translated = await translator.translate({ text, from, to });

    return NextResponse.json({ text: translated });
  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    );
  }
}
