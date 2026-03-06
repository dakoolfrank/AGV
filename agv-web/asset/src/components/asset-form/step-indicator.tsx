"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

export function StepIndicator({ currentStep, totalSteps, steps }: StepIndicatorProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between mb-4 relative">
        {/* Connecting line */}
        <div className="absolute top-4 left-8 right-8 h-0.5 bg-white/30 -z-10"></div>
        
        {steps.map((step, index) => (
          <div
            key={index}
            className="flex flex-col items-center relative z-10"
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mb-2 transition-all duration-300",
                index < currentStep && "bg-white text-primary",
                index === currentStep - 1 && "bg-white text-primary",
                index > currentStep - 1 && "bg-transparent text-white border-2 border-white"
              )}
            >
              {index + 1}
            </div>
            <span className="text-xs text-center text-white/80 max-w-20">{step}</span>
          </div>
        ))}
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}
