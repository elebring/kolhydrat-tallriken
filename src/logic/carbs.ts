import type { MealItem, NutritionValue } from "../types";

export function getCarbsPer100g(values: NutritionValue[]): number {
  const carb = values.find(v =>
    v.namn?.toLowerCase().includes("kolhydrat")
  );

  return Number(carb?.varde ?? 0);
}

export function buildPlate(items: MealItem[], targetCarbs: number) {
  const distribution = {
    mainCarb: 0.68,
    protein: 0.12,
    extraCarb: 0.2,
    vegetable: 0,
  };

  return items.map(item => {
    const carbsPer100g = item.carbsPer100g ?? 0;
    const carbTarget = targetCarbs * distribution[item.role];
    const grams = carbsPer100g ? (carbTarget * 100) / carbsPer100g : 0;

    return {
      ...item,
      grams: Math.round(grams),
      carbs: Math.round(carbTarget * 10) / 10,
    };
  });
}
