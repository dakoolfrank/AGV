'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { FileUpload } from '@/components/ui/file-upload';
import { Button } from '@/components/ui/button';
import { ThirdwebWalletButton } from '@/components/wallet/ThirdwebWalletButton';
import { useState } from 'react';

interface WalletInfo {
  address: string;
  chainId: string;
  chainName: string;
  isConnected: boolean;
}

interface ContributorFormStepsProps {
  currentStep: number;
  watchedValues: Record<string, unknown>;
  register: (name: string) => unknown;
  errors: Record<string, unknown>;
  setValue: (name: string, value: unknown) => void;
  handleArrayChange: (field: string, value: string, checked: boolean) => void;
  uploadedFiles: File[];
  setUploadedFiles: (files: File[]) => void;
  calculatedTier: string;
}

export function ContributorFormSteps({
  currentStep,
  watchedValues,
  register,
  errors,
  setValue,
  handleArrayChange,
  uploadedFiles: _uploadedFiles,
  setUploadedFiles,
  calculatedTier,
}: ContributorFormStepsProps) {
  const [connectedWallet, setConnectedWallet] = useState<WalletInfo | null>(null);

  const handleWalletConnected = (walletInfo: WalletInfo) => {
    setConnectedWallet(walletInfo);
    
    // Automatically add the connected wallet to the form
    const currentWallets = watchedValues.wallets || [];
    const newWallet = {
      chain: walletInfo.chainName,
      address: walletInfo.address
    };
    
    // Check if this wallet is already added
    const isAlreadyAdded = currentWallets.some((wallet: { address: string }) => 
      wallet.address.toLowerCase() === walletInfo.address.toLowerCase()
    );
    
    if (!isAlreadyAdded) {
      setValue('wallets', [...currentWallets, newWallet]);
    }
  };

  const handleWalletDisconnected = () => {
    setConnectedWallet(null);
  };

  const addWallet = () => {
    const currentWallets = watchedValues.wallets || [];
    setValue('wallets', [...currentWallets, { chain: '', address: '' }]);
  };

  const removeWallet = (index: number) => {
    const currentWallets = watchedValues.wallets || [];
    setValue('wallets', currentWallets.filter((_: unknown, i: number) => i !== index));
  };

  const addWorkLink = () => {
    const currentLinks = watchedValues.recentWorkLinks || [];
    setValue('recentWorkLinks', [...currentLinks, '']);
  };

  const removeWorkLink = (index: number) => {
    const currentLinks = watchedValues.recentWorkLinks || [];
    setValue('recentWorkLinks', currentLinks.filter((_: unknown, i: number) => i !== index));
  };

  const updateWorkLink = (index: number, value: string) => {
    const currentLinks = [...(watchedValues.recentWorkLinks || [])];
    currentLinks[index] = value;
    setValue('recentWorkLinks', currentLinks);
  };

  // Step 3: Role & Availability (Contributor+)
  if (currentStep === 3) {
    if (calculatedTier === 'airdrop_hunter') {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Role & Availability</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This section is not required for Airdrop Hunter tier. You can skip to the next step.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Role & Availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-3">Roles (Select all that apply)</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'educator', label: 'Educator' },
                { value: 'analyst', label: 'Analyst' },
                { value: 'community_builder', label: 'Community Builder' },
                { value: 'event_host', label: 'Event Host' },
                { value: 'translator', label: 'Translator' },
                { value: 'content_creator', label: 'Content Creator' },
                { value: 'technical_writer', label: 'Technical Writer' },
              ].map((option) => (
                <label key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    checked={watchedValues.roles?.includes(option.value) || false}
                    onChange={(e) => handleArrayChange('roles', option.value, e.target.checked)}
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
            {errors.roles && (
              <p className="text-sm text-destructive mt-1">{errors.roles.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Availability (hours/week)</label>
            <Input
              {...register('availabilityHoursPerWeek', { valueAsNumber: true })}
              type="number"
              min="0"
              max="168"
              placeholder="e.g., 10"
            />
            {errors.availabilityHoursPerWeek && (
              <p className="text-sm text-destructive mt-1">{errors.availabilityHoursPerWeek.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">Regions you can cover</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                'North America', 'South America', 'Europe', 'Asia Pacific',
                'Middle East', 'Africa', 'Oceania', 'Global'
              ].map((region) => (
                <label key={region} className="flex items-center space-x-2">
                  <Checkbox
                    checked={watchedValues.regionsCanCover?.includes(region) || false}
                    onChange={(e) => handleArrayChange('regionsCanCover', region, e.target.checked)}
                  />
                  <span className="text-sm">{region}</span>
                </label>
              ))}
            </div>
            {errors.regionsCanCover && (
              <p className="text-sm text-destructive mt-1">{errors.regionsCanCover.message}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 4: Performance KPIs (Contributor+)
  if (currentStep === 4) {
    if (calculatedTier === 'airdrop_hunter') {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Performance KPIs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This section is not required for Airdrop Hunter tier. You can skip to the next step.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance KPIs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-3">Your KPI Targets (Set numeric targets)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Impressions</label>
                <Input
                  {...register('kpiTargets.impressions', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  placeholder="e.g., 10000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Clicks</label>
                <Input
                  {...register('kpiTargets.clicks', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  placeholder="e.g., 500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Mints/Stakes</label>
                <Input
                  {...register('kpiTargets.mintsStakes', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  placeholder="e.g., 50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Retention %</label>
                <Input
                  {...register('kpiTargets.retentionPercent', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g., 75"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Education Completions</label>
                <Input
                  {...register('kpiTargets.educationCompletions', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  placeholder="e.g., 25"
                />
              </div>
            </div>
          </div>

          {calculatedTier === 'micro_kol' && (
            <div>
              <label className="block text-sm font-medium mb-2">Consistency Window (days)</label>
              <Input
                {...register('consistencyWindow', { valueAsNumber: true })}
                type="number"
                min="0"
                placeholder="e.g., 90"
              />
              <p className="text-xs text-muted-foreground mt-1">
                How many days should we track for consistent performance?
              </p>
            </div>
          )}

          {calculatedTier === 'fund_partner' && (
            <div>
              <label className="block text-sm font-medium mb-2">Strategic KPI</label>
              <Textarea
                {...register('strategicKpi')}
                placeholder="Describe your strategic KPI targets (e.g., enterprise intros, partner events)..."
                className="min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Describe strategic value metrics beyond standard KPIs
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Step 5: Rewards & Compensation
  if (currentStep === 5) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rewards & Compensation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Compensation Model *</label>
            <RadioGroup orientation="horizontal">
              <RadioItem
                {...register('compensationModel')}
                value="fixed"
                label="Fixed"
                checked={watchedValues.compensationModel === 'fixed'}
                onChange={() => setValue('compensationModel', 'fixed')}
              />
              <RadioItem
                {...register('compensationModel')}
                value="performance"
                label="Performance"
                checked={watchedValues.compensationModel === 'performance'}
                onChange={() => setValue('compensationModel', 'performance')}
              />
              <RadioItem
                {...register('compensationModel')}
                value="hybrid"
                label="Hybrid"
                checked={watchedValues.compensationModel === 'hybrid'}
                onChange={() => setValue('compensationModel', 'hybrid')}
              />
            </RadioGroup>
            {errors.compensationModel && (
              <p className="text-sm text-destructive mt-1">{errors.compensationModel.message}</p>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Payment Rails</h3>
            
            <div>
              <label className="block text-sm font-medium mb-2">USDT Payment</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Chain</label>
                  <Select
                    {...register('paymentRails.usdt.chain')}
                  >
                    <option value="">Select chain</option>
                    <option value="ethereum">Ethereum</option>
                    <option value="bsc">BSC</option>
                    <option value="polygon">Polygon</option>
                    <option value="arbitrum">Arbitrum</option>
                    <option value="optimism">Optimism</option>
                    <option value="avalanche">Avalanche</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Wallet Address</label>
                  <Input
                    {...register('paymentRails.usdt.address')}
                    placeholder="0x..."
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Fiat Payment (Optional)</label>
              <Textarea
                {...register('paymentRails.fiat.bankDetails')}
                placeholder="Enter bank details for fiat payments..."
                className="min-h-[80px]"
              />
            </div>
          </div>

          <div className="p-4 border rounded-lg bg-muted/50">
            <h3 className="text-lg font-semibold mb-2">Tier Benefits</h3>
            <div className="text-sm space-y-1">
              {calculatedTier === 'airdrop_hunter' && (
                <p>• Basic community access, airdrop notifications</p>
              )}
              {calculatedTier === 'contributor' && (
                <p>• Commissions, training, content support</p>
              )}
              {calculatedTier === 'micro_kol' && (
                <p>• Higher commissions, token incentives, partnership opportunities</p>
              )}
              {calculatedTier === 'fund_partner' && (
                <p>• Maximum rewards, potential equity participation, strategic input</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 6: Portfolio & Track Record (Contributor+)
  if (currentStep === 6) {
    if (calculatedTier === 'airdrop_hunter') {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Portfolio & Track Record</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This section is optional for Airdrop Hunter tier. You can skip to the next step.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio & Track Record</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium">Links to Recent Sponsored/Co-branded Work</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addWorkLink}
              >
                Add Link
              </Button>
            </div>
            {watchedValues.recentWorkLinks?.map((link: string, index: number) => (
              <div key={index} className="flex items-center space-x-2 mb-2">
                <Input
                  value={link}
                  onChange={(e) => updateWorkLink(index, e.target.value)}
                  placeholder="https://..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeWorkLink(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
            {(!watchedValues.recentWorkLinks || watchedValues.recentWorkLinks.length === 0) && (
              <p className="text-sm text-muted-foreground">No work links added yet.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Outcomes Summary</label>
            <Textarea
              {...register('outcomesSummary')}
              placeholder="Describe the outcomes and results of your previous work..."
              className="min-h-[100px]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Conflicts/Exclusivity</label>
            <Textarea
              {...register('conflictsExclusivity')}
              placeholder="Describe any potential conflicts of interest or exclusivity arrangements..."
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 7: Wallets & Verification
  if (currentStep === 7) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Wallets & Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* WalletConnect Integration */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Connect Your Wallet</h3>
            
            
            <ThirdwebWalletButton
              onWalletConnected={handleWalletConnected}
              onWalletDisconnected={handleWalletDisconnected}
              connectedWallet={connectedWallet}
            />
          </div>

          {/* Manual Wallet Entry */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium">Or Add Wallet Manually</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addWallet}
              >
                Add Wallet
              </Button>
            </div>
            {watchedValues.wallets?.map((wallet: { chain: string; address: string }, index: number) => (
              <div key={index} className="flex items-center space-x-2 mb-2">
                <Input
                  placeholder="Chain (e.g., Ethereum, BSC)"
                  value={wallet.chain}
                  onChange={(e) => {
                    const newWallets = [...(watchedValues.wallets || [])];
                    newWallets[index] = { ...newWallets[index], chain: e.target.value };
                    setValue('wallets', newWallets);
                  }}
                  className="flex-2"
                />
                <Input
                  placeholder="Wallet Address"
                  value={wallet.address}
                  onChange={(e) => {
                    const newWallets = [...(watchedValues.wallets || [])];
                    newWallets[index] = { ...newWallets[index], address: e.target.value };
                    setValue('wallets', newWallets);
                  }}
                  className="flex-3"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeWallet(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
            {(!watchedValues.wallets || watchedValues.wallets.length === 0) && (
              <p className="text-sm text-muted-foreground">No wallets added yet.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">KYC Upload (Optional)</label>
            <FileUpload
              onFilesChange={setUploadedFiles}
              maxFiles={1}
              acceptedTypes=".pdf,.png,.jpg,.jpeg"
              maxSize={10}
            />
          </div>

          {calculatedTier !== 'airdrop_hunter' && (
            <div>
              <label className="flex items-center space-x-2">
                <Checkbox
                  checked={watchedValues.consentToPublicDashboards || false}
                  onChange={(e) => setValue('consentToPublicDashboards', e.target.checked)}
                />
                <span className="text-sm font-medium">
                  Consent to on-chain/public metric dashboards *
                </span>
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Required for Contributor+ tiers to enable transparent reporting
              </p>
              {errors.consentToPublicDashboards && (
                <p className="text-sm text-destructive mt-1">{errors.consentToPublicDashboards.message}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Step 8: Community & Compliance
  if (currentStep === 8) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Community & Compliance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-2">
                <Checkbox
                  checked={watchedValues.agreeToKolGuidelines || false}
                  onChange={(e) => setValue('agreeToKolGuidelines', e.target.checked)}
                />
                <span className="text-sm font-medium">
                  Agree to KOL Guidelines *
                </span>
              </label>
              {errors.agreeToKolGuidelines && (
                <p className="text-sm text-destructive mt-1">{errors.agreeToKolGuidelines.message}</p>
              )}
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <Checkbox
                  checked={watchedValues.agreeToCommunityRules || false}
                  onChange={(e) => setValue('agreeToCommunityRules', e.target.checked)}
                />
                <span className="text-sm font-medium">
                  Agree to Community Rules *
                </span>
              </label>
              {errors.agreeToCommunityRules && (
                <p className="text-sm text-destructive mt-1">{errors.agreeToCommunityRules.message}</p>
              )}
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <Checkbox
                  checked={watchedValues.antiFraudAcknowledgement || false}
                  onChange={(e) => setValue('antiFraudAcknowledgement', e.target.checked)}
                />
                <span className="text-sm font-medium">
                  Anti-fraud acknowledgement *
                </span>
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                I acknowledge that referral rewards are performance-based and regional restrictions apply.
              </p>
              {errors.antiFraudAcknowledgement && (
                <p className="text-sm text-destructive mt-1">{errors.antiFraudAcknowledgement.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <h3 className="text-lg font-semibold">Referrals</h3>
            
            <div>
              <label className="flex items-center space-x-2">
                <Checkbox
                  checked={watchedValues.referredByG3Partner || false}
                  onChange={(e) => setValue('referredByG3Partner', e.target.checked)}
                />
                <span className="text-sm font-medium">
                  Referred by G3 partner/KOL?
                </span>
              </label>
            </div>

            {watchedValues.referredByG3Partner && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">KOL Referral Code (Optional)</label>
                  <Input
                    {...register('kolReferralCode')}
                    placeholder="Enter KOL referral code if you have one"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    If you were referred by a KOL, enter their referral code to join their team
                  </p>
                </div>
              </div>
            )}

            <div className="p-3 bg-primary/10 rounded-lg">
              <h4 className="font-medium mb-2">Invite-to-Earn Program</h4>
              <p className="text-sm text-muted-foreground">
                2-tier commission structure with lifetime sharing and network effects. 
                Referrers earn rewards based on their referred contributors&apos; performance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
