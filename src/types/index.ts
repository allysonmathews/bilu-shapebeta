// Tipos principais da aplicação

export interface User {
  isAuthenticated: boolean;
  onboardingCompleted: boolean;
}

export interface Biometrics {
  weight: number; // kg
  height: number; // cm
  age: number;
  bodyFat: number; // %
  gender: 'male' | 'female' | 'other';
  biotype?: 'ectomorph' | 'mesomorph' | 'endomorph';
  bodyDetails?: string;
}

export interface Restrictions {
  allergies: string[];
  injuries: Array<{
    location: string;
    severity: 'mild' | 'moderate' | 'severe';
  }>;
}

export interface Goals {
  primary: 'weight_loss' | 'hypertrophy' | 'endurance' | 'maintenance' | 'strength' | 'muscle_definition';
  secondary?: string[];
}

export interface Preferences {
  workoutDaysPerWeek: number;
  workoutDuration: number; // minutos
  location: 'gym' | 'home' | 'park' | 'mixed';
  mealsPerDay: number;
  wakeTime?: string; // HH:mm
  workoutTime?: string; // HH:mm
  sleepTime?: string; // HH:mm
}

export interface OnboardingData {
  biometrics: Biometrics;
  restrictions: Restrictions;
  goals: Goals;
  preferences: Preferences;
}

export interface Meal {
  id: string;
  name: string;
  time: string; // HH:mm
  foods: Array<{
    id: string;
    name: string;
    quantity: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface WorkoutDay {
  id: string;
  day: number; // 1-28 (4 semanas)
  week: number; // 1-4
  exercises: Array<{
    id: string;
    name: string;
    sets: number;
    reps: number;
    weight?: number; // kg
    muscleGroup: string;
    equipment: string;
    videoUrl?: string;
  }>;
  duration: number; // minutos
  completed: boolean;
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DailyMeals {
  monday: Meal[];
  tuesday: Meal[];
  wednesday: Meal[];
  thursday: Meal[];
  friday: Meal[];
  saturday: Meal[];
  sunday: Meal[];
}

export interface WeeklyPlan {
  week: number;
  meals: Meal[]; // Keep for backward compatibility
  dailyMeals?: DailyMeals; // New structure with meals per day
  workouts: WorkoutDay[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export interface FourWeekPlan {
  weeks: WeeklyPlan[];
  startDate: string; // ISO date
}

export interface ProgressEntry {
  date: string;
  weight: number;
  bodyFat?: number;
  measurements?: {
    chest?: number;
    waist?: number;
    hips?: number;
    arms?: number;
    thighs?: number;
  };
}

export interface ExerciseProgress {
  exerciseId: string;
  exerciseName: string;
  history: Array<{
    date: string;
    sets: number;
    reps: number;
    weight: number;
  }>;
}
