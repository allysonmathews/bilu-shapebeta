import React from 'react';
import { Loader2 } from 'lucide-react';

interface NeonSpinnerProps {
  size?: number;
  className?: string;
}

/** Spinner estilo Neon (Verde Limão) para feedback de carregamento. */
export const NeonSpinner: React.FC<NeonSpinnerProps> = ({ size = 28, className = '' }) => {
  return (
    <Loader2
      size={size}
      className={`animate-spin text-alien-green ${className}`}
      style={{
        filter: 'drop-shadow(0 0 6px #39FF14) drop-shadow(0 0 12px rgba(57, 255, 20, 0.6))',
      }}
      aria-hidden
    />
  );
};
