// Mapeamento de grupos musculares para português
export const translateMuscleGroup = (muscleGroup: string): string => {
  const translations: Record<string, string> = {
    'chest': 'Peito',
    'back': 'Costas',
    'shoulders': 'Ombros',
    'biceps': 'Bíceps',
    'triceps': 'Tríceps',
    'forearms': 'Antebraços',
    'abs': 'Abdômen',
    'lower_back': 'Lombar',
    'glutes': 'Glúteos',
    'quads': 'Quadríceps',
    'hamstrings': 'Posteriores',
    'calves': 'Panturrilhas',
  };
  
  const translated = translations[muscleGroup.toLowerCase()] || muscleGroup;
  // Capitalizar primeira letra
  return translated.charAt(0).toUpperCase() + translated.slice(1);
};
