import type { Food, NutritionValue } from "../types";

const PROXY_URL = "/api/slv";

function asArray<T>(data: unknown, keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];

  if (data && typeof data === "object") {
    const objectData = data as Record<string, unknown>;

    for (const key of keys) {
      const value = objectData[key];
      if (Array.isArray(value)) return value as T[];
    }
  }

  return [];
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Kunde inte hämta från Livsmedelsverket. Status ${response.status}. ${text}`
    );
  }

  return response.json();
}

export async function fetchFoods(
  offset = 0,
  limit = 100
): Promise<Food[]> {
  const data = await fetchJson(
    `${PROXY_URL}/livsmedel?offset=${offset}&limit=${limit}&sprak=1`
  );

  return asArray<Food>(data, [
    "livsmedel",
    "livsmedelLista",
    "items",
    "data",
  ]);
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
  const data = await fetchJson(
    `${PROXY_URL}/livsmedel/${foodNumber}/naringsvarden?sprak=1`
  );

  return asArray<NutritionValue>(data, [
    "naringsvarden",
    "naringsvardeLista",
    "items",
    "data",
  ]);
}