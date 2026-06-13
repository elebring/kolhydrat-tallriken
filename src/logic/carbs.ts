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
  const mainCarbs = components.filter(c => c.role === "mainCarb");
  const proteins = components.filter(c => c.role === "protein");
  const extraCarbs = components.filter(c => c.role === "extraCarb");

  let remainingCarbs = targetCarbs;
  const result = [...components];

  function updateComponent(id: string, grams: number) {
    const index = result.findIndex(c => c.id === id);
    if (index >= 0) {
      result[index] = {
        ...result[index],
        plannedGrams: Math.round(grams),
      };
    }
  }

  const mainCarb = mainCarbs[0];
  const protein = proteins[0];

  if (mainCarb && protein) {
    const mainCarbsPer100g =
      mainCarb.manualCarbsPer100g ?? mainCarb.carbsPer100g;

    const proteinCarbsPer100g =
      protein.manualCarbsPer100g ?? protein.carbsPer100g;

    const baseGrams = 80;

    const mainCarbsAmount = carbsForGrams(baseGrams, mainCarbsPer100g);
    const proteinCarbsAmount = carbsForGrams(baseGrams, proteinCarbsPer100g);

    updateComponent(mainCarb.id, baseGrams);
    updateComponent(protein.id, baseGrams);

    remainingCarbs -= mainCarbsAmount + proteinCarbsAmount;
  }

  const adjustableComponents = result.filter(component => {
    const carbsPer100g =
      component.manualCarbsPer100g ?? component.carbsPer100g;

    return (
      carbsPer100g > 0 &&
      component.role !== "vegetable" &&
      component.plannedGrams === 0
    );
  });

  const componentsToFill =
    extraCarbs.length > 0
      ? adjustableComponents.filter(c => c.role === "extraCarb")
      : adjustableComponents;

  if (componentsToFill.length > 0 && remainingCarbs > 0) {
    const carbsPerComponent = remainingCarbs / componentsToFill.length;

    componentsToFill.forEach(component => {
      const carbsPer100g =
        component.manualCarbsPer100g ?? component.carbsPer100g;

      const grams = (carbsPerComponent * 100) / carbsPer100g;
      updateComponent(component.id, grams);
    });
  }

  return result.map(component => {
    if (component.role === "vegetable") {
      return {
        ...component,
        plannedGrams: component.plannedGrams || 50,
      };
    }

    return component;
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