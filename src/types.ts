export type Food = {
  nummer: number;
  namn: string;
};

export type NutritionValue = {
  namn?: string;
  varde?: number;
  enhet?: string;
};

export type MealRole = "mainCarb" | "protein" | "extraCarb" | "vegetable";

export type MealItem = {
  query: string;
  role: MealRole;
  selectedFood?: Food;
  carbsPer100g?: number;
};
