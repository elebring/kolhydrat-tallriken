import Fuse from "fuse.js";
import type { Food } from "../types";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[å]/g, "a")
    .replace(/[ä]/g, "a")
    .replace(/[ö]/g, "o")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreFood(query: string, food: Food): number {
  const q = normalize(query);
  const name = normalize(food.namn);

  const queryWords = q.split(" ").filter(Boolean);
  const nameWords = name.split(" ").filter(Boolean);

  let score = 0;

  if (name === q) score += 120;
  if (name.includes(q)) score += 80;

  const allWordsExist = queryWords.every(word => nameWords.includes(word));
  if (allWordsExist) score += 70;

  for (const word of queryWords) {
    if (nameWords.includes(word)) score += 30;
    else if (name.includes(word)) score += 12;
  }

  if (nameWords[0] === queryWords[0]) score += 20;

  return score;
}

export function searchFoods(query: string, foods: Food[]): Food[] {
  if (!query.trim()) return [];

  const fuse = new Fuse(foods, {
    keys: ["namn"],
    threshold: 0.45,
    ignoreLocation: true,
    includeScore: true,
  });

  const fuseResults = fuse.search(query).slice(0, 20).map(result => result.item);

  const scoredResults = foods
    .map(food => ({
      food,
      score: scoreFood(query, food),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(item => item.food);

  const combined = [...scoredResults, ...fuseResults];

  const unique = new Map<number, Food>();
  combined.forEach(food => unique.set(food.nummer, food));

  return Array.from(unique.values()).slice(0, 8);
}