'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { createContributorApplication } from '@/lib/firebase-service';
import { ContributorApplication } from '@/lib/types';
import { ContributorFormSteps } from '@/components/forms/contributor-form-steps';
import { Header } from '@/components/landing/Header';
import { Footer } from '@/components/landing/Footer';
import { requiresVerification } from '@/lib/social-media-verification';
import { useTranslations } from '../TranslationProvider';

// Validation schema
const contributorSchema = z.object({
  // Identity & Contact
  displayName: z.string().min(1, 'Display name is required'),
  email: z.string().email('Valid email is required'),
  telegramHandle: z.string().min(1, 'Telegram handle is required'),
  countryRegion: z.string().min(1, 'Country/Region is required'),
  languages: z.array(z.string()).min(1, 'Please select at least one language'),
  riskTermsConsent: z.boolean().refine(val => val === true, 'You must consent to risk and terms'),
  
  // Channels & Metrics
  channels: z.array(z.object({
    platform: z.string().min(1, 'Platform is required'),
    url: z.string().url('Valid URL is required'),
    followers: z.number().min(0, 'Followers must be a positive number'),
    avgViews30d: z.number().min(0).optional(),
    audienceTop3Geos: z.array(z.string()).min(1, 'Please select at least one audience geography'),
    contentFocus: z.string().min(1, 'Content focus is required'),
  })).min(1, 'Please add at least one channel'),
  
  // Role & Availability (Contributor+)
  roles: z.array(z.enum(['educator', 'analyst', 'community_builder', 'event_host', 'translator', 'content_creator', 'technical_writer'])).optional(),
  availabilityHoursPerWeek: z.number().min(0).optional(),
  regionsCanCover: z.array(z.string()).optional(),
  
  // Performance KPIs (Contributor+)
  kpiTargets: z.object({
    impressions: z.number().min(0).optional(),
    clicks: z.number().min(0).optional(),
    mintsStakes: z.number().min(0).optional(),
    retentionPercent: z.number().min(0).max(100).optional(),
    educationCompletions: z.number().min(0).optional(),
  }).optional(),
  consistencyWindow: z.number().min(0).optional(),
  strategicKpi: z.string().optional(),
  
  // Rewards & Compensation
  compensationModel: z.enum(['fixed', 'performance', 'hybrid']).optional(),
  paymentRails: z.object({
    usdt: z.object({
      chain: z.string(),
      address: z.string(),
    }).optional(),
    fiat: z.object({
      bankDetails: z.string(),
    }).optional(),
  }),
  
  // Portfolio & Track Record (Contributor+)
  recentWorkLinks: z.array(z.string().url()).optional(),
  outcomesSummary: z.string().optional(),
  conflictsExclusivity: z.string().optional(),
  
  // Wallets & Verification
  wallets: z.array(z.object({
    chain: z.string().min(1, 'Chain is required'),
    address: z.string().min(1, 'Address is required'),
  })).optional(),
  kycUpload: z.string().optional(),
  consentToPublicDashboards: z.boolean().optional(),
  
  // Community & Compliance
  agreeToKolGuidelines: z.boolean().refine(val => val === true, 'You must agree to KOL Guidelines'),
  agreeToCommunityRules: z.boolean().refine(val => val === true, 'You must agree to Community Rules'),
  antiFraudAcknowledgement: z.boolean().refine(val => val === true, 'You must acknowledge anti-fraud policy'),
  
  // Referrals
  referredByG3Partner: z.boolean().optional(),
  kolReferralCode: z.string().optional(),
});

type ContributorFormData = z.infer<typeof contributorSchema>;

interface Channel {
  platform: string;
  url: string;
  followers: number;
  avgViews30d?: number;
  audienceTop3Geos: string[];
  contentFocus: string;
}

interface Wallet {
  chain: string;
  address: string;
}

function ContributorApplicationContent() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [calculatedTier, setCalculatedTier] = useState<ContributorApplication['tier']>('airdrop_hunter');
  
  // Manual verification only - no real-time verification
  
  const {
    register,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ContributorFormData>({
    resolver: zodResolver(contributorSchema),
    defaultValues: {
      languages: [],
      channels: [],
      roles: [],
      regionsCanCover: [],
      kpiTargets: {},
      paymentRails: {},
      recentWorkLinks: [],
      wallets: [],
      agreeToKolGuidelines: false,
      agreeToCommunityRules: false,
      antiFraudAcknowledgement: false,
      riskTermsConsent: false,
    },
  });

  const watchedValues = watch();
  const channels = React.useMemo(() => watchedValues.channels || [], [watchedValues.channels]);

  // Handle KOL referral code from URL
  useEffect(() => {
    const kolRef = searchParams.get('ref');
    if (kolRef) {
      setValue('kolReferralCode', kolRef);
      setValue('referredByG3Partner', true);
    }
  }, [searchParams, setValue]);

  // Define all possible steps (memoized to prevent re-renders)
  const allSteps = React.useMemo(() => [
    { number: 1, title: t('contributor.steps.identity.title'), description: t('contributor.steps.identity.description'), requiredFor: ['airdrop_hunter', 'contributor', 'micro_kol', 'fund_partner'] },
    { number: 2, title: t('contributor.steps.channels.title'), description: t('contributor.steps.channels.description'), requiredFor: ['airdrop_hunter', 'contributor', 'micro_kol', 'fund_partner'] },
    { number: 3, title: t('contributor.steps.role.title'), description: t('contributor.steps.role.description'), requiredFor: ['contributor', 'micro_kol', 'fund_partner'] },
    { number: 4, title: t('contributor.steps.performance.title'), description: t('contributor.steps.performance.description'), requiredFor: ['contributor', 'micro_kol', 'fund_partner'] },
    { number: 5, title: t('contributor.steps.rewards.title'), description: t('contributor.steps.rewards.description'), requiredFor: ['airdrop_hunter', 'contributor', 'micro_kol', 'fund_partner'] },
    { number: 6, title: t('contributor.steps.portfolio.title'), description: t('contributor.steps.portfolio.description'), requiredFor: ['contributor', 'micro_kol', 'fund_partner'] },
    { number: 7, title: t('contributor.steps.wallets.title'), description: t('contributor.steps.wallets.description'), requiredFor: ['airdrop_hunter', 'contributor', 'micro_kol', 'fund_partner'] },
    { number: 8, title: t('contributor.steps.compliance.title'), description: t('contributor.steps.compliance.description'), requiredFor: ['airdrop_hunter', 'contributor', 'micro_kol', 'fund_partner'] },
  ], [t]);

  // Manual verification - no need to extract usernames

  // Step validation functions
  const validateStep = (step: number): boolean => {
    const values = watchedValues;
    
    switch (step) {
      case 1: // Identity & Contact
        return Boolean(
          values.displayName && values.displayName.trim().length > 0 &&
          values.email && values.email.trim().length > 0 &&
          values.telegramHandle && values.telegramHandle.trim().length > 0 &&
          values.countryRegion && values.countryRegion.trim().length > 0 &&
          values.languages && values.languages.length > 0 &&
          values.riskTermsConsent === true
        );
      
        case 2: // Channels & Metrics
          const hasValidChannels = Boolean(
            values.channels && values.channels.length > 0 &&
            values.channels.every((channel: Channel) => 
              channel.platform && channel.platform.trim().length > 0 &&
              channel.url && channel.url.trim().length > 0 &&
              channel.followers && channel.followers > 0 &&
              channel.audienceTop3Geos && channel.audienceTop3Geos.length > 0 &&
              channel.contentFocus && channel.contentFocus.trim().length > 0
            )
          );
          
          // For manual verification, just check if channels are filled
          // Admin will verify manually after submission
          
          return hasValidChannels;
      
      case 3: // Role & Availability (only for Contributor+)
        if (calculatedTier === 'airdrop_hunter') return true; // Skip validation for airdrop_hunter
        return Boolean(
          values.roles && values.roles.length > 0 &&
          values.regionsCanCover && values.regionsCanCover.length > 0
        );
      
      case 4: // Performance KPIs (only for Contributor+)
        if (calculatedTier === 'airdrop_hunter') return true; // Skip validation for airdrop_hunter
        return true; // This step has no required fields (all KPI fields are optional)
      
      case 5: // Rewards & Compensation
        // For Airdrop Hunter, compensation model is optional
        if (calculatedTier === 'airdrop_hunter') {
          return true; // Skip validation for airdrop_hunter
        }
        return Boolean(
          values.compensationModel && 
          typeof values.compensationModel === 'string' && 
          values.compensationModel.trim().length > 0
        );
      
      case 6: // Portfolio & Track Record (only for Contributor+)
        if (calculatedTier === 'airdrop_hunter') return true; // Skip validation for airdrop_hunter
        return true; // This step has no required fields
      
      case 7: // Wallets & Verification
        return Boolean(
          values.wallets && values.wallets.length > 0 &&
          values.wallets.every((wallet: Wallet) => 
            wallet.address && wallet.address.trim().length > 0 &&
            wallet.chain && wallet.chain.trim().length > 0
          )
        );
      
      case 8: // Community & Compliance
        return Boolean(
          values.agreeToKolGuidelines === true &&
          values.agreeToCommunityRules === true &&
          values.antiFraudAcknowledgement === true &&
          values.riskTermsConsent === true
        );
      
      default:
        return true;
    }
  };

  const handleNextStep = () => {
    console.log("handleNextStep", currentStep);
    if (validateStep(currentStep)) {
      const currentStepIndex = steps.findIndex(step => step.number === currentStep);
      if (currentStepIndex < steps.length - 1) {
        setCurrentStep(steps[currentStepIndex + 1].number);
      }
    } else {
      // Get step name for better error message
      const stepName = steps.find(step => step.number === currentStep)?.title || `Step ${currentStep}`;
      toast.error(t('contributor.form.stepValidationError').replace('{stepName}', stepName));
    }
  };

  const handlePreviousStep = () => {
    const currentStepIndex = steps.findIndex(step => step.number === currentStep);
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].number);
    }
  };

  // Calculate tier when channels change
  React.useEffect(() => {
    if (channels.length > 0) {
      // Tier calculation is now handled server-side in the API route
      // We'll use a simple client-side calculation for UI purposes
      const maxFollowers = Math.max(...channels.map(channel => channel.followers));
      let tier: ContributorApplication['tier'] = 'airdrop_hunter';
      
      if (maxFollowers >= 100000) {
        tier = 'fund_partner';
      } else if (maxFollowers >= 10000) {
        tier = 'micro_kol';
      } else if (maxFollowers >= 1000) {
        tier = 'contributor';
      }
      
      setCalculatedTier(tier);
    }
  }, [channels]);

  // Adjust current step when tier changes to ensure we're on a valid step
  React.useEffect(() => {
    const availableSteps = allSteps.filter(step => step.requiredFor.includes(calculatedTier));
    const isCurrentStepValid = availableSteps.some(step => step.number === currentStep);
    
    if (!isCurrentStepValid && availableSteps.length > 0) {
      // If current step is not valid for this tier, move to the first available step
      setCurrentStep(availableSteps[0].number);
    }
  }, [calculatedTier, currentStep, allSteps]);

  // Safety check: ensure currentStep is always valid
  React.useEffect(() => {
    const availableSteps = allSteps.filter(step => step.requiredFor.includes(calculatedTier));
    if (availableSteps.length > 0 && !availableSteps.some(step => step.number === currentStep)) {
      setCurrentStep(availableSteps[0].number);
    }
  }, [calculatedTier, allSteps, currentStep]);

  const onSubmit = async (data: ContributorFormData) => {
    // Manual verification - no need to check verification status
    // Admin will verify channels manually after submission

    console.log('Form submission started for tier:', calculatedTier);
    console.log('Form data:', data);
    console.log('Form errors:', errors);

    setIsSubmitting(true);
    try {
      // Transform form data to match our type structure
      const applicationData: Omit<ContributorApplication, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'tier'> = {
        identity: {
          displayName: data.displayName,
          email: data.email.toLowerCase(),
          telegramHandle: data.telegramHandle,
          countryRegion: data.countryRegion,
          languages: data.languages,
          riskTermsConsent: data.riskTermsConsent,
        },
        channels: data.channels.map((channel) => ({
          ...channel,
          verificationStatus: 'pending' as const,
          verificationMethod: 'pending' as const
        })),
        roleAndAvailability: data.roles && data.roles.length > 0 ? {
          roles: data.roles,
          availabilityHoursPerWeek: data.availabilityHoursPerWeek || 0,
          regionsCanCover: data.regionsCanCover || [],
        } : undefined,
        performanceKpis: data.kpiTargets ? {
          kpiTargets: data.kpiTargets,
          consistencyWindow: data.consistencyWindow,
          strategicKpi: data.strategicKpi,
        } : undefined,
        rewardsCompensation: {
          compensationModel: data.compensationModel || 'fixed',
          paymentRails: data.paymentRails,
        },
        portfolio: data.recentWorkLinks && data.recentWorkLinks.length > 0 ? {
          recentWorkLinks: data.recentWorkLinks,
          outcomesSummary: data.outcomesSummary,
          conflictsExclusivity: data.conflictsExclusivity,
        } : undefined,
        wallets: data.wallets || [],
        kycUpload: data.kycUpload,
        consentToPublicDashboards: data.consentToPublicDashboards || false,
        communityCompliance: {
          agreeToKolGuidelines: data.agreeToKolGuidelines,
          agreeToCommunityRules: data.agreeToCommunityRules,
          antiFraudAcknowledgement: data.antiFraudAcknowledgement,
        },
        referrals: {
          referredByG3Partner: data.referredByG3Partner,
        },
        attachments: {
          portfolioFiles: [],
        },
      };

      await createContributorApplication(applicationData, uploadedFiles);
      toast.success(t('contributor.form.applicationSubmittedSuccessfully'));
      
      // Redirect to KOL dashboard after successful submission
      setTimeout(() => {
        router.push('/kol-dashboard');
      }, 2000);
    } catch (error) {
      console.error('Error submitting application:', error);
      const errorMessage = error instanceof Error ? error.message : t('contributor.form.failedToSubmit');
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submit triggered, current step:', currentStep);
    console.log('Is last step:', currentStep === steps[steps.length - 1]?.number);
    
    // Check if current step is valid
    if (!validateStep(currentStep)) {
      const stepName = steps.find(step => step.number === currentStep)?.title || `Step ${currentStep}`;
      console.log('Current step validation failed:', stepName);
      toast.error(t('contributor.form.stepValidationError').replace('{stepName}', stepName));
      return;
    }

    // If on the last step, submit the form
    if (currentStep === steps[steps.length - 1]?.number) {
      const formData = getValues();
      await onSubmit(formData);
    } else {
      console.log('Not on last step, should not submit');
    }
  };

  const handleArrayChange = (field: string, value: string, checked: boolean) => {
    const currentArray = (watchedValues as unknown as Record<string, string[]>)[field] || [];
    if (checked) {
      setValue(field as keyof ContributorFormData, [...currentArray, value] as ContributorFormData[keyof ContributorFormData]);
      setValue(field as keyof ContributorFormData, [...currentArray, value] as ContributorFormData[keyof ContributorFormData]);
    } else {
      setValue(field as keyof ContributorFormData, currentArray.filter(item => item !== value) as ContributorFormData[keyof ContributorFormData]);
      setValue(field as keyof ContributorFormData, currentArray.filter(item => item !== value) as ContributorFormData[keyof ContributorFormData]);
    }
  };

  const addChannel = () => {
    const currentChannels = getValues('channels') || [];
    const newChannel = {
      platform: '',
      url: '',
      followers: 0,
      avgViews30d: 0,
      audienceTop3Geos: [],
      contentFocus: '',
    };
    setValue('channels', [...currentChannels, newChannel], { shouldValidate: true, shouldDirty: true });
  };

  const removeChannel = (index: number) => {
    const currentChannels = getValues('channels') || [];
    setValue('channels', currentChannels.filter((_, i) => i !== index), { shouldValidate: true, shouldDirty: true });
  };

  const updateChannel = (index: number, field: string, value: string | number | string[]) => {
    const currentChannels = [...(getValues('channels') || [])];
    currentChannels[index] = { ...currentChannels[index], [field]: value };
    setValue('channels', currentChannels, { shouldValidate: true, shouldDirty: true });
  };


  // Get steps required for current tier and add sequential display numbers
  const steps = allSteps
    .filter(step => step.requiredFor.includes(calculatedTier))
    .map((step, index) => ({
      ...step,
      displayNumber: index + 1 // Sequential display number for users
    }));

  // Safety check: don't render if no valid steps
  if (steps.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600 mb-4">{t('contributor.form.error')}</h1>
              <p className="text-gray-600">{t('contributor.form.noValidSteps')}</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const tierInfo = {
    airdrop_hunter: {
      name: t('contributor.tier.airdrop_hunter.name'),
      description: t('contributor.tier.airdrop_hunter.description'),
      requirements: t('contributor.tier.airdrop_hunter.requirements'),
      benefits: t('contributor.tier.airdrop_hunter.benefits'),
    },
    contributor: {
      name: t('contributor.tier.contributor.name'),
      description: t('contributor.tier.contributor.description'),
      requirements: t('contributor.tier.contributor.requirements'),
      benefits: t('contributor.tier.contributor.benefits'),
    },
    micro_kol: {
      name: t('contributor.tier.micro_kol.name'),
      description: t('contributor.tier.micro_kol.description'),
      requirements: t('contributor.tier.micro_kol.requirements'),
      benefits: t('contributor.tier.micro_kol.benefits'),
    },
    fund_partner: {
      name: t('contributor.tier.fund_partner.name'),
      description: t('contributor.tier.fund_partner.description'),
      requirements: t('contributor.tier.fund_partner.requirements'),
      benefits: t('contributor.tier.fund_partner.benefits'),
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 max-w-4xl py-4 sm:py-8">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 sm:mb-4">
            {t('contributor.title')}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            {t('contributor.subtitle')}
          </p>
        </div>

        {/* Tier Information */}
        <Card className="mb-6 sm:mb-8">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">{t('contributor.form.yourCalculatedTier').replace('{tier}', tierInfo[calculatedTier].name)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-2 text-sm sm:text-base">{tierInfo[calculatedTier].description}</p>
            <p className="text-xs sm:text-sm font-medium mb-1">{t('contributor.form.requirements')} {tierInfo[calculatedTier].requirements}</p>
            <p className="text-xs sm:text-sm">{t('contributor.form.benefits')} {tierInfo[calculatedTier].benefits}</p>
          </CardContent>
        </Card>

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
                    {step.displayNumber}
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
              <h2 className="text-lg font-semibold">{steps.find(step => step.number === currentStep)?.title}</h2>
              <p className="text-sm text-muted-foreground">{steps.find(step => step.number === currentStep)?.description}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('contributor.form.step').replace('{number}', steps.find(step => step.number === currentStep)?.displayNumber || '1')} {t('contributor.form.of').replace('{total}', steps.length.toString())}</p>
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
                    {step.displayNumber}
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
              <h2 className="text-xl font-semibold">{steps.find(step => step.number === currentStep)?.title || 'Step'}</h2>
              <p className="text-muted-foreground">{steps.find(step => step.number === currentStep)?.description || ''}</p>
            </div>
          </div>

          {/* Validation Warning */}
          {!validateStep(currentStep) && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 text-center">
                {t('contributor.form.validationWarning')}
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-8">
          {/* Step 1: Identity & Contact */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">{t('contributor.steps.identity.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('contributor.form.displayName')} *</label>
                    <Input
                      {...register('displayName')}
                      placeholder={t('contributor.form.displayName')}
                    />
                    {errors.displayName && (
                      <p className="text-sm text-destructive mt-1">{errors.displayName.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('contributor.form.email')} *</label>
                    <Input
                      {...register('email')}
                      type="email"
                      placeholder={t('contributor.form.emailPlaceholder')}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('contributor.form.telegramHandle')} *</label>
                    <Input
                      {...register('telegramHandle')}
                      placeholder={t('contributor.form.telegramHandlePlaceholder')}
                    />
                  {errors.telegramHandle && (
                    <p className="text-sm text-destructive mt-1">{errors.telegramHandle.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('contributor.form.countryRegion')} *</label>
                  <Input
                    {...register('countryRegion')}
                    placeholder={t('contributor.form.countryRegion')}
                  />
                  {errors.countryRegion && (
                    <p className="text-sm text-destructive mt-1">{errors.countryRegion.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">{t('contributor.form.languages')} *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      t('contributor.form.languageOptions.english'), t('contributor.form.languageOptions.chineseSimplified'), t('contributor.form.languageOptions.chineseTraditional'), t('contributor.form.languageOptions.spanish'),
                      t('contributor.form.languageOptions.french'), t('contributor.form.languageOptions.german'), t('contributor.form.languageOptions.japanese'), t('contributor.form.languageOptions.korean'), t('contributor.form.languageOptions.portuguese'), t('contributor.form.languageOptions.russian'),
                      t('contributor.form.languageOptions.arabic'), t('contributor.form.languageOptions.hindi'), t('contributor.form.languageOptions.other')
                    ].map((language) => (
                      <label key={language} className="flex items-center space-x-2">
                        <Checkbox
                          checked={watchedValues.languages?.includes(language)}
                          onChange={(e) => handleArrayChange('languages', language, e.target.checked)}
                        />
                        <span className="text-sm">{language}</span>
                      </label>
                    ))}
                  </div>
                  {errors.languages && (
                    <p className="text-sm text-destructive mt-1">{errors.languages.message}</p>
                  )}
                </div>

                <div className="p-4 border rounded-lg bg-muted/50">
                  <label className="flex items-center space-x-2">
                    <Checkbox
                      checked={watchedValues.riskTermsConsent || false}
                      onChange={(e) => setValue('riskTermsConsent', e.target.checked)}
                    />
                    <span className="text-sm font-medium">
                      {t('contributor.form.riskTermsConsent')} *
                    </span>
                  </label>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t('contributor.form.riskTermsText')}
                  </p>
                  {errors.riskTermsConsent && (
                    <p className="text-sm text-destructive mt-1">{errors.riskTermsConsent.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Channels & Metrics */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">{t('contributor.steps.channels.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {t('contributor.steps.channels.description')}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addChannel}
                    className="w-full sm:w-auto"
                  >
                    {t('contributor.form.addChannel')}
                  </Button>
                </div>

                {channels.map((channel, index) => (
                  <div key={index} className="p-3 sm:p-4 border rounded-lg space-y-3 sm:space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <h4 className="font-medium text-sm sm:text-base">{t('contributor.form.channel')} {index + 1}</h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeChannel(index)}
                        className="w-full sm:w-auto"
                      >
                        {t('contributor.form.removeChannel')}
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">{t('contributor.form.platform')} *</label>
                        <Select
                          value={channel.platform}
                          onChange={(e) => updateChannel(index, 'platform', e.target.value)}
                        >
                          <option value="">{t('contributor.form.selectPlatform')}</option>
                          <option value="twitter">{t('contributor.form.platforms.twitter')}</option>
                          <option value="youtube">{t('contributor.form.platforms.youtube')}</option>
                          <option value="tiktok">{t('contributor.form.platforms.tiktok')}</option>
                          <option value="instagram">{t('contributor.form.platforms.instagram')}</option>
                          <option value="linkedin">{t('contributor.form.platforms.linkedin')}</option>
                          <option value="telegram">{t('contributor.form.platforms.telegram')}</option>
                          <option value="discord">{t('contributor.form.platforms.discord')}</option>
                          <option value="medium">{t('contributor.form.platforms.medium')}</option>
                          <option value="substack">{t('contributor.form.platforms.substack')}</option>
                          <option value="other">{t('contributor.form.platforms.other')}</option>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">{t('contributor.form.url')} *</label>
                        <Input
                          value={channel.url}
                          onChange={(e) => updateChannel(index, 'url', e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">{t('contributor.form.followers')} *</label>
                        <Input
                          type="number"
                          min="0"
                          value={channel.followers || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                              updateChannel(index, 'followers', 0);
                            } else {
                              const numValue = parseInt(value);
                              if (!isNaN(numValue)) {
                                updateChannel(index, 'followers', numValue);
                              }
                            }
                          }}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">{t('contributor.form.avgViews30d')}</label>
                        <Input
                          type="number"
                          min="0"
                          value={channel.avgViews30d || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                              updateChannel(index, 'avgViews30d', 0);
                            } else {
                              const numValue = parseInt(value);
                              if (!isNaN(numValue)) {
                                updateChannel(index, 'avgViews30d', numValue);
                              }
                            }
                          }}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">{t('contributor.form.audienceTop3Geos')} *</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          t('contributor.form.geographies.northAmerica'), t('contributor.form.geographies.southAmerica'), t('contributor.form.geographies.europe'), t('contributor.form.geographies.asiaPacific'),
                          t('contributor.form.geographies.middleEast'), t('contributor.form.geographies.africa'), t('contributor.form.geographies.oceania'), t('contributor.form.geographies.global')
                        ].map((geo) => (
                          <label key={geo} className="flex items-center space-x-2">
                            <Checkbox
                              checked={channel.audienceTop3Geos?.includes(geo)}
                              onChange={(e) => {
                                const currentGeos = channel.audienceTop3Geos || [];
                                const newGeos = e.target.checked 
                                  ? [...currentGeos, geo]
                                  : currentGeos.filter(g => g !== geo);
                                updateChannel(index, 'audienceTop3Geos', newGeos);
                              }}
                            />
                            <span className="text-sm">{geo}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">{t('contributor.form.contentFocus')} *</label>
                      <Input
                        value={channel.contentFocus}
                        onChange={(e) => updateChannel(index, 'contentFocus', e.target.value)}
                        placeholder={t('contributor.form.contentFocusPlaceholder')}
                      />
                    </div>

                    {/* Manual verification notice */}
                    {channel.platform && channel.url && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>{t('contributor.form.manualVerification')}</strong> {t('contributor.form.manualVerificationText')}
                        </p>
                      </div>
                    )}
                  </div>
                ))}

                {channels.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>{t('contributor.form.noChannelsAdded')}</p>
                  </div>
                )}

                {/* Manual verification notice */}
                {channels.length > 0 && requiresVerification(calculatedTier) && (
                  <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-medium text-yellow-800 mb-2">
                      {t('contributor.form.manualVerificationRequired')}
                    </h4>
                    <p className="text-sm text-yellow-700">
                      {t('contributor.form.manualVerificationRequiredText').replace('{tier}', calculatedTier.replace('_', ' '))}
                    </p>
                  </div>
                )}

                {errors.channels && (
                  <p className="text-sm text-destructive">{errors.channels.message}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Steps 3-8: Use the form steps component */}
          {currentStep >= 3 && (
            <ContributorFormSteps
              currentStep={currentStep}
              watchedValues={watchedValues as Record<string, unknown>}
              register={register as (name: string) => unknown}
              errors={errors as Record<string, unknown>}
              setValue={setValue as (name: string, value: unknown) => void}
              handleArrayChange={handleArrayChange}
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
              calculatedTier={calculatedTier}
            />
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handlePreviousStep}
              disabled={currentStep === steps[0]?.number}
            >
              {t('common.previous')}
            </Button>
            {currentStep !== steps[steps.length - 1]?.number ? (
              <Button
                type="button"
                onClick={handleNextStep}
                variant={validateStep(currentStep) ? "default" : "outline"}
                className={`w-full sm:w-auto order-1 sm:order-2 ${!validateStep(currentStep) ? "border-yellow-300 text-yellow-700 hover:bg-yellow-50" : ""}`}
              >
                {t('common.next')}
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto order-1 sm:order-2">
                {isSubmitting ? t('contributor.form.submitting') : t('contributor.form.submitApplication')}
              </Button>
            )}
          </div>
        </form>
      </div>
      <Footer />
    </div>
  );
}

export default function ContributorApplicationPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ContributorApplicationContent />
    </Suspense>
  );
}
