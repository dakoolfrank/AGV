'use client';

import { CheckCircledIcon, ClockIcon } from '@radix-ui/react-icons';

export type StepStatus = 'completed' | 'current' | 'upcoming' | 'disabled';

interface Step {
  id: number;
  title: string;
  description: string;
  status: StepStatus;
}

interface ClaimStepperProps {
  steps: Step[];
}

export function ClaimStepper({ steps }: ClaimStepperProps) {
  return (
    <div className="w-full mb-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-0">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1 w-full md:w-auto">
            {/* Step Circle */}
            <div className="flex flex-col items-center flex-1 md:flex-initial">
              <div
                className={`relative flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300 ${
                  step.status === 'completed'
                    ? 'bg-green-500 border-green-500 text-white'
                    : step.status === 'current'
                    ? 'bg-blue-500 border-blue-500 text-white ring-4 ring-blue-500/30'
                    : step.status === 'upcoming'
                    ? 'bg-slate-700 border-slate-600 text-slate-400'
                    : 'bg-slate-800 border-slate-700 text-slate-500'
                }`}
              >
                {step.status === 'completed' ? (
                  <CheckCircledIcon className="w-6 h-6" />
                ) : step.status === 'current' ? (
                  <ClockIcon className="w-6 h-6 animate-pulse" />
                ) : (
                  <span className="text-sm font-bold">{step.id}</span>
                )}
              </div>
              
              {/* Step Info */}
              <div className="mt-2 text-center w-full md:w-auto">
                <h3
                  className={`text-sm font-semibold mb-1 ${
                    step.status === 'completed'
                      ? 'text-green-400'
                      : step.status === 'current'
                      ? 'text-blue-400'
                      : step.status === 'upcoming'
                      ? 'text-slate-400'
                      : 'text-slate-500'
                  }`}
                >
                  {step.title}
                </h3>
                <p
                  className={`text-xs ${
                    step.status === 'completed'
                      ? 'text-green-300/70'
                      : step.status === 'current'
                      ? 'text-blue-300/70'
                      : step.status === 'upcoming'
                      ? 'text-slate-400/70'
                      : 'text-slate-500/70'
                  }`}
                >
                  {step.description}
                </p>
              </div>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={`hidden md:block flex-1 h-0.5 mx-4 transition-all duration-300 ${
                  step.status === 'completed'
                    ? 'bg-green-500'
                    : step.status === 'current'
                    ? 'bg-gradient-to-r from-green-500 to-slate-600'
                    : 'bg-slate-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

