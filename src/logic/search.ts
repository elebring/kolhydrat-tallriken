import Fuse from "fuse.js";
import type { Food } from "../types";

export function searchFoods(query: string, foods: Food[]) {
  const fuse = new Fuse(foods, {
    keys: ["namn"],
    threshold: 0.35,
    ignoreLocation: true,
  });

  return fuse.search(query).slice(0, 8).map(r => r.item);
}
