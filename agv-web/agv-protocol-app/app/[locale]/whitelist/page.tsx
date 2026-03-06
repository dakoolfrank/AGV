"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { CheckCircle, Loader2 } from "lucide-react";

// Thirdweb configuration
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

// Form validation schema - flexible schema that works for both KOL and regular users
const whitelistSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  telegramUsername: z.string().min(1, "Telegram username is required"),
  country: z.string().min(2, "Country is required"),
  walletAddress: z.string().min(1, "Wallet address is required"),
  // Optional fields - will be validated in onSubmit function
  hearAbout: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  yourInterest: z.union([z.enum(["airdrop", "presale", "both"]), z.null()]).optional(),
  plannedInvestment: z.union([z.enum(["100-500", "500-1000", "1000-5000", "5000+"]), z.null()]).optional(),
});

type WhitelistFormData = z.infer<typeof whitelistSchema>;

interface KOLProfile {
  email: string;
  name: string;
  walletAddress?: string;
}

const HEAR_ABOUT_OPTIONS = [
  "Twitter / X",
  "Telegram Group", 
  "Airdrop Website (e.g., AirdropAlert)",
  "TaskOn",
  "AGV Official Website",
  "Friend Recommendation",
  "YouTube or Podcast",
  "Discord or Forum",
  "KOL or Influencer",
  "Other"
];

const INTERESTS_OPTIONS = [
  "Real Asset Backing (Agriculture + Solar)",
  "Airdrop Opportunity",
  "Token Pre-sale",
  "ESG / Sustainability",
  "DePIN / Decentralized Infrastructure",
  "NFT Tree Adoption",
  "Team or Ecosystem Backers"
];

export default function WhitelistPage() {
  const account = useActiveAccount();
  const [isKOL, setIsKOL] = useState<boolean>(false);
  const [kolProfile, setKolProfile] = useState<KOLProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingKOL, setIsCheckingKOL] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset
  } = useForm<WhitelistFormData>({
    resolver: zodResolver(whitelistSchema),
    defaultValues: {
      hearAbout: [],
      interests: [],
      yourInterest: null,
      plannedInvestment: null,
    }
  });

  const watchEmail = watch("email");
  const watchHearAbout = watch("hearAbout");
  const watchInterests = watch("interests");
  const watchWalletAddress = watch("walletAddress");
  
  // Debug form state
  useEffect(() => {
    console.log("Form state:", {
      email: watchEmail,
      walletAddress: watchWalletAddress,
      account: account?.address,
      isKOL,
      isSubmitting
    });
  }, [watchEmail, watchWalletAddress, account?.address, isKOL, isSubmitting]);

  const checkKOLStatus = useCallback(async (email: string) => {
    setIsCheckingKOL(true);
    try {
      const response = await fetch(`/api/kol/check?email=${encodeURIComponent(email)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.isKOL) {
          setIsKOL(true);
          setKolProfile(data.profile);
          // Pre-fill form for KOL
          setValue("name", data.profile.name);
          setValue("walletAddress", data.profile.walletAddress || "");
        } else {
          setIsKOL(false);
          setKolProfile(null);
        }
      }
    } catch (error) {
      console.error("Error checking KOL status:", error);
    } finally {
      setIsCheckingKOL(false);
    }
  }, [setValue]);

  // Check KOL status when email changes
  useEffect(() => {
    if (watchEmail && watchEmail.includes("@")) {
      checkKOLStatus(watchEmail);
    }
  }, [watchEmail, checkKOLStatus]);

  // Update wallet address when account changes
  useEffect(() => {
    if (account?.address) {
      setValue("walletAddress", account.address);
      console.log("Wallet address set:", account.address);
    }
  }, [account?.address, setValue]);

  const handleHearAboutChange = (option: string, checked: boolean) => {
    const current = watchHearAbout || [];
    if (checked) {
      setValue("hearAbout", [...current, option]);
    } else {
      setValue("hearAbout", current.filter(item => item !== option));
    }
  };

  const handleInterestsChange = (option: string, checked: boolean) => {
    const current = watchInterests || [];
    if (checked) {
      setValue("interests", [...current, option]);
    } else {
      setValue("interests", current.filter(item => item !== option));
    }
  };

  const onSubmit = async (data: WhitelistFormData) => {
    console.log("Form submitted with data:", data);
    console.log("Is KOL:", isKOL);
    console.log("Account address:", account?.address);
    
    // Custom validation for non-KOL users
    if (!isKOL) {
      if (!data.hearAbout || data.hearAbout.length === 0) {
        toast.error("Please select how you heard about AGV Protocol");
        return;
      }
      if (!data.interests || data.interests.length === 0) {
        toast.error("Please select your interests");
        return;
      }
      if (!data.yourInterest) {
        toast.error("Please select your interest type");
        return;
      }
      if (!data.plannedInvestment) {
        toast.error("Please select your planned investment");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/whitelist/enroll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          walletAddress: account?.address || "",
          isKOL: isKOL,
        }),
      });

      if (response.ok) {
        toast.success("Whitelist application submitted successfully!");
        reset();
        setIsKOL(false);
        setKolProfile(null);
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to submit application");
      }
    } catch (error) {
      console.error("Error submitting application:", error);
      toast.error("Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Join AGV Protocol Whitelist
            </h1>
            <p className="text-xl text-gray-600">
              Be among the first to access our revolutionary agricultural blockchain platform
            </p>
          </div>

          {isKOL && (
            <Alert className="mb-6">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Welcome back! As a KOL, you have a simplified enrollment process.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Whitelist Application</CardTitle>
              <CardDescription>
                {isKOL 
                  ? "Complete your KOL profile information"
                  : "Fill out the form below to join our whitelist"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit, (errors) => {
                console.log("Form validation errors:", errors);
                console.log("Form data:", watch());
              })} className="space-y-6">
                {/* Name */}
                <div>
                  <Label htmlFor="name">Your full name *</Label>
                  <Input
                    id="name"
                    {...register("name")}
                    placeholder="Enter your full name"
                    disabled={isKOL}
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register("email")}
                    placeholder="We'll use this to send updates and confirmations"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                  )}
                  {isCheckingKOL && (
                    <p className="text-blue-500 text-sm mt-1 flex items-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Checking KOL status...
                    </p>
                  )}
                </div>

                {/* Telegram Username */}
                <div>
                  <Label htmlFor="telegramUsername">Telegram Username *</Label>
                  <Input
                    id="telegramUsername"
                    {...register("telegramUsername")}
                    placeholder="e.g. @yourname"
                  />
                  {errors.telegramUsername && (
                    <p className="text-red-500 text-sm mt-1">{errors.telegramUsername.message}</p>
                  )}
                </div>

                {/* Country */}
                <div>
                  <Label htmlFor="country">Country / Region *</Label>
                  <Input
                    id="country"
                    {...register("country")}
                    placeholder="Enter your country"
                    disabled={isKOL}
                  />
                  {errors.country && (
                    <p className="text-red-500 text-sm mt-1">{errors.country.message}</p>
                  )}
                </div>

                {/* How did you hear about AGV? */}
                {!isKOL && (
                  <div>
                    <Label>How did you hear about AGV Protocol? *</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      {HEAR_ABOUT_OPTIONS.map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <Checkbox
                            id={`hear-${option}`}
                            checked={watchHearAbout?.includes(option) || false}
                            onCheckedChange={(checked) => 
                              handleHearAboutChange(option, checked as boolean)
                            }
                          />
                          <Label htmlFor={`hear-${option}`} className="text-sm">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {errors.hearAbout && (
                      <p className="text-red-500 text-sm mt-1">{errors.hearAbout.message}</p>
                    )}
                  </div>
                )}

                {/* What interests you most? */}
                {!isKOL && (
                  <div>
                    <Label>What interests you most about AGV? *</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      {INTERESTS_OPTIONS.map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <Checkbox
                            id={`interest-${option}`}
                            checked={watchInterests?.includes(option) || false}
                            onCheckedChange={(checked) => 
                              handleInterestsChange(option, checked as boolean)
                            }
                          />
                          <Label htmlFor={`interest-${option}`} className="text-sm">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {errors.interests && (
                      <p className="text-red-500 text-sm mt-1">{errors.interests.message}</p>
                    )}
                  </div>
                )}

                {/* Your Interest */}
                {!isKOL && (
                  <div>
                    <Label>Your Interest *</Label>
                    <div className="space-y-2 mt-2">
                      {[
                        { value: "airdrop", label: "Airdrop only" },
                        { value: "presale", label: "Pre-sale only" },
                        { value: "both", label: "Both" }
                      ].map((option) => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id={`interest-${option.value}`}
                            value={option.value}
                            {...register("yourInterest")}
                            className="h-4 w-4"
                          />
                          <Label htmlFor={`interest-${option.value}`}>
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {errors.yourInterest && (
                      <p className="text-red-500 text-sm mt-1">{errors.yourInterest.message}</p>
                    )}
                  </div>
                )}

                {/* Planned Investment */}
                {!isKOL && (
                  <div>
                    <Label>Planned Pre-sale Investment *</Label>
                    <div className="space-y-2 mt-2">
                      {[
                        { value: "100-500", label: "$100 – $500" },
                        { value: "500-1000", label: "$500 – $1,000" },
                        { value: "1000-5000", label: "$1,000 – $5,000" },
                        { value: "5000+", label: "$5,000+" }
                      ].map((option) => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id={`investment-${option.value}`}
                            value={option.value}
                            {...register("plannedInvestment")}
                            className="h-4 w-4"
                          />
                          <Label htmlFor={`investment-${option.value}`}>
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {errors.plannedInvestment && (
                      <p className="text-red-500 text-sm mt-1">{errors.plannedInvestment.message}</p>
                    )}
                  </div>
                )}

                {/* Wallet Connection */}
                <div>
                  <Label>Wallet Address *</Label>
                  {!account ? (
                    <div className="mt-2">
                      <ConnectButton client={client} />
                    </div>
                  ) : (
                    <div className="mt-2">
                      <div className="flex items-center space-x-2">
                        <Input
                          value={account.address}
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                      <p className="text-sm text-green-600 mt-1 flex items-center">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Wallet connected successfully
                      </p>
                    </div>
                  )}
                  {errors.walletAddress && (
                    <p className="text-red-500 text-sm mt-1">{errors.walletAddress.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || !account?.address}
                  onClick={() => {
                    console.log("Submit button clicked!");
                    console.log("Account:", account);
                    console.log("Is submitting:", isSubmitting);
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
}
