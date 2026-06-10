import { useEffect, useState } from "react";
import "./App.css";
import { fetchAllFoods, fetchNutrition } from "./api/slv";
import { calculatePlate, eatenCarbs, getCarbsPer100g } from "./logic/carbs";
import { searchFoods } from "./logic/search";
import type { DayMeal, Food, MealComponent, MealRole, Weekday } from "./types";

const STORAGE_KEY = "kolhydrat_tallriken_week_menu";

const weekdays: Weekday[] = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];

function makeId() {
  return Math.random().toString(36).slice(2);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"parent" | "preschool">("parent");
  const [foods, setFoods] = useState<Food[]>([]);
  const [weekMeals, setWeekMeals] = useState<DayMeal[]>([]);

  const [weekday, setWeekday] = useState<Weekday>("Måndag");
  const [menuText, setMenuText] = useState("köttbullar, kokt potatis, lingonsylt");
  const [targetCarbs, setTargetCarbs] = useState("35");
  const [components, setComponents] = useState<MealComponent[]>([]);

  const [selectedMealId, setSelectedMealId] = useState("");
  const [leftovers, setLeftovers] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAllFoods().then(setFoods).catch(console.error);

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setWeekMeals(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(weekMeals));
  }, [weekMeals]);

  function createComponentsFromMenu() {
    const parts = menuText
      .split(",")
      .map(part => part.trim())
      .filter(Boolean);

    const newComponents: MealComponent[] = parts.map((part, index) => ({
      id: makeId(),
      query: part,
      role: index === 0 ? "protein" : index === 1 ? "mainCarb" : "extraCarb",
      carbsPer100g: 0,
      plannedGrams: 0,
    }));

    setComponents(newComponents);
  }

  async function selectFood(componentId: string, food: Food) {
    const nutrition = await fetchNutrition(food.nummer);
    const carbsPer100g = getCarbsPer100g(nutrition);

    setComponents(current =>
      current.map(component =>
        component.id === componentId
          ? { ...component, selectedFood: food, carbsPer100g }
          : component
      )
    );
  }

  function updateRole(componentId: string, role: MealRole) {
    setComponents(current =>
      current.map(component =>
        component.id === componentId ? { ...component, role } : component
      )
    );
  }

  function updateManualCarbs(componentId: string, value: string) {
    setComponents(current =>
      current.map(component =>
        component.id === componentId
          ? {
              ...component,
              manualCarbsPer100g: value === "" ? undefined : Number(value),
            }
          : component
      )
    );
  }

  function saveMeal() {
    const plate = calculatePlate(components, Number(targetCarbs));

    const meal: DayMeal = {
      id: makeId(),
      weekday,
      menuText,
      targetCarbs: Number(targetCarbs),
      components: plate,
    };

    setWeekMeals(current => [...current.filter(m => m.weekday !== weekday), meal]);
    setSelectedMealId(meal.id);
    setActiveTab("preschool");
  }

  function clearAll() {
    setWeekMeals([]);
    setComponents([]);
    setLeftovers({});
    localStorage.removeItem(STORAGE_KEY);
  }

  const selectedMeal =
    weekMeals.find(meal => meal.id === selectedMealId) ?? weekMeals[0];

  return (
    <main>
      <h1>Kolhydrat-Tallriken</h1>

      <div className="tabs">
        <button
          className={activeTab === "parent" ? "active" : ""}
          onClick={() => setActiveTab("parent")}
        >
          Föräldrar
        </button>

        <button
          className={activeTab === "preschool" ? "active" : ""}
          onClick={() => setActiveTab("preschool")}
        >
          Förskola
        </button>
      </div>

      {activeTab === "parent" && (
        <section>
          <h2>Föräldrar: lägg in matsedel</h2>

          <label>Veckodag</label>
          <select value={weekday} onChange={e => setWeekday(e.target.value as Weekday)}>
            {weekdays.map(day => (
              <option key={day}>{day}</option>
            ))}
          </select>

          <label>Meny</label>
          <input value={menuText} onChange={e => setMenuText(e.target.value)} />

          <label>Totalt kolhydratmål</label>
          <input
            type="number"
            value={targetCarbs}
            onChange={e => setTargetCarbs(e.target.value)}
          />

          <button onClick={createComponentsFromMenu}>Hämta matvaror</button>

          {components.map(component => {
            const matches = searchFoods(component.query, foods);

            return (
              <div className="card" key={component.id}>
                <h3>{component.query}</h3>

                <label>Roll på tallriken</label>
                <select
                  value={component.role}
                  onChange={e => updateRole(component.id, e.target.value as MealRole)}
                >
                  <option value="mainCarb">Kolhydratkälla</option>
                  <option value="protein">Protein</option>
                  <option value="extraCarb">Extra kolhydrat</option>
                  <option value="vegetable">Grönsak</option>
                </select>

                <p>Förslag från Livsmedelsverket:</p>

                {matches.map(food => (
                  <button key={food.nummer} onClick={() => selectFood(component.id, food)}>
                    {food.namn}
                  </button>
                ))}

                {component.selectedFood && (
                  <p>
                    Vald: <strong>{component.selectedFood.namn}</strong>
                    <br />
                    {component.carbsPer100g} g kolhydrater / 100 g
                  </p>
                )}

                <label>Manuellt kolhydratvärde / 100 g</label>
                <input
                  type="number"
                  placeholder="Valfritt"
                  onChange={e => updateManualCarbs(component.id, e.target.value)}
                />
              </div>
            );
          })}

          {components.length > 0 && (
            <>
              <h2>Tallriksförslag</h2>

              {calculatePlate(components, Number(targetCarbs)).map(component => {
                const carbsPer100g =
                  component.manualCarbsPer100g ?? component.carbsPer100g;

                return (
                  <div className="result" key={component.id}>
                    <strong>{component.selectedFood?.namn ?? component.query}</strong>
                    <br />
                    {component.plannedGrams} g
                    <br />
                    {carbsPer100g} g kolhydrater / 100 g
                  </div>
                );
              })}

              <button onClick={saveMeal}>Spara och för över till förskola</button>
            </>
          )}

          <button className="danger" onClick={clearAll}>
            Rensa hela veckan
          </button>
        </section>
      )}

      {activeTab === "preschool" && (
        <section>
          <h2>Förskola: portion och uppätet</h2>

          {weekMeals.length === 0 && <p>Inga sparade måltider ännu.</p>}

          {weekMeals.length > 0 && (
            <>
              <label>Välj dag</label>
              <select value={selectedMeal?.id} onChange={e => setSelectedMealId(e.target.value)}>
                {weekMeals.map(meal => (
                  <option key={meal.id} value={meal.id}>
                    {meal.weekday}: {meal.menuText}
                  </option>
                ))}
              </select>

              {selectedMeal && (
                <>
                  <h3>{selectedMeal.weekday}</h3>
                  <p>{selectedMeal.menuText}</p>
                  <p>Mål: {selectedMeal.targetCarbs} g kolhydrater</p>

                  {selectedMeal.components.map(component => {
                    const carbsPer100g =
                      component.manualCarbsPer100g ?? component.carbsPer100g;

                    const leftover = Number(leftovers[component.id] ?? 0);
                    const eaten = eatenCarbs(
                      component.plannedGrams,
                      leftover,
                      carbsPer100g
                    );

                    return (
                      <div className="card" key={component.id}>
                        <strong>{component.selectedFood?.namn ?? component.query}</strong>

                        <p>
                          Planerad portion: {component.plannedGrams} g
                          <br />
                          Kolhydrater: {carbsPer100g} g / 100 g
                        </p>

                        <label>Kvar på tallriken, gram</label>
                        <input
                          type="number"
                          value={leftovers[component.id] ?? ""}
                          onChange={e =>
                            setLeftovers(current => ({
                              ...current,
                              [component.id]: e.target.value,
                            }))
                          }
                        />

                        <p>
                          Uppskattat ätit: <strong>{eaten} g kolhydrater</strong>
                        </p>
                      </div>
                    );
                  })}

                  <h2>
                    Totalt ätit:{" "}
                    {selectedMeal.components
                      .reduce((sum, component) => {
                        const carbsPer100g =
                          component.manualCarbsPer100g ?? component.carbsPer100g;

                        const leftover = Number(leftovers[component.id] ?? 0);

                        return (
                          sum +
                          eatenCarbs(component.plannedGrams, leftover, carbsPer100g)
                        );
                      }, 0)
                      .toFixed(1)}{" "}
                    g kolhydrater
                  </h2>
                </>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
