import React from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-alien-green mb-1">
          {label}
        </label>
      )}
      <textarea
        className={`
          w-full px-4 py-2 bg-card-bg border border-gray-700 rounded-lg
          text-white placeholder-gray-500 focus:outline-none focus:border-alien-green
          transition-colors duration-200 resize-y min-h-[100px]
          ${error ? 'border-red-500' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};
