"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DurationInput } from "@/components/ui/duration-input";
import { ValidatedInput } from "@/components/ui/validated-input";
import { YesNoToggle } from "@/components/ui/yes-no-toggle";
import { FileUpload } from "@/components/ui/file-upload";
import { LocationPicker } from "@/components/ui/location-picker";
import { StepIndicator } from "./step-indicator";
import { OptionSelector } from "./option-selector";
import { FormSection } from "./form-section";
import { AssetFormHeader } from "./header";
import { AssetFormFooter } from "./footer";
import { useTranslations } from "../../hooks/useTranslations";
import { toast } from "sonner";


type BasicData = {
  projectName: string;
  landParcelId: string;
  county?: string;
  city?: string;
  province?: string;
  latitude?: string;
  longitude?: string;
  landType: string;
  leaseContractId: string;
  duration: string;
  owner: string;
};

type FinancialData = {
  unitInvestmentCost: string;
  annualCashFlowBreakdown: string;
  otherSubsidiesFile?: File;
  annualizedIRR: string;
};

type OperationsCompliance = {
  companyName: string;
  businessLicense: string;
  epcContractorName: string;
  governmentFiling: string;
  operatingEntity: string;
  tier: string;
};

type OrchardData = {
  plantingArea: string;
  numberOfTrees: string;
  age: string;
  variety: string;
  rowSpacing: string;
  treeDensity: string;
  annualYield: string;
  lastThreeYearsYield: string;
  monitoringSystem: boolean;
  deviceId?: string;
  orchardProductSalesRevenueFile?: File;
};

type SolarData = {
  installedCapacity: string;
  pvModuleModel: string;
  manufacturer: string;
  installationDate: string;
  gridConnectionPermitId: string;
  gridCompany: string;
  averageAnnualPowerGeneration: string;
  tariffPpaContractId: string;
  solarElectricitySalesRevenueFile?: File;
};

type FormData = {
  basicData: BasicData;
  financialData: FinancialData;
  operationsCompliance: OperationsCompliance;
  tierData: OrchardData | SolarData;
};

export function AssetRegistrationForm() {
  const { t } = useTranslations();
  const [currentStep, setCurrentStep] = useState(1);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [formData, setFormData] = useState<Partial<FormData>>({});
  const [otherSubsidiesFile, setOtherSubsidiesFile] = useState<File | undefined>(undefined);
  const [orchardProductSalesRevenueFile, setOrchardProductSalesRevenueFile] = useState<File | undefined>(undefined);
  const [solarElectricitySalesRevenueFile, setSolarElectricitySalesRevenueFile] = useState<File | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form schemas with translated error messages
  const basicDataSchema = z.object({
    projectName: z.string().min(1, t("form.validation.fieldRequired")),
    landParcelId: z.string().min(1, t("form.validation.fieldRequired")),
    county: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    landType: z.string().min(1, t("form.validation.fieldRequired")),
    leaseContractId: z.string().min(1, t("form.validation.fieldRequired")),
    duration: z.string()
      .min(1, t("form.validation.fieldRequired"))
      .refine((val) => {
        // Extract the numeric part from "X years" or "X months" format
        const match = val.match(/^(\d+(?:\.\d+)?)\s+(years|months)$/);
        if (!match) return false;
        const numValue = parseFloat(match[1]);
        return numValue > 0;
      }, "Duration must be a positive number"),
    owner: z.string().min(1, t("form.validation.fieldRequired")),
  }).refine((data) => {
    // Custom validation: ensure location is properly selected
    const lat = parseFloat(data.latitude || "");
    const lng = parseFloat(data.longitude || "");
    
    // Check if coordinates are valid numbers and within reasonable ranges
    const hasValidCoordinates = !isNaN(lat) && !isNaN(lng) && 
      lat >= -90 && lat <= 90 && 
      lng >= -180 && lng <= 180 &&
      (data.latitude || "") !== "" && (data.longitude || "") !== "";
    
    
    return hasValidCoordinates;
  }, {
    message: "Please select a valid location",
    path: ["latitude"] // This will show the error on the location picker
  });

  const financialDataSchema = z.object({
    unitInvestmentCost: z.string().min(1, t("form.validation.fieldRequired")),
    annualCashFlowBreakdown: z.string().min(1, t("form.validation.fieldRequired")),
    otherSubsidiesFile: z.instanceof(File).optional(),
    annualizedIRR: z.string().min(1, t("form.validation.fieldRequired")),
  });

  const operationsComplianceSchema = z.object({
    companyName: z.string().min(1, t("form.validation.fieldRequired")),
    businessLicense: z.string().min(1, t("form.validation.fieldRequired")),
    epcContractorName: z.string().min(1, t("form.validation.fieldRequired")),
    governmentFiling: z.string().min(1, t("form.validation.fieldRequired")),
    operatingEntity: z.string().min(1, t("form.validation.fieldRequired")),
    tier: z.string().min(1, t("form.validation.fieldRequired")),
  });

  const orchardDataSchema = z.object({
    plantingArea: z.string().min(1, t("form.validation.fieldRequired")),
    numberOfTrees: z.string().min(1, t("form.validation.fieldRequired")),
    age: z.string().min(1, t("form.validation.fieldRequired")),
    variety: z.string().min(1, t("form.validation.fieldRequired")),
    rowSpacing: z.string().min(1, t("form.validation.fieldRequired")),
    treeDensity: z.string().min(1, t("form.validation.fieldRequired")),
    annualYield: z.string().min(1, t("form.validation.fieldRequired")),
    lastThreeYearsYield: z.string().min(1, t("form.validation.fieldRequired")),
    monitoringSystem: z.boolean(),
    deviceId: z.string().optional(),
    orchardProductSalesRevenueFile: z.instanceof(File).optional(),
  });

  const solarDataSchema = z.object({
    installedCapacity: z.string().min(1, t("form.validation.fieldRequired")),
    pvModuleModel: z.string().min(1, t("form.validation.fieldRequired")),
    manufacturer: z.string().min(1, t("form.validation.fieldRequired")),
    installationDate: z.string().min(1, t("form.validation.fieldRequired")),
    gridConnectionPermitId: z.string().min(1, t("form.validation.fieldRequired")),
    gridCompany: z.string().min(1, t("form.validation.fieldRequired")),
    averageAnnualPowerGeneration: z.string().min(1, t("form.validation.fieldRequired")),
    tariffPpaContractId: z.string().min(1, t("form.validation.fieldRequired")),
    solarElectricitySalesRevenueFile: z.instanceof(File).optional(),
  });

  const steps = [
    t("form.steps.basicData"),
    t("form.steps.financialRevenue"),
    t("form.steps.operationsCompliance"),
    t("form.steps.tierData")
  ];

  const basicForm = useForm<z.infer<typeof basicDataSchema>>({
    resolver: zodResolver(basicDataSchema),
    defaultValues: {
      ...formData.basicData,
      projectName: formData.basicData?.projectName || "",
      landParcelId: formData.basicData?.landParcelId || "",
      county: formData.basicData?.county || "",
      city: formData.basicData?.city || "",
      province: formData.basicData?.province || "",
      latitude: formData.basicData?.latitude || "",
      longitude: formData.basicData?.longitude || "",
      landType: formData.basicData?.landType || "",
      leaseContractId: formData.basicData?.leaseContractId || "",
      duration: formData.basicData?.duration || "",
      owner: formData.basicData?.owner || "",
    },
  });

  const financialForm = useForm<z.infer<typeof financialDataSchema>>({
    resolver: zodResolver(financialDataSchema),
    defaultValues: {
      ...formData.financialData,
      unitInvestmentCost: formData.financialData?.unitInvestmentCost || "",
      annualCashFlowBreakdown: formData.financialData?.annualCashFlowBreakdown || "",
      annualizedIRR: formData.financialData?.annualizedIRR || "",
    },
  });

  const operationsForm = useForm<z.infer<typeof operationsComplianceSchema>>({
    resolver: zodResolver(operationsComplianceSchema),
    defaultValues: {
      ...formData.operationsCompliance,
      companyName: formData.operationsCompliance?.companyName || "",
      businessLicense: formData.operationsCompliance?.businessLicense || "",
      epcContractorName: formData.operationsCompliance?.epcContractorName || "",
      governmentFiling: formData.operationsCompliance?.governmentFiling || "",
      operatingEntity: formData.operationsCompliance?.operatingEntity || "",
      tier: formData.operationsCompliance?.tier || "",
    },
  });

  const orchardForm = useForm<z.infer<typeof orchardDataSchema>>({
    resolver: zodResolver(orchardDataSchema),
    defaultValues: {
      ...(formData.tierData as OrchardData || {}),
      plantingArea: (formData.tierData as OrchardData)?.plantingArea || "",
      numberOfTrees: (formData.tierData as OrchardData)?.numberOfTrees || "",
      age: (formData.tierData as OrchardData)?.age || "",
      variety: (formData.tierData as OrchardData)?.variety || "",
      rowSpacing: (formData.tierData as OrchardData)?.rowSpacing || "",
      treeDensity: (formData.tierData as OrchardData)?.treeDensity || "",
      annualYield: (formData.tierData as OrchardData)?.annualYield || "",
      lastThreeYearsYield: (formData.tierData as OrchardData)?.lastThreeYearsYield || "",
      monitoringSystem: (formData.tierData as OrchardData)?.monitoringSystem || false,
      deviceId: (formData.tierData as OrchardData)?.deviceId || "",
    },
  });

  const solarForm = useForm<z.infer<typeof solarDataSchema>>({
    resolver: zodResolver(solarDataSchema),
    defaultValues: {
      ...(formData.tierData as SolarData || {}),
      installedCapacity: (formData.tierData as SolarData)?.installedCapacity || "",
      pvModuleModel: (formData.tierData as SolarData)?.pvModuleModel || "",
      manufacturer: (formData.tierData as SolarData)?.manufacturer || "",
      installationDate: (formData.tierData as SolarData)?.installationDate || "",
      gridConnectionPermitId: (formData.tierData as SolarData)?.gridConnectionPermitId || "",
      gridCompany: (formData.tierData as SolarData)?.gridCompany || "",
      averageAnnualPowerGeneration: (formData.tierData as SolarData)?.averageAnnualPowerGeneration || "",
      tariffPpaContractId: (formData.tierData as SolarData)?.tariffPpaContractId || "",
    },
  });

  const handleNext = async () => {
    let isValid = false;
    
    if (currentStep === 1) {
      isValid = await basicForm.trigger();
      if (isValid) {
        setFormData(prev => ({ ...prev, basicData: basicForm.getValues() }));
      } else {
        toast.error(t("form.validation.fillAllRequired").replace("{section}", t("form.steps.basicData")));
        return;
      }
    } else if (currentStep === 2) {
      isValid = await financialForm.trigger();
      if (isValid) {
        setFormData(prev => ({ 
          ...prev, 
          financialData: { 
            ...financialForm.getValues(), 
            otherSubsidiesFile 
          } 
        }));
      } else {
        toast.error(t("form.validation.fillAllRequired").replace("{section}", t("form.steps.financialRevenue")));
        return;
      }
    } else if (currentStep === 3) {
      isValid = await operationsForm.trigger();
      if (isValid) {
        setFormData(prev => ({ ...prev, operationsCompliance: operationsForm.getValues() }));
      } else {
        toast.error(t("form.validation.fillAllRequired").replace("{section}", t("form.steps.operationsCompliance")));
        return;
      }
    }

    if (isValid && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleReview = async () => {
    const tier = operationsForm.getValues().tier;
    let isValid = false;

    if (tier === "Orchard Data") {
      isValid = await orchardForm.trigger();
      if (isValid) {
        setFormData(prev => ({ 
          ...prev, 
          tierData: { 
            ...orchardForm.getValues(), 
            orchardProductSalesRevenueFile 
          } 
        }));
      } else {
        toast.error(t("form.validation.fillAllRequired").replace("{section}", t("form.orchardData.title")));
        return;
      }
    } else if (tier === "Solar Data") {
      isValid = await solarForm.trigger();
      if (isValid) {
        setFormData(prev => ({ 
          ...prev, 
          tierData: { 
            ...solarForm.getValues(), 
            solarElectricitySalesRevenueFile 
          } 
        }));
      } else {
        toast.error(t("form.validation.fillAllRequired").replace("{section}", t("form.solarData.title")));
        return;
      }
    } else {
      // No tier selected, show error
      toast.error(t("form.validation.selectTier"));
      return;
    }

    if (isValid) {
      setIsReviewMode(true);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Create FormData object
      const submitFormData = new FormData();
      
      // Add form data as JSON strings
      submitFormData.append('basicData', JSON.stringify(formData.basicData));
      submitFormData.append('financialData', JSON.stringify(formData.financialData));
      submitFormData.append('operationsCompliance', JSON.stringify(formData.operationsCompliance));
      submitFormData.append('tierData', JSON.stringify(formData.tierData));
      
      // Add files if they exist
      if (otherSubsidiesFile) {
        submitFormData.append('otherSubsidiesFile', otherSubsidiesFile);
      }
      if (orchardProductSalesRevenueFile) {
        submitFormData.append('orchardProductSalesRevenueFile', orchardProductSalesRevenueFile);
      }
      if (solarElectricitySalesRevenueFile) {
        submitFormData.append('solarElectricitySalesRevenueFile', solarElectricitySalesRevenueFile);
      }

      const response = await fetch('/api/assets', {
        method: 'POST',
        body: submitFormData, // Don't set Content-Type header, let browser set it with boundary
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(t("form.success.submitted"));
        console.log('Uploaded files:', result.uploadedFiles);
        // Reset form or redirect
        window.location.reload();
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error(t("form.success.failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    if (isReviewMode) {
      return (
        <div className="bg-white rounded-lg p-4 sm:p-8 shadow-lg">
          <h2 className="!text-xl font-bold text-gray-900 mb-6">{t("form.review.title")}</h2>
          <div className="space-y-6">
            {/* Basic Data Review */}
            <div>
              <h3 className="!text-lg font-semibold text-gray-900 mb-3">{t("form.review.basicData")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><strong>Project Name:</strong> {formData.basicData?.projectName}</div>
                <div><strong>Land Parcel ID:</strong> {formData.basicData?.landParcelId}</div>
                <div><strong>Lease Contract ID:</strong> {formData.basicData?.leaseContractId}</div>
                <div><strong>Duration:</strong> {formData.basicData?.duration}</div>
                <div className="sm:col-span-2"><strong>Location:</strong> {formData.basicData?.county}, {formData.basicData?.city}, {formData.basicData?.province}</div>
                <div className="sm:col-span-2"><strong>GPS:</strong> {formData.basicData?.latitude}, {formData.basicData?.longitude}</div>
                <div><strong>Land Type:</strong> {formData.basicData?.landType}</div>
                <div><strong>Owner:</strong> {formData.basicData?.owner}</div>
              </div>
            </div>

            {/* Financial Data Review */}
            <div>
              <h3 className="!text-lg font-semibold text-gray-900 mb-3">{t("form.review.financialData")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><strong>Unit Investment Cost:</strong> {formData.financialData?.unitInvestmentCost}</div>
                <div><strong>Annual Cash Flow:</strong> {formData.financialData?.annualCashFlowBreakdown}</div>
                <div className="sm:col-span-2"><strong>Other Subsidies:</strong> {formData.financialData?.otherSubsidiesFile ? formData.financialData.otherSubsidiesFile.name : "No file uploaded"}</div>
                <div><strong>Annualized IRR:</strong> {formData.financialData?.annualizedIRR}</div>
              </div>
            </div>

            {/* Operations & Compliance Review */}
            <div>
              <h3 className="!text-lg font-semibold text-gray-900 mb-3">{t("form.review.operationsCompliance")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><strong>Company Name:</strong> {formData.operationsCompliance?.companyName}</div>
                <div><strong>Business License:</strong> {formData.operationsCompliance?.businessLicense}</div>
                <div><strong>EPC Contractor:</strong> {formData.operationsCompliance?.epcContractorName}</div>
                <div><strong>Government Filing:</strong> {formData.operationsCompliance?.governmentFiling}</div>
                <div><strong>Operating Entity:</strong> {formData.operationsCompliance?.operatingEntity}</div>
                <div><strong>Tier:</strong> {formData.operationsCompliance?.tier}</div>
              </div>
            </div>

            {/* Tier Data Review */}
            {formData.operationsCompliance?.tier === "Orchard Data" && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{t("form.review.orchardData")}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div><strong>Planting Area:</strong> {(formData.tierData as z.infer<typeof orchardDataSchema>)?.plantingArea}</div>
                  <div><strong>Number of Trees:</strong> {(formData.tierData as z.infer<typeof orchardDataSchema>)?.numberOfTrees}</div>
                  <div><strong>Age:</strong> {(formData.tierData as z.infer<typeof orchardDataSchema>)?.age}</div>
                  <div><strong>Variety:</strong> {(formData.tierData as z.infer<typeof orchardDataSchema>)?.variety}</div>
                  <div><strong>Row Spacing:</strong> {(formData.tierData as z.infer<typeof orchardDataSchema>)?.rowSpacing}</div>
                  <div><strong>Tree Density:</strong> {(formData.tierData as z.infer<typeof orchardDataSchema>)?.treeDensity}</div>
                  <div><strong>Annual Yield:</strong> {(formData.tierData as z.infer<typeof orchardDataSchema>)?.annualYield}</div>
                  <div><strong>Last 3 Years Yield:</strong> {(formData.tierData as z.infer<typeof orchardDataSchema>)?.lastThreeYearsYield}</div>
                  <div><strong>Monitoring System:</strong> {(formData.tierData as z.infer<typeof orchardDataSchema>)?.monitoringSystem ? "Yes" : "No"}</div>
                  {(formData.tierData as z.infer<typeof orchardDataSchema>)?.monitoringSystem && (
                    <div><strong>Device ID:</strong> {(formData.tierData as z.infer<typeof orchardDataSchema>)?.deviceId}</div>
                  )}
                  <div className="sm:col-span-2"><strong>Orchard Product Sales Revenue:</strong> {(formData.tierData as z.infer<typeof orchardDataSchema>)?.orchardProductSalesRevenueFile ? (formData.tierData as z.infer<typeof orchardDataSchema>)?.orchardProductSalesRevenueFile?.name : "No file uploaded"}</div>
                </div>
              </div>
            )}

            {formData.operationsCompliance?.tier === "Solar Data" && (
              <div>
                <h3 className="!text-lg font-semibold text-gray-900 mb-3">{t("form.review.solarData")}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div><strong>Installed Capacity:</strong> {(formData.tierData as z.infer<typeof solarDataSchema>)?.installedCapacity}</div>
                  <div><strong>PV Module Model:</strong> {(formData.tierData as z.infer<typeof solarDataSchema>)?.pvModuleModel}</div>
                  <div><strong>Manufacturer:</strong> {(formData.tierData as z.infer<typeof solarDataSchema>)?.manufacturer}</div>
                  <div><strong>Installation Date:</strong> {(formData.tierData as z.infer<typeof solarDataSchema>)?.installationDate}</div>
                  <div><strong>Grid Connection Permit ID:</strong> {(formData.tierData as z.infer<typeof solarDataSchema>)?.gridConnectionPermitId}</div>
                  <div><strong>Grid Company:</strong> {(formData.tierData as z.infer<typeof solarDataSchema>)?.gridCompany}</div>
                  <div><strong>Average Annual Power Generation:</strong> {(formData.tierData as z.infer<typeof solarDataSchema>)?.averageAnnualPowerGeneration}</div>
                  <div><strong>Tariff/PPA Contract ID:</strong> {(formData.tierData as z.infer<typeof solarDataSchema>)?.tariffPpaContractId}</div>
                  <div className="sm:col-span-2"><strong>Solar Electricity Sales Revenue:</strong> {(formData.tierData as z.infer<typeof solarDataSchema>)?.solarElectricitySalesRevenueFile ? (formData.tierData as z.infer<typeof solarDataSchema>)?.solarElectricitySalesRevenueFile?.name : "No file uploaded"}</div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col space-y-4 mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsReviewMode(false)}
              className="w-full text-black"
            >
{t("form.review.backToEdit")}
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn-primary w-full"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {t("common.submitting")}
                </div>
              ) : (
                t("form.review.submitRegistration")
              )}
            </Button>
          </div>
        </div>
      );
    }

    switch (currentStep) {
      case 1:
        return (
          <FormSection title={t("form.basicData.title")}>
            <form className="space-y-6">
              {/* Project Name and Land Parcel ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ValidatedInput
                  label={t("form.basicData.projectName")}
                  error={basicForm.formState.errors.projectName?.message}
                  validationRules={{ required: true, minLength: 1 }}
                  value={basicForm.watch("projectName") || ""}
                  onChange={(e) => basicForm.setValue("projectName", e.target.value)}
                />
                <ValidatedInput
                  label={t("form.basicData.landParcelId")}
                  error={basicForm.formState.errors.landParcelId?.message}
                  validationRules={{ required: true, minLength: 1 }}
                  value={basicForm.watch("landParcelId") || ""}
                  onChange={(e) => basicForm.setValue("landParcelId", e.target.value)}
                />
              </div>
              {/* Location Selection */}
              <LocationPicker
                label="Location"
                onLocationSelect={(location) => {
                  // Set all location values with fallbacks for empty fields
                  const latitude = location.latitude || "";
                  const longitude = location.longitude || "";
                  const county = location.county || location.city || "Unknown";
                  const city = location.city || location.province || "Unknown";
                  const province = location.province || "Unknown";
                  
                  // Ensure no empty strings - replace with fallbacks
                  const finalCounty = county.trim() === "" ? "Unknown" : county;
                  const finalCity = city.trim() === "" ? (location.province || "Unknown") : city;
                  const finalProvince = province.trim() === "" ? "Unknown" : province;
                  
                  basicForm.setValue("latitude", latitude, { shouldValidate: true });
                  basicForm.setValue("longitude", longitude, { shouldValidate: true });
                  basicForm.setValue("county", finalCounty, { shouldValidate: true });
                  basicForm.setValue("city", finalCity, { shouldValidate: true });
                  basicForm.setValue("province", finalProvince, { shouldValidate: true });
                }}
                initialLocation={{
                  latitude: basicForm.watch("latitude"),
                  longitude: basicForm.watch("longitude"),
                  county: basicForm.watch("county"),
                  city: basicForm.watch("city"),
                  province: basicForm.watch("province"),
                }}
                error={
                  basicForm.formState.errors.latitude?.message ||
                  basicForm.formState.errors.longitude?.message ||
                  basicForm.formState.errors.county?.message ||
                  basicForm.formState.errors.city?.message ||
                  basicForm.formState.errors.province?.message
                }
              />
              

              {/* Land Type */}
              <OptionSelector
                label={t("form.basicData.landType")}
                options={[
                  t("form.basicData.landTypeOptions.orchard"),
                  t("form.basicData.landTypeOptions.farmland"),
                  t("form.basicData.landTypeOptions.facilityAgriculture")
                ]}
                selected={basicForm.watch("landType")}
                onSelect={(value) => basicForm.setValue("landType", value)}
                columns={3}
                error={basicForm.formState.errors.landType?.message}
              />

              {/* Land Ownership Proof */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <ValidatedInput
                  label={t("form.basicData.leaseContractId")}
                  error={basicForm.formState.errors.leaseContractId?.message}
                  validationRules={{ required: true, minLength: 1 }}
                  value={basicForm.watch("leaseContractId") || ""}
                  onChange={(e) => basicForm.setValue("leaseContractId", e.target.value)}
                />
                <DurationInput
                  label={t("form.basicData.duration")}
                  error={basicForm.formState.errors.duration?.message}
                  value={basicForm.watch("duration") || ""}
                  onChange={(value) => basicForm.setValue("duration", value)}
                />
                <ValidatedInput
                  label={t("form.basicData.owner")}
                  error={basicForm.formState.errors.owner?.message}
                  validationRules={{ required: true, minLength: 1 }}
                  value={basicForm.watch("owner") || ""}
                  onChange={(e) => basicForm.setValue("owner", e.target.value)}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    onClick={handleBack}
                    variant="outline"
                    className="flex-1"
                  >
                    {t("common.back")}
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handleNext}
                  className="btn-primary flex-1"
                >
{t("common.next")}
                </Button>
              </div>
            </form>
          </FormSection>
        );

      case 2:
        return (
          <FormSection title={t("form.financialData.title")}>
            <form className="space-y-6">
              <ValidatedInput
                label={t("form.financialData.unitInvestmentCost")}
                error={financialForm.formState.errors.unitInvestmentCost?.message}
                validationRules={{ required: true, minLength: 1 }}
                value={financialForm.watch("unitInvestmentCost") || ""}
                onChange={(e) => financialForm.setValue("unitInvestmentCost", e.target.value)}
              />
              <ValidatedInput
                label={t("form.financialData.annualCashFlowBreakdown")}
                error={financialForm.formState.errors.annualCashFlowBreakdown?.message}
                validationRules={{ required: true, minLength: 1 }}
                value={financialForm.watch("annualCashFlowBreakdown") || ""}
                onChange={(e) => financialForm.setValue("annualCashFlowBreakdown", e.target.value)}
              />
              <FileUpload
                label=""
                onFileSelect={(file) => setOtherSubsidiesFile(file || undefined)}
                selectedFile={otherSubsidiesFile || null}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                placeholder={t("form.financialData.otherSubsidies")}
              />
              <ValidatedInput
                label={t("form.financialData.annualizedIRR")}
                error={financialForm.formState.errors.annualizedIRR?.message}
                validationRules={{ required: true, minLength: 1 }}
                value={financialForm.watch("annualizedIRR") || ""}
                onChange={(e) => financialForm.setValue("annualizedIRR", e.target.value)}
              />

              <div className="flex flex-col sm:flex-row gap-4">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    onClick={handleBack}
                    variant="outline"
                    className="flex-1"
                  >
                    {t("common.back")}
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handleNext}
                  className="btn-primary flex-1"
                >
{t("common.next")}
                </Button>
              </div>
            </form>
          </FormSection>
        );

      case 3:
        return (
          <FormSection title={t("form.operationsCompliance.title")}>
            <form className="space-y-6">
              {/* Company Name and Business License */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ValidatedInput
                  label={t("form.operationsCompliance.companyName")}
                  error={operationsForm.formState.errors.companyName?.message}
                  validationRules={{ required: true, minLength: 1 }}
                  value={operationsForm.watch("companyName") || ""}
                  onChange={(e) => operationsForm.setValue("companyName", e.target.value)}
                />
                <ValidatedInput
                  label={t("form.operationsCompliance.businessLicense")}
                  error={operationsForm.formState.errors.businessLicense?.message}
                  validationRules={{ required: true, minLength: 1 }}
                  value={operationsForm.watch("businessLicense") || ""}
                  onChange={(e) => operationsForm.setValue("businessLicense", e.target.value)}
                />
              </div>

              <ValidatedInput
                label={t("form.operationsCompliance.epcContractorName")}
                error={operationsForm.formState.errors.epcContractorName?.message}
                validationRules={{ required: true, minLength: 1 }}
                value={operationsForm.watch("epcContractorName") || ""}
                onChange={(e) => operationsForm.setValue("epcContractorName", e.target.value)}
              />

              {/* Government Filing */}
              <OptionSelector
                label={t("form.operationsCompliance.governmentFiling")}
                options={[
                  t("form.operationsCompliance.governmentFilingOptions.ndrc"),
                  t("form.operationsCompliance.governmentFilingOptions.energyBureau"),
                  t("form.operationsCompliance.governmentFilingOptions.agricultureBureau")
                ]}
                selected={operationsForm.watch("governmentFiling")}
                onSelect={(value) => operationsForm.setValue("governmentFiling", value)}
                columns={3}
                error={operationsForm.formState.errors.governmentFiling?.message}
              />

              {/* Operating Entity */}
              <OptionSelector
                label={t("form.operationsCompliance.operatingEntity")}
                options={[
                  t("form.operationsCompliance.operatingEntityOptions.agricultureInsurance"),
                  t("form.operationsCompliance.operatingEntityOptions.solarPlantInsurance")
                ]}
                selected={operationsForm.watch("operatingEntity")}
                onSelect={(value) => operationsForm.setValue("operatingEntity", value)}
                columns={2}
                error={operationsForm.formState.errors.operatingEntity?.message}
              />

              {/* Tier Selection */}
              <OptionSelector
                label={t("form.operationsCompliance.tier")}
                options={[
                  t("form.operationsCompliance.tierOptions.orchardData"),
                  t("form.operationsCompliance.tierOptions.solarData")
                ]}
                selected={operationsForm.watch("tier")}
                onSelect={(value) => operationsForm.setValue("tier", value)}
                columns={2}
                error={operationsForm.formState.errors.tier?.message}
              />

              <div className="flex flex-col sm:flex-row gap-4">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    onClick={handleBack}
                    variant="outline"
                    className="flex-1"
                  >
                    {t("common.back")}
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={handleNext}
                  className="btn-primary flex-1"
                >
{t("common.next")}
                </Button>
              </div>
            </form>
          </FormSection>
        );

      case 4:
        const tier = operationsForm.watch("tier");
        
        if (tier === "Orchard Data") {
          return (
            <FormSection title={t("form.orchardData.title")}>
              <form className="space-y-6">
                <ValidatedInput
                  label={t("form.orchardData.plantingArea")}
                  error={orchardForm.formState.errors.plantingArea?.message}
                  validationRules={{ required: true, minLength: 1 }}
                  value={orchardForm.watch("plantingArea") || ""}
                  onChange={(e) => orchardForm.setValue("plantingArea", e.target.value)}
                />

                {/* Number of Trees, Age, Variety */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <ValidatedInput
                    label={t("form.orchardData.numberOfTrees")}
                    error={orchardForm.formState.errors.numberOfTrees?.message}
                    validationRules={{ required: true, minLength: 1 }}
                    value={orchardForm.watch("numberOfTrees") || ""}
                    onChange={(e) => orchardForm.setValue("numberOfTrees", e.target.value)}
                  />
                  <ValidatedInput
                    label={t("form.orchardData.age")}
                    error={orchardForm.formState.errors.age?.message}
                    validationRules={{ required: true, minLength: 1 }}
                    value={orchardForm.watch("age") || ""}
                    onChange={(e) => orchardForm.setValue("age", e.target.value)}
                  />
                  <ValidatedInput
                    label={t("form.orchardData.variety")}
                    error={orchardForm.formState.errors.variety?.message}
                    validationRules={{ required: true, minLength: 1 }}
                    value={orchardForm.watch("variety") || ""}
                    onChange={(e) => orchardForm.setValue("variety", e.target.value)}
                  />
                </div>

                {/* Planting Density */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-white">{t("form.orchardData.plantingDensity")}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ValidatedInput
                      label={t("form.orchardData.rowSpacing")}
                      error={orchardForm.formState.errors.rowSpacing?.message}
                      validationRules={{ required: true, minLength: 1 }}
                      value={orchardForm.watch("rowSpacing") || ""}
                      onChange={(e) => orchardForm.setValue("rowSpacing", e.target.value)}
                    />
                    <ValidatedInput
                      label={t("form.orchardData.treeDensity")}
                      error={orchardForm.formState.errors.treeDensity?.message}
                      validationRules={{ required: true, minLength: 1 }}
                      value={orchardForm.watch("treeDensity") || ""}
                      onChange={(e) => orchardForm.setValue("treeDensity", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <ValidatedInput
                      label={t("form.orchardData.annualYield")}
                      error={orchardForm.formState.errors.annualYield?.message}
                      validationRules={{ required: true, minLength: 1 }}
                      value={orchardForm.watch("annualYield") || ""}
                      onChange={(e) => orchardForm.setValue("annualYield", e.target.value)}
                    />
                    <ValidatedInput
                      label={t("form.orchardData.lastThreeYearsYield")}
                      error={orchardForm.formState.errors.lastThreeYearsYield?.message}
                      validationRules={{ required: true, minLength: 1 }}
                      value={orchardForm.watch("lastThreeYearsYield") || ""}
                      onChange={(e) => orchardForm.setValue("lastThreeYearsYield", e.target.value)}
                    />
                  </div>
                </div>

                {/* Monitoring System */}
                <div className="space-y-3">
                  <YesNoToggle
                    label={t("form.orchardData.monitoringSystem")}
                    value={orchardForm.watch("monitoringSystem")}
                    onChange={(value) => orchardForm.setValue("monitoringSystem", value)}
                  />
                  {orchardForm.watch("monitoringSystem") && (
                    <ValidatedInput
                      label={t("form.orchardData.deviceId")}
                      validationRules={{ required: false }}
                      value={orchardForm.watch("deviceId") || ""}
                      onChange={(e) => orchardForm.setValue("deviceId", e.target.value)}
                    />
                  )}
                </div>

                <FileUpload
                  label=""
                  onFileSelect={(file) => setOrchardProductSalesRevenueFile(file || undefined)}
                  selectedFile={orchardProductSalesRevenueFile || null}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  placeholder={t("form.orchardData.orchardProductSalesRevenue")}
                />

                <div className="flex flex-col sm:flex-row gap-4">
                  {currentStep > 1 && (
                    <Button
                      type="button"
                      onClick={handleBack}
                      variant="outline"
                      className="flex-1"
                    >
                      {t("common.back")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={handleReview}
                    className="btn-primary flex-1"
                  >
{t("common.review")}
                  </Button>
                </div>
              </form>
            </FormSection>
          );
        } else if (tier === "Solar Data") {
          return (
            <FormSection title={t("form.solarData.title")}>
              <form className="space-y-6">
                <ValidatedInput
                  label={t("form.solarData.installedCapacity")}
                  error={solarForm.formState.errors.installedCapacity?.message}
                  validationRules={{ required: true, minLength: 1 }}
                  value={solarForm.watch("installedCapacity") || ""}
                  onChange={(e) => solarForm.setValue("installedCapacity", e.target.value)}
                />

                {/* PV Module Model, Manufacturer, Installation Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <ValidatedInput
                    label={t("form.solarData.pvModuleModel")}
                    error={solarForm.formState.errors.pvModuleModel?.message}
                    validationRules={{ required: true, minLength: 1 }}
                    value={solarForm.watch("pvModuleModel") || ""}
                    onChange={(e) => solarForm.setValue("pvModuleModel", e.target.value)}
                  />
                  <ValidatedInput
                    label={t("form.solarData.manufacturer")}
                    error={solarForm.formState.errors.manufacturer?.message}
                    validationRules={{ required: true, minLength: 1 }}
                    value={solarForm.watch("manufacturer") || ""}
                    onChange={(e) => solarForm.setValue("manufacturer", e.target.value)}
                  />
                  <ValidatedInput
                    label={t("form.solarData.installationDate")}
                    error={solarForm.formState.errors.installationDate?.message}
                    validationRules={{ required: true, minLength: 1 }}
                    value={solarForm.watch("installationDate") || ""}
                    onChange={(e) => solarForm.setValue("installationDate", e.target.value)}
                  />
                </div>

                {/* Grid Connection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ValidatedInput
                    label={t("form.solarData.gridConnectionPermitId")}
                    error={solarForm.formState.errors.gridConnectionPermitId?.message}
                    validationRules={{ required: true, minLength: 1 }}
                    value={solarForm.watch("gridConnectionPermitId") || ""}
                    onChange={(e) => solarForm.setValue("gridConnectionPermitId", e.target.value)}
                  />
                  <ValidatedInput
                    label={t("form.solarData.gridCompany")}
                    error={solarForm.formState.errors.gridCompany?.message}
                    validationRules={{ required: true, minLength: 1 }}
                    value={solarForm.watch("gridCompany") || ""}
                    onChange={(e) => solarForm.setValue("gridCompany", e.target.value)}
                  />
                </div>

                <ValidatedInput
                  label={t("form.solarData.averageAnnualPowerGeneration")}
                  error={solarForm.formState.errors.averageAnnualPowerGeneration?.message}
                  validationRules={{ required: true, minLength: 1 }}
                  value={solarForm.watch("averageAnnualPowerGeneration") || ""}
                  onChange={(e) => solarForm.setValue("averageAnnualPowerGeneration", e.target.value)}
                />

                <ValidatedInput
                  label={t("form.solarData.tariffPpaContractId")}
                  error={solarForm.formState.errors.tariffPpaContractId?.message}
                  validationRules={{ required: true, minLength: 1 }}
                  value={solarForm.watch("tariffPpaContractId") || ""}
                  onChange={(e) => solarForm.setValue("tariffPpaContractId", e.target.value)}
                />

                <FileUpload
                  label=""
                  onFileSelect={(file) => setSolarElectricitySalesRevenueFile(file || undefined)}
                  selectedFile={solarElectricitySalesRevenueFile || null}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  placeholder={t("form.solarData.solarElectricitySalesRevenue")}
                />
                
                <div className="flex flex-col sm:flex-row gap-4">
                  {currentStep > 1 && (
                    <Button
                      type="button"
                      onClick={handleBack}
                      variant="outline"
                      className="flex-1"
                    >
                      {t("common.back")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={handleReview}
                    className="btn-primary flex-1"
                  >
{t("common.review")}
                  </Button>
                </div>
              </form>
            </FormSection>
          );
        }
        return null;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/background.png')" }}>
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <AssetFormHeader />
        
        <div className="max-w-4xl mx-auto">
          <StepIndicator
            currentStep={currentStep}
            totalSteps={steps.length}
            steps={steps}
          />
          
          <div className="glass rounded-lg p-4 sm:p-8 shadow-lg">
            <h1 className="!text-xl sm:!text-2xl font-bold text-white mb-6 sm:mb-8 text-center">
              {t("form.title")}
            </h1>
            {renderStep()}
          </div>
        </div>
      </div>
      
      <AssetFormFooter />
    </div>
  );
}
