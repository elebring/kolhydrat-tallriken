import { useEffect, useState } from "react";
import { fetchAllFoods, fetchNutrition } from "./api/slv";
import { buildPlate, getCarbsPer100g } from "./logic/carbs";
import { searchFoods } from "./logic/search";
import { PlateView } from "./components/PlateView";
import type { Food, MealItem } from "./types";
import "./style.css";

export default function App() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [mealText, setMealText] = useState("köttbullar, potatismos, lingonsylt");
  const [targetCarbs, setTargetCarbs] = useState("35");
  const [items, setItems] = useState<MealItem[]>([]);

  useEffect(() => {
    fetchAllFoods().then(setFoods);
  }, []);

  function createMeal() {
    const parts = mealText.split(",").map(x => x.trim()).filter(Boolean);

    setItems(
      parts.map((part, index) => ({
        query: part,
        role: index === 0 ? "protein" : index === 1 ? "mainCarb" : "extraCarb",
      }))
    );
  }

  async function selectFood(index: number, food: Food) {
    const nutrition = await fetchNutrition(food.nummer);
    const carbsPer100g = getCarbsPer100g(nutrition);

    setItems(current => {
      const next = [...current];
      next[index] = { ...next[index], selectedFood: food, carbsPer100g };
      return next;
    });
  }

  const plate = buildPlate(items, Number(targetCarbs));

  return (
    <main>
      <h1>Kolhydrat-tallriken</h1>

      <label>Måltid</label>
      <input value={mealText} onChange={e => setMealText(e.target.value)} />

      <label>Mål kolhydrater</label>
      <input
        value={targetCarbs}
        onChange={e => setTargetCarbs(e.target.value)}
        type="number"
      />

      <button onClick={createMeal}>Skapa förslag</button>

      {items.map((item, index) => (
        <section key={item.query}>
          <h2>{item.query}</h2>

          {searchFoods(item.query, foods).map(food => (
            <button key={food.nummer} onClick={() => selectFood(index, food)}>
              {food.namn}
            </button>
          ))}

          {item.selectedFood && (
            <p>
              Vald: {item.selectedFood.namn} — {item.carbsPer100g} g kolhydrater / 100 g
            </p>
          )}
        </section>
      ))}

      <h2>Tallriksförslag</h2>
      <PlateView items={plate} />
    </main>
  );
}
