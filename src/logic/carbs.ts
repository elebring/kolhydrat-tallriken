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

function getCarbsValue(component: MealComponent): number {
  return component.manualCarbsPer100g ?? component.carbsPer100g;
}

export function calculatePlate(
  components: MealComponent[],
  targetCarbs: number
): MealComponent[] {
  const result = components.map(component => ({
    ...component,
    plannedGrams: 0,
  }));

  const proteins = result.filter(c => c.role === "protein");
  const mainCarbs = result.filter(c => c.role === "mainCarb");
  const extraCarbs = result.filter(c => c.role === "extraCarb");
  const vegetables = result.filter(c => c.role === "vegetable");

  vegetables.forEach(component => {
    component.plannedGrams = 50;
  });

  const usableProteins = proteins.filter(c => getCarbsValue(c) >= 0);
  const usableMainCarbs = mainCarbs.filter(c => getCarbsValue(c) > 0);
  const usableExtraCarbs = extraCarbs.filter(c => getCarbsValue(c) > 0);

  if (targetCarbs <= 0) {
    return result;
  }

  if (usableProteins.length > 0 && usableMainCarbs.length > 0) {
    const extraTarget =
      usableExtraCarbs.length > 0 ? targetCarbs * 0.15 : 0;

    const mainProteinTarget = targetCarbs - extraTarget;

    const proteinCarbsPer100g =
      usableProteins.reduce((sum, c) => sum + getCarbsValue(c), 0) /
      usableProteins.length;

    const mainCarbsPer100g =
      usableMainCarbs.reduce((sum, c) => sum + getCarbsValue(c), 0) /
      usableMainCarbs.length;

    const carbsPerGramTogether =
      proteinCarbsPer100g / 100 + mainCarbsPer100g / 100;

    const sharedGroupGrams =
      carbsPerGramTogether > 0
        ? mainProteinTarget / carbsPerGramTogether
        : 0;

    usableProteins.forEach(component => {
      component.plannedGrams = Math.round(
        sharedGroupGrams / usableProteins.length
      );
    });

    usableMainCarbs.forEach(component => {
      component.plannedGrams = Math.round(
        sharedGroupGrams / usableMainCarbs.length
      );
    });

    if (usableExtraCarbs.length > 0 && extraTarget > 0) {
      const extraCarbsPerComponent = extraTarget / usableExtraCarbs.length;

      usableExtraCarbs.forEach(component => {
        const carbsPer100g = getCarbsValue(component);
        component.plannedGrams = Math.round(
          (extraCarbsPerComponent * 100) / carbsPer100g
        );
      });
    }

    return result;
  }

  const activeComponents = result.filter(component => {
    const carbsPer100g = getCarbsValue(component);
    return carbsPer100g > 0 && component.role !== "vegetable";
  });

  if (activeComponents.length === 0) {
    return result;
  }

  const carbsPerComponent = targetCarbs / activeComponents.length;

  activeComponents.forEach(component => {
    const carbsPer100g = getCarbsValue(component);
    component.plannedGrams = Math.round(
      (carbsPerComponent * 100) / carbsPer100g
    );
  });

  return result;
}

export function totalCarbsForComponents(
  components: MealComponent[]
): number {
  return (
    Math.round(
      components.reduce((sum, component) => {
        const carbsPer100g = getCarbsValue(component);
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