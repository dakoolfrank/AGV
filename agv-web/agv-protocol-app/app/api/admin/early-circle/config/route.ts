import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '../../_auth';
import { Timestamp } from 'firebase-admin/firestore';
import { EarlyCircleConfig } from '@/lib/early-circle-utils';

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configDoc = await adminDb.collection('early_circle_config').doc('current').get();
    
    if (!configDoc.exists) {
      // Return default config if none exists
      return NextResponse.json({
        success: true,
        config: {
          isActive: false,
          startTimestamp: null,
          endTimestamp: null,
          updatedAt: Timestamp.now(),
          updatedBy: null,
        },
      });
    }

    const config = configDoc.data() as EarlyCircleConfig;
    
    return NextResponse.json({
      success: true,
      config: {
        ...config,
        startTimestamp: config.startTimestamp?.toDate?.()?.toISOString() || null,
        endTimestamp: config.endTimestamp?.toDate?.()?.toISOString() || null,
        updatedAt: config.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching Early Circle config:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await requireAdmin(request);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { isActive, startTimestamp, endTimestamp } = body;

    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isActive must be a boolean' },
        { status: 400 }
      );
    }

    // Validate timestamps if provided
    if (startTimestamp && endTimestamp) {
      const start = new Date(startTimestamp);
      const end = new Date(endTimestamp);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid timestamp format' },
          { status: 400 }
        );
      }

      if (start >= end) {
        return NextResponse.json(
          { success: false, error: 'Start timestamp must be before end timestamp' },
          { status: 400 }
        );
      }
    }

    const now = Timestamp.now();
    const config: EarlyCircleConfig = {
      isActive,
      startTimestamp: startTimestamp ? Timestamp.fromDate(new Date(startTimestamp)) : null,
      endTimestamp: endTimestamp ? Timestamp.fromDate(new Date(endTimestamp)) : null,
      updatedAt: now,
      updatedBy: decoded.email || null,
    };

    await adminDb.collection('early_circle_config').doc('current').set(config);

    return NextResponse.json({
      success: true,
      message: 'Early Circle configuration updated successfully',
      config: {
        ...config,
        startTimestamp: config.startTimestamp?.toDate?.()?.toISOString() || null,
        endTimestamp: config.endTimestamp?.toDate?.()?.toISOString() || null,
        updatedAt: config.updatedAt?.toDate?.()?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating Early Circle config:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  return POST(request); // Same logic for PATCH
}

