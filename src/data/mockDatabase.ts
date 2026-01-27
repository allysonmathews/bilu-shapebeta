// Mock Database com dados da Tabela Nutricional fornecida

export type MealTime = 'desjejum' | 'cafe' | 'almoco' | 'lanche_tarde' | 'pos_treino' | 'janta' | 'ceia';

export interface Food {
  id: string;
  name: string;
  category: 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'dairy';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  allowedMeals: MealTime[];
  unit: string;
  tags?: string[]; // Tags para restrições alimentares (ex: 'lactose', 'gluten', 'ovo')
}

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms' | 'abs' | 'lower_back' | 'glutes' | 'quads' | 'hamstrings' | 'calves';

export type JointGroup = 'shoulder_joint' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle' | 'spine' | 'scapula';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  impactedJoints: JointGroup[];
  equipment: 'gym' | 'home' | 'park' | 'bodyweight';
  type: 'strength' | 'cardio' | 'hybrid';
  goalTags: Array<'weight_loss' | 'hypertrophy' | 'endurance' | 'strength' | 'muscle_definition' | 'maintenance'>;
  videoUrl?: string;
  description: string;
  isCompound?: boolean;
}

// Função auxiliar para mapear refeições da tabela para MealTime
const mapMeals = (mealsStr: string): MealTime[] => {
  const meals: MealTime[] = [];
  const lower = mealsStr.toLowerCase();
  
  if (lower.includes('café da manhã') || lower.includes('cafe da manha') || lower.includes('desjejum')) {
    meals.push('desjejum', 'cafe');
  }
  if (lower.includes('almoço') || lower.includes('almoco')) {
    meals.push('almoco');
  }
  if (lower.includes('lanche da tarde') || lower.includes('lanche')) {
    meals.push('lanche_tarde');
  }
  if (lower.includes('pós-treino') || lower.includes('pos treino') || lower.includes('pos-treino')) {
    meals.push('pos_treino');
  }
  if (lower.includes('janta') || lower.includes('jantar')) {
    meals.push('janta');
  }
  if (lower.includes('ceia')) {
    meals.push('ceia');
  }
  
  return meals.length > 0 ? meals : ['almoco']; // fallback
};


export const mockFoods: Food[] = [
  // Carboidratos - Dados da tabela
  { id: 'c1', name: 'Arroz branco cozido', category: 'carb', calories: 130, protein: 2.5, carbs: 28, fat: 0.3, unit: '100g', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'c2', name: 'Arroz integral cozido', category: 'carb', calories: 124, protein: 2.6, carbs: 25, fat: 1, unit: '100g', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'c3', name: 'Feijão carioca', category: 'carb', calories: 76, protein: 4.8, carbs: 14, fat: 0.5, unit: '100g', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'c4', name: 'Feijão preto', category: 'carb', calories: 77, protein: 4.5, carbs: 14, fat: 0.6, unit: '100g', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'c5', name: 'Lentilha cozida', category: 'carb', calories: 93, protein: 6.3, carbs: 16, fat: 0.4, unit: '100g', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'c6', name: 'Grão-de-bico cozido', category: 'carb', calories: 164, protein: 9, carbs: 27, fat: 2.6, unit: '100g', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'c7', name: 'Macarrão cozido', category: 'carb', calories: 131, protein: 5, carbs: 25, fat: 1, unit: '100g', allowedMeals: mapMeals('Almoço Janta'), tags: ['gluten', 'trigo'] },
  { id: 'c8', name: 'Batata cozida', category: 'carb', calories: 86, protein: 1.9, carbs: 20, fat: 0.1, unit: '100g', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'c9', name: 'Batata-doce', category: 'carb', calories: 90, protein: 1.6, carbs: 21, fat: 0.2, unit: '100g', allowedMeals: mapMeals('Almoço Janta Pos Treino') },
  { id: 'c10', name: 'Mandioca cozida', category: 'carb', calories: 125, protein: 1.4, carbs: 30, fat: 0.3, unit: '100g', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'c11', name: 'Inhame cozido', category: 'carb', calories: 97, protein: 1.5, carbs: 23, fat: 0.2, unit: '100g', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'c12', name: 'Cuscuz de milho', category: 'carb', calories: 112, protein: 3, carbs: 23, fat: 0.7, unit: '100g', allowedMeals: mapMeals('Café da Manhã Janta Cafe da Manha Lanche da Tarde') },
  { id: 'c13', name: 'Tapioca', category: 'carb', calories: 130, protein: 0, carbs: 32, fat: 0, unit: '50g', allowedMeals: mapMeals('Café da Manhã Lanche da Tarde') },
  { id: 'c14', name: 'Pão francês', category: 'carb', calories: 135, protein: 4, carbs: 28, fat: 1.5, unit: '1 uni', allowedMeals: mapMeals('Café da Manhã Lanche da Tarde'), tags: ['gluten', 'trigo'] },
  { id: 'c15', name: 'Pão integral', category: 'carb', calories: 140, protein: 6, carbs: 24, fat: 2, unit: '2 fatias', allowedMeals: mapMeals('Café da Manhã Lanche da Tarde'), tags: ['gluten', 'trigo'] },
  { id: 'c16', name: 'Aveia em flocos', category: 'carb', calories: 114, protein: 4, carbs: 19, fat: 2, unit: '30g', allowedMeals: mapMeals('Café da Manhã Lanche / Pós-Treino') },
  { id: 'c18', name: 'Pão sem glúten', category: 'carb', calories: 130, protein: 4, carbs: 26, fat: 2, unit: '2 fatias', allowedMeals: mapMeals('Café da Manhã Lanche da Tarde') },
  { id: 'c17', name: 'Farinha de milho', category: 'carb', calories: 110, protein: 2, carbs: 23, fat: 1, unit: '30g', allowedMeals: mapMeals('Café da Manhã') },

  // Proteínas - Dados da tabela
  { id: 'p1', name: 'Carne bovina (patinho)', category: 'protein', calories: 133, protein: 21, carbs: 0, fat: 4, unit: '100g', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'p2', name: 'Carne bovina (acém)', category: 'protein', calories: 180, protein: 20, carbs: 0, fat: 10, unit: '100g', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'p3', name: 'Frango grelhado', category: 'protein', calories: 165, protein: 31, carbs: 0, fat: 3.6, unit: '100g', allowedMeals: mapMeals('Almoço Janta / Pós-Treino') },
  { id: 'p4', name: 'Peixe (tilápia)', category: 'protein', calories: 128, protein: 26, carbs: 0, fat: 2.7, unit: '100g', allowedMeals: mapMeals('Almoço Janta / Pós-Treino'), tags: ['peixe', 'frutos do mar'] },
  { id: 'p5', name: 'Sardinha', category: 'protein', calories: 208, protein: 25, carbs: 0, fat: 11, unit: '100g', allowedMeals: mapMeals('Almoço Janta'), tags: ['peixe', 'frutos do mar'] },
  { id: 'p6', name: 'Ovo inteiro', category: 'protein', calories: 70, protein: 6, carbs: 0.6, fat: 5, unit: '1 uni', allowedMeals: mapMeals('Café da Manhã Janta / Pós-Treino'), tags: ['ovo'] },
  { id: 'p7', name: 'Presunto', category: 'protein', calories: 70, protein: 9, carbs: 1, fat: 3, unit: '50g', allowedMeals: mapMeals('Café da Manhã Lanche da Tarde') },
  { id: 'p8', name: 'Frango desfiado', category: 'protein', calories: 165, protein: 31, carbs: 0, fat: 3.6, unit: '100g', allowedMeals: mapMeals('Almoço Janta / Pós-Treino') },
  { id: 'p9', name: 'Tofu', category: 'protein', calories: 76, protein: 8, carbs: 1.9, fat: 4.8, unit: '100g', allowedMeals: mapMeals('Almoço Janta / Pós-Treino') },

  // Laticínios - Dados da tabela
  { id: 'd1', name: 'Queijo muçarela', category: 'dairy', calories: 90, protein: 6, carbs: 1, fat: 7, unit: '30g', allowedMeals: mapMeals('Café da Manhã Lanche da Tarde'), tags: ['lactose', 'derivado de leite'] },
  { id: 'd2', name: 'Queijo minas', category: 'dairy', calories: 80, protein: 5, carbs: 1, fat: 6, unit: '30g', allowedMeals: mapMeals('Café da Manhã Lanche da Tarde'), tags: ['lactose', 'derivado de leite'] },
  { id: 'd3', name: 'Leite integral', category: 'dairy', calories: 120, protein: 6, carbs: 9, fat: 6, unit: '200ml', allowedMeals: mapMeals('Café da Manhã Ceia'), tags: ['lactose', 'leite', 'derivado de leite'] },
  { id: 'd4', name: 'Leite desnatado', category: 'dairy', calories: 70, protein: 6, carbs: 10, fat: 0.5, unit: '200ml', allowedMeals: mapMeals('Café da Manhã Ceia'), tags: ['lactose', 'leite', 'derivado de leite'] },
  { id: 'd5', name: 'Iogurte natural', category: 'dairy', calories: 100, protein: 6, carbs: 8, fat: 4, unit: '170g', allowedMeals: mapMeals('Café da Manhã Lanche / Ceia'), tags: ['lactose', 'derivado de leite'] },

  // Frutas - Dados da tabela
  { id: 'fr1', name: 'Banana', category: 'fruit', calories: 90, protein: 1, carbs: 23, fat: 0.3, unit: '1 uni', allowedMeals: mapMeals('Café da Manhã Lanche / Pós-Treino') },
  { id: 'fr2', name: 'Maçã', category: 'fruit', calories: 80, protein: 0.4, carbs: 21, fat: 0.3, unit: '1 uni', allowedMeals: mapMeals('Lanche da Tarde') },
  { id: 'fr3', name: 'Mamão', category: 'fruit', calories: 43, protein: 0.5, carbs: 11, fat: 0.3, unit: '100g', allowedMeals: mapMeals('Café da Manhã') },
  { id: 'fr4', name: 'Laranja', category: 'fruit', calories: 62, protein: 1.2, carbs: 15, fat: 0.2, unit: '1 uni', allowedMeals: mapMeals('Café da Manhã') },
  { id: 'fr5', name: 'Abacate', category: 'fruit', calories: 160, protein: 2, carbs: 9, fat: 15, unit: '100g', allowedMeals: mapMeals('Lanche da Tarde Ceia') },

  // Vegetais - Dados da tabela
  { id: 'v1', name: 'Alface', category: 'vegetable', calories: 8, protein: 0.6, carbs: 1.5, fat: 0.1, unit: '50g', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'v2', name: 'Tomate', category: 'vegetable', calories: 18, protein: 0.9, carbs: 4, fat: 0.2, unit: '100g', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'v3', name: 'Cenoura', category: 'vegetable', calories: 41, protein: 0.9, carbs: 10, fat: 0.2, unit: '100g', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'v4', name: 'Beterraba', category: 'vegetable', calories: 43, protein: 1.6, carbs: 10, fat: 0.2, unit: '100g', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'v5', name: 'Abobrinha', category: 'vegetable', calories: 17, protein: 1.2, carbs: 3, fat: 0.3, unit: '100g', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'v6', name: 'Couve', category: 'vegetable', calories: 49, protein: 4.3, carbs: 9, fat: 0.9, unit: '100g', allowedMeals: mapMeals('Almoço Janta') },

  // Gorduras - Dados da tabela
  { id: 'f1', name: 'Azeite de oliva', category: 'fat', calories: 90, protein: 0, carbs: 0, fat: 10, unit: '10ml', allowedMeals: mapMeals('Almoço Janta') },
  { id: 'f2', name: 'Manteiga', category: 'fat', calories: 72, protein: 0, carbs: 0, fat: 8, unit: '10g', allowedMeals: mapMeals('Café da Manhã') },
];

export const mockExercises: Exercise[] = [
  // Chest - Gym (Compound movements para força/hipertrofia)
  { id: 'e1', name: 'Supino Reto', muscleGroup: 'chest', secondaryMuscles: ['triceps', 'shoulders'], impactedJoints: ['shoulder_joint', 'elbow', 'wrist'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'strength', 'muscle_definition'], isCompound: true, description: 'Deite no banco, empurre a barra para cima', videoUrl: 'https://www.youtube.com/watch?v=EZMYCLKuGow' },
  { id: 'e2', name: 'Supino Inclinado', muscleGroup: 'chest', secondaryMuscles: ['triceps', 'shoulders'], impactedJoints: ['shoulder_joint', 'elbow', 'wrist'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'strength', 'muscle_definition'], isCompound: true, description: 'Banco inclinado a 45°, empurre a barra', videoUrl: 'https://www.youtube.com/watch?v=fG_03xSzT2s' },
  { id: 'e3', name: 'Crucifixo com Halteres', muscleGroup: 'chest', secondaryMuscles: ['shoulders'], impactedJoints: ['shoulder_joint', 'elbow'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'muscle_definition'], isCompound: false, description: 'Deite no banco, abra os braços com halteres', videoUrl: 'https://www.youtube.com/shorts/jrT3xWa0U9M' },
  { id: 'e4', name: 'Flexão de Braço', muscleGroup: 'chest', secondaryMuscles: ['triceps', 'shoulders', 'abs'], impactedJoints: ['shoulder_joint', 'elbow', 'wrist'], equipment: 'bodyweight', type: 'hybrid', goalTags: ['weight_loss', 'muscle_definition', 'endurance', 'maintenance'], isCompound: true, description: 'Apoie mãos e pés, desça até quase tocar o chão' },
  { id: 'e5', name: 'Flexão Inclinada', muscleGroup: 'chest', secondaryMuscles: ['triceps', 'shoulders', 'abs'], impactedJoints: ['shoulder_joint', 'elbow', 'wrist'], equipment: 'bodyweight', type: 'hybrid', goalTags: ['weight_loss', 'muscle_definition', 'endurance'], isCompound: true, description: 'Mãos no banco, pés no chão' },
  { id: 'e6', name: 'Paralelas', muscleGroup: 'chest', secondaryMuscles: ['triceps', 'shoulders'], impactedJoints: ['shoulder_joint', 'elbow', 'wrist'], equipment: 'park', type: 'strength', goalTags: ['hypertrophy', 'strength', 'muscle_definition'], isCompound: true, description: 'Apoie nas barras paralelas, desça o corpo' },
  
  // Back - Gym (Compound movements)
  { id: 'e7', name: 'Barra Fixa', muscleGroup: 'back', secondaryMuscles: ['biceps', 'shoulders', 'abs'], impactedJoints: ['shoulder_joint', 'elbow', 'wrist', 'spine'], equipment: 'park', type: 'strength', goalTags: ['hypertrophy', 'strength', 'muscle_definition'], isCompound: true, description: 'Puxe o corpo até o queixo passar da barra' },
  { id: 'e8', name: 'Remada Curvada', muscleGroup: 'back', secondaryMuscles: ['biceps', 'shoulders', 'lower_back'], impactedJoints: ['shoulder_joint', 'elbow', 'wrist', 'spine', 'scapula'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'strength', 'muscle_definition'], isCompound: true, description: 'Incline o tronco, puxe a barra até o peito', videoUrl: 'https://www.youtube.com/watch?v=G8x-hN65C34' },
  { id: 'e9', name: 'Puxada Frontal', muscleGroup: 'back', secondaryMuscles: ['biceps', 'shoulders'], impactedJoints: ['shoulder_joint', 'elbow', 'wrist', 'scapula'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'strength', 'muscle_definition'], isCompound: true, description: 'Puxe a barra até o peito na polia', videoUrl: 'https://www.youtube.com/shorts/I-my22VjbdY' },
  { id: 'e10', name: 'Remada Unilateral', muscleGroup: 'back', secondaryMuscles: ['biceps', 'shoulders', 'lower_back'], impactedJoints: ['shoulder_joint', 'elbow', 'wrist', 'spine', 'scapula'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'muscle_definition'], isCompound: false, description: 'Um braço por vez, puxe o halter' },
  { id: 'e11', name: 'Puxada com Elástico', muscleGroup: 'back', secondaryMuscles: ['biceps', 'shoulders'], impactedJoints: ['shoulder_joint', 'elbow', 'wrist', 'scapula'], equipment: 'home', type: 'hybrid', goalTags: ['weight_loss', 'muscle_definition', 'endurance', 'maintenance'], isCompound: false, description: 'Prenda elástico, puxe em direção ao peito' },
  
  // Shoulders
  { id: 'e12', name: 'Desenvolvimento com Halteres', muscleGroup: 'shoulders', secondaryMuscles: ['triceps', 'abs'], impactedJoints: ['shoulder_joint', 'elbow', 'wrist', 'spine'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'strength', 'muscle_definition'], isCompound: true, description: 'Empurre halteres acima da cabeça', videoUrl: 'https://www.youtube.com/shorts/bK2SrMWqiWY' },
  { id: 'e13', name: 'Elevação Lateral', muscleGroup: 'shoulders', secondaryMuscles: [], impactedJoints: ['shoulder_joint', 'scapula'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'muscle_definition'], isCompound: false, description: 'Levante halteres lateralmente até altura dos ombros' },
  { id: 'e14', name: 'Elevação Frontal', muscleGroup: 'shoulders', secondaryMuscles: [], impactedJoints: ['shoulder_joint', 'scapula'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'muscle_definition'], isCompound: false, description: 'Levante halter à frente até altura dos ombros' },
  { id: 'e15', name: 'Pike Push-up', muscleGroup: 'shoulders', secondaryMuscles: ['triceps', 'abs'], impactedJoints: ['shoulder_joint', 'elbow', 'wrist', 'spine'], equipment: 'bodyweight', type: 'hybrid', goalTags: ['weight_loss', 'muscle_definition', 'endurance'], isCompound: true, description: 'Flexão com quadril elevado, formando V' },
  
  // Arms (Isolation)
  { id: 'e16', name: 'Rosca Direta', muscleGroup: 'biceps', secondaryMuscles: ['forearms'], impactedJoints: ['elbow', 'wrist'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'muscle_definition'], isCompound: false, description: 'Flexione os cotovelos, levante a barra', videoUrl: 'https://www.youtube.com/shorts/6sQYqR6Y5a4' },
  { id: 'e17', name: 'Tríceps Pulley', muscleGroup: 'triceps', secondaryMuscles: ['shoulders'], impactedJoints: ['shoulder_joint', 'elbow', 'wrist'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'muscle_definition'], isCompound: false, description: 'Estenda os braços na polia', videoUrl: 'https://www.youtube.com/shorts/qJ9X2W3w4x8' },
  { id: 'e18', name: 'Tríceps Banco', muscleGroup: 'triceps', secondaryMuscles: ['shoulders'], impactedJoints: ['shoulder_joint', 'elbow', 'wrist'], equipment: 'bodyweight', type: 'hybrid', goalTags: ['weight_loss', 'muscle_definition', 'endurance'], isCompound: false, description: 'Apoie mãos no banco, desça o corpo' },
  { id: 'e19', name: 'Rosca Martelo', muscleGroup: 'biceps', secondaryMuscles: ['forearms'], impactedJoints: ['elbow', 'wrist'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'muscle_definition'], isCompound: false, description: 'Halteres com pegada neutra' },
  
  // Legs (Compound movements são essenciais)
  { id: 'e20', name: 'Agachamento Livre', muscleGroup: 'quads', secondaryMuscles: ['glutes', 'hamstrings', 'lower_back'], impactedJoints: ['spine', 'hip', 'knee', 'ankle'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'strength', 'muscle_definition'], isCompound: true, description: 'Desça até coxas paralelas ao chão', videoUrl: 'https://www.youtube.com/watch?v=2DDcRBp07uY' },
  { id: 'e21', name: 'Leg Press', muscleGroup: 'quads', secondaryMuscles: ['glutes', 'hamstrings'], impactedJoints: ['hip', 'knee', 'ankle'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'strength', 'muscle_definition'], isCompound: true, description: 'Empurre a plataforma com as pernas', videoUrl: 'https://www.youtube.com/watch?v=VKFeB7st83A' },
  { id: 'e22', name: 'Agachamento com Peso Corporal', muscleGroup: 'quads', secondaryMuscles: ['glutes', 'hamstrings', 'lower_back'], impactedJoints: ['spine', 'hip', 'knee', 'ankle'], equipment: 'bodyweight', type: 'hybrid', goalTags: ['weight_loss', 'muscle_definition', 'endurance', 'maintenance'], isCompound: true, description: 'Agache sem peso adicional' },
  { id: 'e23', name: 'Lunges', muscleGroup: 'quads', secondaryMuscles: ['glutes', 'hamstrings', 'lower_back'], impactedJoints: ['spine', 'hip', 'knee', 'ankle'], equipment: 'bodyweight', type: 'hybrid', goalTags: ['weight_loss', 'muscle_definition', 'endurance'], isCompound: true, description: 'Dê um passo à frente, desça o joelho traseiro' },
  { id: 'e24', name: 'Afundo', muscleGroup: 'quads', secondaryMuscles: ['glutes', 'hamstrings', 'lower_back'], impactedJoints: ['spine', 'hip', 'knee', 'ankle'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'muscle_definition'], isCompound: true, description: 'Lunges com halteres' },
  { id: 'e25', name: 'Extensão de Pernas', muscleGroup: 'quads', secondaryMuscles: [], impactedJoints: ['knee'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'muscle_definition'], isCompound: false, description: 'Estenda as pernas na máquina' },
  { id: 'e26', name: 'Flexão de Pernas', muscleGroup: 'hamstrings', secondaryMuscles: ['glutes'], impactedJoints: ['knee', 'hip'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'muscle_definition'], isCompound: false, description: 'Flexione as pernas na máquina' },
  { id: 'e27', name: 'Panturrilha em Pé', muscleGroup: 'calves', secondaryMuscles: [], impactedJoints: ['ankle', 'knee'], equipment: 'gym', type: 'strength', goalTags: ['hypertrophy', 'muscle_definition'], isCompound: false, description: 'Fique na ponta dos pés, eleve o corpo' },
  
  // Core (Híbridos para circuitos)
  { id: 'e28', name: 'Abdominal Crunch', muscleGroup: 'abs', secondaryMuscles: [], impactedJoints: ['spine'], equipment: 'bodyweight', type: 'hybrid', goalTags: ['weight_loss', 'muscle_definition', 'endurance', 'maintenance'], isCompound: false, description: 'Deite, flexione o tronco em direção aos joelhos' },
  { id: 'e29', name: 'Prancha', muscleGroup: 'abs', secondaryMuscles: ['lower_back', 'shoulders'], impactedJoints: ['spine', 'shoulder_joint'], equipment: 'bodyweight', type: 'strength', goalTags: ['weight_loss', 'muscle_definition', 'endurance', 'maintenance'], isCompound: false, description: 'Mantenha posição de flexão sem movimento' },
  { id: 'e30', name: 'Mountain Climber', muscleGroup: 'abs', secondaryMuscles: ['shoulders', 'quads'], impactedJoints: ['spine', 'shoulder_joint', 'hip', 'knee'], equipment: 'bodyweight', type: 'hybrid', goalTags: ['weight_loss', 'endurance'], isCompound: false, description: 'Posição de flexão, alterne joelhos rapidamente' },
  { id: 'e31', name: 'Abdominal Bicicleta', muscleGroup: 'abs', secondaryMuscles: [], impactedJoints: ['spine', 'hip'], equipment: 'bodyweight', type: 'hybrid', goalTags: ['weight_loss', 'muscle_definition', 'endurance'], isCompound: false, description: 'Deite, simule pedalar no ar' },
  { id: 'e32', name: 'Russian Twist', muscleGroup: 'abs', secondaryMuscles: ['lower_back'], impactedJoints: ['spine'], equipment: 'bodyweight', type: 'hybrid', goalTags: ['weight_loss', 'muscle_definition', 'endurance'], isCompound: false, description: 'Sente, gire o tronco de lado a lado' },
  
  // Cardio (Para perda de peso e resistência)
  { id: 'e33', name: 'Corrida', muscleGroup: 'calves', secondaryMuscles: ['quads', 'hamstrings', 'glutes'], impactedJoints: ['hip', 'knee', 'ankle', 'spine'], equipment: 'park', type: 'cardio', goalTags: ['weight_loss', 'endurance', 'maintenance'], isCompound: false, description: 'Corra em ritmo moderado a intenso' },
  { id: 'e34', name: 'Burpee', muscleGroup: 'quads', secondaryMuscles: ['glutes', 'hamstrings', 'chest', 'triceps', 'shoulders', 'abs'], impactedJoints: ['spine', 'hip', 'knee', 'ankle', 'shoulder_joint', 'elbow', 'wrist'], equipment: 'bodyweight', type: 'hybrid', goalTags: ['weight_loss', 'endurance'], isCompound: true, description: 'Agache, salte, flexão, salte novamente' },
  { id: 'e35', name: 'Jumping Jacks', muscleGroup: 'calves', secondaryMuscles: ['quads', 'shoulders'], impactedJoints: ['hip', 'knee', 'ankle', 'shoulder_joint'], equipment: 'bodyweight', type: 'cardio', goalTags: ['weight_loss', 'endurance'], isCompound: false, description: 'Salte abrindo pernas e braços simultaneamente' },
  { id: 'e36', name: 'Corda', muscleGroup: 'calves', secondaryMuscles: ['quads', 'shoulders'], impactedJoints: ['hip', 'knee', 'ankle', 'shoulder_joint', 'wrist'], equipment: 'home', type: 'cardio', goalTags: ['weight_loss', 'endurance', 'maintenance'], isCompound: false, description: 'Pule corda em ritmo constante' },
];

// Função helper para encontrar alimentos similares
export function findSimilarFood(food: Food, excludeId?: string, targetMeal?: MealTime): Food | null {
  const similar = mockFoods.filter(f => 
    f.id !== excludeId && 
    f.category === food.category &&
    Math.abs(f.calories - food.calories) < 50 &&
    (!targetMeal || f.allowedMeals.includes(targetMeal))
  );
  if (similar.length === 0) return null;
  return similar[Math.floor(Math.random() * similar.length)];
}

// Função helper para encontrar exercícios similares
export function findSimilarExercise(exercise: Exercise, excludeId?: string, availableEquipment?: string[]): Exercise | null {
  const similar = mockExercises.filter(e => 
    e.id !== excludeId && 
    e.muscleGroup === exercise.muscleGroup &&
    (!availableEquipment || availableEquipment.includes(e.equipment))
  );
  if (similar.length === 0) return null;
  return similar[Math.floor(Math.random() * similar.length)];
}
