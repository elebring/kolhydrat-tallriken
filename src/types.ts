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

export type Weekday =
  | "Måndag"
  | "Tisdag"
  | "Onsdag"
  | "Torsdag"
  | "Fredag";

export type MealComponent = {
  id: string;
  query: string;
  role: MealRole;
  selectedFood?: Food;
  carbsPer100g: number;
  manualCarbsPer100g?: number;
  plannedGrams: number;
};

export type DayMeal = {
  id: string;
  weekday: Weekday;
  menuText: string;
  targetCarbs: number;
  components: MealComponent[];
};
