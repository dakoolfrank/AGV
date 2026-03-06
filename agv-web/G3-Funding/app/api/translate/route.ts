import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { text, to, from = 'en' } = await req.json();

    if (!text || !to) {
      return NextResponse.json(
        { error: 'Missing required fields: text, to' },
        { status: 400 }
      );
    }

    if (text.length > 5000) {
      return NextResponse.json(
        { error: 'Text too long. Maximum 5000 characters.' },
        { status: 400 }
      );
    }

    // Dynamic imports to prevent bundling issues
    const { createTranslator } = await import('@/lib/translator');
    const { translateMessage } = await import('@/lib/translateWithCache');

    const translator = createTranslator();
    const translated = await translateMessage(translator, { text, from, to });

    return NextResponse.json({ text: translated });
  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    );
  }
}
