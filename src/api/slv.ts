import type { Food, NutritionValue } from "../types";

const BASE_URL = "https://dataportal.livsmedelsverket.se/livsmedel/api/v1";

export async function fetchFoods(offset = 0, limit = 100): Promise<Food[]> {
  const res = await fetch(
    `${BASE_URL}/livsmedel?offset=${offset}&limit=${limit}&sprak=1`
  );

  if (!res.ok) {
    throw new Error("Kunde inte hämta livsmedel");
  }

  const data = await res.json();
  return data.livsmedel ?? data.items ?? data;
}

export async function fetchAllFoods(): Promise<Food[]> {
  let all: Food[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const batch = await fetchFoods(offset, limit);
    if (!Array.isArray(batch) || batch.length === 0) break;

    all = [...all, ...batch];
    offset += limit;

    if (batch.length < limit) break;
  }

  return all;
}

export async function fetchNutrition(
  foodNumber: number
): Promise<NutritionValue[]> {
  const res = await fetch(
    `${BASE_URL}/livsmedel/${foodNumber}/naringsvarden?sprak=1`
  );

  if (!res.ok) {
    throw new Error("Kunde inte hämta näringsvärden");
  }

  const data = await res.json();
  return data.naringsvarden ?? data.items ?? data;
}
