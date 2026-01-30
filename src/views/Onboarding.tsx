import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { usePlan } from '../context/PlanContext';
import { OnboardingData, Biometrics, Restrictions, Goals, Preferences } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { InjuryMap, Injury } from '../components/InjuryMap';
import { supabase, saveProfileToSupabase } from '../lib/supabase';
import { ArrowRight, ArrowLeft, Check, Sun, Dumbbell, Moon } from 'lucide-react';

const TOTAL_STEPS = 5;

export const Onboarding: React.FC = () => {
  const { user, setOnboardingData, setPlan, setUser } = useUser();
  const { generatePlan } = usePlan();
  const [step, setStep] = useState(1);
  const [userName, setUserName] = useState('');
  const [biometrics, setBiometrics] = useState<Biometrics>({
    weight: 70,
    height: 170,
    age: 25,
    bodyFat: 15,
    gender: 'male',
  });
  const [restrictions, setRestrictions] = useState<Restrictions>({
    allergies: [],
    injuries: [],
  });
  const [goals, setGoals] = useState<Goals>({
    primary: 'hypertrophy',
    secondary: [],
  });
  const [preferences, setPreferences] = useState<Preferences>({
    workoutDaysPerWeek: 3,
    workoutDuration: 60,
    location: 'gym',
    mealsPerDay: 4,
    wakeTime: '',
    workoutTime: '',
    sleepTime: '',
  });

  const [allergyInput, setAllergyInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const COMMON_RESTRICTIONS = ["Glúten", "Lactose", "Amendoim", "Ovo", "Soja", "Frutos do Mar", "Peixe", "Nozes", "Leite", "Crustáceos", "Trigo", "Vegano", "Vegetariano", "Carne de Porco"];

  const handleNext = async () => {
    // Validação para Step 1 - nome (opcional; se vazio usamos "Bilu")
    // Validação para Step 4 - campos de hora obrigatórios
    if (step === 4) {
      if (!preferences.wakeTime || !preferences.workoutTime || !preferences.sleepTime) {
        return;
      }
    }

    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }

    const displayName = userName.trim() || 'Bilu';
    const data: OnboardingData = {
      biometrics,
      restrictions,
      goals,
      preferences,
    };
    const plan = generatePlan(data);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      console.log('[Onboarding] Perfil salvo: erro — usuário não logado (sem session.user.id)');
      return;
    }

    setSaving(true);
    const result = await saveProfileToSupabase(
      {
        name: displayName,
        email: session.user.email ?? '',
        biotype: data.biometrics.biotype ?? '',
        objective: data.goals.primary,
        calories: plan.weeks[0]?.totalCalories ?? 0,
      },
      session.user.id
    );
    setSaving(false);

    if (result.ok) {
      console.log('[Onboarding] Perfil salvo: sucesso');
      setOnboardingData(data);
      setUser({ ...user, onboardingCompleted: true, displayName });
      setPlan(plan);
    } else {
      console.log('[Onboarding] Perfil salvo: erro', result.error);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const addAllergy = (restriction?: string) => {
    const valueToAdd = restriction || allergyInput.trim();
    if (valueToAdd && !restrictions.allergies.includes(valueToAdd)) {
      setRestrictions(prev => ({
        ...prev,
        allergies: [...prev.allergies, valueToAdd],
      }));
      setAllergyInput('');
      setShowSuggestions(false);
    }
  };

  const handleAllergyInputChange = (value: string) => {
    setAllergyInput(value);
    if (value.trim()) {
      const filtered = COMMON_RESTRICTIONS.filter(
        restriction => 
          restriction.toLowerCase().includes(value.toLowerCase()) &&
          !restrictions.allergies.includes(restriction)
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const removeAllergy = (index: number) => {
    setRestrictions(prev => ({
      ...prev,
      allergies: prev.allergies.filter((_, i) => i !== index),
    }));
  };

  // Função para converter do formato InjuryMap para o formato Restrictions
  const convertInjuriesToRestrictions = (injuries: Injury[]) => {
    const muscleLabels: Record<string, string> = {
      chest: 'Peito',
      back: 'Costas',
      shoulders: 'Ombros',
      arms: 'Braços',
      legs: 'Pernas',
      core: 'Core',
    };

    const severityMap: Record<'low' | 'medium' | 'high', 'mild' | 'moderate' | 'severe'> = {
      low: 'mild',
      medium: 'moderate',
      high: 'severe',
    };

    return injuries.map(injury => ({
      location: muscleLabels[injury.muscle] || injury.muscle,
      severity: severityMap[injury.severity],
    }));
  };

  // Função para converter do formato Restrictions para o formato InjuryMap
  const convertRestrictionsToInjuries = (injuries: Restrictions['injuries']): Injury[] => {
    const muscleMap: Record<string, 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core'> = {
      'Peito': 'chest',
      'Costas': 'back',
      'Ombros': 'shoulders',
      'Braços': 'arms',
      'Pernas': 'legs',
      'Core': 'core',
    };

    const severityMap: Record<'mild' | 'moderate' | 'severe', 'low' | 'medium' | 'high'> = {
      mild: 'low',
      moderate: 'medium',
      severe: 'high',
    };

    return injuries
      .map(injury => {
        const muscle = muscleMap[injury.location];
        if (!muscle) return null;
        return {
          muscle,
          severity: severityMap[injury.severity],
        };
      })
      .filter((injury): injury is Injury => injury !== null);
  };

  const handleInjuryMapChange = (injuries: Injury[]) => {
    setRestrictions(prev => ({
      ...prev,
      injuries: convertInjuriesToRestrictions(injuries),
    }));
  };

  return (
    <div className="min-h-screen bg-deep-bg p-4 pb-20">
      <div className="max-w-md mx-auto">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Passo {step} de {TOTAL_STEPS}</span>
            <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="w-full bg-card-bg h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-alien-green transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Nome / Como gostaria de ser chamado */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-alien-green mb-4">Como você gostaria de ser chamado?</h2>
            <p className="text-gray-400 mb-4">Digite seu nome ou apelido. Usaremos na sua saudação no app.</p>
            <Input
              label="Seu nome ou apelido"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Ex: Maria, Zé, Bilu..."
              className="
                border-alien-green/50 focus:border-alien-green
                shadow-[0_0_20px_rgba(57,255,20,0.15)] focus:shadow-[0_0_24px_rgba(57,255,20,0.25)]
                placeholder-gray-500
              "
            />
          </div>
        )}

        {/* Step 2: Biometrics */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-alien-green mb-4">Seus Dados Corporais</h2>
            
            <Input
              label="Peso (kg)"
              type="number"
              value={biometrics.weight}
              onChange={(e) => setBiometrics(prev => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))}
            />

            <Input
              label="Altura (cm)"
              type="number"
              value={biometrics.height}
              onChange={(e) => setBiometrics(prev => ({ ...prev, height: parseFloat(e.target.value) || 0 }))}
            />

            <Input
              label="Idade"
              type="number"
              value={biometrics.age}
              onChange={(e) => setBiometrics(prev => ({ ...prev, age: parseInt(e.target.value) || 0 }))}
            />

            <Input
              label="Gordura Corporal (%)"
              type="number"
              value={biometrics.bodyFat}
              onChange={(e) => setBiometrics(prev => ({ ...prev, bodyFat: parseFloat(e.target.value) || 0 }))}
            />

            <div>
              <label className="block text-sm font-medium text-alien-green mb-2">Gênero</label>
              <div className="flex gap-2">
                {(['male', 'female', 'other'] as const).map((gender) => (
                  <button
                    key={gender}
                    onClick={() => setBiometrics(prev => ({ ...prev, gender }))}
                    className={`flex-1 py-2 rounded-lg border transition-colors ${
                      biometrics.gender === gender
                        ? 'border-alien-green bg-alien-green text-deep-bg'
                        : 'border-gray-700 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    {gender === 'male' ? 'Masculino' : gender === 'female' ? 'Feminino' : 'Outro'}
                  </button>
                ))}
              </div>
            </div>

            {/* Biotipo & Detalhes */}
            <div className="mt-6 pt-6 border-t border-gray-800">
              <h3 className="text-xl font-bold text-alien-green mb-4">Biotipo & Detalhes</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-alien-green mb-2">Qual seu Biotipo?</label>
                <div className="flex flex-col gap-2">
                  {([
                    { value: 'ectomorph', label: 'Ectomorfo', description: 'Dificuldade em ganhar peso' },
                    { value: 'mesomorph', label: 'Mesomorfo', description: 'Atlético/Ganho fácil' },
                    { value: 'endomorph', label: 'Endomorfo', description: 'Facilidade em acumular gordura' },
                  ] as const).map((biotype) => (
                    <button
                      key={biotype.value}
                      onClick={() => setBiometrics(prev => ({ ...prev, biotype: biotype.value }))}
                      className={`w-full py-3 px-4 rounded-lg border transition-colors text-left ${
                        biometrics.biotype === biotype.value
                          ? 'border-alien-green bg-alien-green text-deep-bg'
                          : 'border-gray-700 text-gray-300 hover:border-gray-600'
                      }`}
                    >
                      <div className="font-medium">{biotype.label}</div>
                      <div className={`text-xs mt-1 ${
                        biometrics.biotype === biotype.value ? 'text-deep-bg/80' : 'text-gray-400'
                      }`}>
                        {biotype.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <Textarea
                label="Detalhes do seu corpo"
                placeholder="Ex: Tenho ombros largos, mas panturrilha fina..."
                value={biometrics.bodyDetails || ''}
                onChange={(e) => setBiometrics(prev => ({ ...prev, bodyDetails: e.target.value }))}
              />
            </div>
          </div>
        )}

        {/* Step 3: Restrictions */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-alien-green mb-4">Restrições</h2>
            
            <div>
              <label className="block text-sm font-medium text-alien-green mb-2">Restrições Alimentares</label>
              <div className="relative">
                <div className="flex gap-2 mb-2">
                  <div className="flex-1 relative">
                    <Input
                      value={allergyInput}
                      onChange={(e) => handleAllergyInputChange(e.target.value)}
                      onFocus={() => {
                        if (allergyInput.trim()) {
                          handleAllergyInputChange(allergyInput);
                        }
                      }}
                      onBlur={() => {
                        // Delay para permitir clique nas sugestões
                        setTimeout(() => setShowSuggestions(false), 200);
                      }}
                      placeholder="Digite para buscar restrições..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (filteredSuggestions.length > 0) {
                            addAllergy(filteredSuggestions[0]);
                          } else if (allergyInput.trim()) {
                            addAllergy();
                          }
                        }
                      }}
                    />
                    {showSuggestions && filteredSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-card-bg border border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredSuggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => addAllergy(suggestion)}
                            className="w-full text-left px-4 py-2 hover:bg-indigo-900/30 text-gray-300 hover:text-white transition-colors first:rounded-t-lg last:rounded-b-lg"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button onClick={() => addAllergy()} variant="secondary">+</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {restrictions.allergies.map((allergy, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-indigo-600/80 text-white rounded-full text-sm flex items-center gap-2"
                    >
                      {allergy}
                      <button 
                        onClick={() => removeAllergy(index)} 
                        className="hover:text-red-300 transition-colors"
                        type="button"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-alien-green mb-4">Lesões</label>
              <InjuryMap
                onChange={handleInjuryMapChange}
                initialInjuries={convertRestrictionsToInjuries(restrictions.injuries)}
              />
              <p className="text-gray-400 text-sm mt-3 text-center">
                Clique nas áreas do corpo para marcar lesões. Você pode pular esta etapa se não tiver lesões.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Goals */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-alien-green mb-4">Seus Objetivos</h2>
            
            <div>
              <label className="block text-sm font-medium text-alien-green mb-2">Objetivo Principal</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'weight_loss', label: 'Perda de Peso' },
                  { value: 'hypertrophy', label: 'Hipertrofia' },
                  { value: 'muscle_definition', label: 'Definição Muscular' },
                  { value: 'endurance', label: 'Resistência' },
                  { value: 'maintenance', label: 'Manutenção' },
                  { value: 'strength', label: 'Força' },
                ] as const).map((goal) => (
                  <button
                    key={goal.value}
                    onClick={() => setGoals(prev => ({ ...prev, primary: goal.value }))}
                    className={`py-3 rounded-lg border transition-colors ${
                      goals.primary === goal.value
                        ? 'border-alien-green bg-alien-green text-deep-bg'
                        : 'border-gray-700 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    {goal.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Seção de Rotina de Horários */}
            <div className="mt-8 pt-6 border-t border-gray-800">
              <h3 className="text-xl font-bold text-alien-green mb-4">Sua Rotina de Horários</h3>
              
              <div className="space-y-4">
                {/* Horário de Acordar */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-alien-green mb-2">
                    <Sun className="w-5 h-5" />
                    Que horas você acorda?
                  </label>
                  <Input
                    type="time"
                    value={preferences.wakeTime || ''}
                    onChange={(e) => setPreferences(prev => ({ ...prev, wakeTime: e.target.value }))}
                    className="text-lg py-3"
                    required
                  />
                  {!preferences.wakeTime && (
                    <p className="mt-1 text-xs text-red-500">Este campo é obrigatório</p>
                  )}
                </div>

                {/* Horário de Treino */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-alien-green mb-2">
                    <Dumbbell className="w-5 h-5" />
                    Que horas você treina?
                  </label>
                  <Input
                    type="time"
                    value={preferences.workoutTime || ''}
                    onChange={(e) => setPreferences(prev => ({ ...prev, workoutTime: e.target.value }))}
                    className="text-lg py-3"
                    required
                  />
                  {!preferences.workoutTime && (
                    <p className="mt-1 text-xs text-red-500">Este campo é obrigatório</p>
                  )}
                </div>

                {/* Horário de Dormir */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-alien-green mb-2">
                    <Moon className="w-5 h-5" />
                    Que horas você dorme?
                  </label>
                  <Input
                    type="time"
                    value={preferences.sleepTime || ''}
                    onChange={(e) => setPreferences(prev => ({ ...prev, sleepTime: e.target.value }))}
                    className="text-lg py-3"
                    required
                  />
                  {!preferences.sleepTime && (
                    <p className="mt-1 text-xs text-red-500">Este campo é obrigatório</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Preferences */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-alien-green mb-4">Preferências</h2>
            
            <Input
              label="Dias de Treino por Semana"
              type="number"
              min="2"
              max="7"
              value={preferences.workoutDaysPerWeek}
              onChange={(e) => setPreferences(prev => ({ ...prev, workoutDaysPerWeek: parseInt(e.target.value) || 3 }))}
            />

            <Input
              label="Duração do Treino (minutos)"
              type="number"
              value={preferences.workoutDuration}
              onChange={(e) => setPreferences(prev => ({ ...prev, workoutDuration: parseInt(e.target.value) || 60 }))}
            />

            <div>
              <label className="block text-sm font-medium text-alien-green mb-2">Local de Treino</label>
              <div className="grid grid-cols-2 gap-2">
                {(['gym', 'home', 'park', 'mixed'] as const).map((loc) => (
                  <button
                    key={loc}
                    onClick={() => setPreferences(prev => ({ ...prev, location: loc }))}
                    className={`py-3 rounded-lg border transition-colors ${
                      preferences.location === loc
                        ? 'border-alien-green bg-alien-green text-deep-bg'
                        : 'border-gray-700 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    {loc === 'gym' ? 'Academia' : loc === 'home' ? 'Casa' : loc === 'park' ? 'Parque' : 'Misto'}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Refeições por Dia"
              type="number"
              min="3"
              max="6"
              value={preferences.mealsPerDay}
              onChange={(e) => setPreferences(prev => ({ ...prev, mealsPerDay: parseInt(e.target.value) || 4 }))}
            />
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-4 mt-8">
          {step > 1 && (
            <Button variant="outline" icon={ArrowLeft} onClick={handleBack} className="flex-1">
              Voltar
            </Button>
          )}
          <Button
            variant="primary"
            icon={step === TOTAL_STEPS ? Check : ArrowRight}
            onClick={handleNext}
            className="flex-1"
            disabled={
              saving ||
              (step === 4 && (!preferences.wakeTime || !preferences.workoutTime || !preferences.sleepTime))
            }
          >
            {saving ? 'Salvando...' : step === TOTAL_STEPS ? 'Finalizar' : 'Próximo'}
          </Button>
        </div>
      </div>
    </div>
  );
};
