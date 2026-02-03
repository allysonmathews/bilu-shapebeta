import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useUser } from '../context/UserContext';
import { Card } from '../components/ui/Card';
import { Check, Droplet, Utensils, Dumbbell, Camera, X, ImageIcon } from 'lucide-react';
import { DayOfWeek, WorkoutDay } from '../types';
import { translateMuscleGroup } from '../utils/muscleGroupTranslations';
import { calculateWaterGoal, getActivityLevelFromPreferences, mlToGlasses, GLASS_ML, getIdealWaterPaceMl } from '../utils/waterGoal';
import { NeonSpinner } from '../components/ui/NeonSpinner';
import { supabase, getDietJournalEntries, saveDietJournalEntry, getDailyWaterConsumedMl, upsertDailyWater, type DietJournalRow } from '../lib/supabase';

/** Dados em revisão antes de salvar (editáveis no modal) - macros ocultos mas preservados no estado */
interface ReviewData {
  imageBase64: string;
  nome: string;
  peso: number;
  calorias: number;
  proteina: number;
  carbo: number;
  gordura: number;
}

/** Entrada de refeição salva no diário (prato analisado pela IA) */
interface DiaryEntry {
  id: string;
  descricao?: string;
  calorias: number;
  proteina: number;
  carboidratos: number;
  gordura: number;
  savedAt: string; // ISO
}

function mapRowToEntry(row: DietJournalRow): DiaryEntry {
  return {
    id: row.id,
    descricao: row.descricao ?? undefined,
    calorias: Number(row.calorias),
    proteina: Number(row.proteina),
    carboidratos: Number(row.carbo),
    gordura: Number(row.gordura),
    savedAt: row.created_at ?? new Date().toISOString(),
  };
}

// Helper para mapear getDay() para DayOfWeek
// getDay() retorna: 0 = Domingo, 1 = Segunda, 2 = Terça, ..., 6 = Sábado
const getCurrentDayOfWeek = (): DayOfWeek => {
  const dayIndex = new Date().getDay();
  const dayMap: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return dayMap[dayIndex];
};

// Helper para obter o nome do dia em português
const getDayName = (dayOfWeek: DayOfWeek): string => {
  const dayNames: Record<DayOfWeek, string> = {
    monday: 'Segunda-feira',
    tuesday: 'Terça-feira',
    wednesday: 'Quarta-feira',
    thursday: 'Quinta-feira',
    friday: 'Sexta-feira',
    saturday: 'Sábado',
    sunday: 'Domingo',
  };
  return dayNames[dayOfWeek];
};

// Helper para calcular qual semana estamos (baseado na startDate)
const getCurrentWeekIndex = (planStartDate: string): number => {
  const start = new Date(planStartDate);
  const today = new Date();
  
  // Resetar horas para comparar apenas datas
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekIndex = Math.floor(diffDays / 7);
  
  // Garantir que está entre 0 e 3 (4 semanas)
  return Math.max(0, Math.min(3, weekIndex));
};

// Helper para obter a data atual no formato YYYY-MM-DD
const getTodayDateString = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export const DailyJournal: React.FC = () => {
  const { user, plan, onboardingData, completedMeals, toggleMealCompletion } = useUser();
  const displayName = user?.displayName?.trim() || 'Bilu';
  const [waterConsumedMl, setWaterConsumedMl] = useState(0);
  const [completedWorkout, setCompletedWorkout] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showPhotoSourceMenu, setShowPhotoSourceMenu] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const todayDateForDiary = getTodayDateString();
  const [savedDiaryEntries, setSavedDiaryEntries] = useState<DiaryEntry[]>([]);
  const [loadingDiary, setLoadingDiary] = useState(true);

  // Carregar consumed_ml do dia ao montar e quando data/sessão mudar (tabela daily_water)
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session?.user?.id) return;
      getDailyWaterConsumedMl(session.user.id, todayDateForDiary).then((ml) => {
        if (!cancelled) setWaterConsumedMl(ml);
      });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user?.id) {
        getDailyWaterConsumedMl(session.user.id, todayDateForDiary).then((ml) => {
          if (!cancelled) setWaterConsumedMl(ml);
        });
      } else {
        if (!cancelled) setWaterConsumedMl(0);
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [todayDateForDiary]);

  // Carregar entradas do diário do Supabase para o dia atual (getDietJournalEntries)
  const loadDiaryForToday = React.useCallback(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) {
        setSavedDiaryEntries([]);
        setLoadingDiary(false);
        return;
      }
      setLoadingDiary(true);
      getDietJournalEntries(session.user.id, todayDateForDiary, todayDateForDiary)
        .then((rows) => setSavedDiaryEntries(rows.map(mapRowToEntry)))
        .finally(() => setLoadingDiary(false));
    });
  }, [todayDateForDiary]);

  useEffect(() => {
    let cancelled = false;
    setLoadingDiary(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session?.user?.id) {
        if (!cancelled) {
          setSavedDiaryEntries([]);
          setLoadingDiary(false);
        }
        return;
      }
      getDietJournalEntries(session.user.id, todayDateForDiary, todayDateForDiary)
        .then((rows) => {
          if (!cancelled) setSavedDiaryEntries(rows.map(mapRowToEntry));
        })
        .finally(() => {
          if (!cancelled) setLoadingDiary(false);
        });
    });

    // Refetch quando a sessão ficar disponível (ex.: app acabou de carregar)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user?.id) {
        getDietJournalEntries(session.user.id, todayDateForDiary, todayDateForDiary)
          .then((rows) => {
            if (!cancelled) setSavedDiaryEntries(rows.map(mapRowToEntry));
          })
          .finally(() => {
            if (!cancelled) setLoadingDiary(false);
          });
      } else {
        setSavedDiaryEntries([]);
        setLoadingDiary(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [todayDateForDiary]);

  // Calcular dados do dia atual
  const todayData = useMemo(() => {
    if (!plan) return null;

    const currentDayOfWeek = getCurrentDayOfWeek();
    const currentWeekIndex = getCurrentWeekIndex(plan.startDate);
    const currentWeek = plan.weeks[currentWeekIndex];
    
    if (!currentWeek || !currentWeek.dailyMeals) {
      return null;
    }

    const todayMeals = currentWeek.dailyMeals[currentDayOfWeek] || [];
    
    // Encontrar treino do dia atual (se houver)
    // Calcular qual dia absoluto estamos (desde o início do plano)
    const startDate = new Date(plan.startDate);
    const today = new Date();
    startDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - startDate.getTime();
    const currentDay = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 porque day começa em 1
    
    // Procurar treino que corresponde ao dia atual em todas as semanas
    let todayWorkout: WorkoutDay | undefined;
    for (const week of plan.weeks) {
      const workout = week.workouts.find(w => w.day === currentDay);
      if (workout) {
        todayWorkout = workout;
        break;
      }
    }

    return {
      dayOfWeek: currentDayOfWeek,
      dayName: getDayName(currentDayOfWeek),
      meals: todayMeals,
      workout: todayWorkout,
      weekIndex: currentWeekIndex,
      totalCalories: currentWeek.totalCalories,
    };
  }, [plan]);

  // Meta diária de água (ml) — só recalcula quando peso, atividade ou idade mudam
  const waterGoalMl = useMemo(() => {
    if (!onboardingData) return 2000;
    const weight = onboardingData.biometrics?.weight ?? 0;
    const age = onboardingData.biometrics?.age;
    const prefs = onboardingData.preferences;
    const activityLevel = getActivityLevelFromPreferences(
      prefs?.workoutDaysPerWeek ?? 0,
      prefs?.workoutDuration ?? 0
    );
    return calculateWaterGoal(weight, activityLevel, age);
  }, [
    onboardingData?.biometrics?.weight,
    onboardingData?.biometrics?.age,
    onboardingData?.preferences?.workoutDaysPerWeek,
    onboardingData?.preferences?.workoutDuration,
  ]);

  const waterGoalGlasses = mlToGlasses(waterGoalMl);

  // Ritmo ideal (ml que deveria ter consumido até agora) — baseado em acordar/dormir
  const idealPaceMl = useMemo(() => {
    const wake = onboardingData?.preferences?.wakeTime;
    const sleep = onboardingData?.preferences?.sleepTime;
    return getIdealWaterPaceMl(waterGoalMl, wake, sleep, new Date());
  }, [waterGoalMl, onboardingData?.preferences?.wakeTime, onboardingData?.preferences?.sleepTime]);

  const isBehindWaterPace = waterConsumedMl < idealPaceMl;

  if (!plan || !onboardingData || !todayData) {
    return (
      <div className="p-4 text-center text-gray-400">
        <p>Carregando seu plano...</p>
      </div>
    );
  }

  const { dayName, meals: todayMeals, workout: todayWorkout, totalCalories: targetCalories } = todayData;
  const todayDateString = getTodayDateString();
  const todayCompletedMeals = completedMeals[todayDateString] || new Set<string>();

  const toggleMeal = (mealId: string, mealTime: string) => {
    toggleMealCompletion(todayDateString, mealId, mealTime);
  };

  const toggleWorkout = () => {
    setCompletedWorkout(prev => !prev);
  };

  const goalMl = waterGoalMl ?? 2000;

  const addWater = useCallback(() => {
    setWaterConsumedMl((prev) => {
      const next = Number(prev) + GLASS_ML;
      const safeNext = Number.isFinite(next) ? Math.max(0, Math.round(next)) : 0;
      supabase.auth.getSession().then(({ data: { session } }) => {
        const uid = session?.user?.id;
        if (uid && todayDateForDiary) {
          upsertDailyWater(uid, todayDateForDiary, safeNext, goalMl);
        }
      });
      return safeNext;
    });
  }, [todayDateForDiary, goalMl]);

  const removeWater = useCallback(() => {
    setWaterConsumedMl((prev) => {
      const next = Math.max(0, Number(prev) - GLASS_ML);
      const safeNext = Number.isFinite(next) ? Math.round(next) : 0;
      supabase.auth.getSession().then(({ data: { session } }) => {
        const uid = session?.user?.id;
        if (uid && todayDateForDiary) {
          upsertDailyWater(uid, todayDateForDiary, safeNext, goalMl);
        }
      });
      return safeNext;
    });
  }, [todayDateForDiary, goalMl]);

  const handleDiscardReview = () => {
    setReviewData(null);
    setIsReviewOpen(false);
    setAnalysisError(null);
  };

  const handleConsume = async () => {
    if (!reviewData) return;
    const result = await saveDietJournalEntry({
      log_date: todayDateForDiary,
      calorias: reviewData.calorias,
      proteina: reviewData.proteina,
      carbo: reviewData.carbo,
      gordura: reviewData.gordura,
      descricao: reviewData.nome || undefined,
    });
    if (!result.ok) {
      setAnalysisError(result.error ?? 'Erro ao salvar no diário');
      return;
    }
    setReviewData(null);
    setIsReviewOpen(false);
    loadDiaryForToday();
  };

  const sendImageForAnalysis = async (base64Data: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setReviewData(null);
    setIsReviewOpen(false);
    try {
      console.log('[DailyJournal] Chamando supabase.functions.invoke("rapid-action")...');
      const { data, error } = await supabase.functions.invoke('rapid-action', {
        body: { image_base64: base64Data },
      });
      console.log('Resposta da função:', data);
      if (error) {
        console.error('Erro da função:', error);
        throw new Error(error.message ?? 'Erro ao analisar imagem');
      }
      if (!data) {
        throw new Error('Resposta vazia da função');
      }
      // Parse se a resposta vier como string JSON
      let parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsed?.ok === false && parsed?.error) {
        throw new Error(parsed.error);
      }
      // Edge Function retorna { ok, alimentos: [{ alimento, calorias, proteina, carbo, gordura }, ...] }
      // Aceita também objeto único no root: { alimento, calorias, ... }
      let alimentos = Array.isArray(parsed?.alimentos) ? parsed.alimentos : [];
      if (alimentos.length === 0 && parsed?.alimento != null) {
        alimentos = [parsed];
      }
      const nome = alimentos.length > 0
        ? alimentos.map((a: { alimento?: string }) => String(a?.alimento ?? '').trim()).filter(Boolean).join(', ')
        : '';
      const calorias = alimentos.length > 0
        ? alimentos.reduce((s: number, a: { calorias?: number }) => s + Number(a?.calorias ?? 0), 0)
        : Number(parsed?.calorias ?? 0);
      const proteina = alimentos.length > 0
        ? alimentos.reduce((s: number, a: { proteina?: number }) => s + Number(a?.proteina ?? 0), 0)
        : Number(parsed?.proteina ?? 0);
      const carbo = alimentos.length > 0
        ? alimentos.reduce((s: number, a: { carbo?: number }) => s + Number(a?.carbo ?? 0), 0)
        : Number(parsed?.carbo ?? 0);
      const gordura = alimentos.length > 0
        ? alimentos.reduce((s: number, a: { gordura?: number }) => s + Number(a?.gordura ?? 0), 0)
        : Number(parsed?.gordura ?? 0);

      const reviewPayload: ReviewData = {
        imageBase64: base64Data,
        nome: nome || (parsed?.alimento ? String(parsed.alimento) : ''),
        peso: Number(parsed?.peso ?? 0),
        calorias,
        proteina,
        carbo,
        gordura,
      };
      setReviewData(reviewPayload);
      setIsReviewOpen(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setAnalysisError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPhotoAsBase64 = async (source: 'Camera' | 'Photos'): Promise<string> => {
    const { Camera, CameraSource, CameraResultType } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: source === 'Camera' ? CameraSource.Camera : CameraSource.Photos,
    });
    const base64 = photo.base64String ? `data:image/jpeg;base64,${photo.base64String}` : '';
    if (!base64) throw new Error('Imagem não obtida');
    return base64;
  };

  const handleTakePhoto = async () => {
    setShowPhotoSourceMenu(false);
    try {
      const base64 = await getPhotoAsBase64('Camera');
      await sendImageForAnalysis(base64);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.toLowerCase().includes('cancel')) setAnalysisError(message);
    }
  };

  const handleChooseFromGallery = async () => {
    setShowPhotoSourceMenu(false);
    try {
      const base64 = await getPhotoAsBase64('Photos');
      await sendImageForAnalysis(base64);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.toLowerCase().includes('cancel')) setAnalysisError(message);
    }
  };

  // Calorias: refeições do plano marcadas como completas + pratos analisados e salvos no diário
  const totalCalories = todayMeals.reduce((sum, meal) => {
    if (todayCompletedMeals.has(meal.id)) return sum + meal.totalCalories;
    return sum;
  }, 0) + savedDiaryEntries.reduce((sum, e) => sum + e.calorias, 0);

  return (
    <div className="p-4 pb-24 space-y-4 relative">
      {/* Alerta de carregamento enquanto a IA analisa */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-deep-bg/95 backdrop-blur-sm">
          <NeonSpinner size={48} />
          <p className="mt-4 text-alien-green font-medium">O Bilu está analisando seu prato...</p>
        </div>
      )}

      {/* Modal de erro (quando análise falha) */}
      {analysisError && !isReviewOpen && !isAnalyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setAnalysisError(null)}>
          <div
            className="bg-zinc-900 border border-red-500/50 rounded-2xl shadow-xl max-w-sm w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-red-400 mb-4">{analysisError}</p>
            <button
              type="button"
              onClick={() => setAnalysisError(null)}
              className="w-full py-2 rounded-xl bg-red-500/20 text-red-400 font-medium hover:bg-red-500/30"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Revisão (Revisar antes de salvar) */}
      {isReviewOpen && reviewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-xl max-w-sm w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
              <h3 className="text-lg font-bold text-alien-green">Revisar antes de salvar</h3>
              <button
                type="button"
                onClick={handleDiscardReview}
                className="p-2 rounded-full hover:bg-zinc-800 text-gray-400 hover:text-white transition-colors"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Imagem do prato */}
              <div className="flex justify-center">
                <img
                  src={reviewData?.imageBase64 ?? ''}
                  alt="Prato analisado"
                  className="max-h-[200px] w-auto rounded-xl object-cover"
                />
              </div>
              {/* Conteúdo somente leitura - Card de Confirmação */}
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-white">
                  {reviewData?.nome || 'Identificando...'}
                </h3>
                {reviewData?.peso != null && reviewData.peso > 0 && (
                  <p className="text-gray-400 text-sm">{reviewData.peso} g</p>
                )}
                <p className="text-2xl font-bold text-alien-green">
                  {reviewData?.calorias ?? 0} kcal
                </p>
              </div>
              {/* Botões de ação */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDiscardReview}
                  className="flex-1 py-3 rounded-xl bg-red-500/20 border border-red-500 text-red-400 font-bold hover:bg-red-500/30 transition-colors"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={handleConsume}
                  className="flex-1 py-3 rounded-xl bg-green-500/20 border border-green-500 text-green-400 font-bold hover:bg-green-500/30 transition-colors"
                >
                  Consumir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-alien-green mb-1">
          Bora treinar, {displayName}! 👽
        </h1>
        <p className="text-gray-400">{dayName}</p>
      </div>

      {/* Calorie Progress */}
      <Card>
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-400">Calorias</span>
          <span className="text-alien-green font-bold">{totalCalories} / {targetCalories} kcal</span>
        </div>
        <div className="w-full bg-card-bg h-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-alien-green transition-all duration-300"
            style={{ width: `${Math.min(100, (totalCalories / targetCalories) * 100)}%` }}
          />
        </div>
      </Card>

      {/* Water Tracker — duas barras: Ritmo Ideal (onde deveria estar) + Consumo Real */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Droplet className="text-cyan-400" size={24} />
            <span className="text-white font-medium">Água</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={removeWater}
              className="w-8 h-8 rounded-full bg-card-bg border border-gray-600 hover:border-alien-green/50 flex items-center justify-center text-white transition-colors"
              aria-label="Menos um copo"
            >
              −
            </button>
            <span className="text-alien-green font-bold text-xl w-12 text-center tabular-nums">{mlToGlasses(waterConsumedMl)}</span>
            <button
              onClick={addWater}
              className="w-8 h-8 rounded-full bg-alien-green/20 border border-alien-green hover:bg-alien-green/30 flex items-center justify-center text-alien-green transition-colors"
              aria-label="Mais um copo"
            >
              +
            </button>
          </div>
        </div>
        <p className="text-alien-green text-sm font-medium tabular-nums mb-3">
          {waterConsumedMl} / {waterGoalMl} ml
        </p>
        <p className="text-xs text-gray-500 mb-3 tabular-nums">
          {mlToGlasses(waterConsumedMl)} / {waterGoalGlasses} copos de 250 ml
        </p>

        {/* Corrida contra o tempo: Ritmo Ideal (trilha no fundo) + Consumo Real (azul translúcido por cima) */}
        <div className="space-y-1.5">
          <p className="text-xs text-gray-400 flex justify-between">
            <span>Ritmo ideal</span>
            <span className="tabular-nums">{idealPaceMl} ml</span>
          </p>
          <div className="relative w-full h-2 rounded-full overflow-hidden bg-card-bg">
            {/* Trilha de fundo: Ritmo Ideal — cor de trilha; laranja/alerta se Consumo Real atrás */}
            <div
              className="absolute inset-y-0 left-0 h-full rounded-full z-0 transition-all duration-300"
              style={{
                width: `${Math.min(100, (idealPaceMl / goalMl) * 100)}%`,
                backgroundColor: isBehindWaterPace ? 'rgba(255, 107, 53, 0.85)' : 'rgba(80, 80, 90, 0.6)',
              }}
            />
            {/* Consumo Real: azul translúcido (opacity 0.75) por cima */}
            <div
              className="absolute inset-y-0 left-0 h-full rounded-full z-10 transition-all duration-300"
              style={{
                width: `${Math.min(100, (waterConsumedMl / goalMl) * 100)}%`,
                backgroundColor: 'rgba(59, 130, 246, 0.75)',
              }}
            />
          </div>
          <p className="text-xs text-gray-400 flex justify-between">
            <span>Consumo real</span>
            <span className="text-blue-400 tabular-nums">{waterConsumedMl} ml</span>
          </p>
        </div>
      </Card>

      {/* Analisar prato (câmara / galeria) */}
      <Card className="flex items-center justify-center">
        <button
          type="button"
          onClick={() => setShowPhotoSourceMenu(true)}
          disabled={isAnalyzing}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-deep-bg/80 border border-alien-green/40 hover:border-alien-green hover:bg-alien-green/10 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          <Camera className="text-alien-green" size={28} />
          <span className="text-alien-green font-bold">Analisar prato</span>
        </button>
      </Card>

      {/* Menu: Tirar Foto | Escolher da Galeria */}
      {showPhotoSourceMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowPhotoSourceMenu(false)}
          role="dialog"
          aria-label="Escolher origem da foto"
        >
          <div
            className="bg-card-bg border border-gray-700 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-gray-700">
              <p className="text-center text-gray-400 text-sm">Como deseja adicionar a foto do prato?</p>
            </div>
            <button
              type="button"
              onClick={handleTakePhoto}
              className="w-full flex items-center gap-4 px-4 py-4 hover:bg-alien-green/10 transition-colors text-left"
            >
              <Camera className="text-alien-green" size={24} />
              <span className="text-white font-medium">Tirar Foto</span>
            </button>
            <button
              type="button"
              onClick={handleChooseFromGallery}
              className="w-full flex items-center gap-4 px-4 py-4 hover:bg-alien-green/10 transition-colors text-left border-t border-gray-700"
            >
              <ImageIcon className="text-alien-green" size={24} />
              <span className="text-white font-medium">Escolher da Galeria</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPhotoSourceMenu(false)}
              className="w-full px-4 py-3 text-gray-400 hover:text-white text-sm transition-colors border-t border-gray-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Meals Timeline */}
      <div>
        <h2 className="text-xl font-bold text-alien-green mb-3 flex items-center gap-2">
          <Utensils size={20} />
          Refeições
        </h2>
        <div className="space-y-3">
          {loadingDiary && savedDiaryEntries.length === 0 && (
            <Card>
              <p className="text-gray-400 text-center py-2 text-sm">Carregando diário...</p>
            </Card>
          )}
          {savedDiaryEntries.length > 0 && (
            <>
              {savedDiaryEntries.map((entry) => (
                <Card key={entry.id} className="border-alien-green/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-bilu-purple font-bold text-sm">Prato analisado</span>
                      </div>
                      <div className="text-sm text-gray-400 space-y-1">
                        {entry.descricao && <p>{entry.descricao}</p>}
                        <p className="text-alien-green">
                          {entry.calorias} kcal • P: {entry.proteina}g • C: {entry.carboidratos}g • F: {entry.gordura}g
                        </p>
                      </div>
                    </div>
                    <div className="ml-4 w-6 h-6 rounded border-2 bg-alien-green border-alien-green flex items-center justify-center">
                      <Check size={16} className="text-deep-bg" />
                    </div>
                  </div>
                </Card>
              ))}
            </>
          )}
          {todayMeals.length > 0 ? (
            todayMeals.map((meal) => {
              const isCompleted = todayCompletedMeals.has(meal.id);
              return (
                <Card
                  key={meal.id}
                  onClick={() => toggleMeal(meal.id, meal.time)}
                  className={`cursor-pointer transition-all ${isCompleted ? 'border-alien-green opacity-75' : 'hover:border-gray-600'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-bilu-purple font-bold">{meal.time}</span>
                        <span className="text-white font-medium">{meal.name}</span>
                      </div>
                      <div className="text-sm text-gray-400 space-y-1">
                        <p>{meal.foods.map(f => f.name).join(', ')}</p>
                        <p className="text-alien-green">
                          {meal.totalCalories} kcal • P: {meal.totalProtein}g • C: {meal.totalCarbs}g • F: {meal.totalFat}g
                        </p>
                      </div>
                    </div>
                    <div className={`ml-4 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                      isCompleted
                        ? 'bg-alien-green border-alien-green'
                        : 'border-gray-600 hover:border-alien-green'
                    }`}>
                      {isCompleted && <Check size={16} className="text-deep-bg" />}
                    </div>
                  </div>
                </Card>
              );
            })
          ) : (
            <Card>
              <p className="text-gray-400 text-center py-4">Nenhuma refeição planejada para hoje</p>
            </Card>
          )}
        </div>
      </div>

      {/* Workout */}
      {todayWorkout && (
        <div>
          <h2 className="text-xl font-bold text-alien-green mb-3 flex items-center gap-2">
            <Dumbbell size={20} />
            Treino
          </h2>
          <Card onClick={toggleWorkout} className={completedWorkout ? 'border-alien-green opacity-75' : ''}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-medium">Treino de Hoje</span>
                </div>
                <div className="text-sm text-gray-400">
                  <p>{todayWorkout.exercises.length} exercícios • {todayWorkout.duration} min</p>
                  <p className="text-bilu-purple mt-1">
                    {todayWorkout.exercises.map(e => e.muscleGroup).filter((v, i, a) => a.indexOf(v) === i).map(translateMuscleGroup).join(', ')}
                  </p>
                </div>
              </div>
              <div className={`ml-4 w-6 h-6 rounded border-2 flex items-center justify-center ${
                completedWorkout
                  ? 'bg-alien-green border-alien-green'
                  : 'border-gray-600'
              }`}>
                {completedWorkout && <Check size={16} className="text-deep-bg" />}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
