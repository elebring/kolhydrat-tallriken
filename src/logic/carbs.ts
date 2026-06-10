import type { MealComponent, NutritionValue } from "../types";

export function getCarbsPer100g(values: NutritionValue[]): number {
  const carb = values.find(v =>
    v.namn?.toLowerCase().includes("kolhydrat")
  );

  return Number(carb?.varde ?? 0);
}

export function carbsForGrams(grams: number, carbsPer100g: number): number {
  return (grams * carbsPer100g) / 100;
}

export function calculatePlate(
  components: MealComponent[],
  targetCarbs: number
): MealComponent[] {
  const distribution = {
    mainCarb: 0.7,
    protein: 0.1,
    extraCarb: 0.2,
    vegetable: 0,
  };

  return components.map(component => {
    const carbTarget = targetCarbs * distribution[component.role];
    const carbsPer100g =
      component.manualCarbsPer100g ?? component.carbsPer100g;

    const plannedGrams =
      carbsPer100g > 0 ? (carbTarget * 100) / carbsPer100g : 0;

    return {
      ...component,
      plannedGrams: Math.round(plannedGrams),
    };
  });
}

export function eatenCarbs(
  plannedGrams: number,
  leftoverGrams: number,
  carbsPer100g: number
): number {
  const eatenGrams = Math.max(plannedGrams - leftoverGrams, 0);
  return Math.round(carbsForGrams(eatenGrams, carbsPer100g) * 10) / 10;
}
