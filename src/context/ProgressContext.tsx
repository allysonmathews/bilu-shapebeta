import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// localStorage: bilu_weight_history, bilu_workout_history (apenas este contexto; não são apagados no logout)
// Estrutura do Log de histórico de cargas
export interface WeightLog {
  id: string;
  exerciseId: string;
  weight: number;
  date: string; // formato: YYYY-MM-DD
}

// Estrutura do histórico completo de treinos
export interface WorkoutHistoryEntry {
  date: string; // formato: YYYY-MM-DD
  workoutId: string;
  exercises: Array<{
    name: string;
    weight: number;
    done: boolean;
  }>;
}

interface ProgressContextType {
  weightHistory: WeightLog[];
  workoutHistory: WorkoutHistoryEntry[];
  saveWeight: (exerciseId: string, weight: number, date?: string) => void;
  getHistory: (exerciseId: string) => WeightLog[];
  finishWorkout: (date: string, workoutId: string, exercisesData: Array<{ name: string, weight: number, done: boolean }>) => void;
  getWorkoutByDate: (date: string) => WorkoutHistoryEntry | undefined;
  cleanDuplicateWeights: () => void;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const ProgressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Função auxiliar para limpar duplicatas
  const cleanDuplicates = (history: WeightLog[]): WeightLog[] => {
    const grouped = new Map<string, WeightLog>();
    
    history.forEach(log => {
      const key = `${log.exerciseId}-${log.date}`;
      const existing = grouped.get(key);
      
      if (!existing || parseInt(log.id.split('-')[0]) > parseInt(existing.id.split('-')[0])) {
        grouped.set(key, log);
      }
    });
    
    return Array.from(grouped.values());
  };

  const [weightHistory, setWeightHistory] = useState<WeightLog[]>(() => {
    const stored = localStorage.getItem('bilu_weight_history');
    const parsed = stored ? JSON.parse(stored) : [];
    // Limpar duplicatas ao carregar do localStorage
    return cleanDuplicates(parsed);
  });

  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistoryEntry[]>(() => {
    const stored = localStorage.getItem('bilu_workout_history');
    return stored ? JSON.parse(stored) : [];
  });

  // Persistir no localStorage sempre que o histórico mudar
  useEffect(() => {
    localStorage.setItem('bilu_weight_history', JSON.stringify(weightHistory));
  }, [weightHistory]);

  useEffect(() => {
    localStorage.setItem('bilu_workout_history', JSON.stringify(workoutHistory));
  }, [workoutHistory]);

  const saveWeight = (exerciseId: string, weight: number, date?: string) => {
    // Usar a data fornecida ou a data atual como fallback
    const logDate = date || new Date().toISOString().split('T')[0];
    
    setWeightHistory(prev => {
      // Verificar se já existe um registro para este exerciseId e data
      const existingIndex = prev.findIndex(
        log => log.exerciseId === exerciseId && log.date === logDate
      );

      if (existingIndex >= 0) {
        // Atualizar registro existente (UPSERT)
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          weight, // Atualizar o peso
        };
        return updated;
      } else {
        // Adicionar novo registro
        const newLog: WeightLog = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          exerciseId,
          weight,
          date: logDate, // formato YYYY-MM-DD
        };
        return [...prev, newLog];
      }
    });
  };

  // Função para limpar duplicatas existentes (mantém apenas o mais recente por data)
  const cleanDuplicateWeights = () => {
    setWeightHistory(prev => cleanDuplicates(prev));
  };

  const getHistory = (exerciseId: string): WeightLog[] => {
    return weightHistory
      .filter(log => log.exerciseId === exerciseId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const finishWorkout = (date: string, workoutId: string, exercisesData: Array<{ name: string, weight: number, done: boolean }>) => {
    // Verificar se já existe um treino para esta data e workoutId
    setWorkoutHistory(prev => {
      const existingIndex = prev.findIndex(entry => entry.date === date && entry.workoutId === workoutId);
      
      if (existingIndex >= 0) {
        // Atualizar entrada existente
        const updated = [...prev];
        updated[existingIndex] = {
          date,
          workoutId,
          exercises: exercisesData,
        };
        return updated;
      } else {
        // Adicionar nova entrada
        return [...prev, {
          date,
          workoutId,
          exercises: exercisesData,
        }];
      }
    });
  };

  const getWorkoutByDate = (date: string): WorkoutHistoryEntry | undefined => {
    return workoutHistory.find(entry => entry.date === date);
  };


  return (
    <ProgressContext.Provider
      value={{
        weightHistory,
        workoutHistory,
        saveWeight,
        getHistory,
        finishWorkout,
        getWorkoutByDate,
        cleanDuplicateWeights,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
};

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within ProgressProvider');
  }
  return context;
};
