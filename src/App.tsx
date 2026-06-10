import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { fetchAllFoods, fetchNutrition } from "./api/slv";
import {
  calculatePlate,
  carbsForGrams,
  eatenCarbs,
  getCarbsPer100g,
  totalCarbsForComponents,
} from "./logic/carbs";
import { searchFoods } from "./logic/search";
import type { DayMeal, Food, MealComponent, MealRole, Weekday } from "./types";

const STORAGE_KEY = "kolhydrat_tallriken_week_menu";
const DRAFT_KEY = "kolhydrat_tallriken_draft";

const weekdays: Weekday[] = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];

function makeId() {
  return Math.random().toString(36).slice(2);
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"parent" | "preschool">("parent");
  const [foods, setFoods] = useState<Food[]>([]);
  const [weekMeals, setWeekMeals] = useState<DayMeal[]>(() =>
    loadJson<DayMeal[]>(STORAGE_KEY, [])
  );

  const [weekday, setWeekday] = useState<Weekday>(() => {
    const draft = loadJson<any>(DRAFT_KEY, null);
    return draft?.weekday ?? "Måndag";
  });

  const [menuText, setMenuText] = useState(() => {
    const draft = loadJson<any>(DRAFT_KEY, null);
    return draft?.menuText ?? "köttbullar, kokt potatis, lingonsylt";
  });

  const [targetCarbs, setTargetCarbs] = useState(() => {
    const draft = loadJson<any>(DRAFT_KEY, null);
    return String(draft?.targetCarbs ?? "35");
  });

  const [components, setComponents] = useState<MealComponent[]>(() => {
    const draft = loadJson<any>(DRAFT_KEY, null);
    return draft?.components ?? [];
  });

  const [selectedMealId, setSelectedMealId] = useState("");
  const [leftovers, setLeftovers] = useState<Record<string, string>>({});
  const [totalLeftover, setTotalLeftover] = useState("");
  const [refills, setRefills] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAllFoods().then(setFoods).catch(console.error);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(weekMeals));
  }, [weekMeals]);

  useEffect(() => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        weekday,
        menuText,
        targetCarbs,
        components,
      })
    );
  }, [weekday, menuText, targetCarbs, components]);

  const calculatedPlate = useMemo(() => {
    return calculatePlate(components, Number(targetCarbs));
  }, [components, targetCarbs]);

  const displayedPlate = useMemo(() => {
    return components.map(component => {
      const calculatedComponent = calculatedPlate.find(c => c.id === component.id);
      const calculatedGrams = calculatedComponent?.plannedGrams ?? 0;

      if (component.plannedGramsInput !== undefined) {
        return {
          ...component,
          plannedGrams:
            component.plannedGramsInput === ""
              ? 0
              : Number(component.plannedGramsInput),
        };
      }

      return {
        ...component,
        plannedGrams:
          component.plannedGrams > 0 ? component.plannedGrams : calculatedGrams,
      };
    });
  }, [components, calculatedPlate]);

  function createComponentsFromMenu() {
    const parts: string[] = menuText
      .split(",")
      .map((part: string) => part.trim())
      .filter((part: string) => Boolean(part));

    const newComponents: MealComponent[] = parts.map(
      (part: string, index: number) => ({
        id: makeId(),
        query: part,
        role:
          parts.length === 1
            ? "mainCarb"
            : index === 0
            ? "protein"
            : index === 1
            ? "mainCarb"
            : "extraCarb",
        carbsPer100g: 0,
        plannedGrams: 0,
        plannedGramsInput: undefined,
      })
    );

    setComponents(newComponents);
  }

  async function selectFood(componentId: string, food: Food) {
    const nutrition = await fetchNutrition(food.nummer);
    const carbsPer100g = getCarbsPer100g(nutrition);

    setComponents(current =>
      current.map(component =>
        component.id === componentId
          ? {
              ...component,
              selectedFood: food,
              carbsPer100g,
              plannedGrams: 0,
              plannedGramsInput: undefined,
            }
          : component
      )
    );
  }

  function updateRole(componentId: string, role: MealRole) {
    setComponents(current =>
      current.map(component =>
        component.id === componentId
          ? {
              ...component,
              role,
              plannedGrams: 0,
              plannedGramsInput: undefined,
            }
          : component
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
              plannedGrams: 0,
              plannedGramsInput: undefined,
            }
          : component
      )
    );
  }

  function updatePlannedGrams(componentId: string, value: string) {
    setComponents(current =>
      current.map(component =>
        component.id === componentId
          ? {
              ...component,
              plannedGramsInput: value,
              plannedGrams: value === "" ? 0 : Number(value),
            }
          : component
      )
    );
  }

  function saveMeal() {
    const meal: DayMeal = {
      id: makeId(),
      weekday,
      menuText,
      targetCarbs: Number(targetCarbs),
      components: displayedPlate.map(component => ({
        ...component,
        plannedGramsInput: String(component.plannedGrams),
      })),
    };

    setWeekMeals(current => {
      const next = [...current.filter(m => m.weekday !== weekday), meal];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    setSelectedMealId(meal.id);
    setActiveTab("preschool");
  }

  function clearAll() {
    setWeekMeals([]);
    setComponents([]);
    setLeftovers({});
    setTotalLeftover("");
    setRefills({});
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DRAFT_KEY);
  }

  const selectedMeal =
    weekMeals.find(meal => meal.id === selectedMealId) ?? weekMeals[0];

  const plannedTotalWeight =
    selectedMeal?.components.reduce(
      (sum: number, component: MealComponent) => sum + component.plannedGrams,
      0
    ) ?? 0;

  const plannedTotalCarbs = selectedMeal
    ? totalCarbsForComponents(selectedMeal.components)
    : 0;

  const totalLeftoverCarbs =
    plannedTotalWeight > 0 && totalLeftover !== ""
      ? Math.round(
          (Number(totalLeftover) / plannedTotalWeight) * plannedTotalCarbs * 10
        ) / 10
      : 0;

  const eatenByTotalWeight = Math.max(
    Math.round((plannedTotalCarbs - totalLeftoverCarbs) * 10) / 10,
    0
  );

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
                    Matchad mot Livsmedelsverket:{" "}
                    <strong>{component.selectedFood.namn}</strong>
                    <br />
                    {component.carbsPer100g} g kolhydrater / 100 g
                  </p>
                )}

                <label>Manuellt kolhydratvärde / 100 g</label>
                <input
                  type="number"
                  placeholder="Valfritt"
                  value={component.manualCarbsPer100g ?? ""}
                  onChange={e => updateManualCarbs(component.id, e.target.value)}
                />
              </div>
            );
          })}

          {components.length > 0 && (
            <>
              <h2>Tallriksförslag</h2>

              {displayedPlate.map(component => {
                const carbsPer100g =
                  component.manualCarbsPer100g ?? component.carbsPer100g;

                return (
                  <div className="result" key={component.id}>
                    <strong>{component.query}</strong>

                    <label>Mängd i tallriksförslag, gram</label>
                    <input
                      type="number"
                      value={component.plannedGramsInput ?? String(component.plannedGrams)}
                      onChange={e => updatePlannedGrams(component.id, e.target.value)}
                    />

                    <p>
                      {carbsPer100g} g kolhydrater / 100 g
                      <br />
                      Ger:{" "}
                      <strong>
                        {carbsForGrams(component.plannedGrams, carbsPer100g)} g
                        kolhydrater
                      </strong>
                    </p>
                  </div>
                );
              })}

              <h3>
                Totalt i tallriksförslag: {totalCarbsForComponents(displayedPlate)} g
                kolhydrater
              </h3>

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
          <h2>Förskola</h2>

          {weekMeals.length === 0 && <p>Inga sparade måltider ännu.</p>}

          {weekMeals.length > 0 && selectedMeal && (
            <>
              <label>Välj dag</label>
              <select value={selectedMeal.id} onChange={e => setSelectedMealId(e.target.value)}>
                {weekMeals.map(meal => (
                  <option key={meal.id} value={meal.id}>
                    {meal.weekday}: {meal.menuText}
                  </option>
                ))}
              </select>

              <h3>{selectedMeal.weekday}</h3>
              <p>{selectedMeal.menuText}</p>

              <section>
                <h2>Planerad portion</h2>

                {selectedMeal.components.map(component => {
                  const carbsPer100g =
                    component.manualCarbsPer100g ?? component.carbsPer100g;

                  return (
                    <div className="result" key={component.id}>
                      <strong>{component.query}</strong>
                      <p>
                        {component.plannedGrams} g
                        <br />
                        {carbsForGrams(component.plannedGrams, carbsPer100g)} g
                        kolhydrater
                      </p>
                    </div>
                  );
                })}

                <h3>
                  Planerat totalt: {plannedTotalWeight} g mat / {plannedTotalCarbs} g
                  kolhydrater
                </h3>
              </section>

              <section>
                <h2>Påfyllning</h2>
                <p>Ange extra mängd per komponent om barnet tar mer mat.</p>

                {selectedMeal.components.map(component => {
                  const carbsPer100g =
                    component.manualCarbsPer100g ?? component.carbsPer100g;

                  const refillGrams = Number(refills[component.id] ?? 0);
                  const refillCarbs = carbsForGrams(refillGrams, carbsPer100g);

                  return (
                    <div className="card" key={component.id}>
                      <strong>{component.query}</strong>

                      <label>Påfyllning, gram</label>
                      <input
                        type="number"
                        value={refills[component.id] ?? ""}
                        onChange={e =>
                          setRefills(current => ({
                            ...current,
                            [component.id]: e.target.value,
                          }))
                        }
                      />

                      <p>
                        Påfyllning: <strong>{refillCarbs} g kolhydrater</strong>
                      </p>
                    </div>
                  );
                })}

                <h3>
                  Totalt påfyllning:{" "}
                  {selectedMeal.components
                    .reduce((sum: number, component: MealComponent) => {
                      const carbsPer100g =
                        component.manualCarbsPer100g ?? component.carbsPer100g;

                      return (
                        sum +
                        carbsForGrams(Number(refills[component.id] ?? 0), carbsPer100g)
                      );
                    }, 0)
                    .toFixed(1)}{" "}
                  g kolhydrater
                </h3>
              </section>

              <section>
                <h2>Beräkning av rester</h2>

                <div className="card">
                  <h3>Alternativ 1: total vikt kvar</h3>

                  <label>Total vikt kvar på tallriken, gram</label>
                  <input
                    type="number"
                    value={totalLeftover}
                    onChange={e => setTotalLeftover(e.target.value)}
                  />

                  <p>
                    Uppskattat ätit:{" "}
                    <strong>{eatenByTotalWeight} g kolhydrater</strong>
                  </p>

                  <p>
                    Denna beräkning antar att resterna har samma blandning som den
                    planerade portionen.
                  </p>
                </div>

                <h3>Alternativ 2: vikt kvar per komponent</h3>

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
                      <strong>{component.query}</strong>

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
                  Totalt ätit enligt komponenter:{" "}
                  {selectedMeal.components
                    .reduce((sum: number, component: MealComponent) => {
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
              </section>
            </>
          )}
        </section>
      )}
    </main>
  );
}