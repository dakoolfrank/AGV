import React from "react";
import Image from "next/image";
interface ValueCardProps {
  icon: string;
  title: string;
  description: string;
}

export const ValueCard: React.FC<ValueCardProps> = ({ icon: Icon, title, description }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 sm:gap-6 lg:gap-8 p-4 sm:p-6 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300 h-full">
      {/* Icon Circle */}
      <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 border-2 border-[#223256] rounded-full flex items-center justify-center">
        <Image src={Icon} alt={title} width={20} height={20} className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>
      
      {/* Content */}
      <div className="flex-1 space-y-1 sm:space-y-2 text-center">
        <h3 className="text-base sm:text-lg font-bold text-[#223256]">{title}</h3>
        <p className="text-xs sm:text-sm text-[#223256] leading-relaxed">{description}</p>
      </div>
    </div>
  );
};
