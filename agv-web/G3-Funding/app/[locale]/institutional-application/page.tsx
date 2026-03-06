'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FileUpload } from '@/components/ui/file-upload';
import { createInstitutionalApplication } from '@/lib/firebase-service';
import { InstitutionalApplication } from '@/lib/types';
import { InstitutionalFormSteps } from '@/components/forms/institutional-form-steps';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { useTranslations } from '../TranslationProvider';

// Validation schema
const institutionalSchema = z.object({
  // Purpose & Fit
  primaryIntent: z.array(z.enum(['advocacy_partner', 'financial_support', 'token_contribution', 'strategic_partner'])).min(1, 'Please select at least one primary intent'),
  whatYouWantToGain: z.array(z.enum(['user_growth', 'resource_access', 'education_narrative', 'brand_reputation', 'long_term_leverage'])).min(1, 'Please select at least one goal'),
  howOrgSupportsRWA: z.string().min(10, 'Please provide a detailed answer (minimum 10 characters)'),
  rwaVerticals: z.array(z.enum(['energy', 'agriculture', 'real_estate', 'carbon_esg', 'supply_chain', 'other'])).min(1, 'Please select at least one RWA vertical'),
  otherVertical: z.string().optional(),
  
  // Organization Profile
  legalEntityName: z.string().min(1, 'Legal entity name is required'),
  jurisdiction: z.string().min(1, 'Jurisdiction is required'),
  registrationNumber: z.string().min(1, 'Registration number is required'),
  registeredAddress: z.string().min(1, 'Registered address is required'),
  website: z.string().url().optional().or(z.literal('')),
  organizationType: z.enum(['exchange', 'fund', 'asset_owner_originator', 'technology_provider', 'ngo_alliance', 'corporate', 'other']),
  otherOrganizationType: z.string().optional(),
  regulatoryPermissions: z.string().optional(),
  briefHistory: z.string().optional(),
  
  // Contacts
  primaryContactName: z.string().min(1, 'Primary contact name is required'),
  primaryContactTitle: z.string().min(1, 'Primary contact title is required'),
  primaryContactEmail: z.string().email('Valid email is required'),
  primaryContactPhone: z.string().optional(),
  complianceContactName: z.string().optional(),
  complianceContactEmail: z.string().email().optional().or(z.literal('')),
  brandPrContactName: z.string().optional(),
  brandPrContactEmail: z.string().email().optional().or(z.literal('')),
  
  // Partnership Mode - Advocacy Partner
  advocacyScope: z.array(z.enum(['co_branded_education', 'policy_roundtables', 'thought_leadership', 'events'])).optional(),
  regionsOfAdvocacy: z.array(z.enum(['apac', 'eu', 'mena', 'africa', 'americas'])).optional(),
  advocacyStartDate: z.string().optional(),
  advocacyEndDate: z.string().optional(),
  
  // Partnership Mode - Financial Support
  financialInstrument: z.enum(['grant', 'sponsorship']).optional(),
  financialCurrency: z.enum(['USD', 'USDT']).optional(),
  financialAmount: z.number().positive().optional(),
  disbursementSchedule: z.string().optional(),
  accountingRequirements: z.string().optional(),
  
  // Partnership Mode - Token Contribution
  tokenName: z.string().optional(),
  tokenChain: z.string().optional(),
  tokenContractAddress: z.string().optional(),
  tokenAllocationAmount: z.number().positive().optional(),
  transferMechanics: z.enum(['immediate_transfer', 'vesting_contract', 'timelock', 'custodial_escrow']).optional(),
  cliffMonths: z.number().min(0).optional(),
  vestingMonths: z.number().min(0).optional(),
  vestingType: z.enum(['linear', 'step']).optional(),
  permittedUses: z.array(z.enum(['kol_bounties', 'education_grants', 'community_incentives', 'data_research_rewards'])).optional(),
  reportingNeeded: z.array(z.enum(['wallet_proofs', 'distribution_dashboards', 'periodic_summaries'])).optional(),
  
  // Partnership Mode - Strategic Partner
  coBrandingExpectations: z.string().optional(),
  priorityDataAccess: z.array(z.enum(['user_growth_metrics', 'wallet_staking_kpis', 'campaign_analytics', 'geographic_breakdowns'])).optional(),
  networkAccessSought: z.array(z.enum(['asset_partners', 'exchanges', 'funds', 'kol_cohorts', 'education_channels'])).optional(),
  confidentialityLevel: z.enum(['public', 'partners_only', 'nda_required']).optional(),
  
  // Geography & Audience
  targetRegions: z.array(z.string()).min(1, 'Please select at least one target region'),
  languagePreferences: z.array(z.string()).min(1, 'Please select at least one language'),
  audienceSegments: z.array(z.enum(['retail', 'prosumer_kols', 'developers', 'institutions', 'policy_education'])).min(1, 'Please select at least one audience segment'),
  
  // Wallets & Payment Rails
  settlementPreference: z.enum(['bank', 'crypto']),
  walletAddresses: z.array(z.object({
    chain: z.string(),
    address: z.string()
  })).optional(),
  complianceConstraints: z.string().optional(),
  
  // Data, Reporting & Compliance
  consentToOnChainVerification: z.boolean().refine(val => val === true, 'You must consent to on-chain verification'),
  preferredReportingCadence: z.enum(['monthly', 'quarterly']),
  dataSharingAgreementNeeded: z.boolean(),
  securityPrivacyRequirements: z.string().optional(),
  
  // Brand Usage & Approvals
  approvalFlowForMentions: z.string().optional(),
  
  // Risk Acknowledgement & Legal
  riskDisclosureAcknowledged: z.boolean().refine(val => val === true, 'You must acknowledge the risk disclosure'),
  termsPrivacyConsent: z.boolean().refine(val => val === true, 'You must consent to terms and privacy policy'),
  conflictsOfInterest: z.string().optional(),
});

type InstitutionalFormData = z.infer<typeof institutionalSchema>;

export default function InstitutionalApplicationPage() {
  const t = useTranslations();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<InstitutionalFormData>({
    resolver: zodResolver(institutionalSchema),
    defaultValues: {
      primaryIntent: [],
      whatYouWantToGain: [],
      rwaVerticals: [],
      targetRegions: [],
      languagePreferences: [],
      audienceSegments: [],
      walletAddresses: [],
      advocacyScope: [],
      consentToOnChainVerification: false,
      dataSharingAgreementNeeded: false,
      riskDisclosureAcknowledged: false,
      termsPrivacyConsent: false,
    },
  });
  console.log("submitting errors", errors);
  const watchedValues = watch();
  // const selectedPrimaryIntent = watch('primaryIntent');

  // Step validation functions
  const validateStep = (step: number): boolean => {
    const values = watchedValues;
    
    switch (step) {
      case 1: // Purpose & Fit
        return Boolean(
          values.primaryIntent && values.primaryIntent.length > 0 &&
          values.whatYouWantToGain && values.whatYouWantToGain.length > 0 &&
          values.howOrgSupportsRWA && values.howOrgSupportsRWA.trim().length >= 10 &&
          values.rwaVerticals && values.rwaVerticals.length > 0
        );
      
      case 2: // Organization Profile
        return Boolean(
          values.legalEntityName && values.legalEntityName.trim().length > 0 &&
          values.jurisdiction && values.jurisdiction.trim().length > 0 &&
          values.registrationNumber && values.registrationNumber.trim().length > 0 &&
          values.registeredAddress && values.registeredAddress.trim().length > 0 &&
          values.organizationType
        );
      
      case 3: // Contacts
        return (
          values.primaryContactName && values.primaryContactName.trim().length > 0 &&
          values.primaryContactTitle && values.primaryContactTitle.trim().length > 0 &&
          values.primaryContactEmail && values.primaryContactEmail.trim().length > 0
        );
      
      case 4: // Partnership Mode
        return true; // Partnership mode fields are conditional based on primaryIntent, so we allow proceeding
      
      case 5: // Geography & Audience
        return (
          values.targetRegions && values.targetRegions.length > 0 &&
          values.languagePreferences && values.languagePreferences.length > 0 &&
          values.audienceSegments && values.audienceSegments.length > 0
        );
      
      case 6: // Wallets & Payment
        return (
          values.settlementPreference
        );
      
      case 7: // Data & Reporting
        return (
          values.consentToOnChainVerification === true &&
          values.preferredReportingCadence
        );
      
      case 8: // Brand & Legal
        return (
          values.riskDisclosureAcknowledged === true &&
          values.termsPrivacyConsent === true
        );
      
      default:
        return true;
    }
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(Math.min(steps.length, currentStep + 1));
    } else {
      // Get step name for better error message
      const stepName = steps[currentStep - 1]?.title || `Step ${currentStep}`;
      toast.error(t('institutional.form.stepValidationError').replace('{stepName}', stepName));
    }
  };

  const handlePreviousStep = () => {
    setCurrentStep(Math.max(1, currentStep - 1));
  };

  const onSubmit = async (data: InstitutionalFormData) => {
    // Check if all steps are valid before submitting
    const allStepsValid = steps.every((_, index) => validateStep(index + 1));
    
    if (!allStepsValid) {
      toast.error(t('institutional.form.allStepsValidationError'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Transform form data to match our type structure
      const applicationData: Omit<InstitutionalApplication, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
        purposeAndFit: {
          primaryIntent: data.primaryIntent,
          whatYouWantToGain: data.whatYouWantToGain,
          howOrgSupportsRWA: data.howOrgSupportsRWA,
          rwaVerticals: data.rwaVerticals,
          otherVertical: data.otherVertical,
        },
        organizationProfile: {
          legalEntityName: data.legalEntityName,
          jurisdiction: data.jurisdiction,
          registrationNumber: data.registrationNumber,
          registeredAddress: data.registeredAddress,
          website: data.website,
          organizationType: data.organizationType,
          otherOrganizationType: data.otherOrganizationType,
          regulatoryPermissions: data.regulatoryPermissions,
          briefHistory: data.briefHistory,
        },
        contacts: {
          primary: {
            name: data.primaryContactName,
            title: data.primaryContactTitle,
            email: data.primaryContactEmail,
            phone: data.primaryContactPhone,
          },
          compliance: data.complianceContactName || data.complianceContactEmail ? {
            name: data.complianceContactName,
            email: data.complianceContactEmail,
          } : undefined,
          brandPr: data.brandPrContactName || data.brandPrContactEmail ? {
            name: data.brandPrContactName,
            email: data.brandPrContactEmail,
          } : undefined,
        },
        partnershipMode: {
          ...(data.primaryIntent.includes('advocacy_partner') && {
            advocacyPartner: {
              advocacyScope: data.advocacyScope || [],
              regionsOfAdvocacy: data.regionsOfAdvocacy || [],
              expectedTimeline: {
                startDate: data.advocacyStartDate || '',
                endDate: data.advocacyEndDate || '',
              },
            },
          }),
          ...(data.primaryIntent.includes('financial_support') && {
            financialSupport: {
              instrument: data.financialInstrument || 'grant',
              currency: data.financialCurrency || 'USD',
              amount: data.financialAmount || 0,
              disbursementSchedule: data.disbursementSchedule || '',
              accountingRequirements: data.accountingRequirements,
            },
          }),
          ...(data.primaryIntent.includes('token_contribution') && {
            tokenContribution: {
              tokenName: data.tokenName || '',
              chain: data.tokenChain || '',
              contractAddress: data.tokenContractAddress || '',
              allocationAmount: data.tokenAllocationAmount || 0,
              transferMechanics: data.transferMechanics || 'immediate_transfer',
              vestingTerms: {
                cliffMonths: data.cliffMonths || 0,
                vestingMonths: data.vestingMonths || 0,
                type: data.vestingType || 'linear',
              },
              permittedUses: data.permittedUses || [],
              reportingNeeded: data.reportingNeeded || [],
            },
          }),
          ...(data.primaryIntent.includes('strategic_partner') && {
            strategicPartner: {
              coBrandingExpectations: data.coBrandingExpectations || '',
              priorityDataAccess: data.priorityDataAccess || [],
              networkAccessSought: data.networkAccessSought || [],
              confidentialityLevel: data.confidentialityLevel || 'public',
            },
          }),
        },
        geographyAndAudience: {
          targetRegions: data.targetRegions,
          languagePreferences: data.languagePreferences,
          audienceSegments: data.audienceSegments,
        },
        walletsAndPayment: {
          settlementPreference: data.settlementPreference,
          walletAddresses: data.walletAddresses || [],
          complianceConstraints: data.complianceConstraints,
        },
        dataReporting: {
          consentToOnChainVerification: data.consentToOnChainVerification,
          preferredReportingCadence: data.preferredReportingCadence,
          dataSharingAgreementNeeded: data.dataSharingAgreementNeeded,
          securityPrivacyRequirements: data.securityPrivacyRequirements,
        },
        brandUsage: {
          approvalFlowForMentions: data.approvalFlowForMentions,
        },
        riskAcknowledgement: {
          riskDisclosureAcknowledged: data.riskDisclosureAcknowledged,
          termsPrivacyConsent: data.termsPrivacyConsent,
          conflictsOfInterest: data.conflictsOfInterest,
        },
        attachments: {
          // File URLs would be populated after upload
        },
      };

      await createInstitutionalApplication(applicationData, uploadedFiles);
      toast.success('Application submitted successfully!');
      // Reset form or redirect
    } catch (error) {
      console.error('Error submitting application:', error);
      toast.error('Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArrayChange = (field: string, value: string, checked: boolean) => {
    const currentArray = (watchedValues as unknown as Record<string, string[]>)[field] || [];
    if (checked) {
      setValue(field as keyof InstitutionalFormData, [...currentArray, value] as InstitutionalFormData[keyof InstitutionalFormData]);
    } else {
      setValue(field, currentArray.filter(item => item !== value) as any);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if current step is valid
    if (!validateStep(currentStep)) {
      const stepName = steps[currentStep - 1]?.title || `Step ${currentStep}`;
      toast.error(t('institutional.form.stepValidationError').replace('{stepName}', stepName));
      return;
    }

    // If not on the last step, go to next step
    if (currentStep < steps.length) {
      handleNextStep();
      return;
    }

    // If on the last step, submit the form
    const formData = getValues();
    await onSubmit(formData);
  };

  // Check if any step has validation errors
  const hasValidationErrors = () => {
    return steps.some((_, index) => !validateStep(index + 1));
  };

  const addWalletAddress = () => {
    const currentAddresses = watchedValues.walletAddresses || [];
    setValue('walletAddresses', [...currentAddresses, { chain: '', address: '' }]);
  };

  const removeWalletAddress = (index: number) => {
    const currentAddresses = watchedValues.walletAddresses || [];
    setValue('walletAddresses', currentAddresses.filter((_, i) => i !== index));
  };

  const steps = [
    { number: 1, title: t('institutional.steps.purpose.title'), description: t('institutional.steps.purpose.description') },
    { number: 2, title: t('institutional.steps.organization.title'), description: t('institutional.steps.organization.description') },
    { number: 3, title: t('institutional.steps.contacts.title'), description: t('institutional.steps.contacts.description') },
    { number: 4, title: t('institutional.steps.partnership.title'), description: t('institutional.steps.partnership.description') },
    { number: 5, title: t('institutional.steps.geography.title'), description: t('institutional.steps.geography.description') },
    { number: 6, title: t('institutional.steps.wallets.title'), description: t('institutional.steps.wallets.description') },
    { number: 7, title: t('institutional.steps.data.title'), description: t('institutional.steps.data.description') },
    { number: 8, title: t('institutional.steps.brand.title'), description: t('institutional.steps.brand.description') },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 max-w-4xl py-4 sm:py-8">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 sm:mb-4">
            {t('institutional.title')}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            {t('institutional.subtitle')}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          {/* Mobile Stepper */}
          <div className="block md:hidden">
            <div className="flex items-center justify-center space-x-2 mb-4">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm ${
                    currentStep >= step.number 
                      ? 'bg-primary border-primary text-primary-foreground' 
                      : 'border-muted-foreground text-muted-foreground'
                  }`}>
                    {step.number}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-4 h-0.5 mx-1 ${
                      currentStep > step.number ? 'bg-primary' : 'bg-muted-foreground'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold">{steps[currentStep - 1].title}</h2>
              <p className="text-sm text-muted-foreground">{steps[currentStep - 1].description}</p>
              <p className="text-xs text-muted-foreground mt-1">Step {currentStep} of {steps.length}</p>
            </div>
          </div>

          {/* Desktop Stepper */}
          <div className="hidden md:block">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    currentStep >= step.number 
                      ? 'bg-primary border-primary text-primary-foreground' 
                      : 'border-muted-foreground text-muted-foreground'
                  }`}>
                    {step.number}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-16 h-0.5 mx-2 ${
                      currentStep > step.number ? 'bg-primary' : 'bg-muted-foreground'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 text-center">
              <h2 className="text-xl font-semibold">{steps[currentStep - 1].title}</h2>
              <p className="text-muted-foreground">{steps[currentStep - 1].description}</p>
            </div>
          </div>

          {/* Validation Warning */}
          {!validateStep(currentStep) && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 text-center">
                {t('institutional.form.validationWarning')}
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-8">
          {/* Step 1: Purpose & Fit */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('institutional.steps.purpose.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-3">{t('institutional.form.primaryIntent')}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'advocacy_partner', label: t('institutional.form.options.advocacyPartner') },
                      { value: 'financial_support', label: t('institutional.form.options.financialSupport') },
                      { value: 'token_contribution', label: t('institutional.form.options.tokenContribution') },
                      { value: 'strategic_partner', label: t('institutional.form.options.strategicPartner') },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          checked={watchedValues.primaryIntent?.includes(option.value as any)}
                          onChange={(e) => handleArrayChange('primaryIntent', option.value, e.target.checked)}
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.primaryIntent && (
                    <p className="text-sm text-destructive mt-1">{errors.primaryIntent.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">{t('institutional.form.whatYouWantToGain')}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'user_growth', label: t('institutional.form.options.userGrowth') },
                      { value: 'resource_access', label: t('institutional.form.options.resourceAccess') },
                      { value: 'education_narrative', label: t('institutional.form.options.educationNarrative') },
                      { value: 'brand_reputation', label: t('institutional.form.options.brandReputation') },
                      { value: 'long_term_leverage', label: t('institutional.form.options.longTermLeverage') },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          checked={watchedValues.whatYouWantToGain?.includes(option.value as any)}
                          onChange={(e) => handleArrayChange('whatYouWantToGain', option.value, e.target.checked)}
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.whatYouWantToGain && (
                    <p className="text-sm text-destructive mt-1">{errors.whatYouWantToGain.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('institutional.form.howOrgSupportsRWA')}
                  </label>
                  <Textarea
                    {...register('howOrgSupportsRWA')}
                    placeholder={t('institutional.form.howOrgSupportsRWAPlaceholder')}
                    className="min-h-[100px]"
                  />
                  {errors.howOrgSupportsRWA && (
                    <p className="text-sm text-destructive mt-1">{errors.howOrgSupportsRWA.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">{t('institutional.form.rwaVerticals')}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'energy', label: t('institutional.form.options.energy') },
                      { value: 'agriculture', label: t('institutional.form.options.agriculture') },
                      { value: 'real_estate', label: t('institutional.form.options.realEstate') },
                      { value: 'carbon_esg', label: t('institutional.form.options.carbonEsg') },
                      { value: 'supply_chain', label: t('institutional.form.options.supplyChain') },
                      { value: 'other', label: t('institutional.form.options.other') },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          checked={watchedValues.rwaVerticals?.includes(option.value as any)}
                          onChange={(e) => handleArrayChange('rwaVerticals', option.value, e.target.checked)}
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.rwaVerticals && (
                    <p className="text-sm text-destructive mt-1">{errors.rwaVerticals.message}</p>
                  )}
                </div>

                {watchedValues.rwaVerticals?.includes('other') && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('institutional.form.otherVertical')}</label>
                    <Input
                      {...register('otherVertical')}
                      placeholder={t('institutional.form.otherVerticalPlaceholder')}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Organization Profile */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('institutional.steps.organization.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('institutional.form.legalEntityName')} *</label>
                    <Input
                      {...register('legalEntityName')}
                      placeholder={t('institutional.form.legalEntityName')}
                    />
                    {errors.legalEntityName && (
                      <p className="text-sm text-destructive mt-1">{errors.legalEntityName.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('institutional.form.jurisdiction')} *</label>
                    <Input
                      {...register('jurisdiction')}
                      placeholder={t('institutional.form.jurisdictionPlaceholder')}
                    />
                    {errors.jurisdiction && (
                      <p className="text-sm text-destructive mt-1">{errors.jurisdiction.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('institutional.form.registrationNumber')} *</label>
                    <Input
                      {...register('registrationNumber')}
                      placeholder={t('institutional.form.registrationNumber')}
                    />
                    {errors.registrationNumber && (
                      <p className="text-sm text-destructive mt-1">{errors.registrationNumber.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('institutional.form.website')}</label>
                    <Input
                      {...register('website')}
                      placeholder={t('institutional.form.websitePlaceholder')}
                      type="url"
                    />
                    {errors.website && (
                      <p className="text-sm text-destructive mt-1">{errors.website.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('institutional.form.registeredAddress')} *</label>
                  <Textarea
                    {...register('registeredAddress')}
                    placeholder={t('institutional.form.registeredAddress')}
                    className="min-h-[80px]"
                  />
                  {errors.registeredAddress && (
                    <p className="text-sm text-destructive mt-1">{errors.registeredAddress.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('institutional.form.organizationType')} *</label>
                  <Select {...register('organizationType')}>
                    <option value="">Select organization type</option>
                    <option value="exchange">{t('institutional.form.options.exchange')}</option>
                    <option value="fund">{t('institutional.form.options.fund')}</option>
                    <option value="asset_owner_originator">{t('institutional.form.options.assetOwnerOriginator')}</option>
                    <option value="technology_provider">{t('institutional.form.options.technologyProvider')}</option>
                    <option value="ngo_alliance">{t('institutional.form.options.ngoAlliance')}</option>
                    <option value="corporate">{t('institutional.form.options.corporate')}</option>
                    <option value="other">{t('institutional.form.options.other')}</option>
                  </Select>
                  {errors.organizationType && (
                    <p className="text-sm text-destructive mt-1">{errors.organizationType.message}</p>
                  )}
                </div>

                {watchedValues.organizationType === 'other' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('institutional.form.otherOrganizationType')}</label>
                    <Input
                      {...register('otherOrganizationType')}
                      placeholder={t('institutional.form.otherOrganizationTypePlaceholder')}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">{t('institutional.form.regulatoryPermissions')}</label>
                  <Textarea
                    {...register('regulatoryPermissions')}
                    placeholder={t('institutional.form.regulatoryPermissionsPlaceholder')}
                    className="min-h-[80px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('institutional.form.briefHistory')}</label>
                  <Textarea
                    {...register('briefHistory')}
                    placeholder={t('institutional.form.briefHistoryPlaceholder')}
                    className="min-h-[100px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('institutional.form.regulatoryDocuments')}</label>
                  <FileUpload
                    onFilesChange={setUploadedFiles}
                    maxFiles={5}
                    acceptedTypes=".pdf,.png,.jpg,.jpeg"
                    uploadText={t('institutional.form.fileUploadText')}
                    fileTypesText={t('institutional.form.fileUploadTypes')}
                    maxSize={20}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Steps 3-8: Use the form steps component */}
          {currentStep >= 3 && (
            <InstitutionalFormSteps
              currentStep={currentStep}
              watchedValues={watchedValues}
              register={register}
              errors={errors}
              setValue={setValue}
              handleArrayChange={handleArrayChange}
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
            />
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handlePreviousStep}
              disabled={currentStep === 1}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              {t('common.previous')}
            </Button>
            {currentStep < steps.length ? (
              <Button
                type="button"
                onClick={handleNextStep}
                variant={validateStep(currentStep) ? "default" : "outline"}
                className={`w-full sm:w-auto order-2 sm:order-2 ${!validateStep(currentStep) ? "border-yellow-300 text-yellow-700 hover:bg-yellow-50" : ""}`}
              >
                {t('common.next')}
              </Button>
            ) : (
              <Button 
                type="submit" 
                disabled={isSubmitting || !validateStep(currentStep)}
                variant={validateStep(currentStep) ? "default" : "outline"}
                className={`w-full sm:w-auto order-1 sm:order-1 ${!validateStep(currentStep) ? "border-yellow-300 text-yellow-700 hover:bg-yellow-50" : ""}`}
              >
                {isSubmitting ? t('institutional.form.submitting') : t('institutional.form.submitApplication')}
              </Button>
            )}
          </div>
        </form>
      </div>
      <Footer />
    </div>
  );
}
