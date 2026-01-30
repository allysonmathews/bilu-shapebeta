import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { usePlan } from '../context/PlanContext';
import { useProgress } from '../context/ProgressContext';
import { Card } from '../components/ui/Card';
import { SwapButton } from '../components/ui/SwapButton';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { ExerciseExecutionModal } from '../components/ExerciseExecutionModal';
import { saveWorkoutLog } from '../lib/supabase';
import { Check, Youtube, Calendar, Play } from 'lucide-react';
import { WorkoutDay, DayOfWeek } from '../types';
import { translateMuscleGroup } from '../utils/muscleGroupTranslations';

export const WorkoutView: React.FC = () => {
  const { plan, onboardingData, updateExerciseProgress, setPlan } = useUser();
  const { swapExercise, generatePlan } = usePlan();
  const { saveWeight, finishWorkout, getWorkoutByDate, workoutHistory, weightHistory } = useProgress();
  
  // Auto-seed: Gerar plano padrão se não houver plano e houver onboardingData
  useEffect(() => {
    if (!plan && onboardingData) {
      const defaultPlan = generatePlan(onboardingData);
      setPlan(defaultPlan);
    }
  }, [plan, onboardingData, generatePlan, setPlan]);

  // Calcular índice visual do dia da semana (0 = Domingo, 1 = Segunda, ..., 6 = Sábado)
  // Para exibição visual: Dom=0, Seg=1, Ter=2, Qua=3, Qui=4, Sex=5, Sáb=6
  const getDayOfWeekIndex = (date: Date): number => {
    return date.getDay(); // getDay() já retorna 0=Domingo, 1=Segunda, etc.
  };

  // Mapear índice (0-6) para DayOfWeek
  // Índice 0 = Domingo, 1 = Segunda, etc.
  const getDayOfWeekFromIndex = (index: number): DayOfWeek => {
    const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[index];
  };

  // Estado para data selecionada (formato YYYY-MM-DD)
  // Usar data local para evitar problemas de fuso horário
  const getTodayDateString = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Inicializar com a data de hoje (garantir que seja segunda-feira 26/01/2026 se for hoje)
  const [selectedDateString, setSelectedDateString] = useState<string>(getTodayDateString());
  const [datePickerRef, setDatePickerRef] = useState<HTMLInputElement | null>(null);

  const [exerciseWeights, setExerciseWeights] = useState<Record<string, number>>({});
  const [exerciseDone, setExerciseDone] = useState<Record<string, boolean>>({});
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  const [savedExercises, setSavedExercises] = useState<Set<string>>(new Set());
  const [lastSavedWeights, setLastSavedWeights] = useState<Record<string, number>>({});
  const [executionModalExerciseId, setExecutionModalExerciseId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Calcular data selecionada (usar selectedDateString diretamente)
  const selectedDate = selectedDateString;

  // Calcular índice do dia da semana baseado na data selecionada
  const selectedDayIndex = useMemo(() => {
    const date = new Date(selectedDate);
    return getDayOfWeekIndex(date);
  }, [selectedDate]);

  // Handler para quando o usuário seleciona uma data no date picker
  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = event.target.value;
    if (newDate) {
      setSelectedDateString(newDate);
    }
  };

  // Handler para abrir o date picker ao clicar no ícone
  const handleCalendarIconClick = () => {
    if (datePickerRef) {
      // Tentar usar showPicker() se disponível (Chrome/Edge modernos)
      if (typeof (datePickerRef as any).showPicker === 'function') {
        (datePickerRef as any).showPicker();
      } else {
        // Fallback: clicar no input (funciona em todos os navegadores)
        datePickerRef.click();
      }
    }
  };

  // Verificar se a data selecionada é passada, hoje ou futura
  // Usar comparação de strings YYYY-MM-DD para evitar problemas de fuso horário
  const dateStatus = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;
    
    if (selectedDate < todayString) return 'past';
    if (selectedDate === todayString) return 'today';
    return 'future';
  }, [selectedDate]);

  const isPastDate = dateStatus === 'past';
  const isToday = dateStatus === 'today';
  const isFuture = dateStatus === 'future';

  // Buscar histórico (sempre verificar, independente da data)
  const historicalWorkout = useMemo(() => {
    return getWorkoutByDate(selectedDate);
  }, [selectedDate, getWorkoutByDate]);

  // Salvar automaticamente quando sair do modo de edição
  useEffect(() => {
    // Só executar quando isEditing mudar de true para false
    if (!isEditing && historicalWorkout && workoutData?.workout?.id && Object.keys(exerciseWeights).length > 0) {
      // Salvar todas as alterações feitas durante a edição
      const exercisesData = workoutData.workout.exercises
        .filter(ex => ex != null)
        .map(ex => ({
          name: ex?.name ?? 'Exercício',
          weight: exerciseWeights[ex?.id ?? ''] || ex?.weight || 0,
          done: exerciseDone[ex?.id ?? ''] || false,
        }));
      
      finishWorkout(selectedDate, workoutData.workout.id, exercisesData);
      
      // Salvar pesos individuais também
      Object.keys(exerciseWeights).forEach(exerciseId => {
        const weight = exerciseWeights[exerciseId];
        if (weight && weight > 0) {
          saveWeight(exerciseId, weight, selectedDate);
        }
      });

      // Enviar cada exercício com peso para o Supabase (workout_history)
      (async () => {
        if (!workoutData?.workout?.exercises) return;
        for (const ex of workoutData.workout.exercises) {
          if (!ex?.id || !ex?.name) continue;
          const weight = exerciseWeights[ex.id];
          if (weight && weight > 0) {
            await saveWorkoutLog(ex.name, weight, selectedDate);
          }
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // Calcular qual treino corresponde ao dia selecionado
  // O plano usa workoutDays onde 1=Segunda, 2=Terça, etc., e dayNumber = (week-1)*7 + dayOfWeek
  const workoutData = useMemo(() => {
    if (!plan) return null;

    // Parsear startDate do plano (pode estar em formato ISO ou string)
    let startDateString = plan.startDate;
    if (startDateString.includes('T')) {
      startDateString = startDateString.split('T')[0];
    }
    
    // Criar objetos Date usando apenas YYYY-MM-DD para evitar problemas de fuso horário
    const [startYear, startMonth, startDay] = startDateString.split('-').map(Number);
    const [selectedYear, selectedMonth, selectedDay] = selectedDate.split('-').map(Number);
    
    const startDateObj = new Date(startYear, startMonth - 1, startDay);
    const selectedDateObj = new Date(selectedYear, selectedMonth - 1, selectedDay);
    
    // IMPORTANTE: Normalizar o startDate para a segunda-feira da semana
    // O plano sempre assume que dia 1 = Segunda-feira, independente de quando foi criado
    const startDayOfWeek = startDateObj.getDay(); // 0=Domingo, 1=Segunda, etc.
    const normalizedStartDate = new Date(startDateObj);
    if (startDayOfWeek === 0) {
      // Se começou no domingo, normalizar para a segunda anterior (6 dias atrás)
      normalizedStartDate.setDate(startDateObj.getDate() - 6);
    } else if (startDayOfWeek !== 1) {
      // Se começou em outro dia (terça a sábado), normalizar para a segunda anterior
      normalizedStartDate.setDate(startDateObj.getDate() - (startDayOfWeek - 1));
    }
    // Se já é segunda-feira, não precisa ajustar
    
    // Calcular diferença em dias desde o início normalizado do plano
    const diffTime = selectedDateObj.getTime() - normalizedStartDate.getTime();
    const daysDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Se a data selecionada for antes do início normalizado do plano, não há treino
    if (daysDiff < 0) return null;
    
    // Calcular o dia da semana da data selecionada (1=Segunda, 7=Domingo)
    // IMPORTANTE: O plano sempre assume que dia 1 = Segunda-feira
    const jsDayOfWeek = selectedDateObj.getDay(); // 0=Domingo, 1=Segunda, etc.
    const planDayOfWeek = jsDayOfWeek === 0 ? 7 : jsDayOfWeek; // Converter para 1-7 (1=Seg, 7=Dom)
    
    // Calcular qual semana estamos (1-4)
    // O plano assume que a semana LÓGICA começa na segunda-feira (dia 1)
    // daysDiff = 0 significa segunda-feira da primeira semana (dia 1)
    const weekNumber = Math.floor(daysDiff / 7) + 1;
    const weekIndex = Math.max(0, Math.min(weekNumber - 1, 3));
    const week = plan.weeks[weekIndex];

    if (!week) return null;

    // Calcular o dia absoluto esperado (1-28)
    // O dia absoluto é calculado como: (weekNumber - 1) * 7 + dayOfWeek
    // Onde dayOfWeek é 1-7 (1=Segunda, 7=Domingo)
    // IMPORTANTE: Dia 1 do plano = Segunda-feira, sempre
    // Exemplo: Se weekNumber=1 e dayOfWeek=1 (Segunda), então dayNumber = (1-1)*7 + 1 = 1
    const expectedDayNumber = (weekNumber - 1) * 7 + planDayOfWeek;

    // Procurar treino pelo dayNumber absoluto em todas as semanas (caso o plano tenha semanas diferentes)
    let workout: WorkoutDay | undefined;
    let workoutIndex = -1;
    let foundWeekIndex = weekIndex;

    // Primeiro, tentar encontrar pelo dayNumber exato na semana calculada
    for (let i = 0; i < week.workouts.length; i++) {
      const w = week.workouts[i];
      if (w.day === expectedDayNumber) {
        workout = w;
        workoutIndex = i;
        foundWeekIndex = weekIndex;
        break;
      }
    }

    // Se não encontrou, procurar em todas as semanas pelo dayNumber
    if (!workout) {
      for (let wIdx = 0; wIdx < plan.weeks.length; wIdx++) {
        const currentWeek = plan.weeks[wIdx];
        for (let i = 0; i < currentWeek.workouts.length; i++) {
          const w = currentWeek.workouts[i];
          if (w.day === expectedDayNumber) {
            workout = w;
            workoutIndex = i;
            foundWeekIndex = wIdx;
            break;
          }
        }
        if (workout) break;
      }
    }

    // Se ainda não encontrou pelo dayNumber exato, procurar pelo dia da semana
    // (útil se o plano tiver treinos repetidos na mesma semana)
    if (!workout) {
      for (let i = 0; i < week.workouts.length; i++) {
        const w = week.workouts[i];
        // Converter dayNumber absoluto para dia da semana (1-7)
        const workoutWeekDay = ((w.day - 1) % 7) + 1;
        if (workoutWeekDay === planDayOfWeek) {
          workout = w;
          workoutIndex = i;
          foundWeekIndex = weekIndex;
          break;
        }
      }
    }

    return { workout, weekIndex: foundWeekIndex, workoutIndex, dayNumber: expectedDayNumber };
  }, [plan, selectedDate]);

  // Memorizar mapeamento nome -> id dos exercícios do treino atual para uso no efeito de sincronização
  const exerciseNameToIdMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (workoutData?.workout?.exercises) {
      workoutData.workout.exercises
        .filter(ex => ex != null && ex.name && ex.id)
        .forEach(ex => {
          map[ex.name!] = ex.id!;
        });
    }
    return map;
  }, [workoutData?.workout?.exercises]);

  // SINCRONIZAÇÃO DE DATA: Carregar pesos e estados do contexto ao mudar de data
  useEffect(() => {
    // Buscar dados do histórico de treino para a data selecionada
    const workoutForDate = getWorkoutByDate(selectedDate);
    
    // Buscar pesos do weightHistory para a data selecionada
    const weightsForDate: Record<string, number> = {};
    const doneForDate: Record<string, boolean> = {};
    
    // Primeiro, popular com dados do weightHistory (mais granular, por exerciseId)
    weightHistory
      .filter(log => log.date === selectedDate)
      .forEach(log => {
        weightsForDate[log.exerciseId] = log.weight;
      });
    
    // Se houver histórico de treino completo, usar os dados dele também
    // para carregar o estado "done" e pesos por nome do exercício
    if (workoutForDate && workoutForDate.exercises) {
      workoutForDate.exercises.forEach((ex) => {
        // Usar o mapeamento nome -> id para encontrar o exercício correto
        const exerciseId = exerciseNameToIdMap[ex.name];
        if (exerciseId) {
          // Só sobrescrever peso se não tiver no weightHistory ou se o histórico tiver valor
          if (ex.weight > 0 && !weightsForDate[exerciseId]) {
            weightsForDate[exerciseId] = ex.weight;
          }
          doneForDate[exerciseId] = ex.done;
        }
      });
    }
    
    // Atualizar estados locais com os dados do contexto
    // Isso garante que a UI reflita corretamente o estado salvo
    setExerciseWeights(weightsForDate);
    setExerciseDone(doneForDate);
    setLastSavedWeights(weightsForDate);
    setSavedExercises(new Set());
    setIsEditing(false);
  }, [selectedDate, exerciseNameToIdMap, weightHistory, getWorkoutByDate]); // Dependências: selectedDate, mapeamento de exercícios e dados do contexto

  const handleSwap = useCallback(
    (exerciseId: string, displayIndex: number) => {
      // Só permitir swap se não for histórico (modo visualização)
      if (!plan || !workoutData || workoutData.weekIndex < 0 || workoutData.workoutIndex < 0 || historicalWorkout) return;
      
      // Encontrar o índice REAL no array original de exercícios (não no array filtrado)
      const workout = workoutData.workout;
      if (!workout || !workout.exercises) return;
      
      // Buscar o exercício pelo ID no array original para obter o índice correto
      const realExerciseIndex = workout.exercises.findIndex(ex => ex?.id === exerciseId);
      
      // Se não encontrar, usar o índice do display como fallback (caso não haja filtros)
      const exerciseIndex = realExerciseIndex >= 0 ? realExerciseIndex : displayIndex;
      
      setSwappingIndex(displayIndex); // Usar displayIndex para feedback visual
      const updated = swapExercise(plan, workoutData.weekIndex, workoutData.workoutIndex, exerciseIndex, exerciseId);
      setPlan(updated);
      setTimeout(() => setSwappingIndex(null), 280);
    },
    [plan, workoutData, swapExercise, setPlan, historicalWorkout]
  );

  const handleWeightChange = (exerciseId: string, weight: number) => {
    setExerciseWeights(prev => ({ ...prev, [exerciseId]: weight }));
    if (workoutData?.workout?.exercises) {
      const exercise = workoutData.workout.exercises.find(e => e?.id === exerciseId);
      if (exercise && exercise?.name && weight > 0) {
        // Usar selectedDate ao invés de new Date() para permitir salvamento em datas retroativas
        updateExerciseProgress(
          exerciseId, 
          exercise.name, 
          selectedDate, 
          exercise?.sets ?? 0, 
          exercise?.reps ?? 0, 
          weight
        );
      }
    }
    
    // Se estiver em modo de edição e for histórico, salvar automaticamente
    if (isEditing && historicalWorkout && weight > 0) {
      saveWeight(exerciseId, weight, selectedDate);
    }
  };

  const handleSaveWeight = (exerciseId: string, weight: number) => {
    // Permitir salvar se não for futuro E (não for histórico OU estiver em modo de edição)
    if (weight > 0 && !isFuture && (!historicalWorkout || isEditing)) {
      // Verificar se o valor realmente mudou para evitar salvamentos desnecessários
      const lastSaved = lastSavedWeights[exerciseId];
      if (lastSaved !== undefined && lastSaved === weight) {
        // Valor não mudou, apenas mostrar feedback visual breve
        setSavedExercises(prev => new Set(prev).add(exerciseId));
        setTimeout(() => {
          setSavedExercises(prev => {
            const newSet = new Set(prev);
            newSet.delete(exerciseId);
            return newSet;
          });
        }, 1000);
        return;
      }

      // Passar selectedDate explicitamente para salvar na data correta (permite datas retroativas)
      saveWeight(exerciseId, weight, selectedDate);
      setLastSavedWeights(prev => ({ ...prev, [exerciseId]: weight }));
      setSavedExercises(prev => new Set(prev).add(exerciseId));

      // Enviar para Supabase (workout_history) com ID do usuário logado
      const exercise = workoutData?.workout?.exercises.find(e => e?.id === exerciseId);
      const exerciseName = exercise?.name ?? 'Exercício';
      (async () => {
        if (weight > 0) {
          await saveWorkoutLog(exerciseName, weight, selectedDate);
        }
      })();

      // Se estiver em modo de edição e for histórico, atualizar o workoutHistory também
      if (isEditing && historicalWorkout && workoutData?.workout?.id) {
        const exercisesData = displayExercises
          .filter(ex => ex != null)
          .map(ex => ({
            name: ex?.name ?? 'Exercício',
            weight: exerciseWeights[ex?.id ?? ''] || ex?.weight || 0,
            done: exerciseDone[ex?.id ?? ''] || false,
          }));
        finishWorkout(selectedDate, workoutData.workout.id, exercisesData);
      }
      
      setTimeout(() => {
        setSavedExercises(prev => {
          const newSet = new Set(prev);
          newSet.delete(exerciseId);
          return newSet;
        });
      }, 2000);
    }
  };

  const handleFinishWorkout = () => {
    // Só permitir finalizar se não for histórico e não for futuro
    if (!workoutData?.workout || !workoutData.workout.exercises || historicalWorkout || isFuture) return;

    const exercisesData = workoutData.workout.exercises
      .filter(ex => ex != null) // Filtrar exercícios nulos
      .map(ex => ({
        name: ex?.name ?? 'Exercício',
        weight: exerciseWeights[ex?.id ?? ''] || ex?.weight || 0,
        done: exerciseDone[ex?.id ?? ''] || false,
      }));

    if (workoutData.workout.id) {
      finishWorkout(selectedDate, workoutData.workout.id, exercisesData);
      (async () => {
        for (const ex of workoutData.workout.exercises) {
          if (!ex) continue;
          const w = exerciseWeights[ex.id] ?? ex.weight ?? 0;
          if (w > 0 && ex.name) {
            await saveWorkoutLog(ex.name, w, selectedDate);
          }
        }
      })();
      alert('Treino finalizado e salvo no histórico!');
    }
  };

  const handleExecutionComplete = useCallback(
    (exerciseId: string, weight: number) => {
      if (weight > 0 && !historicalWorkout && !isFuture) {
        saveWeight(exerciseId, weight, selectedDate);
        setLastSavedWeights(prev => ({ ...prev, [exerciseId]: weight }));
        setExerciseDone(prev => ({ ...prev, [exerciseId]: true }));
        setSavedExercises(prev => new Set(prev).add(exerciseId));

        const exercise = workoutData?.workout?.exercises.find(e => e?.id === exerciseId);
        const exerciseName = exercise?.name ?? 'Exercício';
        (async () => {
          await saveWorkoutLog(exerciseName, weight, selectedDate);
        })();

        setTimeout(() => {
          setSavedExercises(prev => {
            const next = new Set(prev);
            next.delete(exerciseId);
            return next;
          });
        }, 2000);
      }
      setExecutionModalExerciseId(null);
    },
    [historicalWorkout, isFuture, saveWeight, selectedDate, workoutData]
  );

  // Dados dos dias da semana - ORDEM VISUAL: Dom, Seg, Ter, Qua, Qui, Sex, Sáb
  const daysOfWeek: { key: DayOfWeek; label: string; short: string }[] = [
    { key: 'sunday', label: 'Domingo', short: 'Dom' },
    { key: 'monday', label: 'Segunda-feira', short: 'Seg' },
    { key: 'tuesday', label: 'Terça-feira', short: 'Ter' },
    { key: 'wednesday', label: 'Quarta-feira', short: 'Qua' },
    { key: 'thursday', label: 'Quinta-feira', short: 'Qui' },
    { key: 'friday', label: 'Sexta-feira', short: 'Sex' },
    { key: 'saturday', label: 'Sábado', short: 'Sáb' },
  ];

  // Determinar o que exibir no conteúdo - ORDEM DE PRIORIDADE
  const contentToDisplay = useMemo(() => {
    // 1º CHECK: Histórico Real (qualquer data)
    if (historicalWorkout) {
      return { 
        type: 'history' as const, 
        data: historicalWorkout,
        status: dateStatus 
      };
    }

    // 2º CHECK: Plano Teórico (se não houver histórico)
    if (workoutData?.workout) {
      return { 
        type: 'planned' as const, 
        workout: workoutData.workout, 
        workoutData,
        status: dateStatus // 'past', 'today', ou 'future'
      };
    }

    // 3º CHECK: Loading (se não houver plano ainda)
    if (!plan) {
      return { type: 'loading' as const };
    }

    // 4º CHECK: Descanso (se houver plano mas não houver treino para este dia)
    return { type: 'rest' as const, status: dateStatus };
  }, [historicalWorkout, workoutData, plan, dateStatus]);

  // Preparar exercícios para exibição com verificações de segurança
  const displayExercises = useMemo(() => {
    if (contentToDisplay.type === 'history' && workoutData?.workout?.exercises) {
      // Histórico: usar dados salvos com verificações de null
      return workoutData.workout.exercises
        .filter(ex => ex != null) // Filtrar exercícios nulos
        .map(ex => {
          const historicalEx = contentToDisplay.data?.exercises?.find(h => h?.name === ex?.name);
          // Se estiver em modo de edição, usar exerciseWeights se disponível, senão usar histórico
          const currentWeight = isEditing && exerciseWeights[ex.id] !== undefined
            ? exerciseWeights[ex.id]
            : (historicalEx?.weight ?? ex?.weight ?? 0);
          return {
            ...ex,
            weight: currentWeight,
            done: exerciseDone[ex.id] !== undefined ? exerciseDone[ex.id] : (historicalEx?.done ?? false),
          };
        });
    }
    
    if (contentToDisplay.type === 'planned' && contentToDisplay.workout?.exercises) {
      // Planejado: usar dados do plano com estados locais e verificações de null
      return contentToDisplay.workout.exercises
        .filter(ex => ex != null) // Filtrar exercícios nulos
        .map(ex => ({
          ...ex,
          weight: exerciseWeights[ex.id] !== undefined ? exerciseWeights[ex.id] : (ex?.weight ?? 0),
          done: exerciseDone[ex.id] ?? false,
        }));
    }

    return [];
  }, [contentToDisplay, workoutData, exerciseWeights, exerciseDone, isEditing]);

  // Identificar grupos musculares únicos do dia com verificações de segurança
  const uniqueMuscleGroups = useMemo(() => {
    if (!displayExercises?.length) return [];
    const groups = displayExercises
      .map(ex => ex?.muscleGroup)
      .filter((value): value is string => value != null && value !== undefined) // Filtrar valores nulos
      .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicatas
    return groups.map(translateMuscleGroup);
  }, [displayExercises]);

  // Calcular a semana da data selecionada para sincronizar a barra de dias
  // SEMANA VISUAL COMEÇA NO DOMINGO (índice 0)
  // IMPORTANTE: Sempre mostra a semana que CONTÉM a data selecionada
  const selectedDateObj = useMemo(() => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [selectedDate]);
  
  const weekStartDate = useMemo(() => {
    const date = new Date(selectedDateObj);
    const dayOfWeek = date.getDay(); // 0=Domingo, 1=Segunda, ..., 6=Sábado
    // Calcular diferença para o domingo da semana (domingo = início visual)
    // Sempre calcular o domingo da semana que CONTÉM a data selecionada
    const diff = -dayOfWeek; // Se domingo (0), diff=0; se segunda (1), diff=-1, etc.
    date.setDate(date.getDate() + diff);
    return date;
  }, [selectedDateObj]);

  // Gerar array de datas da semana para a barra de dias
  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate);
      date.setDate(weekStartDate.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [weekStartDate]);

  // Função auxiliar para converter Date para string YYYY-MM-DD (usando data local)
  const dateToLocalString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Verificar se uma data da semana é a data selecionada
  const isDateSelected = (date: Date): boolean => {
    return dateToLocalString(date) === selectedDate;
  };

  // Verificar se uma data é hoje (para destaque visual)
  const isDateToday = (date: Date): boolean => {
    const today = new Date();
    return dateToLocalString(date) === dateToLocalString(today);
  };

  const executionModalExercise = useMemo(
    () => displayExercises?.find((e) => e?.id === executionModalExerciseId) ?? null,
    [displayExercises, executionModalExerciseId]
  );

  return (
    <>
    <div className="p-4 pb-24 space-y-4">
      {/* Header - Sempre visível */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-alien-green">Treino</h1>
        {/* Ícone de Calendário */}
        <button
          onClick={handleCalendarIconClick}
          className="p-2 rounded-lg bg-card-bg border border-gray-700 hover:border-alien-green hover:bg-alien-green/10 transition-all duration-200 flex items-center justify-center"
          aria-label="Selecionar data"
        >
          <Calendar size={20} className="text-alien-green" />
        </button>
        {/* Input date oculto mas funcional */}
        <input
          ref={setDatePickerRef}
          type="date"
          value={selectedDate}
          onChange={handleDateChange}
          style={{
            position: 'absolute',
            opacity: 0,
            width: 0,
            height: 0,
            pointerEvents: 'none',
            visibility: 'hidden'
          }}
          aria-label="Seletor de data"
        />
      </div>

      {/* Week Calendar - Sempre visível, sincronizado com a data selecionada */}
      {/* Ordem VISUAL: Dom, Seg, Ter, Qua, Qui, Sex, Sáb */}
      <div className="mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {weekDates.map((date, index) => {
            const dayIndex = getDayOfWeekIndex(date); // 0=Dom, 1=Seg, etc.
            const day = daysOfWeek[dayIndex];
            const isSelected = isDateSelected(date);
            const dateIsToday = isDateToday(date);
            const dateString = dateToLocalString(date);
            
            return (
              <button
                key={`${dateString}-${index}`}
                onClick={() => setSelectedDateString(dateString)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg border-2 transition-all duration-200 ${
                  isSelected
                    ? 'bg-alien-green border-alien-green text-deep-bg font-bold shadow-lg shadow-alien-green/50'
                    : dateIsToday
                    ? 'bg-alien-green/30 border-alien-green text-alien-green font-bold shadow-md shadow-alien-green/30 hover:border-alien-green hover:bg-alien-green/40'
                    : 'bg-card-bg border-gray-700 text-gray-300 hover:border-gray-600'
                }`}
              >
                <div className="flex flex-col items-center">
                  <span className="text-sm">{day?.short ?? '?'}</span>
                  <span className="text-xs opacity-75">{date.getDate()}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area - Lógica de exibição */}
      <div className="space-y-4">
        {contentToDisplay.type === 'loading' && (
          <Card>
            <div className="p-8 text-center">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-700 rounded w-3/4 mx-auto"></div>
                <div className="h-4 bg-gray-700 rounded w-1/2 mx-auto"></div>
              </div>
              <p className="text-gray-400 mt-4">Carregando treino...</p>
            </div>
          </Card>
        )}

        {contentToDisplay.type === 'rest' && (
          <Card>
            <div className="p-8 text-center">
              <p className="text-gray-400 text-lg">
                {isPastDate ? 'Descanso / Sem registro' : 'Descanso'}
              </p>
              {isPastDate && (
                <p className="text-gray-500 text-sm mt-2">
                  Nenhum treino registrado para {new Date(selectedDate).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          </Card>
        )}

        {(contentToDisplay.type === 'history' || contentToDisplay.type === 'planned') && workoutData?.workout && (
          <>
            {/* Indicador de tipo com tags visuais */}
            <div className="flex items-center gap-2 text-sm flex-wrap">
              {contentToDisplay.type === 'history' ? (
                <>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Prevenir qualquer navegação ou scroll
                      e.currentTarget.blur();
                      setIsEditing(prev => !prev);
                    }}
                    className={`px-3 py-1 rounded-full font-medium transition-all duration-200 ${
                      isEditing
                        ? 'text-deep-bg bg-alien-green hover:bg-[#2EE010] cursor-pointer'
                        : 'text-alien-green bg-alien-green/20 hover:bg-alien-green/30 cursor-pointer'
                    }`}
                    type="button"
                  >
                    {isEditing ? '✎ Editando' : '✓ Realizado'}
                  </button>
                  <span className="text-gray-400 text-xs">
                    {new Date(selectedDate).toLocaleDateString('pt-BR')}
                  </span>
                </>
              ) : contentToDisplay.status === 'past' ? (
                <>
                  <span className="text-amber-400 bg-amber-400/20 px-3 py-1 rounded-full font-medium">
                    ⚠ Não Registrado
                  </span>
                  <span className="text-gray-400 text-xs">
                    Treino que deveria ter sido feito em {new Date(selectedDate).toLocaleDateString('pt-BR')}
                  </span>
                </>
              ) : contentToDisplay.status === 'today' ? (
                <span className="text-alien-green bg-alien-green/20 px-3 py-1 rounded-full font-medium">
                  Hoje - Treino Planejado
                </span>
              ) : (
                <span className="text-bilu-purple bg-bilu-purple/20 px-3 py-1 rounded-full font-medium">
                  Futuro - Planejado
                </span>
              )}
            </div>

            {/* Card de resumo */}
            <Card>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-gray-400 text-sm">Duração</p>
                  <p className="text-alien-green font-bold text-xl">{workoutData.workout?.duration ?? 0} min</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Exercícios</p>
                  <p className="text-alien-green font-bold text-xl">{workoutData.workout?.exercises?.length ?? 0}</p>
                </div>
              </div>
            </Card>

            {/* Resumo dos grupos musculares focados */}
            {uniqueMuscleGroups.length > 0 && (
              <div className="text-center py-2">
                <p className="text-sm text-gray-300">
                  <span className="text-gray-400">Foco de hoje: </span>
                  <span className="text-alien-green font-medium">
                    {uniqueMuscleGroups.length === 1
                      ? uniqueMuscleGroups[0]
                      : uniqueMuscleGroups.length === 2
                      ? `${uniqueMuscleGroups[0]} e ${uniqueMuscleGroups[1]}`
                      : `${uniqueMuscleGroups.slice(0, -1).join(', ')} e ${uniqueMuscleGroups[uniqueMuscleGroups.length - 1]}`
                    }
                  </span>
                </p>
              </div>
            )}

            {/* Lista de exercícios com verificações de segurança */}
            <div className="space-y-3">
              {displayExercises?.map((exercise, index) => {
                // Verificações de segurança para prevenir crashes
                if (!exercise || !exercise.id) return null;
                
                return (
                  <Card key={exercise.id}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-white font-bold">{exercise?.name ?? 'Exercício'}</h3>
                          {exercise?.muscleGroup && (
                            <span className="text-xs text-bilu-purple bg-bilu-purple/20 px-2 py-1 rounded">
                              {translateMuscleGroup(exercise.muscleGroup)}
                            </span>
                          )}
                          {isPastDate && exercise?.done && (
                            <span className="text-xs text-alien-green bg-alien-green/20 px-2 py-1 rounded">
                              Concluído
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mb-2">
                          {exercise?.sets ?? 0} séries × {exercise?.reps ?? 0} reps
                        </p>
                        {exercise?.videoUrl && (
                          <a 
                            href={exercise.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-alien-green text-sm font-medium hover:text-[#2EE010] transition-colors bg-alien-green/10 px-3 py-1.5 rounded-lg border border-alien-green/30 hover:border-alien-green/50"
                          >
                            <Youtube size={16} />
                            Ver vídeo
                          </a>
                        )}
                      </div>
                      {!historicalWorkout && !isFuture && (
                        <SwapButton
                          onClick={() => handleSwap(exercise.id, index)}
                          isLoading={swappingIndex === index}
                        />
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-800">
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Input
                            label="Peso (kg)"
                            type="number"
                            value={exercise?.weight ?? ''}
                            onChange={(e) => {
                              if (exercise?.id && (!historicalWorkout || isEditing) && !isFuture) {
                                handleWeightChange(exercise.id, parseFloat(e.target.value) || 0);
                              }
                            }}
                            placeholder="Ex: 20"
                            disabled={(!!historicalWorkout && !isEditing) || isFuture}
                          />
                        </div>
                        {historicalWorkout && !isEditing ? (
                          // Modo histórico sem edição: apenas mostrar peso usado
                          exercise?.weight && (
                            <div className="px-4 py-2.5 rounded-lg bg-gray-700 text-white">
                              <span className="text-sm">{exercise.weight} kg</span>
                            </div>
                          )
                        ) : isFuture ? (
                          // Modo futuro: mostrar "Planejado"
                          <div className="px-4 py-2.5 rounded-lg bg-bilu-purple/30 text-gray-400 border border-bilu-purple/50">
                            <span className="text-xs">Planejado</span>
                          </div>
                        ) : (
                          // Modo hoje/passado sem histórico OU modo histórico em edição: permitir edição
                          <>
                            <button
                              onClick={() => {
                                if (exercise?.id) {
                                  handleSaveWeight(exercise.id, exerciseWeights[exercise.id] || exercise?.weight || 0);
                                }
                              }}
                              disabled={!exerciseWeights[exercise.id] && !exercise?.weight}
                              className={`px-4 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                                savedExercises.has(exercise.id)
                                  ? 'bg-alien-green text-deep-bg'
                                  : 'bg-bilu-purple text-white hover:bg-[#8A00E6] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed'
                              }`}
                            >
                              {savedExercises.has(exercise.id) ? (
                                <>
                                  <Check size={18} />
                                  <span className="text-xs">Salvo!</span>
                                </>
                              ) : (
                                <>
                                  <Check size={18} />
                                  <span className="text-xs">Salvar</span>
                                </>
                              )}
                            </button>
                            {!historicalWorkout && (
                              <>
                                <button
                                  onClick={() => {
                                    if (exercise?.id) {
                                      setExecutionModalExerciseId(exercise.id);
                                    }
                                  }}
                                  className="px-4 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 bg-alien-green text-deep-bg hover:bg-[#2EE010]"
                                >
                                  <Play size={18} />
                                  <span className="text-xs">Iniciar</span>
                                </button>
                                <button
                                  onClick={() => {
                                    if (exercise?.id) {
                                      setExerciseDone(prev => ({ ...prev, [exercise.id]: !prev[exercise.id] }));
                                    }
                                  }}
                                  className={`px-4 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                                    exerciseDone[exercise.id]
                                      ? 'bg-alien-green text-deep-bg'
                                      : 'bg-gray-700 text-white hover:bg-gray-600'
                                  }`}
                                >
                                  <Check size={18} />
                                  <span className="text-xs">{exerciseDone[exercise.id] ? 'Feito' : 'Fazer'}</span>
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Botão Finalizar Treino - Só aparece para hoje ou passado sem histórico */}
            {!historicalWorkout && !isFuture && (
              <div className="mt-6">
                <Button
                  onClick={handleFinishWorkout}
                  className="w-full bg-alien-green text-deep-bg hover:bg-[#2EE010] font-bold py-3"
                >
                  {isPastDate ? 'Registrar Treino' : 'Finalizar Treino'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>

    {executionModalExercise && (
      <ExerciseExecutionModal
        isOpen={!!executionModalExerciseId}
        onClose={() => setExecutionModalExerciseId(null)}
        exercise={{
          id: executionModalExercise.id,
          name: executionModalExercise.name ?? 'Exercício',
          sets: executionModalExercise.sets ?? 0,
          reps: executionModalExercise.reps ?? 0,
          weight: executionModalExercise.weight,
          muscleGroup: executionModalExercise.muscleGroup,
        }}
        currentWeight={exerciseWeights[executionModalExercise.id] ?? executionModalExercise.weight ?? 0}
        onComplete={(weight) =>
          handleExecutionComplete(executionModalExercise.id, weight)
        }
      />
    )}
    </>
  );
};
