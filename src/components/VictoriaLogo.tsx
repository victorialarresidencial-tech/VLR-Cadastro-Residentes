import React from 'react';

interface VictoriaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'full' | 'compact';
}

export const OFFICIAL_LOGO_PATH = '/assets/aistudio/image_d44b11c8.png';

export const VictoriaLogo: React.FC<VictoriaLogoProps> = ({
  size = 'md',
  className = '',
}) => {
  const heightClasses = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-12',
    lg: 'h-14 sm:h-16',
    xl: 'h-20 sm:h-24',
  }[size];

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <img
        src={OFFICIAL_LOGO_PATH}
        alt="Victoria Lar Residencial"
        className={`${heightClasses} w-auto object-contain rounded-lg shadow-xs transition-transform hover:scale-[1.01]`}
        loading="eager"
      />
    </div>
  );
};
