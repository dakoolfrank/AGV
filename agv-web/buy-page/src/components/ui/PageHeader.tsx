'use client';

interface PageHeaderProps {
  title: string;
  description: string;
  className?: string;
}

export function PageHeader({ title, description, className = '' }: PageHeaderProps) {
  return (
    <div className={`text-center mb-8 sm:mb-10 md:mb-12 px-4 ${className}`}>
      <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6 animate-fade-in-up">
        {title}
      </h1>
      <p className="text-base sm:text-lg md:text-xl text-blue-200 mb-6 sm:mb-8 animate-fade-in-up-delay">
        {description}
      </p>
    </div>
  );
}

