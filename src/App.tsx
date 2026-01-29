import React, { useCallback, useState } from 'react';
import { UserProvider, useUser } from './context/UserContext';
import { PlanProvider, usePlan } from './context/PlanContext';
import { ProgressProvider } from './context/ProgressContext';
import { Login } from './views/Login';
import { Onboarding } from './views/Onboarding';
import { DailyJournal } from './views/DailyJournal';
import { WorkoutView } from './views/WorkoutView';
import { DietView } from './views/DietView';
import { EvolutionView } from './views/EvolutionView';
import { ProfileView } from './views/ProfileView';
import { Navigation } from './components/Navigation';
import { PullToRefresh } from './components/PullToRefresh';

const AppContent: React.FC = () => {
  const { user, onboardingData, setPlan } = useUser();
  const { generatePlan } = usePlan();
  const [currentTab, setCurrentTab] = useState('diario');

  const handleRefresh = useCallback(async () => {
    if (!onboardingData) return;
    await new Promise((r) => setTimeout(r, 280));
    const newPlan = generatePlan(onboardingData);
    setPlan(newPlan);
    // Não altera ProgressContext: pesos e histórico do dia atual permanecem.
  }, [onboardingData, generatePlan, setPlan]);

  const usePullToRefresh = currentTab === 'treino' || currentTab === 'dieta';

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
      {usePullToRefresh ? (
        <PullToRefresh onRefresh={handleRefresh} className="h-full pb-16">
          {renderCurrentView()}
        </PullToRefresh>
      ) : (
        <div className="h-full overflow-y-auto pb-16">
          {renderCurrentView()}
        </div>
      )}
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
