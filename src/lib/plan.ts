// Shared, browser-safe types and helpers for plans and grocery lists.
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = (typeof DAYS)[number];
export const MEALS = ["breakfast", "lunch", "dinner"] as const;
export type Meal = (typeof MEALS)[number];

export type Cell = { recipe_id: string; leftover: boolean };
export type PlanDay = { day: Day; breakfast: Cell; lunch: Cell; dinner: Cell };
export type PlanJson = { days: PlanDay[] };

export type CheckInAnswers = {
  meals: Meal[];
  people: number;
  busyDays: Day[];
  noCookDays: Day[];
  includeSunday: boolean;
  leftoverLunch: boolean;
  fridge: string[];
};

export type Recipe = {
  id: string;
  name: string;
  ingredients: string[];
  steps: string | null;
  cook_time: number;
  is_quick: boolean;
  can_repeat: boolean;
  meal_types: Meal[];
  original_image_url?: string | null;
  image_crop?: import("./photo-crop").PhotoCrop | null;
  image_url: string | null;
  /** Signed URL for image_url, filled in by queries. */
  imageSrc?: string | null;
};

export const MEAL_TYPES = MEALS;
export type MealType = (typeof MEAL_TYPES)[number];

/** Swap any two cells (across days or meal types). Returns null if the move isn't allowed. */
export function swapCells(plan: PlanJson, locked: string[], a: { day: Day; meal: Meal }, b: { day: Day; meal: Meal }): PlanJson | null {
  if (a.day === b.day && a.meal === b.meal) return null;
  if (locked.includes(cellKey(a.day, a.meal)) || locked.includes(cellKey(b.day, b.meal))) return null;
  const ca = plan.days.find((d) => d.day === a.day)?.[a.meal];
  const cb = plan.days.find((d) => d.day === b.day)?.[b.meal];
  if (!ca || !cb) return null;
  // A moved meal is freshly cooked where it lands, so the leftover flag is dropped.
  return {
    days: plan.days.map((d) => {
      let out = d;
      if (d.day === a.day) out = { ...out, [a.meal]: { recipe_id: cb.recipe_id, leftover: false } };
      if (d.day === b.day) out = { ...out, [b.meal]: { recipe_id: ca.recipe_id, leftover: false } };
      return out;
    }),
  };
}

/** Plain-text grocery list grouped by aisle (unchecked items only). */
export function groceryText(items: GroceryItem[], title?: string): string {
  const body = AISLES.map((a) => {
    const rows = items.filter((i) => i.aisle === a && !i.checked);
    return rows.length ? `${a}\n${rows.map((r) => `- ${r.name} (${r.qty})`).join("\n")}` : "";
  })
    .filter(Boolean)
    .join("\n\n");
  return title ? `${title}\n\n${body}` : body;
}

export const cellKey = (day: Day, meal: Meal) => `${day}-${meal}`;

/** Weekday and mealtime in the user's local timezone. */
export function currentCookingSlot(now = new Date()): { day: Day; meal: Meal } {
  const day = DAYS[(now.getDay() + 6) % 7] ?? "Mon";
  const hour = now.getHours();
  const meal: Meal = hour < 11 ? "breakfast" : hour < 16 ? "lunch" : "dinner";
  return { day, meal };
}

/** Resolve the local weekday's meal from the calendar currently being viewed. */
export function cookingRecipe(plan: PlanJson, recipes: Recipe[], slot: { day: Day; meal: Meal }): Recipe | undefined {
  const cell = plan.days.find((day) => day.day === slot.day)?.[slot.meal];
  return recipes.find((recipe) => recipe.id === cell?.recipe_id);
}

/** True when a recipe over 20 minutes lands in dinner on a busy day (allowed, but worth a warning). */
export function longDinnerOnBusyDay(answers: CheckInAnswers | null | undefined, recipe: Recipe | undefined, day: Day, meal: Meal): boolean {
  return !!answers && meal === "dinner" && answers.busyDays.includes(day) && !!recipe && recipe.cook_time > 20;
}

/** Shift a week_start (YYYY-MM-DD) by whole weeks. */
export function shiftWeek(weekStart: string, weeks: number): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

/** "Oct 19 – 25, 2026" for a week_start. */
export function weekRangeLabel(weekStart: string): string {
  const s = new Date(weekStart + "T00:00:00");
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  const sameMonth = s.getMonth() === e.getMonth();
  const start = s.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const end = e.toLocaleDateString(undefined, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${start} – ${end}, ${e.getFullYear()}`;
}

/** "Mon, Oct 19" for a day within the week. */
export function dayDateLabel(weekStart: string, day: Day): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + DAYS.indexOf(day));
  return `${day}, ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

/** Monday of the upcoming week (today if today is Monday), as YYYY-MM-DD. */
export function upcomingMonday(from = new Date()): string {
  const d = new Date(from);
  const dow = d.getDay(); // 0 Sun
  const add = dow === 1 ? 0 : (8 - dow) % 7;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

export const AISLES = ["Produce", "Meat & eggs", "Dairy", "Pantry", "Bakery & frozen"] as const;
export type Aisle = (typeof AISLES)[number];
export type GroceryItem = { name: string; qty: string; aisle: Aisle; checked: boolean };

const AISLE_WORDS: Record<Exclude<Aisle, "Pantry">, string[]> = {
  Produce: ["onion", "garlic", "tomato", "potato", "carrot", "pepper", "lettuce", "spinach", "kale", "lemon", "lime", "apple", "banana", "berr", "avocado", "cucumber", "zucchini", "courgette", "broccoli", "cauliflower", "mushroom", "ginger", "herb", "cilantro", "coriander", "parsley", "basil", "mint", "scallion", "leek", "celery", "cabbage", "squash", "pumpkin", "corn", "pea", "bean sprout", "chili", "fruit", "salad", "eggplant", "aubergine", "orange", "grape"],
  "Meat & eggs": ["chicken", "beef", "pork", "lamb", "turkey", "bacon", "sausage", "ham", "egg", "fish", "salmon", "tuna", "shrimp", "prawn", "mince", "steak", "tofu"],
  Dairy: ["milk", "cheese", "butter", "yogurt", "yoghurt", "cream", "paneer", "feta", "mozzarella", "parmesan", "ricotta"],
  "Bakery & frozen": ["bread", "bun", "roll", "tortilla", "wrap", "pita", "naan", "bagel", "frozen", "baguette"],
};

export function aisleFor(name: string): Aisle {
  const n = name.toLowerCase();
  for (const a of ["Meat & eggs", "Dairy", "Bakery & frozen", "Produce"] as const) {
    if (AISLE_WORDS[a].some((w) => n.includes(w))) return a;
  }
  return "Pantry";
}

/** Split "2 cups rice" into { amount: 2, rest: "cups rice" }. */
function parseQty(raw: string): { amount: number | null; unit: string; name: string } {
  const m = raw.trim().match(/^(\d+(?:[.,]\d+)?|\d+\/\d+)\s*(.*)$/);
  if (!m) return { amount: null, unit: "", name: raw.trim() };
  const g1 = m[1] ?? "";
  const num = g1.includes("/") ? Number(g1.split("/")[0]) / Number(g1.split("/")[1]) : Number(g1.replace(",", "."));
  const rest = m[2] ?? "";
  const u = rest.match(/^(g|kg|ml|l|cups?|tbsp|tsp|oz|lb|cans?|cloves?|bunch(?:es)?|pcs?)\b\s*(.*)$/i);
  return u ? { amount: num, unit: u[1] ?? "", name: u[2] ?? "" } : { amount: num, unit: "", name: rest };
}

const round = (n: number) => (Math.round(n * 4) / 4).toString();

/**
 * Builds a grocery list from the plan. Recipes are assumed to serve 2;
 * quantities scale by people / 2. Leftover cells add nothing. Fridge items are removed.
 */
export function buildGrocery(plan: PlanJson, recipes: Recipe[], people: number, fridge: string[]): GroceryItem[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const factor = Math.max(1, people) / 2;
  const fridgeLc = fridge.map((f) => f.toLowerCase().trim()).filter(Boolean);
  const agg = new Map<string, { name: string; unit: string; amount: number; count: number }>();
  for (const d of plan.days) {
    for (const meal of MEALS) {
      const c = d[meal];
      if (!c?.recipe_id || c.leftover) continue;
      const r = byId.get(c.recipe_id);
      if (!r) continue;
      for (const ing of r.ingredients) {
        const p = parseQty(ing);
        const name = p.name.toLowerCase().trim();
        if (!name) continue;
        if (fridgeLc.some((f) => name.includes(f) || f.includes(name))) continue;
        const key = `${name}|${p.unit.toLowerCase()}`;
        const cur = agg.get(key) ?? { name: p.name.trim(), unit: p.unit, amount: 0, count: 0 };
        if (p.amount != null) cur.amount += p.amount * factor;
        else cur.count += 1;
        agg.set(key, cur);
      }
    }
  }
  return [...agg.values()]
    .map((v) => ({
      name: v.name.charAt(0).toUpperCase() + v.name.slice(1),
      qty: v.amount > 0 ? `${round(v.amount)}${v.unit ? " " + v.unit : ""}` : `for ${v.count} meal${v.count > 1 ? "s" : ""}`,
      aisle: aisleFor(v.name),
      checked: false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Never retain a generated recipe in a meal slot it is not tagged for. */
export function enforceMealTypes(plan: PlanJson, recipes: Recipe[]): PlanJson {
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  return { days: plan.days.map((day) => {
    const out = { ...day };
    for (const meal of MEALS) {
      const cell = day[meal];
      if (cell.recipe_id && !byId.get(cell.recipe_id)?.meal_types.includes(meal)) out[meal] = { recipe_id: "", leftover: false };
    }
    return out;
  }) };
}
