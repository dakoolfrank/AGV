'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { FileUpload } from '@/components/ui/file-upload';
import { InstitutionalFormData } from '@/app/institutional-application/page';
import { useTranslations } from '@/app/[locale]/TranslationProvider';

interface FormStepsProps {
  currentStep: number;
  watchedValues: any;
  register: any;
  errors: any;
  setValue: any;
  handleArrayChange: (field: keyof InstitutionalFormData, value: string, checked: boolean) => void;
  uploadedFiles: File[];
  setUploadedFiles: (files: File[]) => void;
}

export function InstitutionalFormSteps({
  currentStep,
  watchedValues,
  register,
  errors,
  setValue,
  handleArrayChange,
  uploadedFiles,
  setUploadedFiles,
}: FormStepsProps) {
  const t = useTranslations();
  const addWalletAddress = () => {
    const currentAddresses = watchedValues.walletAddresses || [];
    setValue('walletAddresses', [...currentAddresses, { chain: '', address: '' }]);
  };

  const removeWalletAddress = (index: number) => {
    const currentAddresses = watchedValues.walletAddresses || [];
    setValue('walletAddresses', currentAddresses.filter((_: any, i: number) => i !== index));
  };

  // Step 3: Contacts
  if (currentStep === 3) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('institutional.steps.contacts.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('institutional.form.primaryContactName')} *</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('institutional.form.primaryContactName')} *</label>
                <Input
                  {...register('primaryContactName')}
                  placeholder={t('institutional.form.primaryContactName')}
                />
                {errors.primaryContactName && (
                  <p className="text-sm text-destructive mt-1">{errors.primaryContactName.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('institutional.form.primaryContactTitle')} *</label>
                <Input
                  {...register('primaryContactTitle')}
                  placeholder={t('institutional.form.primaryContactTitle')}
                />
                {errors.primaryContactTitle && (
                  <p className="text-sm text-destructive mt-1">{errors.primaryContactTitle.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('institutional.form.primaryContactEmail')} *</label>
                <Input
                  {...register('primaryContactEmail')}
                  type="email"
                  placeholder={t('institutional.form.primaryContactEmail')}
                />
                {errors.primaryContactEmail && (
                  <p className="text-sm text-destructive mt-1">{errors.primaryContactEmail.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('institutional.form.primaryContactPhone')}</label>
                <Input
                  {...register('primaryContactPhone')}
                  type="tel"
                  placeholder={t('institutional.form.primaryContactPhone')}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Compliance Contact (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <Input
                  {...register('complianceContactName')}
                  placeholder="Enter compliance contact name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <Input
                  {...register('complianceContactEmail')}
                  type="email"
                  placeholder="compliance@company.com"
                />
                {errors.complianceContactEmail && (
                  <p className="text-sm text-destructive mt-1">{errors.complianceContactEmail.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Brand/PR Contact (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <Input
                  {...register('brandPrContactName')}
                  placeholder="Enter brand/PR contact name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <Input
                  {...register('brandPrContactEmail')}
                  type="email"
                  placeholder="pr@company.com"
                />
                {errors.brandPrContactEmail && (
                  <p className="text-sm text-destructive mt-1">{errors.brandPrContactEmail.message}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 4: Partnership Mode
  if (currentStep === 4) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Partnership Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Advocacy Partner */}
          {watchedValues.primaryIntent?.includes('advocacy_partner') && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="text-lg font-semibold">Advocacy Partner Details</h3>
              <div>
                <label className="block text-sm font-medium mb-3">Advocacy Scope</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'co_branded_education', label: 'Co-branded Education' },
                    { value: 'policy_roundtables', label: 'Policy Roundtables' },
                    { value: 'thought_leadership', label: 'Thought Leadership' },
                    { value: 'events', label: 'Events' },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        checked={watchedValues.advocacyScope?.includes(option.value) || false}
                        onChange={(e) => handleArrayChange('advocacyScope', option.value, e.target.checked)}
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-3">Regions of Advocacy</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'apac', label: 'APAC' },
                    { value: 'eu', label: 'EU' },
                    { value: 'mena', label: 'MENA' },
                    { value: 'africa', label: 'Africa' },
                    { value: 'americas', label: 'Americas' },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        checked={watchedValues.regionsOfAdvocacy?.includes(option.value) || false}
                        onChange={(e) => handleArrayChange('regionsOfAdvocacy', option.value, e.target.checked)}
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Expected Start Date</label>
                  <Input
                    {...register('advocacyStartDate')}
                    type="date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Expected End Date</label>
                  <Input
                    {...register('advocacyEndDate')}
                    type="date"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Financial Support */}
          {watchedValues.primaryIntent?.includes('financial_support') && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="text-lg font-semibold">Financial Support Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Instrument</label>
                  <RadioGroup orientation="horizontal">
                    <RadioItem
                      {...register('financialInstrument')}
                      value="grant"
                      label="Grant"
                    />
                    <RadioItem
                      {...register('financialInstrument')}
                      value="sponsorship"
                      label="Sponsorship"
                    />
                  </RadioGroup>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Currency</label>
                  <RadioGroup orientation="horizontal">
                    <RadioItem
                      {...register('financialCurrency')}
                      value="USD"
                      label="USD"
                    />
                    <RadioItem
                      {...register('financialCurrency')}
                      value="USDT"
                      label="USDT"
                    />
                  </RadioGroup>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Amount</label>
                <Input
                  {...register('financialAmount', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter amount"
                />
                {errors.financialAmount && (
                  <p className="text-sm text-destructive mt-1">{errors.financialAmount.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Disbursement Schedule</label>
                <Textarea
                  {...register('disbursementSchedule')}
                  placeholder="Describe the disbursement schedule and milestones..."
                  className="min-h-[80px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Accounting Requirements</label>
                <Textarea
                  {...register('accountingRequirements')}
                  placeholder="Any specific accounting or reporting requirements..."
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}

          {/* Token Contribution */}
          {watchedValues.primaryIntent?.includes('token_contribution') && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="text-lg font-semibold">Token Contribution Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Token Name</label>
                  <Input
                    {...register('tokenName')}
                    placeholder="Enter token name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Chain</label>
                  <Input
                    {...register('tokenChain')}
                    placeholder="e.g., Ethereum, BSC, Polygon"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Contract Address</label>
                <Input
                  {...register('tokenContractAddress')}
                  placeholder="0x..."
                />
                {errors.tokenContractAddress && (
                  <p className="text-sm text-destructive mt-1">{errors.tokenContractAddress.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Allocation Amount</label>
                <Input
                  {...register('tokenAllocationAmount', { valueAsNumber: true })}
                  type="number"
                  min="0"
                  placeholder="Enter allocation amount"
                />
                {errors.tokenAllocationAmount && (
                  <p className="text-sm text-destructive mt-1">{errors.tokenAllocationAmount.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Transfer Mechanics</label>
                <RadioGroup orientation="horizontal">
                  <RadioItem
                    {...register('transferMechanics')}
                    value="immediate_transfer"
                    label="Immediate Transfer"
                  />
                  <RadioItem
                    {...register('transferMechanics')}
                    value="vesting_contract"
                    label="Vesting Contract"
                  />
                  <RadioItem
                    {...register('transferMechanics')}
                    value="timelock"
                    label="Timelock"
                  />
                  <RadioItem
                    {...register('transferMechanics')}
                    value="custodial_escrow"
                    label="Custodial Escrow"
                  />
                </RadioGroup>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Cliff Months</label>
                  <Input
                    {...register('cliffMonths', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Vesting Months</label>
                  <Input
                    {...register('vestingMonths', { valueAsNumber: true })}
                    type="number"
                    min="0"
                    placeholder="12"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Vesting Type</label>
                  <RadioGroup orientation="vertical">
                    <RadioItem
                      {...register('vestingType')}
                      value="linear"
                      label="Linear"
                    />
                    <RadioItem
                      {...register('vestingType')}
                      value="step"
                      label="Step"
                    />
                  </RadioGroup>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-3">Permitted Uses</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'kol_bounties', label: 'KOL Bounties' },
                    { value: 'education_grants', label: 'Education Grants' },
                    { value: 'community_incentives', label: 'Community Incentives' },
                    { value: 'data_research_rewards', label: 'Data/Research Rewards' },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        checked={watchedValues.permittedUses?.includes(option.value) || false}
                        onChange={(e) => handleArrayChange('permittedUses', option.value, e.target.checked)}
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-3">Reporting Needed Back</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'wallet_proofs', label: 'Wallet Proofs' },
                    { value: 'distribution_dashboards', label: 'Distribution Dashboards' },
                    { value: 'periodic_summaries', label: 'Periodic Summaries' },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        checked={watchedValues.reportingNeeded?.includes(option.value) || false}
                        onChange={(e) => handleArrayChange('reportingNeeded', option.value, e.target.checked)}
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Strategic Partner */}
          {watchedValues.primaryIntent?.includes('strategic_partner') && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="text-lg font-semibold">Strategic Partner Details</h3>
              <div>
                <label className="block text-sm font-medium mb-2">Co-branding Expectations</label>
                <Textarea
                  {...register('coBrandingExpectations')}
                  placeholder="Describe your co-branding expectations and requirements..."
                  className="min-h-[100px]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-3">Priority Data Access Needs</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'user_growth_metrics', label: 'User Growth Metrics' },
                    { value: 'wallet_staking_kpis', label: 'Wallet/Staking KPIs' },
                    { value: 'campaign_analytics', label: 'Campaign Analytics' },
                    { value: 'geographic_breakdowns', label: 'Geographic Breakdowns' },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        checked={watchedValues.priorityDataAccess?.includes(option.value) || false}
                        onChange={(e) => handleArrayChange('priorityDataAccess', option.value, e.target.checked)}
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-3">Network Access Sought</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'asset_partners', label: 'Asset Partners' },
                    { value: 'exchanges', label: 'Exchanges' },
                    { value: 'funds', label: 'Funds' },
                    { value: 'kol_cohorts', label: 'KOL Cohorts' },
                    { value: 'education_channels', label: 'Education Channels' },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        checked={watchedValues.networkAccessSought?.includes(option.value) || false}
                        onChange={(e) => handleArrayChange('networkAccessSought', option.value, e.target.checked)}
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Confidentiality Level</label>
                <RadioGroup orientation="horizontal">
                  <RadioItem
                    {...register('confidentialityLevel')}
                    value="public"
                    label="Public"
                  />
                  <RadioItem
                    {...register('confidentialityLevel')}
                    value="partners_only"
                    label="Partners Only"
                  />
                  <RadioItem
                    {...register('confidentialityLevel')}
                    value="nda_required"
                    label="NDA Required"
                  />
                </RadioGroup>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Step 5: Geography & Audience
  if (currentStep === 5) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Geography & Audience</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-3">Target Regions *</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                'North America', 'South America', 'Europe', 'Asia Pacific',
                'Middle East', 'Africa', 'Oceania', 'Global'
              ].map((region) => (
                <label key={region} className="flex items-center space-x-2">
                  <Checkbox
                    checked={watchedValues.targetRegions?.includes(region) || false}
                    onChange={(e) => handleArrayChange('targetRegions', region, e.target.checked)}
                  />
                  <span className="text-sm">{region}</span>
                </label>
              ))}
            </div>
            {errors.targetRegions && (
              <p className="text-sm text-destructive mt-1">{errors.targetRegions.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">Language Preferences *</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                'English', 'Chinese (Simplified)', 'Chinese (Traditional)', 'Spanish',
                'French', 'German', 'Japanese', 'Korean', 'Portuguese', 'Russian',
                'Arabic', 'Hindi', 'Other'
              ].map((language) => (
                <label key={language} className="flex items-center space-x-2">
                  <Checkbox
                    checked={watchedValues.languagePreferences?.includes(language) || false}
                    onChange={(e) => handleArrayChange('languagePreferences', language, e.target.checked)}
                  />
                  <span className="text-sm">{language}</span>
                </label>
              ))}
            </div>
            {errors.languagePreferences && (
              <p className="text-sm text-destructive mt-1">{errors.languagePreferences.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">Audience Segments *</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'retail', label: 'Retail' },
                { value: 'prosumer_kols', label: 'Prosumer/KOLs' },
                { value: 'developers', label: 'Developers' },
                { value: 'institutions', label: 'Institutions' },
                { value: 'policy_education', label: 'Policy/Education' },
              ].map((option) => (
                <label key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    checked={watchedValues.audienceSegments?.includes(option.value) || false}
                    onChange={(e) => handleArrayChange('audienceSegments', option.value, e.target.checked)}
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
            {errors.audienceSegments && (
              <p className="text-sm text-destructive mt-1">{errors.audienceSegments.message}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 6: Wallets & Payment Rails
  if (currentStep === 6) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('institutional.steps.wallets.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">{t('institutional.form.settlementPreference')} *</label>
            <RadioGroup orientation="horizontal">
              <RadioItem
                {...register('settlementPreference')}
                value="bank"
                label={t('institutional.form.bank')}
              />
              <RadioItem
                {...register('settlementPreference')}
                value="crypto"
                label={t('institutional.form.crypto')}
              />
            </RadioGroup>
            {errors.settlementPreference && (
              <p className="text-sm text-destructive mt-1">{errors.settlementPreference.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium">{t('institutional.form.walletAddresses')}</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addWalletAddress}
              >
                {t('institutional.form.addWallet')}
              </Button>
            </div>
            {watchedValues.walletAddresses?.map((wallet: any, index: number) => (
              <div key={index} className="flex items-center space-x-2 mb-2">
                <Input
                  placeholder={t('institutional.form.chainPlaceholder')}
                  value={wallet.chain}
                  onChange={(e) => {
                    const newAddresses = [...(watchedValues.walletAddresses || [])];
                    newAddresses[index] = { ...newAddresses[index], chain: e.target.value };
                    setValue('walletAddresses', newAddresses);
                  }}
                  className="flex-2"
                />
                <Input
                  placeholder={t('institutional.form.addressPlaceholder')}
                  value={wallet.address}
                  onChange={(e) => {
                    const newAddresses = [...(watchedValues.walletAddresses || [])];
                    newAddresses[index] = { ...newAddresses[index], address: e.target.value };
                    setValue('walletAddresses', newAddresses);
                  }}
                  className="flex-3"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeWalletAddress(index)}
                >
                  {t('institutional.form.removeWallet')}
                </Button>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Compliance Constraints on Wallets</label>
            <Textarea
              {...register('complianceConstraints')}
              placeholder="Describe any compliance constraints or requirements for wallet usage..."
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 7: Data, Reporting & Compliance
  if (currentStep === 7) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data, Reporting & Compliance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="flex items-center space-x-2">
              <Checkbox
                checked={watchedValues.consentToOnChainVerification || false}
                onChange={(e) => setValue('consentToOnChainVerification', e.target.checked)}
              />
              <span className="text-sm font-medium">
                Consent to on-chain verification & public dashboards *
              </span>
            </label>
            {errors.consentToOnChainVerification && (
              <p className="text-sm text-destructive mt-1">{errors.consentToOnChainVerification.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Preferred Reporting Cadence *</label>
            <RadioGroup orientation="horizontal">
              <RadioItem
                {...register('preferredReportingCadence')}
                value="monthly"
                label="Monthly"
              />
              <RadioItem
                {...register('preferredReportingCadence')}
                value="quarterly"
                label="Quarterly"
              />
            </RadioGroup>
            {errors.preferredReportingCadence && (
              <p className="text-sm text-destructive mt-1">{errors.preferredReportingCadence.message}</p>
            )}
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <Checkbox
                checked={watchedValues.dataSharingAgreementNeeded || false}
                onChange={(e) => setValue('dataSharingAgreementNeeded', e.target.checked)}
              />
              <span className="text-sm font-medium">
                Data sharing agreement needed?
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Security & Privacy Requirements</label>
            <Textarea
              {...register('securityPrivacyRequirements')}
              placeholder="Describe any specific security and privacy requirements..."
              className="min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 8: Brand Usage & Approvals
  if (currentStep === 8) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Brand Usage & Approvals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Logo Files</label>
            <FileUpload
              onFilesChange={setUploadedFiles}
              maxFiles={3}
              acceptedTypes=".png,.jpg,.jpeg,.svg"
              maxSize={10}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Brand Guidelines</label>
            <Input
              {...register('brandGuidelines')}
              placeholder="URL to brand guidelines or upload file"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Approval Flow for Public Mentions</label>
            <Textarea
              {...register('approvalFlowForMentions')}
              placeholder="Describe your approval process for public mentions and marketing materials..."
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <h3 className="text-lg font-semibold">Risk Acknowledgement & Legal</h3>
            
            <div>
              <label className="flex items-center space-x-2">
                <Checkbox
                  checked={watchedValues.riskDisclosureAcknowledged || false}
                  onChange={(e) => setValue('riskDisclosureAcknowledged', e.target.checked)}
                />
                <span className="text-sm font-medium">
                  Risk disclosure acknowledgement *
                </span>
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                I acknowledge that there are no guaranteed returns and this is a community initiative.
              </p>
              {errors.riskDisclosureAcknowledged && (
                <p className="text-sm text-destructive mt-1">{errors.riskDisclosureAcknowledged.message}</p>
              )}
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <Checkbox
                  checked={watchedValues.termsPrivacyConsent || false}
                  onChange={(e) => setValue('termsPrivacyConsent', e.target.checked)}
                />
                <span className="text-sm font-medium">
                  Terms/Privacy consent *
                </span>
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                I agree to the Terms of Service and Privacy Policy.
              </p>
              {errors.termsPrivacyConsent && (
                <p className="text-sm text-destructive mt-1">{errors.termsPrivacyConsent.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Conflicts of Interest Disclosure</label>
              <Textarea
                {...register('conflictsOfInterest')}
                placeholder="Please disclose any potential conflicts of interest..."
                className="min-h-[80px]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Additional Attachments</label>
              <FileUpload
                onFilesChange={setUploadedFiles}
                maxFiles={10}
                acceptedTypes=".pdf,.png,.jpg,.jpeg"
                maxSize={20}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Upload: Certificate of Incorporation, Licences, Sanctions/PEP screening letter, 
                Token economics memo, MOU/LOI (all optional)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
