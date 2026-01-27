import { UserProfile, Exercise } from '../data/mockData';
import { exercises } from '../data/mockData';
import { translateMuscleGroup } from '../utils/muscleGroupTranslations';

interface DashboardProps {
  userProfile: UserProfile;
  consumedCalories: number;
  nextWorkout?: Exercise;
}

export default function Dashboard({ userProfile, consumedCalories, nextWorkout }: DashboardProps) {
  const remainingCalories = Math.max(0, userProfile.dailyCalories - consumedCalories);
  const progress = (consumedCalories / userProfile.dailyCalories) * 100;

  // Encontrar próximo treino se não fornecido
  const defaultWorkout = nextWorkout || exercises[0];

  return (
    <div className="p-4 space-y-6 pb-24 bg-deep-bg min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-alien-green mb-2">
          Olá, Bilu!
        </h1>
        <p className="text-gray-400">Acompanhe seu progresso hoje</p>
      </div>

      {/* Calories Remaining Progress Circle */}
      <div className="card rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Calorias Restantes</h2>
        
        <div className="flex items-center justify-center mb-6">
          <div className="relative w-48 h-48">
            <svg className="transform -rotate-90 w-48 h-48">
              {/* Background Circle */}
              <circle
                cx="96"
                cy="96"
                r="80"
                stroke="#121212"
                strokeWidth="12"
                fill="none"
              />
              {/* Progress Circle - Alien Green */}
              <circle
                cx="96"
                cy="96"
                r="80"
                stroke="#39FF14"
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 80}`}
                strokeDashoffset={`${2 * Math.PI * 80 * (1 - progress / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-bold text-alien-green">
                {remainingCalories}
              </div>
              <div className="text-sm text-gray-400 mt-1">kcal restantes</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-deep-bg rounded-xl p-4 border border-bilu-purple">
            <div className="text-sm text-gray-400 mb-1">Consumidas</div>
            <div className="text-2xl font-bold text-alien-green">{consumedCalories}</div>
            <div className="text-xs text-gray-500">kcal</div>
          </div>
          <div className="bg-deep-bg rounded-xl p-4 border border-bilu-purple">
            <div className="text-sm text-gray-400 mb-1">Meta Diária</div>
            <div className="text-2xl font-bold text-alien-green">{userProfile.dailyCalories}</div>
            <div className="text-xs text-gray-500">kcal</div>
          </div>
        </div>
      </div>

      {/* Today's Workout Card - Purple Border */}
      <div className="card rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Treino de Hoje</h2>
        
        <div className="space-y-4">
          <div className="bg-deep-bg rounded-xl p-4 border border-bilu-purple">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {defaultWorkout.name}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {defaultWorkout.muscleGroups.map((group, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-1 bg-bilu-purple/20 text-bilu-purple rounded-full border border-bilu-purple/30"
                    >
                      {translateMuscleGroup(group)}
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-xs px-2 py-1 bg-card-bg text-gray-300 rounded-full border border-bilu-purple">
                {defaultWorkout.category}
              </span>
            </div>
            
            {defaultWorkout.caloriesBurned && (
              <div className="mt-3 pt-3 border-t border-bilu-purple/30">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Calorias queimadas:</span>
                  <span className="text-alien-green font-semibold">
                    ~{defaultWorkout.caloriesBurned} kcal/min
                  </span>
                </div>
              </div>
            )}
          </div>

          <button className="w-full py-3 px-4 rounded-xl hover:opacity-90 transition-opacity">
            Iniciar Treino
          </button>
        </div>
      </div>
    </div>
  );
}
