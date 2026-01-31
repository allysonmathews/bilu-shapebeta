import React, { useState, useMemo, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { Card } from '../components/ui/Card';
import { Check, Droplet, Utensils, Dumbbell, Camera, X, ImageIcon, Save } from 'lucide-react';
import { DayOfWeek, WorkoutDay } from '../types';
import { translateMuscleGroup } from '../utils/muscleGroupTranslations';
import { NeonSpinner } from '../components/ui/NeonSpinner';
import { supabase, getDietJournalEntries, saveDietJournalEntry, type DietJournalRow } from '../lib/supabase';

/** Resultado da análise de prato pela IA (totais agregados dos alimentos) */
interface MealAnalysisResult {
  calorias: number;
  proteina: number;
  carboidratos: number;
  gordura: number;
  descricao?: string;
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
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [completedWorkout, setCompletedWorkout] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mealAnalysis, setMealAnalysis] = useState<MealAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showPhotoSourceMenu, setShowPhotoSourceMenu] = useState(false);
  const todayDateForDiary = getTodayDateString();
  const [savedDiaryEntries, setSavedDiaryEntries] = useState<DiaryEntry[]>([]);
  const [loadingDiary, setLoadingDiary] = useState(true);

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

  const toggleMeal = (mealId: string) => {
    toggleMealCompletion(todayDateString, mealId);
  };

  const toggleWorkout = () => {
    setCompletedWorkout(prev => !prev);
  };

  const addWater = () => {
    setWaterGlasses(prev => prev + 1);
  };

  const removeWater = () => {
    setWaterGlasses(prev => Math.max(0, prev - 1));
  };

  const closeMealAnalysisModal = () => {
    setMealAnalysis(null);
    setAnalysisError(null);
  };

  const handleSaveToDiary = async () => {
    if (!mealAnalysis) return;
    const result = await saveDietJournalEntry({
      log_date: todayDateString,
      calorias: mealAnalysis.calorias,
      proteina: mealAnalysis.proteina,
      carbo: mealAnalysis.carboidratos,
      gordura: mealAnalysis.gordura,
      descricao: mealAnalysis.descricao,
    });
    if (!result.ok) {
      setAnalysisError(result.error ?? 'Erro ao salvar no diário');
      return;
    }
    closeMealAnalysisModal();
    loadDiaryForToday();
  };

  const sendImageForAnalysis = async (base64Data: string) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setMealAnalysis(null);
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
      // Usa os dados diretamente da resposta da Edge Function
      const calorias = Number(data.calorias ?? 0);
      const proteina = Number(data.proteina ?? 0);
      const carboidratos = Number(data.carbo ?? 0);
      const gordura = Number(data.gordura ?? 0);
      const descricao = data.alimento ?? undefined;

      setMealAnalysis({
        calorias,
        proteina,
        carboidratos,
        gordura,
        descricao,
      });
      const saveResult = await saveDietJournalEntry({
        log_date: getTodayDateString(),
        calorias,
        proteina,
        carbo: carboidratos,
        gordura,
        descricao,
      });
      if (!saveResult.ok) {
        setAnalysisError(saveResult.error ?? 'Erro ao salvar no diário');
        return;
      }
      loadDiaryForToday();
      closeMealAnalysisModal();
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

      {/* Modal com resumo nutricional */}
      {(mealAnalysis !== null || analysisError !== null) && !isAnalyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={closeMealAnalysisModal}>
          <div
            className="bg-card-bg border border-alien-green/50 rounded-2xl shadow-xl max-w-sm w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-bold text-alien-green">Análise do prato</h3>
              <button
                type="button"
                onClick={closeMealAnalysisModal}
                className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              {analysisError ? (
                <p className="text-red-400">{analysisError}</p>
              ) : mealAnalysis ? (
                <>
                  {mealAnalysis.descricao && (
                    <p className="text-gray-300 text-sm mb-4">{mealAnalysis.descricao}</p>
                  )}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-deep-bg/80 rounded-xl p-3 text-center">
                      <p className="text-gray-400 text-xs uppercase tracking-wider">Calorias</p>
                      <p className="text-alien-green font-bold text-xl">{mealAnalysis.calorias}</p>
                      <p className="text-gray-500 text-xs">kcal</p>
                    </div>
                    <div className="bg-deep-bg/80 rounded-xl p-3 text-center">
                      <p className="text-gray-400 text-xs uppercase tracking-wider">Proteína</p>
                      <p className="text-bilu-purple font-bold text-xl">{mealAnalysis.proteina}g</p>
                    </div>
                    <div className="bg-deep-bg/80 rounded-xl p-3 text-center">
                      <p className="text-gray-400 text-xs uppercase tracking-wider">Hidratos</p>
                      <p className="text-bilu-purple font-bold text-xl">{mealAnalysis.carboidratos}g</p>
                    </div>
                    <div className="bg-deep-bg/80 rounded-xl p-3 text-center">
                      <p className="text-gray-400 text-xs uppercase tracking-wider">Gordura</p>
                      <p className="text-bilu-purple font-bold text-xl">{mealAnalysis.gordura}g</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveToDiary}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-alien-green/20 border border-alien-green text-alien-green font-bold hover:bg-alien-green/30 transition-colors"
                  >
                    <Save size={20} />
                    Salvar no diário
                  </button>
                </>
              ) : null}
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

      {/* Water Tracker */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplet className="text-blue-400" size={24} />
            <span className="text-white font-medium">Água</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={removeWater}
              className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white"
            >
              −
            </button>
            <span className="text-alien-green font-bold text-xl w-12 text-center">{waterGlasses}</span>
            <button
              onClick={addWater}
              className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center text-white"
            >
              +
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">Copos de 250ml</p>
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
                  onClick={() => toggleMeal(meal.id)}
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
