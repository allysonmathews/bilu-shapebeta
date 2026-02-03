import React, { useCallback, useState, useEffect } from 'react';
import { UserProvider, useUser } from './context/UserContext';
import { PlanProvider, usePlan } from './context/PlanContext';
import { ProgressProvider } from './context/ProgressContext';
import { Login } from './views/Login';
import { PreCadastroChat } from './components/PreCadastroChat';
import { DailyJournal } from './views/DailyJournal';
import { WorkoutView } from './views/WorkoutView';
import { DietView } from './views/DietView';
import { EvolutionView } from './views/EvolutionView';
import { ProfileView } from './views/ProfileView';
import { Navigation } from './components/Navigation';
import { AppHeader } from './components/AppHeader';
import { PullToRefresh } from './components/PullToRefresh';
import { NeonSpinner } from './components/ui/NeonSpinner';
import type { OnboardingData } from './types';
import type { ProfileRow } from './lib/supabase';

/** Constrói OnboardingData mínimo a partir do perfil do Supabase (para restaurar aluno em novo dispositivo). */
function buildOnboardingDataFromProfile(profile: ProfileRow): OnboardingData {
  const primary = (profile.objective || 'hypertrophy') as OnboardingData['goals']['primary'];
  return {
    biometrics: {
      weight: 70,
      height: 170,
      age: 25,
      bodyFat: 15,
      gender: 'male',
      biotype: (profile.biotype as OnboardingData['biometrics']['biotype']) || 'mesomorph',
    },
    restrictions: { allergies: [], injuries: [] },
    goals: { primary, secondary: [] },
    preferences: {
      workoutDaysPerWeek: 3,
      workoutDuration: 60,
      location: 'gym',
      mealsPerDay: 4,
      wakeTime: '07:00',
      workoutTime: '18:00',
      sleepTime: '23:00',
    },
  };
}

const AppContent: React.FC = () => {
  const {
    user,
    userId,
    authLoading,
    profileCheckLoading,
    profileCheckResult,
    clearProfileCheckResult,
    onboardingData,
    setOnboardingData,
    setPlan,
    setUser,
    refreshProfileFromSupabase,
  } = useUser();
  const { generatePlanAsync } = usePlan();
  const [currentTab, setCurrentTab] = useState('diario');
  const [restoreDone, setRestoreDone] = useState(false);

  // Abrir aba 'evolucao' ao redirecionar do PreCadastroChat
  useEffect(() => {
    if (onboardingData && user.onboardingCompleted) {
      const tab = sessionStorage.getItem('bilu_initial_tab');
      if (tab) {
        sessionStorage.removeItem('bilu_initial_tab');
        setCurrentTab(tab);
      }
    }
  }, [onboardingData, user.onboardingCompleted]);

  const handleRefresh = useCallback(async () => {
    if (!onboardingData) return;
    await new Promise((r) => setTimeout(r, 280));
    try {
      const { data: { session } } = await import('./lib/supabase').then((m) => m.supabase.auth.getSession());
      const newPlan = await generatePlanAsync(onboardingData, session?.access_token ?? null);
      setPlan(newPlan);
    } catch (e) {
      console.error('Erro ao regenerar plano:', e);
    }
  }, [onboardingData, generatePlanAsync, setPlan]);

  const usePullToRefresh = currentTab === 'treino' || currentTab === 'dieta';

  // Restaurar estado a partir do perfil no Supabase (usuário já é aluno, novo dispositivo)
  useEffect(() => {
    if (restoreDone || onboardingData !== null) return;

    const tryRestoreFromStandardProfile = () => {
      if (!profileCheckResult) return false;
      const name = (profileCheckResult.name ?? '').trim();
      const objective = (profileCheckResult.objective ?? '').trim();
      if (!name || !objective) return false;

      const minimal = buildOnboardingDataFromProfile(profileCheckResult);
      setOnboardingData(minimal);
      (async () => {
        try {
          const { data: { session } } = await import('./lib/supabase').then((m) => m.supabase.auth.getSession());
          const plan = await generatePlanAsync(minimal, session?.access_token ?? null);
          setPlan(plan);
        } catch (e) {
          console.error('Erro ao gerar plano:', e);
        }
      })();
      setUser({ ...user, onboardingCompleted: true, displayName: name });
      clearProfileCheckResult();
      setRestoreDone(true);
      return true;
    };

    if (tryRestoreFromStandardProfile()) return;

    // Perfil pre-cadastro (biotype preenchido pela IA, mas sem name/objective)
    if (profileCheckResult?.biotype) {
      refreshProfileFromSupabase(async (data) => {
        try {
          const { data: { session } } = await import('./lib/supabase').then((m) => m.supabase.auth.getSession());
          const plan = await generatePlanAsync(data, session?.access_token ?? null);
          setPlan(plan);
        } catch (e) {
          console.error('Erro ao gerar plano:', e);
        }
        setRestoreDone(true);
      });
    }
  }, [
    restoreDone,
    profileCheckResult,
    onboardingData,
    setOnboardingData,
    setPlan,
    generatePlanAsync,
    setUser,
    user,
    clearProfileCheckResult,
    refreshProfileFromSupabase,
  ]);

  // Verificando sessão Supabase
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-deep-bg">
        <NeonSpinner size={40} />
      </div>
    );
  }

  // Bloqueio: não logado → redirecionar para Login (não pode ver treinos nem o resto do app)
  if (!user.isAuthenticated) {
    return <Login />;
  }

  // Enquanto verifica na tabela profiles se o usuário já tem perfil (evitar repetir onboarding)
  if (profileCheckLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-deep-bg">
        <NeonSpinner size={40} />
      </div>
    );
  }

  // Usuário já tem perfil no Supabase (nome + objetivo) mas ainda não restaurou estado local → aguardar restore
  if (profileCheckResult && (profileCheckResult.name ?? '').trim() && (profileCheckResult.objective ?? '').trim() && !onboardingData && !restoreDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-deep-bg">
        <NeonSpinner size={40} />
      </div>
    );
  }

  // Se não completou onboarding (sem perfil), mostrar apenas o Chat da IA
  if (!user.onboardingCompleted || !onboardingData) {
    return <PreCadastroChat />;
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
      {userId && <AppHeader userId={userId} />}
      <div className={userId ? 'pt-12 h-full' : 'h-full'}>
      {usePullToRefresh ? (
        <PullToRefresh onRefresh={handleRefresh} className="h-full pb-16">
          {renderCurrentView()}
        </PullToRefresh>
      ) : (
        <div className="h-full overflow-y-auto pb-16">
          {renderCurrentView()}
        </div>
      )}
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
