import Fuse from "fuse.js";
import type { Food } from "../types";

export function searchFoods(query: string, foods: Food[]): Food[] {
  if (!query.trim()) return [];

  const fuse = new Fuse(foods, {
    keys: ["namn"],
    threshold: 0.35,
    ignoreLocation: true,
  });

  return fuse.search(query).slice(0, 8).map(result => result.item);
}
