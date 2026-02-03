import React from 'react';
import { NotificationCenter } from './NotificationCenter';

interface AppHeaderProps {
  userId: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ userId }) => {
  return (
    <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-12 flex items-center justify-between px-4 bg-deep-bg/95 backdrop-blur-sm border-b border-gray-800 z-40">
      <span className="text-alien-green font-bold text-lg tracking-tight">Bilu Shape</span>
      <NotificationCenter userId={userId} />
    </header>
  );
};
