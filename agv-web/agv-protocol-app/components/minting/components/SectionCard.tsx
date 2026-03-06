import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  icon: LucideIcon;
  iconBg?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  icon: Icon,
  iconBg = "bg-blue-500",
  title,
  description,
  children,
  className,
}) => {
  return (
    <div className={cn(
      "bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-6",
      className
    )}>
      <div className="flex items-center space-x-2 sm:space-x-3 mb-3 sm:mb-4">
        <div className={cn("p-1.5 sm:p-2 rounded-lg shadow-lg", iconBg)}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-white">{title}</h3>
          {description && (
            <p className="text-xs sm:text-sm text-white/70">{description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
};
