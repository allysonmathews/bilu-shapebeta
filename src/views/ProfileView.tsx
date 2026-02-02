import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { regenerateAllPlans } from '../context/PlanContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { InjuryMap, Injury, Severity } from '../components/InjuryMap';
import { 
  User as UserIcon, 
  Edit2, 
  Save, 
  X, 
  Scale, 
  Ruler, 
  Calendar, 
  Users, 
  Target, 
  CalendarDays, 
  Clock, 
  MapPin, 
  Utensils, 
  AlertTriangle,
  Activity,
  Sun,
  Dumbbell,
  Moon
} from 'lucide-react';
import { OnboardingData } from '../types';

// Função para converter severidade do InjuryMap para o formato do Restrictions
const convertSeverity = (severity: Severity): 'mild' | 'moderate' | 'severe' => {
  switch (severity) {
    case 'low': return 'mild';
    case 'medium': return 'moderate';
    case 'high': return 'severe';
    default: return 'mild';
  }
};

// Função para converter severidade do Restrictions para o formato do InjuryMap
const convertSeverityToInjuryMap = (severity: 'mild' | 'moderate' | 'severe'): Severity => {
  switch (severity) {
    case 'mild': return 'low';
    case 'moderate': return 'medium';
    case 'severe': return 'high';
    default: return 'low';
  }
};

// Função para converter lesões do formato InjuryMap para Restrictions
const convertInjuriesToRestrictions = (injuries: Injury[]): Array<{ location: string; severity: 'mild' | 'moderate' | 'severe' }> => {
  return injuries.map(injury => ({
    location: injury.id, // Usando o ID como location
    severity: convertSeverity(injury.severity),
  }));
};

// Função para converter lesões do formato Restrictions para InjuryMap
const convertRestrictionsToInjuries = (restrictions: Array<{ location: string; severity: 'mild' | 'moderate' | 'severe' }>): Injury[] => {
  // IDs de articulações conhecidos
  const jointIds = [
    'shoulder-front-left', 'shoulder-front-right', 'shoulder-back-left', 'shoulder-back-right',
    'elbow-front-left', 'elbow-front-right', 'elbow-back-left', 'elbow-back-right',
    'wrist-front-left', 'wrist-front-right', 'wrist-back-left', 'wrist-back-right',
    'hip-front-left', 'hip-front-right', 'hip-back-left', 'hip-back-right',
    'knee-front-left', 'knee-front-right', 'knee-back-left', 'knee-back-right',
    'ankle-front-left', 'ankle-front-right', 'ankle-back-left', 'ankle-back-right',
    'spine-front', 'spine-back',
    'scapula-back-left', 'scapula-back-right',
  ];
  
  return restrictions.map(restriction => ({
    id: restriction.location,
    type: jointIds.includes(restriction.location) ? 'joint' : 'muscle',
    severity: convertSeverityToInjuryMap(restriction.severity),
  }));
};

// Função para obter label do músculo/articulação
const getInjuryLabel = (id: string): string => {
  // Mapeamento completo baseado nos dados do InjuryMap
  const labels: Record<string, string> = {
    // Músculos - Vista frontal
    'chest-front': 'Peito',
    'shoulders-front-left': 'Ombro Esquerdo',
    'shoulders-front-right': 'Ombro Direito',
    'biceps-front-left': 'Bíceps Esquerdo',
    'biceps-front-right': 'Bíceps Direito',
    'triceps-front-left': 'Tríceps Esquerdo',
    'triceps-front-right': 'Tríceps Direito',
    'forearms-front-left': 'Antebraço Esquerdo',
    'forearms-front-right': 'Antebraço Direito',
    'abs-front': 'Abdômen',
    'quads-front-left': 'Quadríceps Esquerdo',
    'quads-front-right': 'Quadríceps Direito',
    'calves-front-left': 'Panturrilha Esquerda',
    'calves-front-right': 'Panturrilha Direita',
    // Músculos - Vista traseira
    'back-back': 'Costas',
    'shoulders-back-left': 'Ombro Esquerdo',
    'shoulders-back-right': 'Ombro Direito',
    'triceps-back-left': 'Tríceps Esquerdo',
    'triceps-back-right': 'Tríceps Direito',
    'biceps-back-left': 'Bíceps Esquerdo',
    'biceps-back-right': 'Bíceps Direito',
    'forearms-back-left': 'Antebraço Esquerdo',
    'forearms-back-right': 'Antebraço Direito',
    'lower_back-back': 'Lombar',
    'glutes-back-left': 'Glúteo Esquerdo',
    'glutes-back-right': 'Glúteo Direito',
    'hamstrings-back-left': 'Posterior Esquerdo',
    'hamstrings-back-right': 'Posterior Direito',
    'calves-back-left': 'Panturrilha Esquerda',
    'calves-back-right': 'Panturrilha Direita',
    // Articulações - Vista frontal
    'shoulder-front-left': 'Ombro Esquerdo',
    'shoulder-front-right': 'Ombro Direito',
    'elbow-front-left': 'Cotovelo Esquerdo',
    'elbow-front-right': 'Cotovelo Direito',
    'wrist-front-left': 'Punho Esquerdo',
    'wrist-front-right': 'Punho Direito',
    'hip-front-left': 'Quadril Esquerdo',
    'hip-front-right': 'Quadril Direito',
    'knee-front-left': 'Joelho Esquerdo',
    'knee-front-right': 'Joelho Direito',
    'ankle-front-left': 'Tornozelo Esquerdo',
    'ankle-front-right': 'Tornozelo Direito',
    'spine-front': 'Coluna',
    // Articulações - Vista traseira
    'shoulder-back-left': 'Ombro Esquerdo',
    'shoulder-back-right': 'Ombro Direito',
    'elbow-back-left': 'Cotovelo Esquerdo',
    'elbow-back-right': 'Cotovelo Direito',
    'wrist-back-left': 'Punho Esquerdo',
    'wrist-back-right': 'Punho Direito',
    'hip-back-left': 'Quadril Esquerdo',
    'hip-back-right': 'Quadril Direito',
    'knee-back-left': 'Joelho Esquerdo',
    'knee-back-right': 'Joelho Direito',
    'ankle-back-left': 'Tornozelo Esquerdo',
    'ankle-back-right': 'Tornozelo Direito',
    'spine-back': 'Coluna',
    'scapula-back-left': 'Escápula Esquerda',
    'scapula-back-right': 'Escápula Direita',
  };
  return labels[id] || id;
};

export const ProfileView: React.FC = () => {
  const { onboardingData, setOnboardingData, setPlan, logout } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [showInjuryMap, setShowInjuryMap] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  
  // Estados para edição
  const [formData, setFormData] = useState<Partial<OnboardingData>>({});
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [allergiesInput, setAllergiesInput] = useState('');

  // Inicializar dados do formulário quando entrar no modo edição
  useEffect(() => {
    if (isEditing && onboardingData) {
      setFormData(onboardingData);
      setInjuries(convertRestrictionsToInjuries(onboardingData.restrictions.injuries || []));
      setAllergiesInput(onboardingData.restrictions.allergies?.join(', ') || '');
    }
  }, [isEditing, onboardingData]);

  const handleSave = async () => {
    if (!onboardingData) return;

    const updatedData: OnboardingData = {
      ...onboardingData,
      biometrics: {
        ...onboardingData.biometrics,
        weight: formData.biometrics?.weight ?? onboardingData.biometrics.weight,
        height: formData.biometrics?.height ?? onboardingData.biometrics.height,
        age: formData.biometrics?.age ?? onboardingData.biometrics.age,
        gender: formData.biometrics?.gender ?? onboardingData.biometrics.gender,
        biotype: formData.biometrics?.biotype ?? onboardingData.biometrics.biotype,
      },
      goals: {
        ...onboardingData.goals,
        primary: formData.goals?.primary ?? onboardingData.goals.primary,
      },
      preferences: {
        ...onboardingData.preferences,
        workoutDaysPerWeek: formData.preferences?.workoutDaysPerWeek ?? onboardingData.preferences.workoutDaysPerWeek,
        workoutDuration: formData.preferences?.workoutDuration ?? onboardingData.preferences.workoutDuration,
        location: formData.preferences?.location ?? onboardingData.preferences.location,
        mealsPerDay: formData.preferences?.mealsPerDay ?? onboardingData.preferences.mealsPerDay,
        wakeTime: formData.preferences?.wakeTime ?? onboardingData.preferences.wakeTime,
        workoutTime: formData.preferences?.workoutTime ?? onboardingData.preferences.workoutTime,
        sleepTime: formData.preferences?.sleepTime ?? onboardingData.preferences.sleepTime,
      },
      restrictions: {
        allergies: allergiesInput.split(',').map(a => a.trim()).filter(a => a.length > 0),
        injuries: convertInjuriesToRestrictions(injuries),
      },
    };

    setOnboardingData(updatedData);

    // Persistir todos os campos do perfil permanentemente no Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      const { error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: session.user.id,
            updated_at: new Date().toISOString(),
            weight: updatedData.biometrics.weight ?? null,
            height: updatedData.biometrics.height ?? null,
            age: updatedData.biometrics.age ?? null,
            biotype: updatedData.biometrics.biotype ?? null,
            gender: updatedData.biometrics.gender ?? null,
            meals_per_day: updatedData.preferences.mealsPerDay ?? null,
            wake_up_time: updatedData.preferences.wakeTime ?? null,
            sleep_time: updatedData.preferences.sleepTime ?? null,
            workout_time: updatedData.preferences.workoutTime ?? null,
          },
          { onConflict: 'id' }
        );
      if (error) {
        console.error('Erro ao salvar perfil no Supabase:', error.message);
      }
    }

    // Regenerar o plano com os novos dados
    try {
      const newPlan = regenerateAllPlans(updatedData);
      setPlan(newPlan);
    } catch (error) {
      console.error('Erro ao regenerar plano:', error);
    }

    setIsEditing(false);
    setShowInjuryMap(false);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setShowInjuryMap(false);
    setFormData({});
    setInjuries([]);
    setAllergiesInput('');
  };

  if (!onboardingData) {
    return (
      <div className="p-4 text-center text-gray-400">
        <p>Nenhum dado de perfil encontrado.</p>
      </div>
    );
  }

  const { biometrics, goals, preferences, restrictions } = onboardingData;

  // Traduções
  const getGenderLabel = (gender: string) => {
    switch (gender) {
      case 'male': return 'Masculino';
      case 'female': return 'Feminino';
      case 'other': return 'Outro';
      default: return gender;
    }
  };

  const getBiotypeLabel = (biotype?: string) => {
    switch (biotype) {
      case 'ectomorph': return 'Ectomorfo';
      case 'mesomorph': return 'Mesomorfo';
      case 'endomorph': return 'Endomorfo';
      default: return 'Não definido';
    }
  };

  const getGoalLabel = (goal: string) => {
    switch (goal) {
      case 'weight_loss': return 'Perda de Peso';
      case 'hypertrophy': return 'Hipertrofia';
      case 'strength': return 'Força';
      case 'endurance': return 'Resistência';
      case 'maintenance': return 'Manutenção';
      case 'muscle_definition': return 'Definição Muscular';
      default: return goal;
    }
  };

  const getLocationLabel = (location: string) => {
    switch (location) {
      case 'gym': return 'Academia';
      case 'home': return 'Casa';
      case 'park': return 'Parque';
      case 'mixed': return 'Misto';
      default: return location;
    }
  };

  const getSeverityColor = (severity: 'mild' | 'moderate' | 'severe') => {
    switch (severity) {
      case 'mild': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500';
      case 'moderate': return 'bg-amber-500/20 text-amber-400 border-amber-500';
      case 'severe': return 'bg-red-500/20 text-red-400 border-red-500';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const getSeverityLabel = (severity: 'mild' | 'moderate' | 'severe') => {
    switch (severity) {
      case 'mild': return 'Baixa';
      case 'moderate': return 'Média';
      case 'severe': return 'Alta';
      default: return severity;
    }
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-20 h-20 rounded-full bg-bilu-purple flex items-center justify-center mx-auto mb-3">
          <UserIcon size={40} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-alien-green mb-2">Perfil</h1>
        {!isEditing && (
          <Button
            variant="outline"
            icon={Edit2}
            onClick={() => setIsEditing(true)}
            className="mt-2"
          >
            Editar Perfil
          </Button>
        )}
        {isEditing && (
          <div className="flex gap-2 justify-center mt-2">
            <Button
              variant="primary"
              icon={Save}
              onClick={handleSave}
            >
              Salvar Alterações
            </Button>
            <Button
              variant="ghost"
              icon={X}
              onClick={handleCancel}
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>

      {/* Mensagem de sucesso */}
      {showSuccessMessage && (
        <Card className="bg-emerald-500/20 border-emerald-500">
          <p className="text-emerald-400 text-center font-semibold">
            ✓ Plano atualizado com sucesso!
          </p>
        </Card>
      )}

      {/* Grid de Cards - Modo Leitura */}
      {!isEditing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 🅰️ Dados Pessoais & Biotipo */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Users className="text-alien-green" size={20} />
              <h3 className="text-white font-bold text-lg">Dados Pessoais & Biotipo</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-gray-400">
                  <Scale size={16} />
                  <span>Peso:</span>
                </div>
                <span className="text-alien-green font-semibold">{biometrics.weight} kg</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-gray-400">
                  <Ruler size={16} />
                  <span>Altura:</span>
                </div>
                <span className="text-alien-green font-semibold">{biometrics.height} cm</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-gray-400">
                  <Calendar size={16} />
                  <span>Idade:</span>
                </div>
                <span className="text-alien-green font-semibold">{biometrics.age} anos</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-gray-400">
                  <Users size={16} />
                  <span>Gênero:</span>
                </div>
                <span className="text-alien-green font-semibold">{getGenderLabel(biometrics.gender)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-gray-400">
                  <Activity size={16} />
                  <span>Biotipo:</span>
                </div>
                <span className="text-alien-green font-semibold">{getBiotypeLabel(biometrics.biotype)}</span>
              </div>
            </div>
          </Card>

          {/* 🅱️ Planejamento de Treino */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Target className="text-alien-green" size={20} />
              <h3 className="text-white font-bold text-lg">Planejamento de Treino</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-gray-400">
                  <Target size={16} />
                  <span>Objetivo:</span>
                </div>
                <span className="text-alien-green font-semibold">{getGoalLabel(goals.primary)}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-gray-400">
                  <CalendarDays size={16} />
                  <span>Dias por Semana:</span>
                </div>
                <span className="text-alien-green font-semibold">{preferences.workoutDaysPerWeek} dias</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-gray-400">
                  <Clock size={16} />
                  <span>Duração:</span>
                </div>
                <span className="text-alien-green font-semibold">{preferences.workoutDuration} min</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-gray-400">
                  <MapPin size={16} />
                  <span>Local:</span>
                </div>
                <span className="text-alien-green font-semibold">{getLocationLabel(preferences.location)}</span>
              </div>
            </div>
          </Card>

          {/* ©️ Nutrição */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Utensils className="text-alien-green" size={20} />
              <h3 className="text-white font-bold text-lg">Nutrição</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-gray-400">
                  <Utensils size={16} />
                  <span>Refeições por Dia:</span>
                </div>
                <span className="text-alien-green font-semibold">{preferences.mealsPerDay} refeições</span>
              </div>
              <div>
                <div className="flex items-center gap-2 text-gray-400 mb-2">
                  <AlertTriangle size={16} />
                  <span>Alergias Alimentares:</span>
                </div>
                {restrictions.allergies && restrictions.allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {restrictions.allergies.map((allergy, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-amber-500/20 text-amber-400 border border-amber-500 rounded-lg text-xs"
                      >
                        {allergy}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-500 text-xs">Nenhuma alergia registrada</span>
                )}
              </div>
            </div>
          </Card>

          {/* 🕐 Rotina Diária */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="text-alien-green" size={20} />
              <h3 className="text-white font-bold text-lg">Rotina Diária</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-gray-400">
                  <Sun size={16} />
                  <span>Acordar:</span>
                </div>
                <span className="text-alien-green font-semibold">
                  {preferences.wakeTime || '--:--'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-gray-400">
                  <Dumbbell size={16} />
                  <span>Treino:</span>
                </div>
                <span className="text-alien-green font-semibold">
                  {preferences.workoutTime || '--:--'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-gray-400">
                  <Moon size={16} />
                  <span>Dormir:</span>
                </div>
                <span className="text-alien-green font-semibold">
                  {preferences.sleepTime || '--:--'}
                </span>
              </div>
            </div>
          </Card>

          {/* ⚠️ Saúde & Lesões */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="text-alien-green" size={20} />
              <h3 className="text-white font-bold text-lg">Saúde & Lesões</h3>
            </div>
            <div className="space-y-2">
              {restrictions.injuries && restrictions.injuries.length > 0 ? (
                <div className="space-y-2">
                  {restrictions.injuries.map((injury, index) => (
                    <div
                      key={index}
                      className={`px-3 py-2 rounded-lg border ${getSeverityColor(injury.severity)} text-sm`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{getInjuryLabel(injury.location)}</span>
                        <span className="text-xs opacity-75">({getSeverityLabel(injury.severity)})</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Nenhuma restrição registrada</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Modo Edição */}
      {isEditing && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 🅰️ Dados Pessoais & Biotipo */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Users className="text-alien-green" size={20} />
                <h3 className="text-white font-bold text-lg">Dados Pessoais & Biotipo</h3>
              </div>
              <div className="space-y-3">
                <Input
                  label="Peso (kg)"
                  type="number"
                  value={formData.biometrics?.weight?.toString() || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    biometrics: { ...formData.biometrics, weight: parseFloat(e.target.value) || 0 } as any
                  })}
                />
                <Input
                  label="Altura (cm)"
                  type="number"
                  value={formData.biometrics?.height?.toString() || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    biometrics: { ...formData.biometrics, height: parseFloat(e.target.value) || 0 } as any
                  })}
                />
                <Input
                  label="Idade"
                  type="number"
                  value={formData.biometrics?.age?.toString() || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    biometrics: { ...formData.biometrics, age: parseInt(e.target.value) || 0 } as any
                  })}
                />
                <div>
                  <label className="block text-sm font-medium text-alien-green mb-1">
                    Gênero
                  </label>
                  <select
                    value={formData.biometrics?.gender || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      biometrics: { ...formData.biometrics, gender: e.target.value as any } as any
                    })}
                    className="w-full px-4 py-2 bg-card-bg border border-gray-700 rounded-lg text-white focus:outline-none focus:border-alien-green transition-colors duration-200"
                  >
                    <option value="male">Masculino</option>
                    <option value="female">Feminino</option>
                    <option value="other">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-alien-green mb-1">
                    Biotipo
                  </label>
                  <select
                    value={formData.biometrics?.biotype || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      biometrics: { ...formData.biometrics, biotype: e.target.value as any } as any
                    })}
                    className="w-full px-4 py-2 bg-card-bg border border-gray-700 rounded-lg text-white focus:outline-none focus:border-alien-green transition-colors duration-200"
                  >
                    <option value="">Selecione...</option>
                    <option value="ectomorph">Ectomorfo</option>
                    <option value="mesomorph">Mesomorfo</option>
                    <option value="endomorph">Endomorfo</option>
                  </select>
                </div>
              </div>
            </Card>

            {/* 🅱️ Planejamento de Treino */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Target className="text-alien-green" size={20} />
                <h3 className="text-white font-bold text-lg">Planejamento de Treino</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-alien-green mb-1">
                    Objetivo Principal
                  </label>
                  <select
                    value={formData.goals?.primary || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      goals: { ...formData.goals, primary: e.target.value as any } as any
                    })}
                    className="w-full px-4 py-2 bg-card-bg border border-gray-700 rounded-lg text-white focus:outline-none focus:border-alien-green transition-colors duration-200"
                  >
                    <option value="weight_loss">Perda de Peso</option>
                    <option value="hypertrophy">Hipertrofia</option>
                    <option value="strength">Força</option>
                    <option value="endurance">Resistência</option>
                    <option value="maintenance">Manutenção</option>
                    <option value="muscle_definition">Definição Muscular</option>
                  </select>
                </div>
                <Input
                  label="Dias por Semana"
                  type="number"
                  min="1"
                  max="7"
                  value={formData.preferences?.workoutDaysPerWeek?.toString() || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    preferences: { ...formData.preferences, workoutDaysPerWeek: parseInt(e.target.value) || 0 } as any
                  })}
                />
                <Input
                  label="Duração (minutos)"
                  type="number"
                  min="15"
                  value={formData.preferences?.workoutDuration?.toString() || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    preferences: { ...formData.preferences, workoutDuration: parseInt(e.target.value) || 0 } as any
                  })}
                />
                <div>
                  <label className="block text-sm font-medium text-alien-green mb-1">
                    Local de Treino
                  </label>
                  <select
                    value={formData.preferences?.location || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, location: e.target.value as any } as any
                    })}
                    className="w-full px-4 py-2 bg-card-bg border border-gray-700 rounded-lg text-white focus:outline-none focus:border-alien-green transition-colors duration-200"
                  >
                    <option value="gym">Academia</option>
                    <option value="home">Casa</option>
                    <option value="park">Parque</option>
                    <option value="mixed">Misto</option>
                  </select>
                </div>
              </div>
            </Card>

            {/* ©️ Nutrição */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Utensils className="text-alien-green" size={20} />
                <h3 className="text-white font-bold text-lg">Nutrição</h3>
              </div>
              <div className="space-y-3">
                <Input
                  label="Refeições por Dia"
                  type="number"
                  min="1"
                  max="8"
                  value={formData.preferences?.mealsPerDay?.toString() || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    preferences: { ...formData.preferences, mealsPerDay: parseInt(e.target.value) || 0 } as any
                  })}
                />
                <div>
                  <label className="block text-sm font-medium text-alien-green mb-1">
                    Alergias Alimentares (separadas por vírgula)
                  </label>
                  <Input
                    type="text"
                    value={allergiesInput}
                    onChange={(e) => setAllergiesInput(e.target.value)}
                    placeholder="Ex: Amendoim, Glúten, Lactose"
                  />
                  {allergiesInput && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {allergiesInput.split(',').map((allergy, index) => {
                        const trimmed = allergy.trim();
                        return trimmed ? (
                          <span
                            key={index}
                            className="px-2 py-1 bg-amber-500/20 text-amber-400 border border-amber-500 rounded-lg text-xs"
                          >
                            {trimmed}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* 🕐 Rotina Diária */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="text-alien-green" size={20} />
                <h3 className="text-white font-bold text-lg">Rotina Diária</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-alien-green mb-1">
                    <Sun size={16} />
                    Que horas você acorda?
                  </label>
                  <Input
                    type="time"
                    value={formData.preferences?.wakeTime || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, wakeTime: e.target.value } as any
                    })}
                    className="text-lg py-3"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-alien-green mb-1">
                    <Dumbbell size={16} />
                    Que horas você treina?
                  </label>
                  <Input
                    type="time"
                    value={formData.preferences?.workoutTime || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, workoutTime: e.target.value } as any
                    })}
                    className="text-lg py-3"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-alien-green mb-1">
                    <Moon size={16} />
                    Que horas você dorme?
                  </label>
                  <Input
                    type="time"
                    value={formData.preferences?.sleepTime || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      preferences: { ...formData.preferences, sleepTime: e.target.value } as any
                    })}
                    className="text-lg py-3"
                  />
                </div>
              </div>
            </Card>

            {/* ⚠️ Saúde & Lesões */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="text-alien-green" size={20} />
                <h3 className="text-white font-bold text-lg">Saúde & Lesões</h3>
              </div>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={() => setShowInjuryMap(!showInjuryMap)}
                  className="w-full"
                >
                  {showInjuryMap ? 'Ocultar' : 'Abrir'} Mapa de Lesões
                </Button>
                {showInjuryMap && (
                  <div className="mt-4">
                    <InjuryMap
                      initialInjuries={injuries}
                      onChange={(newInjuries) => setInjuries(newInjuries)}
                    />
                  </div>
                )}
                {!showInjuryMap && injuries.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-gray-400 text-sm">Lesões registradas:</p>
                    {injuries.map((injury, index) => (
                      <div
                        key={index}
                        className={`px-3 py-2 rounded-lg border ${
                          injury.severity === 'low' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500' :
                          injury.severity === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500' :
                          'bg-red-500/20 text-red-400 border-red-500'
                        } text-sm`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{getInjuryLabel(injury.id)}</span>
                          <span className="text-xs opacity-75">
                            ({injury.severity === 'low' ? 'Baixa' : injury.severity === 'medium' ? 'Média' : 'Alta'})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Logout */}
      {!isEditing && (
        <Button
          variant="ghost"
          icon={X}
          onClick={logout}
          className="w-full text-red-400 hover:text-red-300"
        >
          Sair
        </Button>
      )}
    </div>
  );
};
