'use client';

import { LeaderboardEntry } from '@/lib/types';
import { StarIcon as TrophyIcon, ClockIcon } from '@radix-ui/react-icons';
import { useTranslations } from '@/lib/translation-provider';

interface KOLReferralEntry {
  wallet: string;
  referrals: number;
  kolId: string;
  displayName: string;
  tier: string;
  rank?: number;
}

interface ClaimReferralEntry {
  wallet: string;
  totalAmount: number;
  referralCount: number;
  rank?: number;
}

interface BuyerLeaderboardEntry {
  wallet: string;
  totalAmount: number;
  purchaseCount: number;
  rank?: number;
}

interface LeaderboardProps {
  leaderboard: LeaderboardEntry[] | KOLReferralEntry[] | ClaimReferralEntry[] | BuyerLeaderboardEntry[];
  isLoading: boolean;
  type: 'buyer' | 'referral' | 'activation' | 'kol-referral' | 'claim-referral';
  currentAddress?: string;
  title?: string;
  loadingText?: string;
  walletText?: string;
  amountText?: string;
  rankText?: string;
  noDataText?: string;
}

export function Leaderboard({ leaderboard, isLoading, type, currentAddress, title, loadingText, walletText, amountText, rankText, noDataText }: LeaderboardProps) {
  const { t } = useTranslations('leaderboard');
  const formatAddress = (addr: string) => {
    if (!addr) return 'N/A';
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInHours < 168) {
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return `${Math.floor(diffInHours / 168)}w ago`;
    }
  };

  const getTitle = () => {
    if (title) return title;
    switch (type) {
      case 'buyer':
        return t('buyerLeaderboard');
      case 'referral':
        return t('referralLeaderboard');
      case 'activation':
        return t('activationLeaderboard');
      case 'kol-referral':
        return t('kolReferralLeaderboard');
      case 'claim-referral':
        return t('claimReferralLeaderboard');
      default:
        return t('leaderboard');
    }
  };

  const getColumnHeaders = () => {
    switch (type) {
      case 'buyer':
        return (
          <>
            <th className="text-left py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{rankText || t('rank')}</th>
            <th className="text-left py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{walletText || t('wallet')}</th>
            <th className="text-right py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{t('totalPurchased')}</th>
            <th className="text-right py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{t('purchases')}</th>
          </>
        );
      case 'referral':
        return (
          <>
            <th className="text-left py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{rankText || t('rank')}</th>
            <th className="text-left py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{t('address')}</th>
            <th className="text-right py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{t('referralTime')}</th>
            <th className="text-right py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{t('totalEarned')}</th>
          </>
        );
      case 'activation':
        return (
          <>
            <th className="text-left py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{rankText || t('rank')}</th>
            <th className="text-left py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{t('address')}</th>
            <th className="text-right py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{t('totalEarned')}</th>
            <th className="text-right py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{t('redeemed')}</th>
            <th className="text-right py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{t('accrued')}</th>
            <th className="text-right py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{t('activated')}</th>
          </>
        );
      case 'kol-referral':
        return (
          <>
            <th className="text-left py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{rankText || t('rank')}</th>
            <th className="text-left py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{walletText || t('wallet')}</th>
            <th className="text-right py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{t('numberOfReferrals')}</th>
          </>
        );
      case 'claim-referral':
        return (
          <>
            <th className="text-left py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{rankText || t('rank')}</th>
            <th className="text-left py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{walletText || t('wallet')}</th>
            <th className="text-right py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{amountText || t('totalAmount')}</th>
            <th className="text-right py-3 px-2 sm:py-4 sm:px-4 text-slate-300 font-semibold text-xs sm:text-sm">{t('referrals')}</th>
          </>
        );
    }
  };

  const getRowContent = (entry: LeaderboardEntry | KOLReferralEntry | ClaimReferralEntry | BuyerLeaderboardEntry, index: number) => {
    switch (type) {
      case 'kol-referral':
        const kolEntry = entry as KOLReferralEntry;
        return (
          <>
            <td className="py-3 px-2 sm:py-4 sm:px-4">
              <div className="flex items-center">
                {index < 3 && (
                  <div className="mr-2 sm:mr-3">
                    {index === 0 ? (
                      <div className="p-1.5 sm:p-2 bg-yellow-500/20 rounded-full border border-yellow-400/30">
                        <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                      </div>
                    ) : index === 1 ? (
                      <div className="p-1.5 sm:p-2 bg-gray-400/20 rounded-full border border-gray-400/30">
                        <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                      </div>
                    ) : (
                      <div className="p-1.5 sm:p-2 bg-orange-500/20 rounded-full border border-orange-400/30">
                        <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                      </div>
                    )}
                  </div>
                )}
                <span className={`font-semibold text-xs sm:text-sm ${kolEntry.wallet && currentAddress && kolEntry.wallet.toLowerCase() === currentAddress.toLowerCase() ? 'text-primary' : 'text-white'}`}>
                  #{kolEntry.rank || (index + 1)}
                </span>
              </div>
            </td>
            <td className="py-3 px-2 sm:py-4 sm:px-4">
              <span className={`font-mono text-xs sm:text-sm break-all ${kolEntry.wallet && currentAddress && kolEntry.wallet.toLowerCase() === currentAddress.toLowerCase() ? 'text-primary' : 'text-slate-300'}`}>
                {formatAddress(kolEntry.wallet || 'N/A')}
              </span>
            </td>
            <td className="py-3 px-2 sm:py-4 sm:px-4 text-right">
              <span className="text-white font-semibold text-xs sm:text-sm">
                {kolEntry.referrals}
              </span>
            </td>
          </>
        );
      case 'buyer':
        // Check if it's the new format (BuyerLeaderboardEntry) or old format (LeaderboardEntry)
        const hasWallet = 'wallet' in entry;
        const hasTotalAmount = 'totalAmount' in entry;
        const hasPurchaseCount = 'purchaseCount' in entry;
        
        if (hasWallet && hasTotalAmount && hasPurchaseCount) {
          // New format: BuyerLeaderboardEntry
          const buyerEntry = entry as BuyerLeaderboardEntry;
          return (
            <>
              <td className="py-3 px-2 sm:py-4 sm:px-4">
                <div className="flex items-center">
                  {index < 3 && (
                    <div className="mr-2 sm:mr-3">
                      {index === 0 ? (
                        <div className="p-1.5 sm:p-2 bg-yellow-500/20 rounded-full border border-yellow-400/30">
                          <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                        </div>
                      ) : index === 1 ? (
                        <div className="p-1.5 sm:p-2 bg-gray-400/20 rounded-full border border-gray-400/30">
                          <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                        </div>
                      ) : (
                        <div className="p-1.5 sm:p-2 bg-orange-500/20 rounded-full border border-orange-400/30">
                          <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                        </div>
                      )}
                    </div>
                  )}
                  <span className={`font-semibold text-xs sm:text-sm ${buyerEntry.wallet && currentAddress && buyerEntry.wallet.toLowerCase() === currentAddress.toLowerCase() ? 'text-primary' : 'text-white'}`}>
                    #{buyerEntry.rank || (index + 1)}
                  </span>
                </div>
              </td>
              <td className="py-3 px-2 sm:py-4 sm:px-4">
                <span className={`font-mono text-xs sm:text-sm break-all ${buyerEntry.wallet && currentAddress && buyerEntry.wallet.toLowerCase() === currentAddress.toLowerCase() ? 'text-primary' : 'text-slate-300'}`}>
                  {formatAddress(buyerEntry.wallet || 'N/A')}
                </span>
              </td>
              <td className="py-3 px-2 sm:py-4 sm:px-4 text-right">
                <span className="text-white font-semibold text-xs sm:text-sm">
                  {(() => {
                    const amount = buyerEntry.totalAmount || 0;
                    if (amount >= 1) {
                      return `$${amount.toFixed(2)}`;
                    } else if (amount >= 0.01) {
                      return `$${amount.toFixed(4)}`;
                    } else {
                      return `$${amount.toFixed(6)}`;
                    }
                  })()}
                </span>
              </td>
              <td className="py-3 px-2 sm:py-4 sm:px-4 text-right">
                <span className="text-white font-semibold text-xs sm:text-sm">
                  {buyerEntry.purchaseCount || 0}
                </span>
              </td>
            </>
          );
        } else {
          // Old format: LeaderboardEntry (for backward compatibility)
          const buyerEntry = entry as LeaderboardEntry;
          return (
            <>
              <td className="py-3 px-2 sm:py-4 sm:px-4">
                <div className="flex items-center">
                  {index < 3 && (
                    <div className="mr-2 sm:mr-3">
                      {index === 0 ? (
                        <div className="p-1.5 sm:p-2 bg-yellow-500/20 rounded-full border border-yellow-400/30">
                          <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                        </div>
                      ) : index === 1 ? (
                        <div className="p-1.5 sm:p-2 bg-gray-400/20 rounded-full border border-gray-400/30">
                          <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                        </div>
                      ) : (
                        <div className="p-1.5 sm:p-2 bg-orange-500/20 rounded-full border border-orange-400/30">
                          <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                        </div>
                      )}
                    </div>
                  )}
                  <span className={`font-semibold text-xs sm:text-sm ${buyerEntry.address && currentAddress && buyerEntry.address.toLowerCase() === currentAddress.toLowerCase() ? 'text-primary' : 'text-white'}`}>
                    #{buyerEntry.rank}
                  </span>
                </div>
              </td>
              <td className="py-3 px-2 sm:py-4 sm:px-4">
                <span className={`font-mono text-xs sm:text-sm break-all ${buyerEntry.address && currentAddress && buyerEntry.address.toLowerCase() === currentAddress.toLowerCase() ? 'text-primary' : 'text-slate-300'}`}>
                  {formatAddress(buyerEntry.address || 'N/A')}
                </span>
              </td>
              <td className="py-3 px-2 sm:py-4 sm:px-4 text-right">
                <span className="text-white font-semibold text-xs sm:text-sm">
                  {((buyerEntry.redeemedAmount || 0)).toFixed(1)} preGVT
                </span>
              </td>
              <td className="py-3 px-2 sm:py-4 sm:px-4 text-right">
                <span className="text-white font-semibold text-xs sm:text-sm">
                  {(buyerEntry.stakedAmount || 0).toFixed(1)} preGVT
                </span>
              </td>
            </>
          );
        }
      case 'referral':
        const referralEntry = entry as LeaderboardEntry;
        return (
          <>
            <td className="py-3 px-2 sm:py-4 sm:px-4">
              <div className="flex items-center">
                {index < 3 && (
                  <div className="mr-2 sm:mr-3">
                    {index === 0 ? (
                      <div className="p-1.5 sm:p-2 bg-yellow-500/20 rounded-full border border-yellow-400/30">
                        <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                      </div>
                    ) : index === 1 ? (
                      <div className="p-1.5 sm:p-2 bg-gray-400/20 rounded-full border border-gray-400/30">
                        <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                      </div>
                    ) : (
                      <div className="p-1.5 sm:p-2 bg-orange-500/20 rounded-full border border-orange-400/30">
                        <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                      </div>
                    )}
                  </div>
                )}
                <span className={`font-semibold text-xs sm:text-sm ${referralEntry.address && currentAddress && referralEntry.address.toLowerCase() === currentAddress.toLowerCase() ? 'text-primary' : 'text-white'}`}>
                  #{referralEntry.rank}
                </span>
              </div>
            </td>
            <td className="py-3 px-2 sm:py-4 sm:px-4">
              <span className={`font-mono text-xs sm:text-sm break-all ${referralEntry.address && currentAddress && referralEntry.address.toLowerCase() === currentAddress.toLowerCase() ? 'text-primary' : 'text-slate-300'}`}>
                {formatAddress(referralEntry.address || 'N/A')}
              </span>
            </td>
            <td className="py-3 px-2 sm:py-4 sm:px-4 text-right">
              <span className="text-slate-400 text-xs sm:text-sm flex items-center justify-end">
                <ClockIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 shrink-0" />
                {formatTime(referralEntry.claimTime || '')}
              </span>
            </td>
            <td className="py-3 px-2 sm:py-4 sm:px-4 text-right">
              <span className="text-white font-semibold text-xs sm:text-sm">
                {(referralEntry.totalEarned || 0).toFixed(1)} preGVT
              </span>
            </td>
          </>
        );
      case 'activation':
        const activationEntry = entry as LeaderboardEntry;
        return (
          <>
            <td className="py-3 px-2 sm:py-4 sm:px-4">
              <div className="flex items-center">
                {index < 3 && (
                  <div className="mr-2 sm:mr-3">
                    {index === 0 ? (
                      <div className="p-1.5 sm:p-2 bg-yellow-500/20 rounded-full border border-yellow-400/30">
                        <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                      </div>
                    ) : index === 1 ? (
                      <div className="p-1.5 sm:p-2 bg-gray-400/20 rounded-full border border-gray-400/30">
                        <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                      </div>
                    ) : (
                      <div className="p-1.5 sm:p-2 bg-orange-500/20 rounded-full border border-orange-400/30">
                        <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                      </div>
                    )}
                  </div>
                )}
                <span className={`font-semibold text-xs sm:text-sm ${activationEntry.address && currentAddress && activationEntry.address.toLowerCase() === currentAddress.toLowerCase() ? 'text-primary' : 'text-white'}`}>
                  #{activationEntry.rank}
                </span>
              </div>
            </td>
            <td className="py-3 px-2 sm:py-4 sm:px-4">
              <span className={`font-mono text-xs sm:text-sm break-all ${activationEntry.address && currentAddress && activationEntry.address.toLowerCase() === currentAddress.toLowerCase() ? 'text-primary' : 'text-slate-300'}`}>
                {formatAddress(activationEntry.address || 'N/A')}
              </span>
            </td>
            <td className="py-3 px-2 sm:py-4 sm:px-4 text-right">
              <span className="text-white font-semibold text-xs sm:text-sm">
                {(activationEntry.totalEarned || 0).toFixed(1)} preGVT
              </span>
            </td>
            <td className="py-3 px-2 sm:py-4 sm:px-4 text-right">
              <span className="text-white font-semibold text-xs sm:text-sm">
                {(activationEntry.redeemedAmount || 0).toFixed(1)} preGVT
              </span>
            </td>
            <td className="py-3 px-2 sm:py-4 sm:px-4 text-right">
              <span className="text-white font-semibold text-xs sm:text-sm">
                {(activationEntry.accruedAmount || 0).toFixed(1)} preGVT
              </span>
            </td>
            <td className="py-3 px-2 sm:py-4 sm:px-4 text-right">
              <span className="text-slate-400 text-xs sm:text-sm flex items-center justify-end">
                <ClockIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 shrink-0" />
                {formatTime(activationEntry.activationTime || '')}
              </span>
            </td>
          </>
        );
      case 'claim-referral':
        const claimEntry = entry as ClaimReferralEntry;
        return (
          <>
            <td className="py-3 px-2 sm:py-4 sm:px-4">
              <div className="flex items-center">
                {index < 3 && (
                  <div className="mr-2 sm:mr-3">
                    {index === 0 ? (
                      <div className="p-1.5 sm:p-2 bg-yellow-500/20 rounded-full border border-yellow-400/30">
                        <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                      </div>
                    ) : index === 1 ? (
                      <div className="p-1.5 sm:p-2 bg-gray-400/20 rounded-full border border-gray-400/30">
                        <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                      </div>
                    ) : (
                      <div className="p-1.5 sm:p-2 bg-orange-500/20 rounded-full border border-orange-400/30">
                        <TrophyIcon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                      </div>
                    )}
                  </div>
                )}
                <span className={`font-semibold text-xs sm:text-sm ${claimEntry.wallet && currentAddress && claimEntry.wallet.toLowerCase() === currentAddress.toLowerCase() ? 'text-primary' : 'text-white'}`}>
                  #{claimEntry.rank || (index + 1)}
                </span>
              </div>
            </td>
            <td className="py-3 px-2 sm:py-4 sm:px-4">
              <span className={`font-mono text-xs sm:text-sm break-all ${claimEntry.wallet && currentAddress && claimEntry.wallet.toLowerCase() === currentAddress.toLowerCase() ? 'text-primary' : 'text-slate-300'}`}>
                {formatAddress(claimEntry.wallet || 'N/A')}
              </span>
            </td>
            <td className="py-3 px-2 sm:py-4 sm:px-4 text-right">
              <span className="text-white font-semibold text-xs sm:text-sm">
                {(claimEntry.totalAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} preGVT
              </span>
            </td>
            <td className="py-3 px-2 sm:py-4 sm:px-4 text-right">
              <span className="text-white font-semibold text-xs sm:text-sm">
                {claimEntry.referralCount || 0}
              </span>
            </td>
          </>
        );
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center mb-6 sm:mb-8">
        <div className="p-2 sm:p-3 bg-primary/20 rounded-full border border-primary/30 mr-3 sm:mr-4">
          <TrophyIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold text-white">
          {getTitle()}
        </h3>
      </div>

      {isLoading ? (
        <div className="text-center py-8 sm:py-12 space-y-3 sm:space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="text-slate-300 text-base sm:text-lg">{loadingText || t('loading')}</p>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <p className="text-slate-300 text-base sm:text-lg">{noDataText || t('noEntries')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-600/30">
                  {getColumnHeaders()}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, index) => {
                  const entryAddress = type === 'kol-referral' 
                    ? (entry as KOLReferralEntry).wallet 
                    : type === 'claim-referral'
                    ? (entry as ClaimReferralEntry).wallet
                    : type === 'buyer' && 'wallet' in entry
                    ? (entry as BuyerLeaderboardEntry).wallet
                    : (entry as LeaderboardEntry).address;
                  
                  const entryKey = type === 'kol-referral' 
                    ? (entry as KOLReferralEntry).kolId 
                    : type === 'claim-referral'
                    ? (entry as ClaimReferralEntry).wallet
                    : type === 'buyer' && 'wallet' in entry
                    ? (entry as BuyerLeaderboardEntry).wallet
                    : entryAddress || `entry-${index}`;
                  
                  // Safe comparison with null check
                  const isCurrentUser = entryAddress && currentAddress 
                    ? entryAddress.toLowerCase() === currentAddress.toLowerCase() 
                    : false;
                  
                  return (
                    <tr 
                      key={entryKey} 
                      className={`border-b border-slate-600/20 hover:bg-slate-700/30 transition-colors ${
                        isCurrentUser ? 'bg-primary/10' : ''
                      }`}
                    >
                      {getRowContent(entry, index)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
