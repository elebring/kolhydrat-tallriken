import type { MealComponent, NutritionValue } from "../types";

export function getCarbsPer100g(values: NutritionValue[]): number {
  const carb = values.find(v =>
    v.namn?.toLowerCase().includes("kolhydrat")
  );

  return Number(carb?.varde ?? 0);
}

export function carbsForGrams(grams: number, carbsPer100g: number): number {
  return Math.round(((grams * carbsPer100g) / 100) * 10) / 10;
}

export function calculatePlate(
  components: MealComponent[],
  targetCarbs: number
): MealComponent[] {
  const activeComponents = components.filter(component => {
    const carbsPer100g =
      component.manualCarbsPer100g ?? component.carbsPer100g;

    return carbsPer100g > 0 && component.role !== "vegetable";
  });

  if (activeComponents.length === 0) {
    return components;
  }

  const carbsPerComponent = targetCarbs / activeComponents.length;

  return components.map(component => {
    const carbsPer100g =
      component.manualCarbsPer100g ?? component.carbsPer100g;

    if (component.role === "vegetable" || carbsPer100g <= 0) {
      return {
        ...component,
        plannedGrams: 0,
      };
    }

    const plannedGrams = (carbsPerComponent * 100) / carbsPer100g;

    return {
      ...component,
      plannedGrams: Math.round(plannedGrams),
    };
  });
}

export function totalCarbsForComponents(
  components: MealComponent[]
): number {
  return (
    Math.round(
      components.reduce((sum, component) => {
        const carbsPer100g =
          component.manualCarbsPer100g ?? component.carbsPer100g;

        return sum + carbsForGrams(component.plannedGrams, carbsPer100g);
      }, 0) * 10
    ) / 10
  );
}

export function eatenCarbs(
  plannedGrams: number,
  leftoverGrams: number,
  carbsPer100g: number
): number {
  const eatenGrams = Math.max(plannedGrams - leftoverGrams, 0);
  return carbsForGrams(eatenGrams, carbsPer100g);
}