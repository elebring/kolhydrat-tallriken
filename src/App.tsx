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

const WEEK_KEY = "kolhydrat_tallriken_week_menu";
const LUNCH_DRAFT_KEY = "kolhydrat_tallriken_lunch_draft";
const PARENT_OTHER_KEY = "kolhydrat_tallriken_parent_other";
const PRESCHOOL_OTHER_KEY = "kolhydrat_tallriken_preschool_other";

const weekdays: Weekday[] = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];

type TopTab = "parent" | "preschool";
type ParentSubTab = "lunch" | "other";
type PreschoolSubTab = "lunch" | "other";

type CalculatorState = {
  menuText: string;
  targetCarbs: string;
  components: MealComponent[];
};

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

function roleText(role: MealRole) {
  if (role === "mainCarb") return "Kolhydratkälla";
  if (role === "protein") return "Protein";
  if (role === "extraCarb") return "Extra kolhydrat";
  return "Grönsak";
}

const emptyCalculator: CalculatorState = {
  menuText: "yoghurt, flingor, banan",
  targetCarbs: "25",
  components: [],
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TopTab>("parent");
  const [parentSubTab, setParentSubTab] = useState<ParentSubTab>("lunch");
  const [preschoolSubTab, setPreschoolSubTab] =
    useState<PreschoolSubTab>("lunch");

  const [foods, setFoods] = useState<Food[]>([]);
  const [weekMeals, setWeekMeals] = useState<DayMeal[]>(() =>
    loadJson<DayMeal[]>(WEEK_KEY, [])
  );

  const lunchDraft = loadJson<any>(LUNCH_DRAFT_KEY, null);

  const [weekday, setWeekday] = useState<Weekday>(
    lunchDraft?.weekday ?? "Måndag"
  );

  const [menuText, setMenuText] = useState(
    lunchDraft?.menuText ?? "köttbullar, kokt potatis, lingonsylt"
  );

  const [targetCarbs, setTargetCarbs] = useState(
    String(lunchDraft?.targetCarbs ?? "35")
  );

  const [components, setComponents] = useState<MealComponent[]>(
    lunchDraft?.components ?? []
  );

  const [parentOther, setParentOther] = useState<CalculatorState>(() =>
    loadJson<CalculatorState>(PARENT_OTHER_KEY, emptyCalculator)
  );

  const [preschoolOther, setPreschoolOther] = useState<CalculatorState>(() =>
    loadJson<CalculatorState>(PRESCHOOL_OTHER_KEY, {
      menuText: "frukt, smörgås",
      targetCarbs: "20",
      components: [],
    })
  );

  const [selectedMealId, setSelectedMealId] = useState("");
  const [leftovers, setLeftovers] = useState<Record<string, string>>({});
  const [totalLeftover, setTotalLeftover] = useState("");
  const [refills, setRefills] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAllFoods().then(setFoods).catch(console.error);
  }, []);

  useEffect(() => {
    localStorage.setItem(WEEK_KEY, JSON.stringify(weekMeals));
  }, [weekMeals]);

  useEffect(() => {
    localStorage.setItem(
      LUNCH_DRAFT_KEY,
      JSON.stringify({ weekday, menuText, targetCarbs, components })
    );
  }, [weekday, menuText, targetCarbs, components]);

  useEffect(() => {
    localStorage.setItem(PARENT_OTHER_KEY, JSON.stringify(parentOther));
  }, [parentOther]);

  useEffect(() => {
    localStorage.setItem(PRESCHOOL_OTHER_KEY, JSON.stringify(preschoolOther));
  }, [preschoolOther]);

  function createComponentsFromText(text: string): MealComponent[] {
    const parts: string[] = text
      .split(",")
      .map((part: string) => part.trim())
      .filter((part: string) => Boolean(part));

    return parts.map((part: string, index: number) => ({
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
    }));
  }

  async function selectFoodForComponents(
    componentId: string,
    food: Food,
    setter: React.Dispatch<React.SetStateAction<MealComponent[]>>
  ) {
    const nutrition = await fetchNutrition(food.nummer);
    const carbsPer100g = getCarbsPer100g(nutrition);

    setter(current =>
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

  function updateComponentRole(
    componentId: string,
    role: MealRole,
    setter: React.Dispatch<React.SetStateAction<MealComponent[]>>
  ) {
    setter(current =>
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

  function updateComponentManualCarbs(
    componentId: string,
    value: string,
    setter: React.Dispatch<React.SetStateAction<MealComponent[]>>
  ) {
    setter(current =>
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

  function updateComponentGrams(
    componentId: string,
    value: string,
    setter: React.Dispatch<React.SetStateAction<MealComponent[]>>
  ) {
    setter(current =>
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

  function getDisplayedPlate(items: MealComponent[], carbs: string) {
    const calculated = calculatePlate(items, Number(carbs));

    return items.map(component => {
      const calculatedComponent = calculated.find(c => c.id === component.id);
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
  }

  const displayedLunchPlate = useMemo(
    () => getDisplayedPlate(components, targetCarbs),
    [components, targetCarbs]
  );

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

  function saveLunchMeal() {
    const meal: DayMeal = {
      id: makeId(),
      weekday,
      menuText,
      targetCarbs: Number(targetCarbs),
      components: displayedLunchPlate.map(component => ({
        ...component,
        plannedGramsInput: String(component.plannedGrams),
      })),
    };

    setWeekMeals(current => {
      const next = [...current.filter(m => m.weekday !== weekday), meal];
      localStorage.setItem(WEEK_KEY, JSON.stringify(next));
      return next;
    });

    setSelectedMealId(meal.id);
    setActiveTab("preschool");
    setPreschoolSubTab("lunch");
  }

  function clearAll() {
    setWeekMeals([]);
    setComponents([]);
    setLeftovers({});
    setTotalLeftover("");
    setRefills({});
    localStorage.removeItem(WEEK_KEY);
    localStorage.removeItem(LUNCH_DRAFT_KEY);
  }

  function renderCalculator({
    title,
    description,
    state,
    setState,
  }: {
    title: string;
    description: string;
    state: CalculatorState;
    setState: React.Dispatch<React.SetStateAction<CalculatorState>>;
  }) {
    const plate = getDisplayedPlate(state.components, state.targetCarbs);

    const setCalculatorComponents: React.Dispatch<
      React.SetStateAction<MealComponent[]>
    > = update => {
      setState(current => ({
        ...current,
        components:
          typeof update === "function" ? update(current.components) : update,
      }));
    };

    return (
      <section>
        <h2>{title}</h2>
        <p>{description}</p>

        <div className="info-box">
          <strong>Tips vid känd vikt</strong>
          <p>
            Om du vill utgå från faktisk vikt i stället för ett kolhydratmål:
            skriv <strong>0</strong> som kolhydratmål och ange vikten direkt
            under <strong>Portionsförslag</strong>. Då räknas kolhydraterna ut
            från angiven vikt.
          </p>
        </div>

        <label>Måltidens delar</label>
        <input
          value={state.menuText}
          onChange={e =>
            setState(current => ({
              ...current,
              menuText: e.target.value,
              components: [],
            }))
          }
        />

        <label>Kolhydratmål</label>
        <input
          type="number"
          value={state.targetCarbs}
          onChange={e =>
            setState(current => ({ ...current, targetCarbs: e.target.value }))
          }
        />

        <button
          onClick={() =>
            setState(current => ({
              ...current,
              components: createComponentsFromText(current.menuText),
            }))
          }
        >
          Hämta matvaror
        </button>

        {state.components.map(component => {
          const matches = searchFoods(component.query, foods);

          return (
            <div className="card" key={component.id}>
              <span className={`role-label role-${component.role}`}>
                {roleText(component.role)}
              </span>

              <h3>{component.query}</h3>

              <label>Roll på tallriken</label>
              <select
                value={component.role}
                onChange={e =>
                  updateComponentRole(
                    component.id,
                    e.target.value as MealRole,
                    setCalculatorComponents
                  )
                }
              >
                <option value="mainCarb">Kolhydratkälla</option>
                <option value="protein">Protein</option>
                <option value="extraCarb">Extra kolhydrat</option>
                <option value="vegetable">Grönsak</option>
              </select>

              <p>
                Välj bästa träff från Livsmedelsverkets databas. Om träffen
                inte stämmer kan du ange kolhydratvärdet manuellt nedan.
              </p>

              {matches.map(food => (
                <button
                  key={food.nummer}
                  className={
                    component.selectedFood?.nummer === food.nummer
                      ? "food-option selected"
                      : "food-option"
                  }
                  onClick={() =>
                    selectFoodForComponents(
                      component.id,
                      food,
                      setCalculatorComponents
                    )
                  }
                >
                  {food.namn}
                </button>
              ))}

              {component.selectedFood && (
                <p>
                  Matchad mot: <strong>{component.selectedFood.namn}</strong>
                  <br />
                  {component.carbsPer100g} g kolhydrater / 100 g
                </p>
              )}

              <label>Manuellt kolhydratvärde / 100 g</label>
              <input
                type="number"
                placeholder="Valfritt"
                value={component.manualCarbsPer100g ?? ""}
                onChange={e =>
                  updateComponentManualCarbs(
                    component.id,
                    e.target.value,
                    setCalculatorComponents
                  )
                }
              />
            </div>
          );
        })}

        {state.components.length > 0 && (
          <>
            <h2>Portionsförslag</h2>
            <p>
              Förslaget kan justeras manuellt. Kolhydraterna räknas om direkt
              när mängden ändras.
            </p>

            {plate.map(component => {
              const carbsPer100g =
                component.manualCarbsPer100g ?? component.carbsPer100g;

              return (
                <div className="result" key={component.id}>
                  <span className={`role-label role-${component.role}`}>
                    {roleText(component.role)}
                  </span>

                  <strong>{component.query}</strong>

                  <label>Mängd, gram</label>
                  <input
                    type="number"
                    value={
                      component.plannedGramsInput ?? String(component.plannedGrams)
                    }
                    onChange={e =>
                      updateComponentGrams(
                        component.id,
                        e.target.value,
                        setCalculatorComponents
                      )
                    }
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

            <div className="summary-card">
              <strong>Sammanfattning</strong>
              <p>
                Totalt:{" "}
                <strong>{totalCarbsForComponents(plate)} g kolhydrater</strong>
              </p>
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <main>
      <h1>SmartPortion</h1>
      <p className="app-intro">
        Planera portioner, räkna kolhydrater och ge tydliga underlag mellan hem
        och förskola.
      </p>

      <div className="tabs">
        <button
          className={activeTab === "parent" ? "active" : ""}
          onClick={() => setActiveTab("parent")}
        >
          Förälder
        </button>

        <button
          className={activeTab === "preschool" ? "active" : ""}
          onClick={() => setActiveTab("preschool")}
        >
          Förskola
        </button>
      </div>

      {activeTab === "parent" && (
        <>
          <div className="subtabs">
            <button
              className={parentSubTab === "lunch" ? "active" : ""}
              onClick={() => setParentSubTab("lunch")}
            >
              Beräkna lunch
            </button>

            <button
              className={parentSubTab === "other" ? "active" : ""}
              onClick={() => setParentSubTab("other")}
            >
              Beräkna annan måltid
            </button>
          </div>

          {parentSubTab === "lunch" && (
            <section>
              <h2>Beräkna lunch</h2>
              <p>
                Lägg in dagens lunch, välj träffar från Livsmedelsverket och
                spara förslaget till förskolefliken.
              </p>

              <label>Veckodag</label>
              <select
                value={weekday}
                onChange={e => setWeekday(e.target.value as Weekday)}
              >
                {weekdays.map(day => (
                  <option key={day}>{day}</option>
                ))}
              </select>

              <label>Meny</label>
              <input
                value={menuText}
                onChange={e => {
                  setMenuText(e.target.value);
                  setComponents([]);
                }}
              />

              <label>Totalt kolhydratmål</label>
              <input
                type="number"
                value={targetCarbs}
                onChange={e => setTargetCarbs(e.target.value)}
              />

              <button
                onClick={() => setComponents(createComponentsFromText(menuText))}
              >
                Hämta matvaror
              </button>

              {components.map(component => {
                const matches = searchFoods(component.query, foods);

                return (
                  <div className="card" key={component.id}>
                    <span className={`role-label role-${component.role}`}>
                      {roleText(component.role)}
                    </span>

                    <h3>{component.query}</h3>

                    <label>Roll på tallriken</label>
                    <select
                      value={component.role}
                      onChange={e =>
                        updateComponentRole(
                          component.id,
                          e.target.value as MealRole,
                          setComponents
                        )
                      }
                    >
                      <option value="mainCarb">Kolhydratkälla</option>
                      <option value="protein">Protein</option>
                      <option value="extraCarb">Extra kolhydrat</option>
                      <option value="vegetable">Grönsak</option>
                    </select>

                    <p>
                      Välj den databaspost som bäst motsvarar maten som ska
                      serveras. Om träffen inte stämmer kan du ange
                      kolhydratvärdet manuellt nedan.
                    </p>

                    {matches.map(food => (
                      <button
                        key={food.nummer}
                        className={
                          component.selectedFood?.nummer === food.nummer
                            ? "food-option selected"
                            : "food-option"
                        }
                        onClick={() =>
                          selectFoodForComponents(
                            component.id,
                            food,
                            setComponents
                          )
                        }
                      >
                        {food.namn}
                      </button>
                    ))}

                    {component.selectedFood && (
                      <p>
                        Matchad mot: <strong>{component.selectedFood.namn}</strong>
                        <br />
                        {component.carbsPer100g} g kolhydrater / 100 g
                      </p>
                    )}

                    <label>Manuellt kolhydratvärde / 100 g</label>
                    <input
                      type="number"
                      placeholder="Valfritt"
                      value={component.manualCarbsPer100g ?? ""}
                      onChange={e =>
                        updateComponentManualCarbs(
                          component.id,
                          e.target.value,
                          setComponents
                        )
                      }
                    />
                  </div>
                );
              })}

              {components.length > 0 && (
                <>
                  <h2>Tallriksförslag</h2>
                  <p>
                    Justera gram manuellt om portionen behöver anpassas. Det
                    sparade förslaget förs över till förskolan.
                  </p>

                  {displayedLunchPlate.map(component => {
                    const carbsPer100g =
                      component.manualCarbsPer100g ?? component.carbsPer100g;

                    return (
                      <div className="result" key={component.id}>
                        <span className={`role-label role-${component.role}`}>
                          {roleText(component.role)}
                        </span>

                        <strong>{component.query}</strong>

                        <label>Mängd, gram</label>
                        <input
                          type="number"
                          value={
                            component.plannedGramsInput ??
                            String(component.plannedGrams)
                          }
                          onChange={e =>
                            updateComponentGrams(
                              component.id,
                              e.target.value,
                              setComponents
                            )
                          }
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

                  <div className="summary-card">
                    <strong>Sammanfattning</strong>
                    <p>
                      Totalt i tallriksförslag:{" "}
                      <strong>
                        {totalCarbsForComponents(displayedLunchPlate)} g
                        kolhydrater
                      </strong>
                    </p>
                  </div>

                  <button onClick={saveLunchMeal}>
                    Spara och för över till förskola
                  </button>
                </>
              )}

              <button className="danger" onClick={clearAll}>
                Rensa hela veckan
              </button>
            </section>
          )}

          {parentSubTab === "other" &&
            renderCalculator({
              title: "Beräkna annan måltid",
              description:
                "Använd för mellanmål, fruktstund, utflykt eller andra måltider. Beräkningen sparas separat men förs inte över till förskolan.",
              state: parentOther,
              setState: setParentOther,
            })}
        </>
      )}

      {activeTab === "preschool" && (
        <>
          <div className="subtabs">
            <button
              className={preschoolSubTab === "lunch" ? "active" : ""}
              onClick={() => setPreschoolSubTab("lunch")}
            >
              Lunchförslag
            </button>

            <button
              className={preschoolSubTab === "other" ? "active" : ""}
              onClick={() => setPreschoolSubTab("other")}
            >
              Beräkna annan måltid
            </button>
          </div>

          {preschoolSubTab === "other" &&
            renderCalculator({
              title: "Beräkna annan måltid",
              description:
                "Använd vid extra mellanmål eller annan mat som inte hör till lunchförslaget. Beräkningen sparas separat på denna enhet.",
              state: preschoolOther,
              setState: setPreschoolOther,
            })}

          {preschoolSubTab === "lunch" && (
            <section>
              <h2>Lunchförslag</h2>
              <p>
                Här visas lunchförslag som sparats av förälder. Förskolan kan
                beräkna påfyllning och rester.
              </p>

              {weekMeals.length === 0 && <p>Inga sparade måltider ännu.</p>}

              {weekMeals.length > 0 && selectedMeal && (
                <>
                  <label>Välj dag</label>
                  <select
                    value={selectedMeal.id}
                    onChange={e => setSelectedMealId(e.target.value)}
                  >
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
                    <p>Den portion som har sparats från föräldrafliken.</p>

                    {selectedMeal.components.map(component => {
                      const carbsPer100g =
                        component.manualCarbsPer100g ?? component.carbsPer100g;

                      return (
                        <div className="result" key={component.id}>
                          <span className={`role-label role-${component.role}`}>
                            {roleText(component.role)}
                          </span>

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

                    <div className="summary-card">
                      <strong>Planerat totalt</strong>
                      <p>
                        {plannedTotalWeight} g mat /{" "}
                        <strong>{plannedTotalCarbs} g kolhydrater</strong>
                      </p>
                    </div>
                  </section>

                  <section>
                    <h2>Påfyllning</h2>
                    <p>
                      Ange extra mängd per komponent om barnet får mer mat utöver
                      den planerade portionen.
                    </p>

                    {selectedMeal.components.map(component => {
                      const carbsPer100g =
                        component.manualCarbsPer100g ?? component.carbsPer100g;

                      const refillGrams = Number(refills[component.id] ?? 0);
                      const refillCarbs = carbsForGrams(
                        refillGrams,
                        carbsPer100g
                      );

                      return (
                        <div className="card" key={component.id}>
                          <span className={`role-label role-${component.role}`}>
                            {roleText(component.role)}
                          </span>

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

                    <div className="summary-card">
                      <strong>Totalt påfyllning</strong>
                      <p>
                        {selectedMeal.components
                          .reduce((sum: number, component: MealComponent) => {
                            const carbsPer100g =
                              component.manualCarbsPer100g ??
                              component.carbsPer100g;

                            return (
                              sum +
                              carbsForGrams(
                                Number(refills[component.id] ?? 0),
                                carbsPer100g
                              )
                            );
                          }, 0)
                          .toFixed(1)}{" "}
                        g kolhydrater
                      </p>
                    </div>
                  </section>

                  <section>
                    <h2>Beräkning av rester</h2>
                    <p>
                      Välj antingen total vikt kvar eller väg kvarvarande mängd
                      per komponent.
                    </p>

                    <div className="card option-card">
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

                      <small>
                        Beräkningen antar att resterna har ungefär samma
                        blandning som den planerade portionen.
                      </small>
                    </div>

                    <div className="card option-card">
                      <h3>Alternativ 2: vikt kvar per komponent</h3>

                      {selectedMeal.components.map(component => {
                        const carbsPer100g =
                          component.manualCarbsPer100g ??
                          component.carbsPer100g;

                        const leftover = Number(leftovers[component.id] ?? 0);
                        const eaten = eatenCarbs(
                          component.plannedGrams,
                          leftover,
                          carbsPer100g
                        );

                        return (
                          <div className="sub-card" key={component.id}>
                            <span className={`role-label role-${component.role}`}>
                              {roleText(component.role)}
                            </span>

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
                              Uppskattat ätit:{" "}
                              <strong>{eaten} g kolhydrater</strong>
                            </p>
                          </div>
                        );
                      })}

                      <div className="summary-card">
                        <strong>Sammanfattning</strong>
                        <p>
                          Totalt ätit enligt komponenter:{" "}
                          <strong>
                            {selectedMeal.components
                              .reduce(
                                (sum: number, component: MealComponent) => {
                                  const carbsPer100g =
                                    component.manualCarbsPer100g ??
                                    component.carbsPer100g;

                                  const leftover = Number(
                                    leftovers[component.id] ?? 0
                                  );

                                  return (
                                    sum +
                                    eatenCarbs(
                                      component.plannedGrams,
                                      leftover,
                                      carbsPer100g
                                    )
                                  );
                                },
                                0
                              )
                              .toFixed(1)}{" "}
                            g kolhydrater
                          </strong>
                        </p>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}