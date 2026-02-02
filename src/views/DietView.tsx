import React, { useState } from 'react';
import { useUser } from '../context/UserContext';
import { usePlan } from '../context/PlanContext';
import { Card } from '../components/ui/Card';
import { SwapButton } from '../components/ui/SwapButton';
import { Meal, DayOfWeek } from '../types';
import { Utensils, ShoppingCart, Check } from 'lucide-react';
import { mockFoods } from '../data/mockDatabase';

export const DietView: React.FC = () => {
  const { plan, setPlan } = useUser();
  const { swapFoodItem } = usePlan();
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('monday');
  const [activeTab, setActiveTab] = useState<'cardapio' | 'compras'>('cardapio');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const daysOfWeek: { key: DayOfWeek; label: string; short: string }[] = [
    { key: 'monday', label: 'Segunda-feira', short: 'Seg' },
    { key: 'tuesday', label: 'Terça-feira', short: 'Ter' },
    { key: 'wednesday', label: 'Quarta-feira', short: 'Qua' },
    { key: 'thursday', label: 'Quinta-feira', short: 'Qui' },
    { key: 'friday', label: 'Sexta-feira', short: 'Sex' },
    { key: 'saturday', label: 'Sábado', short: 'Sáb' },
    { key: 'sunday', label: 'Domingo', short: 'Dom' },
  ];

  if (!plan) {
    return (
      <div className="p-4 text-center text-gray-400">
        <p>Carregando dieta...</p>
      </div>
    );
  }

  const currentWeek = plan.weeks[selectedWeek - 1];
  
  // Get meals for selected day
  const getDayMeals = (): Meal[] => {
    if (currentWeek.dailyMeals) {
      return currentWeek.dailyMeals[selectedDay] || [];
    }
    // Fallback to old structure (all meals, show all)
    return currentWeek.meals || [];
  };

  const dayMeals = getDayMeals();

  const handleSwapFood = (mealId: string, foodId: string) => {
    if (!plan) return;

    // Encontrar o índice da refeição no dia selecionado
    const currentWeek = plan.weeks[selectedWeek - 1];
    if (!currentWeek.dailyMeals) return;

    const dayMeals = currentWeek.dailyMeals[selectedDay];
    if (!dayMeals) return;

    const mealIndex = dayMeals.findIndex(m => m.id === mealId);
    if (mealIndex === -1) return;

    // Chamar função global swapFoodItem
    const updatedPlan = swapFoodItem(plan, selectedWeek - 1, selectedDay, mealIndex, foodId);
    
    // Atualizar o plano no contexto
    setPlan(updatedPlan);
  };

  // Extract portion value and unit from food name
  const extractPortionInfo = (foodName: string): { value: number; unit: string; baseName: string } => {
    // Try to extract value from parentheses: "Arroz (100g)" → { value: 100, unit: 'g' }
    // Also match: "(1 unidade)", "(2 unidades)", "(1 colher)", "(2 fatias)"
    const parenMatch = foodName.match(/\((\d+)\s*(g|kg|gr|ml|l|L|un|unidade|unidades|colher|colheres|fatia|fatias)\)/i);
    
    if (parenMatch) {
      const value = parseInt(parenMatch[1]);
      const unitStr = parenMatch[2].toLowerCase();
      
      // Normalize units
      let unit = 'g';
      if (unitStr === 'kg') unit = 'kg';
      else if (unitStr === 'g' || unitStr === 'gr') unit = 'g';
      else if (unitStr === 'ml' || unitStr === 'l') unit = 'ml';
      else if (unitStr === 'un' || unitStr === 'unidade' || unitStr === 'unidades' || 
               unitStr === 'colher' || unitStr === 'colheres' ||
               unitStr === 'fatia' || unitStr === 'fatias') {
        unit = 'un';
      }
      
      // Extract base name (without parentheses)
      const baseName = foodName.replace(/\s*\([^)]+\)\s*/, '').trim();
      
      return { value, unit, baseName };
    }
    
    // If no parentheses, try to detect from name and category
    const nameLower = foodName.toLowerCase();
    let unit = 'g';
    let value = 100; // Default portion in grams
    
    // Detect liquids
    if (nameLower.includes('água') || nameLower.includes('agua') || 
        nameLower.includes('suco') || nameLower.includes('leite') ||
        nameLower.includes('ml') || nameLower.includes('litro')) {
      unit = 'ml';
      value = 200; // Default 200ml
    }
    // Detect units (eggs, fruits, bread slices)
    else if (nameLower.includes('ovo') || nameLower.includes('ovos') ||
             nameLower.includes('banana') || nameLower.includes('maçã') ||
             nameLower.includes('laranja') || nameLower.includes('pão') ||
             nameLower.includes('fatia') || nameLower.includes('fatias')) {
      unit = 'un';
      value = 1; // Default 1 unit
    }
    // Detect by weight keywords
    else if (nameLower.includes('kg')) {
      unit = 'kg';
      value = 1; // Default 1kg
    }
    // Default: grams for solids (meat, fish, vegetables without parentheses)
    else {
      unit = 'g';
      value = 100; // Default 100g for foods without parentheses
    }
    
    return { value, unit, baseName: foodName };
  };

  // Generate Grocery List for selected week
  // CORRIGIDO: Agora calcula corretamente somando TODAS as ocorrências da semana inteira
  const generateGroceryList = (weekNumber: number) => {
    const week = plan.weeks[weekNumber - 1];
    if (!week) return [];

    const foodMap = new Map<string, { 
      name: string; 
      totalQuantity: number; 
      frequency: number;
      unit: string;
      baseName: string;
    }>();

    // Use dailyMeals if available, otherwise fallback to meals
    const allMeals = week.dailyMeals 
      ? [
          ...week.dailyMeals.monday,
          ...week.dailyMeals.tuesday,
          ...week.dailyMeals.wednesday,
          ...week.dailyMeals.thursday,
          ...week.dailyMeals.friday,
          ...week.dailyMeals.saturday,
          ...week.dailyMeals.sunday,
        ]
      : week.meals;

    // Iterar por TODAS as refeições da semana (7 dias)
    allMeals.forEach(meal => {
      meal.foods.forEach(food => {
        const portionInfo = extractPortionInfo(food.name);
        const key = portionInfo.baseName; // Use base name as key to group same foods
        
        // FÓRMULA CORRIGIDA: Peso Total = (Tamanho da Porção) * (Quantidade) * (Número de ocorrências)
        // Cada ocorrência adiciona: portionValue * quantity
        const portionValue = portionInfo.value;
        const quantity = food.quantity || 1;
        
        // Normalizar para gramas se necessário para somar corretamente
        let contribution = portionValue * quantity;
        let unit = portionInfo.unit;
        
        // Se a unidade for 'un', manter como está (não converter)
        // Se for ml, manter como ml (não converter para g)
        // Se for kg, converter para g para somar
        if (unit === 'kg') {
          contribution = contribution * 1000; // Converter kg para g
          unit = 'g'; // Usar g como unidade base
        }
        
        const existing = foodMap.get(key);
        
        if (existing) {
          // Verificar se a unidade é compatível
          // Se a unidade existente for diferente e não for 'un', normalizar
          if (existing.unit !== unit && existing.unit !== 'un' && unit !== 'un') {
            // Se ambos são g ou ml, pode somar diretamente
            if ((existing.unit === 'g' && unit === 'g') || 
                (existing.unit === 'ml' && unit === 'ml')) {
              existing.totalQuantity += contribution;
              existing.frequency += 1;
            } else {
              // Unidades incompatíveis - manter a primeira encontrada e somar valores
              // (assumindo que são a mesma unidade base)
              existing.totalQuantity += contribution;
              existing.frequency += 1;
            }
          } else if (existing.unit === unit) {
            // Unidades iguais - somar normalmente
            existing.totalQuantity += contribution;
            existing.frequency += 1;
          } else {
            // Unidades diferentes mas uma é 'un' - manter separado ou usar a primeira
            existing.totalQuantity += contribution;
            existing.frequency += 1;
          }
        } else {
          foodMap.set(key, {
            name: portionInfo.baseName,
            totalQuantity: contribution,
            frequency: 1,
            unit: unit, // Usar unidade normalizada
            baseName: portionInfo.baseName,
          });
        }
      });
    });

    return Array.from(foodMap.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(item => ({
        ...item,
        id: item.name, // Use name as ID for checkbox tracking
      }));
  };

  // Usar lista_compras da API quando disponível (dieta gerada por IA)
  const groceryList = plan.dietaApi?.lista_compras?.length
    ? plan.dietaApi.lista_compras.map((item, i) => ({
        id: `${item.item}-${i}`,
        name: item.item,
        totalQuantity: 1,
        frequency: 1,
        unit: item.quantidade,
        baseName: item.item,
      }))
    : generateGroceryList(selectedWeek);
  
  // Separate items into "A comprar" and "Já comprado"
  const itemsToBuy = groceryList.filter(item => !checkedItems.has(item.id));
  const itemsBought = groceryList.filter(item => checkedItems.has(item.id));

  const handleToggleItem = (itemId: string) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };


  // Helper function to get food unit from mockFoods
  const getFoodUnit = (foodId: string): string => {
    const food = mockFoods.find(f => f.id === foodId);
    if (food?.unit) {
      // Extrair apenas a unidade, removendo números no início
      // Ex: "100g" -> "g", "1 unidade" -> "Unidade", "1 fatia" -> "Fatia"
      const unitText = food.unit.replace(/^\d+\s*/, '').trim();
      
      // Normalizar unidades comuns
      if (unitText.toLowerCase().includes('unidade')) {
        return 'Unidade';
      }
      if (unitText.toLowerCase().includes('fatia')) {
        return 'Fatia';
      }
      if (unitText.toLowerCase().includes('colher')) {
        return 'Colher de sopa';
      }
      if (unitText.toLowerCase().includes('dose')) {
        return 'Dose';
      }
      if (unitText.toLowerCase().includes('pote')) {
        return 'Pote';
      }
      if (unitText.toLowerCase().includes('xícara')) {
        return 'Xícara';
      }
      
      // Retornar a unidade capitalizada
      return unitText.charAt(0).toUpperCase() + unitText.slice(1);
    }
    // Fallback: tentar extrair do nome
    const foodName = food?.name || '';
    if (foodName.toLowerCase().includes('100g') || foodName.toLowerCase().includes('(100g)')) {
      return '100g';
    }
    return 'Unidade'; // Default
  };

  // Helper function to get clean food name (without portion info)
  const getCleanFoodName = (foodId: string, foodName: string): string => {
    const food = mockFoods.find(f => f.id === foodId);
    if (food) {
      // Remover informações de porção do nome se presente
      return food.name.replace(/\s*\([^)]+\)\s*/, '').trim();
    }
    // Fallback: remover do nome fornecido
    return foodName.replace(/\s*\([^)]+\)\s*/, '').trim();
  };

  // Format quantity with strict pattern: "g", "ml", "uni"
  const formatQuantity = (amount: number, unit: string) => {
    // Tenta extrair números da unidade (ex: '100g' -> 100)
    const match = unit.match(/(\d+)/);
    const baseQty = match ? parseInt(match[0]) : 1;
    
    // Calcula o total real
    const total = Math.round(amount * baseQty);

    // Define o sufixo padrão
    let suffix = 'uni'; 
    if (unit.toLowerCase().includes('ml')) suffix = 'ml';
    else if (unit.toLowerCase().includes('g') && !unit.toLowerCase().includes('uni')) suffix = 'g'; // Evita 'uni' se for gramas
    
    return `${total} ${suffix}`;
  };

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-alien-green mb-4 flex items-center justify-center gap-2">
          <Utensils size={24} />
          Dieta
        </h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 bg-card-bg p-1 rounded-lg border border-gray-800">
          <button
            onClick={() => setActiveTab('cardapio')}
            className={`flex-1 py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'cardapio'
                ? 'bg-alien-green text-deep-bg font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Utensils size={18} />
            Cardápio
          </button>
          <button
            onClick={() => setActiveTab('compras')}
            className={`flex-1 py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'compras'
                ? 'bg-alien-green text-deep-bg font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ShoppingCart size={18} />
            Lista de Compras
          </button>
        </div>

        {/* Week Selector - Only show for Cardápio or when in Compras tab */}
        {activeTab === 'cardapio' || activeTab === 'compras' ? (
          <select
            value={selectedWeek}
            onChange={(e) => {
              setSelectedWeek(parseInt(e.target.value));
              // Reset checked items when changing weeks
              setCheckedItems(new Set());
            }}
            className="bg-card-bg border border-gray-700 rounded-lg px-3 py-2 text-white"
          >
            {plan.weeks.map((w, i) => (
              <option key={i} value={i + 1}>Semana {i + 1}</option>
            ))}
          </select>
        ) : null}
      </div>

      {/* Cardápio View */}
      {activeTab === 'cardapio' && (
        <>
          {/* Day Selector */}
          <div className="mb-4">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {daysOfWeek.map((day) => (
                <button
                  key={day.key}
                  onClick={() => setSelectedDay(day.key)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg border-2 transition-all duration-200 ${
                    selectedDay === day.key
                      ? 'bg-alien-green border-alien-green text-deep-bg font-bold shadow-lg shadow-alien-green/50'
                      : 'bg-card-bg border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <span className="text-sm">{day.short}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Day Name */}
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-alien-green">
              {daysOfWeek.find(d => d.key === selectedDay)?.label}
            </h2>
          </div>

          {/* Weekly Summary */}
          <Card>
            <h3 className="text-white font-bold mb-3">Resumo Diário</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-gray-400 text-sm">Calorias</p>
                <p className="text-alien-green font-bold">{currentWeek.totalCalories} kcal</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Proteína</p>
                <p className="text-alien-green font-bold">{currentWeek.totalProtein}g</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Carboidratos</p>
                <p className="text-alien-green font-bold">{currentWeek.totalCarbs}g</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Gorduras</p>
                <p className="text-alien-green font-bold">{currentWeek.totalFat}g</p>
              </div>
            </div>
          </Card>

          {/* Daily Meals */}
          <div>
            <h2 className="text-xl font-bold text-alien-green mb-3">Refeições do Dia</h2>
            {dayMeals.length > 0 ? (
              <div className="space-y-4">
                {dayMeals.map((meal) => (
                <Card key={meal.id}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-bilu-purple font-bold">{meal.time}</span>
                      <h3 className="text-white font-bold text-lg">{meal.name}</h3>
                    </div>
                    <span className="text-alien-green font-bold">{meal.totalCalories} kcal</span>
                  </div>

                  <div className="space-y-2">
                    {meal.foods.map((food) => {
                      const isApiDiet = food.id.startsWith('ai-');
                      const foodData = mockFoods.find(f => f.id === food.id);
                      const displayName = isApiDiet ? food.name : (getCleanFoodName(food.id, food.name) + (foodData ? ` (${formatQuantity(food.quantity || 1, foodData.unit)})` : ` (${food.quantity || 1} uni)`));
                      return (
                        <div
                          key={food.id}
                          className="flex items-center justify-between p-2 bg-deep-bg rounded border border-gray-800"
                        >
                          <p className="text-gray-300 text-sm flex-1">
                            • {displayName}
                          </p>
                          {!isApiDiet && <SwapButton onClick={() => handleSwapFood(meal.id, food.id)} />}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-400 text-sm">Total da Refeição:</span>
                      <span className="text-alien-green font-bold text-sm">{meal.totalCalories} kcal</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>P: {meal.totalProtein.toFixed(1)}g</span>
                      <span>C: {meal.totalCarbs.toFixed(1)}g</span>
                      <span>G: {meal.totalFat.toFixed(1)}g</span>
                    </div>
                  </div>
                </Card>
                ))}
              </div>
            ) : (
              <Card>
                <p className="text-gray-400 text-center py-4">Nenhuma refeição planejada para este dia</p>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Lista de Compras View */}
      {activeTab === 'compras' && (
        <div>
          <Card>
            <h3 className="text-white font-bold mb-4">Lista de Compras - Semana {selectedWeek}</h3>
            
            {groceryList.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">Nenhum item na lista para esta semana</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* A comprar Section */}
                {itemsToBuy.length > 0 && (
                  <div>
                    <h4 className="text-alien-green font-bold mb-3 text-lg flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-alien-green"></span>
                      A comprar
                    </h4>
                    <div className="space-y-2">
                      {itemsToBuy.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-deep-bg rounded border border-gray-800 hover:border-alien-green transition-colors"
                        >
                          <div className="flex-1">
                            <p className="text-white font-medium mb-1">{item.name}</p>
                            <div className="flex gap-4 text-sm">
                              <span className="text-alien-green">
                                Total: <strong>{plan.dietaApi?.lista_compras ? item.unit : formatQuantity(item.totalQuantity, item.unit)}</strong>
                              </span>
                              {!plan.dietaApi?.lista_compras && (
                              <span className="text-bilu-purple">
                                {item.frequency} {item.frequency === 1 ? 'refeição' : 'refeições'}
                              </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggleItem(item.id)}
                            className="ml-4 w-6 h-6 rounded border-2 border-gray-600 hover:border-alien-green flex items-center justify-center transition-colors"
                          >
                            <Check size={14} className="text-transparent" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Já comprado Section */}
                {itemsBought.length > 0 && (
                  <div>
                    <h4 className="text-bilu-purple font-bold mb-3 text-lg flex items-center gap-2 opacity-70">
                      <span className="w-2 h-2 rounded-full bg-bilu-purple"></span>
                      Já comprado
                    </h4>
                    <div className="space-y-2">
                      {itemsBought.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-deep-bg rounded border border-gray-800 opacity-50 transition-all"
                        >
                          <div className="flex-1">
                            <p className="text-white font-medium mb-1 line-through">{item.name}</p>
                            <div className="flex gap-4 text-sm">
                              <span className="text-alien-green line-through opacity-70">
                                Total: <strong>{plan.dietaApi?.lista_compras ? item.unit : formatQuantity(item.totalQuantity, item.unit)}</strong>
                              </span>
                              {!plan.dietaApi?.lista_compras && (
                              <span className="text-bilu-purple line-through opacity-70">
                                {item.frequency} {item.frequency === 1 ? 'refeição' : 'refeições'}
                              </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggleItem(item.id)}
                            className="ml-4 w-6 h-6 rounded border-2 bg-alien-green border-alien-green flex items-center justify-center transition-colors hover:bg-[#2EE010]"
                          >
                            <Check size={14} className="text-deep-bg" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clear all button */}
                {checkedItems.size > 0 && (
                  <div className="pt-4 border-t border-gray-800">
                    <button
                      onClick={() => setCheckedItems(new Set())}
                      className="w-full text-alien-green text-sm hover:underline text-center"
                    >
                      Limpar seleção
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
