'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { PageLayout } from '@/components/layouts/PageLayout';
import { WalletConnect } from '@/components/WalletConnect';
import { PageCard } from '@/components/ui/PageCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { useTranslations } from '@/lib/translation-provider';
import { 
  BUY_CONTRACT_ADDRESS, 
  buy_ABI, 
  OLD_BUY_CONTRACT_ADDRESS,
  old_buy_ABI,
  MIGRATION_CONTRACT_ADDRESS,
  MIGRATION_CONTRACT_ABI
} from '@/lib/contracts';
import { getContract, readContract, prepareContractCall, sendTransaction, defineChain } from 'thirdweb';
import { createThirdwebClient } from 'thirdweb';
import { toast } from 'sonner';
import { 
  CheckCircledIcon, 
  ExclamationTriangleIcon,
  ArrowRightIcon,
} from '@radix-ui/react-icons';

// Constants
const BSC_CHAIN = defineChain({
  id: 56,
  name: "Binance Smart Chain",
  nativeCurrency: {
    name: "BNB",
    symbol: "BNB",
    decimals: 18,
  },
  rpc: "https://bsc-dataseed.binance.org/",
  blockExplorers: [
    {
      name: "BSCScan",
      url: "https://bscscan.com",
    },
  ],
});

const TOKEN_DECIMALS = 18;

const RPC_ENDPOINTS = [
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.defibit.io/",
  "https://bsc-dataseed1.ninicoin.io/",
  "https://bsc-dataseed2.defibit.io/"
];

export default function MigrationPage() {
  const { t } = useTranslations('migration');
  const account = useActiveAccount();
  const address = account?.address;
  
  // Balance state
  const [preGVTBalance, setPreGVTBalance] = useState<bigint | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  
  // Migration state
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [migrationSuccess, setMigrationSuccess] = useState(false);
  
  // Migration ticket state
  const [oldPreGVTBalance, setOldPreGVTBalance] = useState<bigint | null>(null);
  const [isLoadingOldBalance, setIsLoadingOldBalance] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  // Create thirdweb client (memoized)
  const client = useMemo(
    () => createThirdwebClient({
      clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "your-client-id"
    }),
    []
  );

  // Load preGVT balance from contract (current/new contract)
  const loadPreGVTBalance = useCallback(async () => {
    if (!address || !BUY_CONTRACT_ADDRESS) {
      setPreGVTBalance(null);
      return;
    }

    setIsLoadingBalance(true);
    try {
      let contract = null;
      let workingRpc = null;
      
      for (const rpc of RPC_ENDPOINTS) {
        try {
          const testChain = defineChain({
            ...BSC_CHAIN,
            rpc: rpc,
          });
          
          contract = getContract({
            client,
            address: BUY_CONTRACT_ADDRESS,
            chain: testChain,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            abi: buy_ABI as any,
          });
          
          // Test this RPC with a simple call
          await readContract({
            contract,
            method: "presaleActive",
            params: [],
          });
          
          workingRpc = rpc;
          break;
        } catch {
          continue;
        }
      }
      
      if (!contract || !workingRpc) {
        setPreGVTBalance(null);
        return;
      }

      const balance = await readContract({
        contract,
        method: "balanceOf",
        params: [address],
      });

      setPreGVTBalance(balance as bigint);
    } catch (err) {
      console.error('Error loading preGVT balance:', err);
      setPreGVTBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [address, client]);

  // Load old preGVT balance from old contract
  const loadOldPreGVTBalance = useCallback(async () => {
    if (!address || !OLD_BUY_CONTRACT_ADDRESS) {
      setOldPreGVTBalance(null);
      return;
    }

    setIsLoadingOldBalance(true);
    
    try {
      let contract = null;
      let workingRpc = null;
      
      for (const rpc of RPC_ENDPOINTS) {
        try {
          const testChain = defineChain({
            ...BSC_CHAIN,
            rpc: rpc,
          });
          
          contract = getContract({
            client,
            address: OLD_BUY_CONTRACT_ADDRESS,
            chain: testChain,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            abi: old_buy_ABI as any,
          });
          
          // Test this RPC with a simple call
          await readContract({
            contract,
            method: "balanceOf",
            params: [address],
          });
          
          workingRpc = rpc;
          break;
        } catch {
          continue;
        }
      }
      
      if (!contract || !workingRpc) {
        setOldPreGVTBalance(null);
        return;
      }

      const balance = await readContract({
        contract,
        method: "balanceOf",
        params: [address],
      });

      setOldPreGVTBalance(balance as bigint);
    } catch (err) {
      console.error('Error loading old preGVT balance:', err);
      setOldPreGVTBalance(null);
    } finally {
      setIsLoadingOldBalance(false);
    }
  }, [address, client]);

  // Migrate function - mocks the contract call for now
  const handleMigrate = useCallback(async () => {
    if (!address || !preGVTBalance || preGVTBalance === BigInt(0)) {
      toast.error('No preGVT tokens found to migrate');
      return;
    }

    setIsMigrating(true);
    setMigrationError(null);
    setMigrationSuccess(false);

    try {
      // TODO: Replace with actual contract call when migration contract is deployed
      // For now, we'll mock the migration
      
      // Mock migration - simulate contract call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In the real implementation, this would be:
      // const contract = getContract({
      //   client,
      //   address: MIGRATION_CONTRACT_ADDRESS,
      //   chain: BSC_CHAIN,
      //   abi: MIGRATION_CONTRACT_ABI as any,
      // });
      // 
      // const transaction = prepareContractCall({
      //   contract,
      //   method: "migrate",
      //   params: [address, preGVTBalance],
      // });
      //
      // await sendTransaction({
      //   transaction,
      //   account: account,
      // });

      setMigrationSuccess(true);
      toast.success('Migration successful!', {
        description: 'Your preGVT tokens have been migrated to vpreGVT.',
      });
      
      // Reload balances after migration
      await loadPreGVTBalance();
      await loadOldPreGVTBalance();
    } catch (err) {
      console.error('Error migrating tokens:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to migrate tokens';
      setMigrationError(errorMessage);
      toast.error('Migration failed', {
        description: errorMessage,
      });
    } finally {
      setIsMigrating(false);
    }
  }, [address, preGVTBalance, client, account, loadPreGVTBalance, loadOldPreGVTBalance]);

  // Create migration ticket
  const createMigrationTicket = useCallback(async () => {
    if (!address || !oldPreGVTBalance || oldPreGVTBalance === BigInt(0)) {
      toast.error('No old tokens found to migrate');
      return;
    }

    setIsCreatingTicket(true);
    setTicketError(null);

    try {
      const oldBalanceFormatted = Number(oldPreGVTBalance) / 10 ** TOKEN_DECIMALS;

      const response = await fetch('/api/migration-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: address,
          oldBalance: oldBalanceFormatted,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create migration ticket');
      }

      setTicketId(data.ticketId);
      toast.success('Migration ticket created successfully!', {
        description: `Ticket ID: ${data.ticketId}`,
      });
    } catch (err) {
      console.error('Error creating migration ticket:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create migration ticket';
      setTicketError(errorMessage);
      toast.error('Failed to create migration ticket', {
        description: errorMessage,
      });
    } finally {
      setIsCreatingTicket(false);
    }
  }, [address, oldPreGVTBalance]);

  // Load data when address changes
  useEffect(() => {
    if (address) {
      loadPreGVTBalance();
      loadOldPreGVTBalance();
    }
  }, [address, loadPreGVTBalance, loadOldPreGVTBalance]);

  // Calculate derived values
  const formattedBalance = useMemo(() => {
    if (preGVTBalance === null) return '0';
    return (Number(preGVTBalance) / 10 ** TOKEN_DECIMALS).toFixed(4);
  }, [preGVTBalance]);

  const hasPreGVTBalance = preGVTBalance !== null && preGVTBalance > BigInt(0);

  return (
    <PageLayout showStickyDisclaimer showDisclaimerBanner>
      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16">
        <div className="max-w-6xl mx-auto">
          <PageHeader 
            title={t('title')}
            description={t('subtitle')}
          />

          {/* Intro Copy Section */}
          <PageCard className="mb-6 sm:mb-8" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
            <div className="text-center space-y-4">
              <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
                {t('introCopy')}
              </p>
            </div>
          </PageCard>

          {/* Wallet Connection Section */}
          <PageCard className="mb-6 sm:mb-8" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }}>
            <div className="text-center mb-4 sm:mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 sm:mb-3">
                Wallet Connection
              </h2>
              <p className="text-slate-300 text-base sm:text-lg px-4">
                {t('connectWallet')}
              </p>
            </div>
            <WalletConnect />
          </PageCard>

          {/* Migration Section */}
          {address && (
            <>
              {/* PreGVT Balance Display */}
              <PageCard style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }} className="mb-6 sm:mb-8">
                <div className="flex items-center mb-4 sm:mb-6">
                  <div className="p-2 sm:p-3 bg-primary/20 rounded-full border border-primary/30 mr-3 sm:mr-4">
                    <ArrowRightIcon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white">{t('preGVTBalance')}</h3>
                </div>
                
                {isLoadingBalance ? (
                  <div className="text-center space-y-3 sm:space-y-4 py-6">
                    <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-primary border-t-transparent mx-auto"></div>
                    <p className="text-slate-300 text-sm sm:text-base">{t('loadingBalance')}</p>
                  </div>
                ) : (
                  <div className="text-center mb-6 sm:mb-8">
                    <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-green-400 mb-2 sm:mb-3">
                      {formattedBalance} preGVT
                    </div>
                    {preGVTBalance !== null && (
                      <p className="text-blue-400 text-xs sm:text-sm mt-2">
                        {t('balanceFromContract')}
                      </p>
                    )}
                  </div>
                )}

                {/* Migrate Button */}
                {!isLoadingBalance && hasPreGVTBalance && (
                  <div className="space-y-4">
                    {migrationError && (
                      <div className="p-4 bg-red-500/20 rounded-xl border border-red-500/30">
                        <p className="text-red-400 text-sm">{migrationError}</p>
                      </div>
                    )}

                    {migrationSuccess && (
                      <div className="p-4 bg-green-500/20 rounded-xl border border-green-500/30">
                        <div className="flex items-center">
                          <CheckCircledIcon className="w-5 h-5 text-green-400 mr-2" />
                          <p className="text-green-400 font-semibold">{t('migrationSuccess')}</p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleMigrate}
                      disabled={isMigrating || !hasPreGVTBalance}
                      className="w-full px-6 sm:px-10 py-3 sm:py-4 bg-gradient-to-r from-primary to-primary/80 text-white rounded-xl text-base sm:text-lg font-semibold hover:from-primary/80 hover:to-primary transition-all duration-300 shadow-lg hover:shadow-primary/25 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {isMigrating ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent inline-block mr-2"></div>
                          {t('migrating')}
                        </>
                      ) : (
                        <>
                          <ArrowRightIcon className="w-4 h-4 sm:w-5 sm:h-5 inline mr-2" />
                          {t('migrateButton')}
                        </>
                      )}
                    </button>
                  </div>
                )}

                {!isLoadingBalance && !hasPreGVTBalance && (
                  <div className="text-center space-y-4 py-4 bg-slate-700/50 rounded-xl border border-slate-600/30">
                    <p className="text-slate-300 text-sm sm:text-base">
                      {t('noPreGVTTokens')}
                    </p>
                  </div>
                )}
              </PageCard>

              {/* Migration Support Ticket Section */}
              {OLD_BUY_CONTRACT_ADDRESS && address && 
                (isLoadingOldBalance || (oldPreGVTBalance !== null && oldPreGVTBalance > BigInt(0)) || ticketId) && (
                <PageCard 
                  style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderColor: 'rgba(71, 85, 105, 0.3)' }} 
                  className="mb-6 sm:mb-8"
                >
                  <div className="flex items-center mb-4 sm:mb-6">
                    <div className="p-2 sm:p-3 bg-orange-500/20 rounded-full border border-orange-500/30 mr-3 sm:mr-4">
                      <ExclamationTriangleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white">{t('supportTicket.title')}</h3>
                  </div>
                  
                  <div className="space-y-4 sm:space-y-6">
                    {/* Instructions */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                      <p className="text-slate-300 text-sm sm:text-base mb-2">
                        <strong className="text-white">{t('supportTicket.processTitle')}</strong>
                      </p>
                      <ol className="text-slate-300 text-xs sm:text-sm space-y-1 list-decimal list-inside">
                        <li>{t('supportTicket.step1')}</li>
                        <li>{t('supportTicket.step2')}</li>
                        <li>{t('supportTicket.step3')}</li>
                        <li>{t('supportTicket.step4')}</li>
                      </ol>
                    </div>

                    {/* Loading State */}
                    {isLoadingOldBalance && (
                      <div className="text-center space-y-3 sm:space-y-4 py-6">
                        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-4 border-orange-500 border-t-transparent mx-auto"></div>
                        <p className="text-slate-300 text-sm sm:text-base">{t('supportTicket.checkingBalance')}</p>
                      </div>
                    )}

                    {/* Old Balance Display */}
                    {!isLoadingOldBalance && oldPreGVTBalance !== null && (
                      <div className="p-4 bg-slate-700/50 rounded-xl border border-slate-600/30">
                        <p className="text-slate-400 text-sm mb-2">{t('supportTicket.oldPreGVTBalance')}</p>
                        <p className="text-white text-2xl font-bold">
                          {(Number(oldPreGVTBalance) / 10 ** TOKEN_DECIMALS).toFixed(4)} preGVT
                        </p>
                      </div>
                    )}

                    {/* Ticket Form */}
                    {!isLoadingOldBalance && oldPreGVTBalance !== null && oldPreGVTBalance > BigInt(0) && !ticketId && (
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-700/50 rounded-xl border border-slate-600/30 space-y-3">
                          <div>
                            <p className="text-slate-400 text-sm mb-1">{t('supportTicket.walletAddress')}</p>
                            <p className="text-white font-mono text-sm break-all">{address}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 text-sm mb-1">{t('supportTicket.oldPreGVTBalance')}</p>
                            <p className="text-white font-semibold">
                              {(Number(oldPreGVTBalance) / 10 ** TOKEN_DECIMALS).toFixed(4)} preGVT
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400 text-sm mb-1">{t('supportTicket.ticketId')}</p>
                            <p className="text-slate-300 text-sm italic">{t('supportTicket.ticketIdPlaceholder')}</p>
                          </div>
                        </div>

                        {ticketError && (
                          <div className="p-4 bg-red-500/20 rounded-xl border border-red-500/30">
                            <p className="text-red-400 text-sm">{ticketError}</p>
                          </div>
                        )}

                        <button
                          onClick={createMigrationTicket}
                          disabled={isCreatingTicket || oldPreGVTBalance === BigInt(0)}
                          className="w-full px-6 sm:px-10 py-3 sm:py-4 bg-orange-500 text-white rounded-xl text-base sm:text-lg font-semibold hover:bg-orange-600 transition-all duration-300 shadow-lg hover:shadow-orange-500/25 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                          {isCreatingTicket ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent inline-block mr-2"></div>
                              {t('supportTicket.creatingTicket')}
                            </>
                          ) : (
                            t('supportTicket.createTicket')
                          )}
                        </button>
                      </div>
                    )}

                    {/* Ticket Created Success */}
                    {ticketId && (
                      <div className="space-y-4">
                        <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/30">
                          <div className="flex items-center mb-2">
                            <CheckCircledIcon className="w-5 h-5 text-green-400 mr-2" />
                            <p className="text-green-400 font-semibold">{t('supportTicket.ticketCreated')}</p>
                          </div>
                          <div className="space-y-2 mt-3">
                            <div>
                              <p className="text-slate-400 text-sm mb-1">{t('supportTicket.ticketId')}</p>
                              <p className="text-white font-mono font-semibold">{ticketId}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-sm mb-1">{t('supportTicket.walletAddress')}</p>
                              <p className="text-white font-mono text-sm break-all">{address}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 text-sm mb-1">{t('supportTicket.oldPreGVTBalance')}</p>
                              <p className="text-white font-semibold">
                                {(Number(oldPreGVTBalance || BigInt(0)) / 10 ** TOKEN_DECIMALS).toFixed(4)} preGVT
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                          <p className="text-yellow-400 text-sm font-semibold mb-2">{t('supportTicket.nextSteps')}</p>
                          <ol className="text-slate-300 text-xs sm:text-sm space-y-1 list-decimal list-inside mb-4">
                            <li>{t('supportTicket.nextStep1')} <code className="bg-slate-800 px-2 py-1 rounded text-white">{t('supportTicket.migrationRequest', { ticketId, address: address || '' })}</code></li>
                            <li>{t('supportTicket.nextStep2')}</li>
                            <li>{t('supportTicket.nextStep3')}</li>
                          </ol>
                          
                          <a
                            href={`https://discord.gg/mJKTyqWtKe`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full px-6 py-3 bg-indigo-500 text-white rounded-xl text-center font-semibold hover:bg-indigo-600 transition-all duration-300 mt-4"
                          >
                            {t('supportTicket.postInSupport')}
                          </a>
                        </div>
                      </div>
                    )}

                    {/* No Old Tokens */}
                    {!isLoadingOldBalance && oldPreGVTBalance !== null && oldPreGVTBalance === BigInt(0) && (
                      <div className="text-center space-y-4 py-4 bg-slate-700/50 rounded-xl border border-slate-600/30">
                        <p className="text-slate-300 text-sm sm:text-base">
                          {t('supportTicket.noOldTokensFound')}
                        </p>
                      </div>
                    )}
                  </div>
                </PageCard>
              )}
            </>
          )}
        </div>
      </main>
    </PageLayout>
  );
}
