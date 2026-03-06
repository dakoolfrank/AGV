import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface VestingSchedule {
  id: string;
  kolId: string;
  walletAddress: string;
  totalAmount: number;
  vestedAmount: number;
  remainingAmount: number;
  startDate: Date | string;
  endDate: Date | string;
  cliffDate: Date | string;
  cliffDays: number;
  duration: number;
  vestingDays: number;
  dailyVestAmount: number;
  lastClaimAt?: Date | string;
  status: 'active' | 'completed' | 'cancelled';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet') || searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Normalize wallet address (lowercase, trim)
    const normalizedAddress = walletAddress.trim().toLowerCase();

    // Validate wallet address format (basic check)
    if (!/^0x[a-fA-F0-9]{40}$/i.test(normalizedAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // TODO: Replace this mock data with actual contract call
    // For now, return mock vesting schedule data
    // In the future, this should query the vesting contract to get real data
    const mockVestingSchedule: VestingSchedule = {
      id: `vesting_${normalizedAddress}`,
      kolId: 'mock_kol_id',
      walletAddress: normalizedAddress,
      totalAmount: 10000, // Total sGVT to be vested
      vestedAmount: 3500, // Already vested amount
      remainingAmount: 6500, // Remaining to vest
      startDate: new Date('2024-01-01'), // Vesting start date
      cliffDate: new Date('2024-04-01'), // Cliff date (3 months from start)
      endDate: new Date('2025-01-01'), // Vesting end date (12 months from start)
      vestingDays: 365, // Total vesting period in days
      cliffDays: 90, // Cliff period in days
      duration: 365, // Total duration in days
      dailyVestAmount: 27.4, // Daily vesting amount (10000 / 365)
      lastClaimAt: new Date('2024-10-15'), // Last claim date
      status: 'active' as const,
    };

    // Calculate current vested amount based on time elapsed
    const now = new Date();
    const start = new Date(mockVestingSchedule.startDate);
    const end = new Date(mockVestingSchedule.endDate);
    const cliff = new Date(mockVestingSchedule.cliffDate);

    // If before cliff, vested amount is 0
    if (now < cliff) {
      mockVestingSchedule.vestedAmount = 0;
      mockVestingSchedule.remainingAmount = mockVestingSchedule.totalAmount;
    } else if (now >= end) {
      // If past end date, everything is vested
      mockVestingSchedule.vestedAmount = mockVestingSchedule.totalAmount;
      mockVestingSchedule.remainingAmount = 0;
      mockVestingSchedule.status = 'completed';
    } else {
      // Calculate vested amount linearly after cliff
      const daysSinceCliff = Math.floor((now.getTime() - cliff.getTime()) / (1000 * 60 * 60 * 24));
      const vestingDaysAfterCliff = Math.floor((end.getTime() - cliff.getTime()) / (1000 * 60 * 60 * 24));
      const vestedPercentage = Math.min(1, daysSinceCliff / vestingDaysAfterCliff);
      
      mockVestingSchedule.vestedAmount = mockVestingSchedule.totalAmount * vestedPercentage;
      mockVestingSchedule.remainingAmount = mockVestingSchedule.totalAmount - mockVestingSchedule.vestedAmount;
    }

    return NextResponse.json(mockVestingSchedule, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

