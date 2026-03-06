'use client';

// This dynamic route allows /buy/[kolId] to work
// The buy page component will extract the referral ID from the pathname
// We just re-export the buy page component since it already handles pathname extraction
import BuyPage from '../page';

export default BuyPage;

