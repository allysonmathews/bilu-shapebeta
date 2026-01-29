import React, { useState, useMemo, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useProgress } from '../context/ProgressContext';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  TrendingUp,
  Plus,
  Shield,
  Target,
  Brain,
  Calendar,
  Dumbbell,
  UtensilsCrossed,
  Moon,
  Ruler,
} from 'lucide-react';
import { mockExercises } from '../data/mockDatabase';
import { getSplitConfig, type SplitType } from '../logic/workoutGenerator';

// Labels em português para cada tipo de split
const SPLIT_LABELS: Record<SplitType, string> = {
  full_body: 'Corpo completo',
  full_body_focus_a: 'Grandes grupos (Peito, Costas, Pernas)',
  full_body_focus_b: 'Ombros, Braços e Pernas',
  full_body_focus_c: 'Core e Pernas',
  push: 'Push (Peito, Ombros, Tríceps)',
  pull: 'Pull (Costas, Bíceps)',
  legs: 'Pernas',
  chest_triceps: 'Peito + Tríceps',
  back_biceps: 'Costas + Bíceps',
  shoulders_traps: 'Ombros + Trapézio',
  legs_complete: 'Pernas Completa',
  push_ppl: 'Push (Peito, Ombros, Tríceps)',
  pull_ppl: 'Pull (Costas, Bíceps)',
  legs_ppl: 'Pernas',
  chest: 'Peito',
  back: 'Costas',
  shoulders_abs: 'Ombros + Abdômen',
  arms: 'Braços',
  upper: 'Superior',
  lower: 'Inferior',
};

export const EvolutionView: React.FC = () => {
  const { progress, exerciseProgress, addProgressEntry, onboardingData, plan } = useUser();
  const { weightHistory, getHistory } = useProgress();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newBodyFat, setNewBodyFat] = useState('');
  const [newChest, setNewChest] = useState('');
  const [newWaist, setNewWaist] = useState('');
  const [newHips, setNewHips] = useState('');
  const [newArms, setNewArms] = useState('');
  const [newThighs, setNewThighs] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');

  const handleAddProgress = () => {
    if (newWeight) {
      const measurements: { chest?: number; waist?: number; hips?: number; arms?: number; thighs?: number } = {};
      if (newChest) measurements.chest = parseFloat(newChest);
      if (newWaist) measurements.waist = parseFloat(newWaist);
      if (newHips) measurements.hips = parseFloat(newHips);
      if (newArms) measurements.arms = parseFloat(newArms);
      if (newThighs) measurements.thighs = parseFloat(newThighs);

      addProgressEntry({
        date: new Date().toISOString().split('T')[0],
        weight: parseFloat(newWeight),
        bodyFat: newBodyFat ? parseFloat(newBodyFat) : undefined,
        measurements: Object.keys(measurements).length > 0 ? measurements : undefined,
      });
      setNewWeight('');
      setNewBodyFat('');
      setNewChest('');
      setNewWaist('');
      setNewHips('');
      setNewArms('');
      setNewThighs('');
      setShowAddForm(false);
    }
  };

  const chartData = progress.map(p => ({
    date: new Date(p.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
    peso: p.weight,
    gordura: p.bodyFat || 0,
  }));

  /** Estratégia dinâmica premium por Biotipo + Objetivo */
  const getStrategyContent = () => {
    if (!onboardingData || !plan) return null;

    const goal = onboardingData.goals.primary;
    const biotype = onboardingData.biometrics.biotype ?? 'mesomorph';
    const dailyCalories = plan.weeks[0]?.totalCalories || 0;

    type Key = `${typeof goal}-${typeof biotype}`;
    const strategies: Partial<Record<Key, { strategy: string; logic: string; prediction: string }>> = {
      'hypertrophy-ectomorph': {
        strategy:
          'Estratégia de Superávit Agressivo: Seu metabolismo acelerado exige densidade calórica. Focaremos em macros de absorção lenta para manter o anabolismo constante.',
        logic:
          'Ectomorfos oxidam calorias rapidamente. O superávit garante energia para síntese proteica; refeições frequentes e alimentos densos evitam catabolismo. A progressão de carga em 4–5 séries estimula hipertrofia com recuperação adequada.',
        prediction: '+2–3 kg de massa magra em 4 semanas',
      },
      'hypertrophy-mesomorph': {
        strategy:
          'Superávit moderado com foco em progressão de carga. Seu perfil responde bem ao estímulo — priorizamos volume de séries e proteína alta.',
        logic:
          'Mesomorfos ganham massa com facilidade. Superávit controlado + treino de força pesado maximizam hipertrofia. Mantemos proteína em ~2 g/kg e distribuímos carboidratos em torno do treino.',
        prediction: '+2–3 kg de massa magra em 4 semanas',
      },
      'hypertrophy-endomorph': {
        strategy:
          'Superávit leve com controle de carboidratos. Priorizamos qualidade calórica e janelas de nutrição em torno do treino para ganhar músculo sem acumular gordura.',
        logic:
          'Endomorfos tendem a ganhar gordura mais facilmente. Mantemos superávit pequeno (~200–300 kcal), macros equilibrados e treino regular para direcionar calorias para massa magra.',
        prediction: '+1,5–2,5 kg de massa magra em 4 semanas',
      },
      'weight_loss-ectomorph': {
        strategy:
          'Déficit leve para preservar massa. Seu metabolismo já é ativo — um corte agressivo poderia aumentar catabolismo.',
        logic:
          'Déficit moderado (~300–400 kcal) com alta proteína mantém massa. Treino de força + cardio breve preservam metabolismo e garantem que a perda seja principalmente gordura.',
        prediction: '-2–3 kg de gordura em 4 semanas',
      },
      'weight_loss-mesomorph': {
        strategy:
          'Déficit calórico controlado e treino metabólico para queimar gordura mantendo massa.',
        logic:
          'O déficit moderado (≈500 kcal) permite perda de gordura sem catabolismo excessivo. O treino mantém a massa muscular e acelera o metabolismo.',
        prediction: '-3–4 kg de gordura em 4 semanas',
      },
      'weight_loss-endomorph': {
        strategy:
          'Déficit mais assertivo com foco em carboidratos e ingestão proteica alta. Controle de insulina e treino regular são prioridade.',
        logic:
          'Endomorfos respondem bem a menos carboidratos e mais atividade. Déficit de 500–750 kcal, proteína alta e distribuição inteligente de macros otimizam queima de gordura.',
        prediction: '-3–4 kg de gordura em 4 semanas',
      },
      'muscle_definition-ectomorph': {
        strategy:
          'Recomposição com ênfase em manter calorias. Evitamos déficits grandes para não perder o pouco que você ganhou.',
        logic:
          'Calorias próximas ao TDEE, alta proteína e treino de força. Pequeno superávit em dias de treino e leve déficit em off ajudam a recompor sem catabolismo.',
        prediction: '-1–2 kg gordura + +0,5–1 kg massa em 4 semanas',
      },
      'muscle_definition-mesomorph': {
        strategy:
          'Equilíbrio calórico com foco em recomposição: perder gordura e ganhar músculo simultaneamente.',
        logic:
          'TDEE mantido, proteína alta. Treino de força preserva/ganha massa; déficit leve em gordura e ajuste de carbs permitem definição sem perder tamanho.',
        prediction: '-2 kg gordura + +1 kg massa em 4 semanas',
      },
      'muscle_definition-endomorph': {
        strategy:
          'Recomposição com déficit leve e baixo carboidrato. Priorizamos definição sem grandes cortes que reduzam desempenho.',
        logic:
          'Déficit pequeno, gordura controlada, carbs em torno do treino. Força mantida para preservar massa enquanto a gordura diminui.',
        prediction: '-2 kg gordura + +0,5 kg massa em 4 semanas',
      },
      'strength-ectomorph': {
        strategy:
          'Superávit moderado e foco em exercícios compostos. Seu metabolismo exige energia estável para treinos pesados.',
        logic:
          'Calorias suficientes para força e recuperação. Progressão linear em agachamento, supino, terra e desenvolvimentos. Proteína alta e sono priorizados.',
        prediction: '+5–10% força + +1–2 kg massa em 4 semanas',
      },
      'strength-mesomorph': {
        strategy:
          'Superávit calórico moderado com treino de força pesado para ganhos de força máxima.',
        logic:
          'Superávit garante energia para sessões intensas. Foco em compostos e progressão de carga desenvolve força neural e hipertrofia funcional.',
        prediction: '+5–10% força + +1–2 kg massa em 4 semanas',
      },
      'strength-endomorph': {
        strategy:
          'Superávit leve com prioridade em força. Evitamos excesso calórico que vire gordura; qualidade e timing em torno do treino.',
        logic:
          'Energia para treinar pesado sem ganho excessivo de gordura. Compostos primeiro, proteína alta, carbs estratégicos.',
        prediction: '+5–10% força + +0,5–1,5 kg massa em 4 semanas',
      },
      'maintenance-ectomorph': {
        strategy:
          'Manutenção calórica com treino equilibrado. Refeições frequentes ajudam a sustentar peso e desempenho.',
        logic:
          'Calorias no TDEE mantêm peso estável. Treino regular preserva massa e saúde metabólica.',
        prediction: 'Manutenção de composição em 4 semanas',
      },
      'maintenance-mesomorph': {
        strategy:
          'Manutenção calórica com treino equilibrado para preservar composição corporal.',
        logic:
          'Calorias no TDEE mantêm peso estável. Treino regular preserva massa muscular e saúde metabólica.',
        prediction: 'Manutenção de composição em 4 semanas',
      },
      'maintenance-endomorph': {
        strategy:
          'Manutenção com atenção a carboidratos e atividade. Evitar excedente calórico mantém composição estável.',
        logic:
          'TDEE como base, distribuição inteligente de macros. Treino e movimento diário evitam ganho de gordura.',
        prediction: 'Manutenção de composição em 4 semanas',
      },
      'endurance-ectomorph': {
        strategy:
          'Volume de treino com calorias adequadas. Seu biotipo demanda boa ingestão para suportar carga de endurance.',
        logic:
          'Calorias suficientes para volume sem catabolismo. Carboidratos como base energética; força 1–2×/semana para preservar massa.',
        prediction: 'Melhora de capacidade aeróbia e manutenção de massa em 4 semanas',
      },
      'endurance-mesomorph': {
        strategy:
          'Equilíbrio entre endurance e força. Volume aeróbio com sessões de manutenção muscular.',
        logic:
          'TDEE ou leve superávit conforme volume. Carbs priorizados; treino de força complementar preserva massa.',
        prediction: 'Melhora de capacidade aeróbia em 4 semanas',
      },
      'endurance-endomorph': {
        strategy:
          'Endurance com controle calórico. Volume de treino ajuda na composição; evitamos excedente.',
        logic:
          'Déficit leve ou manutenção. Carbs em torno dos treinos; força 1–2×/semana para preservar massa.',
        prediction: 'Melhora de capacidade aeróbia e perda de gordura em 4 semanas',
      },
    };

    const key: Key = `${goal}-${biotype}`;
    const base = strategies[key] ?? strategies[`${goal}-mesomorph`] ?? strategies['maintenance-mesomorph'];
    const s = base!;

    return {
      dailyCalories,
      strategyText: s.strategy,
      logicText: s.logic,
      prediction: s.prediction,
    };
  };

  const strategy = getStrategyContent();

  /** Dados para cards de Treino, Nutrição e Recuperação */
  const strategyExtras = useMemo(() => {
    if (!onboardingData || !plan) return null;
    const prefs = onboardingData.preferences;
    const days = prefs.workoutDaysPerWeek ?? 5;
    const duration = prefs.workoutDuration ?? plan.weeks[0]?.workouts?.[0]?.duration ?? 90;
    const { split } = getSplitConfig(days);
    const uniqueLabels = [...new Set(split.map(s => SPLIT_LABELS[s] ?? s))];
    const splitDescription =
      uniqueLabels.length <= 3 ? uniqueLabels.join(' · ') : `Foco em grandes grupos musculares (${uniqueLabels.length} dias)`;

    const w = plan.weeks[0];
    const cal = w?.totalCalories || 0;
    const p = w?.totalProtein || 0;
    const c = w?.totalCarbs || 0;
    const f = w?.totalFat || 0;
    const calFromMacros = 4 * p + 4 * c + 9 * f;
    const total = calFromMacros || cal;
    const pctP = total > 0 ? (4 * p) / total : 0;
    const pctC = total > 0 ? (4 * c) / total : 0;
    const pctF = total > 0 ? (9 * f) / total : 0;

    return {
      splitDescription: uniqueLabels.length > 3 ? 'Foco em Grandes Grupos Musculares' : splitDescription,
      splitDetail: uniqueLabels.join(' → '),
      durationMinutes: duration,
      workoutDaysPerWeek: days,
      macros: { protein: pctP, carbs: pctC, fat: pctF, totalCalories: cal || Math.round(total), proteinG: p, carbsG: c, fatG: f },
    };
  }, [onboardingData, plan]);

  /** Semana atual do plano (1–4) para barra de progresso */
  const fourWeekProgress = useMemo(() => {
    if (!plan?.startDate) return { current: 1, total: 4, percent: 25 };
    const start = new Date(plan.startDate).getTime();
    const now = Date.now();
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const elapsed = Math.max(0, now - start);
    const current = Math.min(4, Math.max(1, Math.floor(elapsed / msPerWeek) + 1));
    const percent = Math.min(100, (current / 4) * 100);
    return { current, total: 4, percent };
  }, [plan?.startDate]);

  // Obter lista de exercícios únicos do histórico de cargas
  const exercisesWithHistory = useMemo(() => {
    const exerciseIds = new Set(weightHistory.map(log => log.exerciseId));
    return Array.from(exerciseIds)
      .map(id => {
        const exercise = mockExercises.find(e => e.id === id);
        return exercise ? { id: exercise.id, name: exercise.name } : null;
      })
      .filter((e): e is { id: string; name: string } => e !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [weightHistory]);

  const weightChartData = useMemo(() => {
    if (!selectedExerciseId) return [];
    const history = getHistory(selectedExerciseId);
    const groupedByDate = new Map<string, { dateKey: string; dateFormatted: string; peso: number; timestamp: number }>();
    history.forEach(log => {
      const dateKey = log.date;
      const timestamp = parseInt(log.id.split('-')[0]) || 0;
      const existing = groupedByDate.get(dateKey);
      if (!existing || timestamp > existing.timestamp) {
        groupedByDate.set(dateKey, {
          dateKey,
          dateFormatted: new Date(log.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
          peso: log.weight,
          timestamp,
        });
      }
    });
    return Array.from(groupedByDate.values())
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .map(item => ({ date: item.dateFormatted, peso: item.peso }));
  }, [selectedExerciseId, getHistory]);

  useEffect(() => {
    if (exercisesWithHistory.length > 0 && !selectedExerciseId) {
      setSelectedExerciseId(exercisesWithHistory[0].id);
    }
  }, [exercisesWithHistory, selectedExerciseId]);

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-alien-green flex items-center gap-2">
          <TrendingUp size={24} />
          Evolução
        </h1>
        <Button variant="secondary" icon={Plus} onClick={() => setShowAddForm(!showAddForm)}>
          Adicionar
        </Button>
      </div>

      {/* Seu Plano Blindado — Estratégia dinâmica + cards */}
      {strategy && (
        <div className="space-y-4">
          <Card className="border-2 border-bilu-purple bg-card-bg rounded-2xl overflow-hidden">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-alien-green flex items-center gap-2 mb-2">
                <Shield size={22} className="text-bilu-purple" />
                Seu Plano Blindado
              </h2>
              <p className="text-gray-300 text-sm leading-relaxed">{strategy.strategyText}</p>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-800">
              <div className="flex items-center gap-2">
                <Target size={18} className="text-bilu-purple shrink-0" />
                <div>
                  <h3 className="text-alien-green font-bold text-sm">Meta Diária</h3>
                  <p className="text-white font-semibold">{strategy.dailyCalories} kcal</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Brain size={18} className="text-bilu-purple shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-alien-green font-bold text-sm mb-1">A Lógica</h3>
                  <p className="text-gray-300 text-sm leading-relaxed">{strategy.logicText}</p>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={18} className="text-bilu-purple shrink-0" />
                  <h3 className="text-alien-green font-bold text-sm">Previsão (4 Semanas)</h3>
                </div>
                <p className="text-bilu-purple font-semibold ml-6">{strategy.prediction}</p>
                <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-alien-green to-bilu-purple rounded-full transition-all duration-500"
                    style={{ width: `${fourWeekProgress.percent}%` }}
                  />
                </div>
                <p className="text-gray-400 text-xs mt-1">
                  Semana {fourWeekProgress.current} de {fourWeekProgress.total}
                </p>
              </div>
            </div>
          </Card>

          {/* Cards: Treino, Nutrição, Recuperação */}
          {strategyExtras && (
            <div className="grid gap-3">
              <Card className="rounded-2xl border border-gray-800 hover:border-bilu-purple/50 transition-colors">
                <div className="flex gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-bilu-purple/20 shrink-0">
                    <Dumbbell size={20} className="text-bilu-purple" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-alien-green font-bold text-sm mb-1">Treino</h3>
                    <p className="text-white font-medium text-sm">{strategyExtras.splitDescription}</p>
                    <p className="text-gray-400 text-xs mt-1">{strategyExtras.splitDetail}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Duração de {strategyExtras.durationMinutes} min escolhida para maximizar o volume de séries e garantir recuperação entre exercícios.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="rounded-2xl border border-gray-800 hover:border-bilu-purple/50 transition-colors">
                <div className="flex gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-bilu-purple/20 shrink-0">
                    <UtensilsCrossed size={20} className="text-bilu-purple" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-alien-green font-bold text-sm mb-1">Nutrição</h3>
                    <p className="text-gray-300 text-sm">
                      {strategyExtras.macros.totalCalories} kcal · Macros sugeridos:
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="px-2 py-1 rounded-lg bg-alien-green/10 text-alien-green text-xs font-medium">
                        Proteína {(strategyExtras.macros.protein * 100).toFixed(0)}%
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-bilu-purple/20 text-bilu-purple text-xs font-medium">
                        Carbo {(strategyExtras.macros.carbs * 100).toFixed(0)}%
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium">
                        Gordura {(strategyExtras.macros.fat * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mt-2">
                      {strategyExtras.macros.proteinG}g P · {strategyExtras.macros.carbsG}g C · {strategyExtras.macros.fatG}g G
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="rounded-2xl border border-gray-800 hover:border-bilu-purple/50 transition-colors">
                <div className="flex gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-bilu-purple/20 shrink-0">
                    <Moon size={20} className="text-bilu-purple" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-alien-green font-bold text-sm mb-1">Recuperação</h3>
                    <p className="text-gray-300 text-sm">
                      Com {strategyExtras.workoutDaysPerWeek} dias de treino por semana, sono e descanso entre os treinos são fundamentais. Priorize 7–8h de sono e evite treinar o mesmo grupo em dias consecutivos.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Form: Registrar Peso, Gordura e Medidas */}
      {showAddForm && (
        <Card className="rounded-2xl border border-alien-green/30">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Ruler size={18} className="text-alien-green" />
            Registrar métricas
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            Registre peso e medidas para atualizar os gráficos de evolução.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Peso (kg)"
                type="number"
                inputMode="decimal"
                value={newWeight}
                onChange={e => setNewWeight(e.target.value)}
                placeholder="Ex: 70.5"
              />
              <Input
                label="Gordura (%)"
                type="number"
                inputMode="decimal"
                value={newBodyFat}
                onChange={e => setNewBodyFat(e.target.value)}
                placeholder="Ex: 15"
              />
            </div>
            <div className="pt-2 border-t border-gray-800">
              <p className="text-gray-400 text-xs font-medium mb-2">Medidas (cm) — opcional</p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Peito"
                  type="number"
                  inputMode="decimal"
                  value={newChest}
                  onChange={e => setNewChest(e.target.value)}
                  placeholder="cm"
                />
                <Input
                  label="Cintura"
                  type="number"
                  inputMode="decimal"
                  value={newWaist}
                  onChange={e => setNewWaist(e.target.value)}
                  placeholder="cm"
                />
                <Input
                  label="Quadril"
                  type="number"
                  inputMode="decimal"
                  value={newHips}
                  onChange={e => setNewHips(e.target.value)}
                  placeholder="cm"
                />
                <Input
                  label="Braços"
                  type="number"
                  inputMode="decimal"
                  value={newArms}
                  onChange={e => setNewArms(e.target.value)}
                  placeholder="cm"
                />
                <Input
                  label="Coxas"
                  type="number"
                  inputMode="decimal"
                  value={newThighs}
                  onChange={e => setNewThighs(e.target.value)}
                  placeholder="cm"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="primary" onClick={handleAddProgress} className="flex-1">
                Salvar
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)} className="flex-1">
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Gráfico Peso */}
      {chartData.length > 0 && (
        <Card className="rounded-2xl">
          <h3 className="text-white font-bold mb-4">Evolução do Peso</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#9D00FF" />
              <YAxis stroke="#9D00FF" />
              <Tooltip
                contentStyle={{ backgroundColor: '#121212', border: '1px solid #39FF14', borderRadius: '12px' }}
                labelStyle={{ color: '#39FF14' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="peso"
                stroke="#39FF14"
                strokeWidth={2}
                dot={{ fill: '#39FF14', r: 4 }}
                name="Peso (kg)"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Gráfico Gordura */}
      {chartData.some(d => d.gordura > 0) && (
        <Card className="rounded-2xl">
          <h3 className="text-white font-bold mb-4">Gordura Corporal</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#9D00FF" />
              <YAxis stroke="#9D00FF" />
              <Tooltip
                contentStyle={{ backgroundColor: '#121212', border: '1px solid #39FF14', borderRadius: '12px' }}
                labelStyle={{ color: '#39FF14' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="gordura"
                stroke="#9D00FF"
                strokeWidth={2}
                dot={{ fill: '#9D00FF', r: 4 }}
                name="Gordura (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Evolução de Cargas */}
      {exercisesWithHistory.length > 0 && (
        <Card className="rounded-2xl">
          <h3 className="text-white font-bold mb-4">Evolução de Cargas</h3>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Selecione o exercício:</label>
            <select
              value={selectedExerciseId}
              onChange={e => setSelectedExerciseId(e.target.value)}
              className="w-full bg-card-bg border border-gray-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-alien-green"
            >
              {exercisesWithHistory.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>
          {weightChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={weightChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#9D00FF" tick={{ fill: '#9D00FF', fontSize: 12 }} />
                <YAxis
                  stroke="#9D00FF"
                  tick={{ fill: '#9D00FF', fontSize: 12 }}
                  label={{ value: 'Peso (kg)', angle: -90, position: 'insideLeft', fill: '#9D00FF' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#121212',
                    border: '1px solid #39FF14',
                    borderRadius: '12px',
                    color: '#39FF14',
                  }}
                  labelStyle={{ color: '#39FF14' }}
                />
                <Line
                  type="monotone"
                  dataKey="peso"
                  stroke="#39FF14"
                  strokeWidth={3}
                  dot={{ fill: '#39FF14', r: 5 }}
                  activeDot={{ r: 7, fill: '#2EE010' }}
                  name="Peso (kg)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-2">Nenhum dado de carga registrado ainda.</p>
              <p className="text-alien-green text-sm font-medium">
                Faça seu primeiro treino e salve as cargas para ver sua evolução.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Progresso nos Exercícios */}
      {exerciseProgress.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-alien-green mb-3">Progresso nos Exercícios</h2>
          <div className="space-y-3">
            {exerciseProgress.map(ep => {
              const latest = ep.history[ep.history.length - 1];
              const previous = ep.history.length > 1 ? ep.history[ep.history.length - 2] : null;
              const improvement = previous ? latest.weight - previous.weight : 0;
              return (
                <Card key={ep.exerciseId} className="rounded-2xl">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-white font-bold">{ep.exerciseName}</h3>
                      <p className="text-gray-400 text-sm">
                        {latest.sets} séries × {latest.reps} reps @ {latest.weight} kg
                      </p>
                    </div>
                    {improvement > 0 && (
                      <span className="text-alien-green text-sm font-bold">+{improvement.toFixed(1)} kg</span>
                    )}
                  </div>
                  {ep.history.length > 1 && (
                    <div className="mt-2">
                      <ResponsiveContainer width="100%" height={80}>
                        <LineChart
                          data={ep.history.map(h => ({
                            date: new Date(h.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
                            weight: h.weight,
                          }))}
                        >
                          <Line
                            type="monotone"
                            dataKey="weight"
                            stroke="#39FF14"
                            strokeWidth={2}
                            dot={{ fill: '#39FF14', r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {progress.length === 0 && !showAddForm && (
        <Card className="rounded-2xl">
          <p className="text-gray-400 text-center">
            Nenhum dado de progresso ainda. Use <strong className="text-alien-green">+ Adicionar</strong> para registrar peso e medidas.
          </p>
        </Card>
      )}
    </div>
  );
};
