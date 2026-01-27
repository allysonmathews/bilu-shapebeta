import React, { useState, useMemo, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useProgress } from '../context/ProgressContext';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Plus } from 'lucide-react';
import { mockExercises } from '../data/mockDatabase';

export const EvolutionView: React.FC = () => {
  const { progress, exerciseProgress, addProgressEntry, onboardingData, plan } = useUser();
  const { weightHistory, getHistory } = useProgress();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [newBodyFat, setNewBodyFat] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');

  const handleAddProgress = () => {
    if (newWeight) {
      addProgressEntry({
        date: new Date().toISOString().split('T')[0],
        weight: parseFloat(newWeight),
        bodyFat: newBodyFat ? parseFloat(newBodyFat) : undefined,
      });
      setNewWeight('');
      setNewBodyFat('');
      setShowAddForm(false);
    }
  };

  const chartData = progress.map(p => ({
    date: new Date(p.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
    peso: p.weight,
    gordura: p.bodyFat || 0,
  }));

  // Generate Strategy Content
  const getStrategyContent = () => {
    if (!onboardingData || !plan) return null;

    const goal = onboardingData.goals.primary;
    const biotype = onboardingData.biometrics.biotype;
    const weight = onboardingData.biometrics.weight;
    const dailyCalories = plan.weeks[0]?.totalCalories || 0;

    let strategyText = '';
    let logicText = '';
    let prediction = '';

    // Strategy text based on goal
    if (goal === 'hypertrophy') {
      strategyText = 'Foco em superávit calórico e progressão de carga para romper fibras.';
      logicText = 'O superávit calórico garante energia suficiente para síntese proteica e recuperação muscular. A progressão de carga estimula adaptação contínua, promovendo hipertrofia através de microlesões controladas nas fibras.';
      prediction = `+2-3kg de massa magra`;
    } else if (goal === 'weight_loss') {
      strategyText = 'Déficit calórico controlado e treino metabólico para queimar gordura mantendo massa.';
      logicText = 'O déficit calórico moderado (500kcal) permite perda de gordura sem catabolismo excessivo. O treino metabólico mantém a massa muscular enquanto acelera o metabolismo, garantindo que a maior parte da perda seja gordura, não músculo.';
      prediction = `-3-4kg de gordura`;
    } else if (goal === 'muscle_definition') {
      strategyText = 'Equilíbrio calórico com foco em recomposição corporal: perder gordura e ganhar músculo simultaneamente.';
      logicText = 'Manter calorias próximas ao TDEE com alta proteína permite recomposição. O treino de força mantém/ganha massa enquanto o déficit leve queima gordura, criando definição muscular sem perder tamanho.';
      prediction = `-2kg gordura + +1kg massa`;
    } else if (goal === 'strength') {
      strategyText = 'Superávit calórico moderado com treino de força pesado para ganhos de força máxima.';
      logicText = 'O superávit garante energia para treinos intensos e recuperação. Foco em exercícios compostos e progressão linear de carga desenvolve força neural e hipertrofia funcional.';
      prediction = `+5-10% força + +1-2kg massa`;
    } else {
      strategyText = 'Manutenção calórica com treino equilibrado para preservar composição corporal.';
      logicText = 'Calorias no TDEE mantêm peso estável. Treino regular preserva massa muscular e saúde metabólica, prevenindo perda de força e massa ao longo do tempo.';
      prediction = `Manutenção de composição`;
    }

    // Add biotype-specific advice
    if (biotype === 'ectomorph') {
      strategyText += ' Como ectomorfo, priorize refeições frequentes para manter energia constante.';
      logicText += ' Ectomorfos têm metabolismo acelerado, então comer a cada 2-3 horas evita catabolismo e mantém síntese proteica ativa.';
    } else if (biotype === 'endomorph') {
      strategyText += ' Como endomorfo, controle de carboidratos e treino regular são essenciais.';
      logicText += ' Endomorfos tendem a acumular gordura facilmente, então distribuição inteligente de macros e atividade constante otimizam resultados.';
    }

    return {
      dailyCalories,
      strategyText,
      logicText,
      prediction,
    };
  };

  const strategy = getStrategyContent();

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

  // Dados do gráfico de evolução de cargas (agrupados por data única)
  const weightChartData = useMemo(() => {
    if (!selectedExerciseId) return [];
    const history = getHistory(selectedExerciseId);
    
    // Agrupar por data única, mantendo apenas o mais recente de cada dia
    const groupedByDate = new Map<string, { dateKey: string; dateFormatted: string; peso: number; timestamp: number }>();
    
    history.forEach(log => {
      const dateKey = log.date; // YYYY-MM-DD
      const timestamp = parseInt(log.id.split('-')[0]) || 0;
      const existing = groupedByDate.get(dateKey);
      
      // Se não existe ou se este é mais recente (maior timestamp)
      if (!existing || timestamp > existing.timestamp) {
        groupedByDate.set(dateKey, {
          dateKey,
          dateFormatted: new Date(log.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
          peso: log.weight,
          timestamp,
        });
      }
    });
    
    // Converter para array, ordenar por data (dateKey) e mapear para formato do gráfico
    return Array.from(groupedByDate.values())
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .map(item => ({
        date: item.dateFormatted,
        peso: item.peso,
      }));
  }, [selectedExerciseId, getHistory]);

  // Definir o primeiro exercício como selecionado por padrão
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
        <Button
          variant="secondary"
          icon={Plus}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          Adicionar
        </Button>
      </div>

      {/* Smart Strategy Card */}
      {strategy && (
        <Card className="border-2 border-bilu-purple bg-card-bg">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-alien-green flex items-center gap-2 mb-2">
              🛡️ Seu Plano Blindado
            </h2>
            <p className="text-gray-300 text-sm">{strategy.strategyText}</p>
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-800">
            {/* Meta Diária */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🎯</span>
                <h3 className="text-alien-green font-bold">Meta Diária</h3>
              </div>
              <p className="text-white text-lg font-semibold ml-7">{strategy.dailyCalories} Kcal</p>
            </div>

            {/* A Lógica */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🧠</span>
                <h3 className="text-alien-green font-bold">A Lógica</h3>
              </div>
              <p className="text-gray-300 text-sm ml-7 leading-relaxed">{strategy.logicText}</p>
            </div>

            {/* Previsão */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📅</span>
                <h3 className="text-alien-green font-bold">Previsão (4 Semanas)</h3>
              </div>
              <p className="text-bilu-purple text-lg font-semibold ml-7">{strategy.prediction}</p>
            </div>
          </div>
        </Card>
      )}

      {showAddForm && (
        <Card>
          <h3 className="text-white font-bold mb-3">Registrar Progresso</h3>
          <div className="space-y-3">
            <Input
              label="Peso (kg)"
              type="number"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="Ex: 70.5"
            />
            <Input
              label="Gordura Corporal (%)"
              type="number"
              value={newBodyFat}
              onChange={(e) => setNewBodyFat(e.target.value)}
              placeholder="Ex: 15"
            />
            <div className="flex gap-2">
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

      {/* Weight Chart */}
      {chartData.length > 0 && (
        <Card>
          <h3 className="text-white font-bold mb-4">Evolução do Peso</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#9D00FF" />
              <YAxis stroke="#9D00FF" />
              <Tooltip
                contentStyle={{ backgroundColor: '#121212', border: '1px solid #39FF14', borderRadius: '8px' }}
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

      {/* Body Fat Chart */}
      {chartData.some(d => d.gordura > 0) && (
        <Card>
          <h3 className="text-white font-bold mb-4">Gordura Corporal</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#9D00FF" />
              <YAxis stroke="#9D00FF" />
              <Tooltip
                contentStyle={{ backgroundColor: '#121212', border: '1px solid #39FF14', borderRadius: '8px' }}
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
        <Card>
          <h3 className="text-white font-bold mb-4">Evolução de Cargas</h3>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Selecione o exercício:</label>
            <select
              value={selectedExerciseId}
              onChange={(e) => setSelectedExerciseId(e.target.value)}
              className="w-full bg-card-bg border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-alien-green"
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
                <XAxis 
                  dataKey="date" 
                  stroke="#9D00FF"
                  tick={{ fill: '#9D00FF', fontSize: 12 }}
                />
                <YAxis 
                  stroke="#9D00FF"
                  tick={{ fill: '#9D00FF', fontSize: 12 }}
                  label={{ value: 'Peso (kg)', angle: -90, position: 'insideLeft', fill: '#9D00FF' }}
                />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: '#121212', 
                    border: '1px solid #39FF14', 
                    borderRadius: '8px',
                    color: '#39FF14'
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
                💪 Faça seu primeiro treino e salve as cargas para ver sua evolução!
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Exercise Progress */}
      {exerciseProgress.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-alien-green mb-3">Progresso nos Exercícios</h2>
          <div className="space-y-3">
            {exerciseProgress.map((ep) => {
              const latest = ep.history[ep.history.length - 1];
              const previous = ep.history.length > 1 ? ep.history[ep.history.length - 2] : null;
              const improvement = previous ? latest.weight - previous.weight : 0;

              return (
                <Card key={ep.exerciseId}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-white font-bold">{ep.exerciseName}</h3>
                      <p className="text-gray-400 text-sm">
                        {latest.sets} séries × {latest.reps} reps @ {latest.weight}kg
                      </p>
                    </div>
                    {improvement > 0 && (
                      <span className="text-alien-green text-sm font-bold">+{improvement.toFixed(1)}kg</span>
                    )}
                  </div>
                  {ep.history.length > 1 && (
                    <div className="mt-2">
                      <ResponsiveContainer width="100%" height={80}>
                        <LineChart data={ep.history.map(h => ({ date: new Date(h.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }), weight: h.weight }))}>
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

      {progress.length === 0 && (
        <Card>
          <p className="text-gray-400 text-center">Nenhum dado de progresso ainda. Adicione seu primeiro registro!</p>
        </Card>
      )}
    </div>
  );
};
