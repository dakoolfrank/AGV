import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAnalyticsMetadata } from '@/lib/analytics-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventType, walletAddress, sessionId, metadata } = body;

    // Validate event type
    const validEventTypes = [
      'claim_page_visit',
      'buy_page_visit',
      'staking_page_visit',
      'claim_dropoff',
      'buy_dropoff',
      'staking_dropoff',
    ];

    if (!eventType || !validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid event type' },
        { status: 400 }
      );
    }

    // Get analytics metadata (country, device, time-of-day)
    const analyticsMetadata = await getAnalyticsMetadata(request);

    // Create analytics event
    const timestamp = new Date().toISOString();
    const eventData: Record<string, unknown> = {
      eventType,
      timestamp,
      createdAt: new Date(),
      // Analytics metadata
      country: analyticsMetadata.country,
      region: analyticsMetadata.region,
      city: analyticsMetadata.city,
      deviceType: analyticsMetadata.deviceType,
      browser: analyticsMetadata.browser,
      os: analyticsMetadata.os,
      hourOfDay: analyticsMetadata.hourOfDay,
      timeOfDay: analyticsMetadata.timeOfDay,
    };

    // Optional fields
    if (walletAddress) {
      eventData.walletAddress = walletAddress.toLowerCase();
    }
    if (sessionId) {
      eventData.sessionId = sessionId;
    }
    if (metadata) {
      eventData.metadata = { ...(eventData.metadata || {}), ...metadata };
    }

    await adminDb.collection('analytics_events').add(eventData);

    return NextResponse.json({
      success: true,
      message: 'Event tracked successfully',
    });
  } catch (error) {
    console.error('Error tracking analytics event:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

