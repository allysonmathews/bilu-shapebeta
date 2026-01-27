import React from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';

interface SwapButtonProps {
  onClick: () => void;
  className?: string;
  isLoading?: boolean;
}

export const SwapButton: React.FC<SwapButtonProps> = ({ onClick, className = '', isLoading = false }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={`
        p-2 rounded-full bg-bilu-purple text-white hover:bg-[#8A00E6]
        transition-all duration-200 active:scale-90
        disabled:opacity-70 disabled:cursor-not-allowed
        ${className}
      `}
      title="Trocar exercício"
    >
      {isLoading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <RefreshCw size={16} />
      )}
    </button>
  );
};
