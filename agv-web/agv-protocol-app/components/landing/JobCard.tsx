import React from "react";
import { LucideIcon, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/hooks/useTranslations";

interface JobCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onReadMore: () => void;
}

export const JobCard: React.FC<JobCardProps> = ({ icon: Icon, title, description, onReadMore }) => {
  const { t } = useTranslations();
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
      {/* Icon Circle */}
      <div className="w-12 h-12 bg-[#3399FF] rounded-full flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-white" />
      </div>
      
      {/* Content */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-[#223256]">{title}</h3>
        <p className="text-sm text-[#223256] leading-relaxed">{description}</p>
        
        {/* Read More Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onReadMore}
          className="p-0 h-auto text-[#223256] hover:text-[#223256]/80 font-medium flex items-center space-x-1 transition-colors duration-300"
        >
          <span>{t('common.readMore') || 'Read more'}</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
