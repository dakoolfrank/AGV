"use client";

import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, children, className }: FormSectionProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <h2 className="!text-xl font-bold text-white mb-6">{title}</h2>
      {children}
    </div>
  );
}
