import React, { useState } from 'react';
import { UserProvider, useUser } from './context/UserContext';
import { PlanProvider } from './context/PlanContext';
import { ProgressProvider } from './context/ProgressContext';
import { Login } from './views/Login';
import { Onboarding } from './views/Onboarding';
import { DailyJournal } from './views/DailyJournal';
import { WorkoutView } from './views/WorkoutView';
import { DietView } from './views/DietView';
import { EvolutionView } from './views/EvolutionView';
import { ProfileView } from './views/ProfileView';
import { Navigation } from './components/Navigation';

const AppContent: React.FC = () => {
  const { user, onboardingData } = useUser();
  const [currentTab, setCurrentTab] = useState('diario');

  // Se não está autenticado, mostrar Login
  if (!user.isAuthenticated) {
    return <Login />;
  }

  // Se não completou onboarding, mostrar Onboarding
  if (!user.onboardingCompleted || !onboardingData) {
    return <Onboarding />;
  }

  // App principal com navegação
  const renderCurrentView = () => {
    switch (currentTab) {
      case 'diario':
        return <DailyJournal />;
      case 'treino':
        return <WorkoutView />;
      case 'dieta':
        return <DietView />;
      case 'evolucao':
        return <EvolutionView />;
      case 'perfil':
        return <ProfileView />;
      default:
        return <DailyJournal />;
    }
  };

  return (
    <div className="max-w-md mx-auto h-screen overflow-hidden border-x border-gray-800 relative bg-deep-bg">
      <div className="h-full overflow-y-auto pb-16">
        {renderCurrentView()}
      </div>
      <Navigation currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <UserProvider>
      <PlanProvider>
        <ProgressProvider>
          <AppContent />
        </ProgressProvider>
      </PlanProvider>
    </UserProvider>
  );
};

export default App;
