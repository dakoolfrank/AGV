"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/hooks/useTranslations";

interface MintWithReferralPageProps {
  params: {
    locale: string;
    kolId: string;
  };
}

export default function MintWithReferralPage({ params }: MintWithReferralPageProps) {
  const router = useRouter();
  const { t } = useTranslations();
  
  useEffect(() => {
    // Extract the 6-digit referral ID from the kolId parameter
    const referralId = params.kolId.match(/\d{6}/)?.[0];
    
    if (referralId) {
      // Redirect to the main mint page with the referral ID as a query parameter
      // This will trigger the existing logic in the minting interface to prefill and lock the referral ID
      router.replace(`/${params.locale}/mint?ref=${referralId}`);
    } else {
      // If no valid referral ID, redirect to the main mint page
      router.replace(`/${params.locale}/mint`);
    }
  }, [params.kolId, params.locale, router]);

  // Show loading state while redirecting
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#223256] via-[#223256] to-[#223256] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        <p className="text-white text-lg">{t('minting.loading')}</p>
      </div>
    </div>
  );
}
