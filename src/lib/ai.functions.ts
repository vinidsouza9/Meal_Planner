import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { claudeJSON } from "./claude.server";
import { DAYS, MEALS, type CheckInAnswers, type PlanJson, type Recipe } from "./plan";

const recipeOut = z.object({
  name: z.string().min(1),
  ingredients: z.array(z.string()),
  steps: z.string(),
  cook_time: z.number().int().min(0).max(1000),
  is_quick: z.boolean(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "any"]),
});

const recipeSchemaItem = {
  type: "object",
  additionalProperties: false,
  required: ["name", "meal_type", "ingredients", "steps", "cook_time", "is_quick"],
  properties: {
    name: { type: "string" },
    meal_type: { type: "string", enum: ["breakfast", "lunch", "dinner", "any"] },
    ingredients: { type: "array", items: { type: "string" } },
    steps: { type: "string" },
    cook_time: { type: "integer" },
    is_quick: { type: "boolean" },
  },
};

const RECIPE_RULES =
  "Ingredients are raw items with quantities for 2 servings (e.g. '200 g chicken thighs'). " +
  "Leave out salt, oil, water and spices — they are pantry staples. Steps are short numbered lines. " +
  "meal_type is breakfast, lunch or dinner when the dish clearly suits one, otherwise any. " +
  "is_quick is true only when cook_time is 20 minutes or less.";

export const parseRecipePhotosWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { images: { mediaType: string; data: string }[] }) =>
    z
      .object({
        images: z
          .array(z.object({ mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]), data: z.string().min(10).max(4_000_000) }))
          .min(1)
          .max(3),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const out = await claudeJSON({
      system:
        "You read photos of recipes (cookbook pages, cards, screenshots, handwritten notes) and turn them into structured recipes. " +
        RECIPE_RULES +
        " If the photos show the same recipe across pages, return it once. If no recipe is readable, set readable=false and return no recipes.",
      user: "Extract the recipe(s) from these photos.",
      images: data.images,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["readable", "recipes"],
        properties: { readable: { type: "boolean" }, recipes: { type: "array", items: recipeSchemaItem } },
      },
      validator: z.object({ readable: z.boolean(), recipes: z.array(recipeOut) }),
    });
    if (!out.readable || !out.recipes.length)
      throw new Error("We couldn't find a recipe in that photo. Try a clearer, well-lit shot of the recipe page.");
    return out.recipes.map((r) => ({ ...r, is_quick: r.cook_time <= 20 && r.is_quick }));
  });

export const parseRecipesWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { text: string }) => z.object({ text: z.string().min(2).max(20000) }).parse(d))
  .handler(async ({ data }) => {
    const out = await claudeJSON({
      system:
        "You turn pasted recipes or lists of dish names into structured recipes for a weekly meal planner. " +
        RECIPE_RULES +
        " If only a dish name is given, write a sensible typical version.",
      user: data.text,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["recipes"],
        properties: {
          recipes: {
            type: "array",
            items: recipeSchemaItem,
          },
        },
      },
      validator: z.object({ recipes: z.array(recipeOut) }),
    });
    return out.recipes.map((r) => ({ ...r, is_quick: r.cook_time <= 20 }));
  });

const cellSchema = {
  type: "object",
  additionalProperties: false,
  required: ["recipe_id", "leftover"],
  properties: { recipe_id: { type: "string" }, leftover: { type: "boolean" } },
};
const cellZ = z.object({ recipe_id: z.string(), leftover: z.boolean() });
const planZ = z.object({
  days: z
    .array(z.object({ day: z.enum(DAYS), breakfast: cellZ, lunch: cellZ, dinner: cellZ }))
    .length(7),
});

function libraryText(recipes: Recipe[]) {
  return recipes
    .map((r) => `- id=${r.id} | ${r.name} | ${r.meal_type ?? "any"} | ${r.cook_time} min${r.is_quick ? " | QUICK" : ""}${r.can_repeat ? " | CAN_REPEAT" : ""}`)
    .join("\n");
}

const answersZ = z.object({
  meals: z.array(z.enum(MEALS)),
  people: z.number().int().min(1).max(20),
  busyDays: z.array(z.enum(DAYS)),
  noCookDays: z.array(z.enum(DAYS)),
  includeSunday: z.boolean(),
  leftoverLunch: z.boolean(),
  fridge: z.array(z.string()),
});

/** Enforce hard rules after the model answers, so the saved plan always respects them. */
function enforce(plan: PlanJson, a: CheckInAnswers, recipes: Recipe[]): PlanJson {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const empty = { recipe_id: "", leftover: false };
  const days = DAYS.map((day) => {
    const d = plan.days.find((x) => x.day === day) ?? { day, breakfast: empty, lunch: empty, dinner: empty };
    const out = { ...d };
    for (const m of MEALS) {
      const c = out[m];
      const ok = a.meals.includes(m) && !a.noCookDays.includes(day) && (a.includeSunday || day !== "Sun");
      if (!ok || !c.recipe_id || !byId.has(c.recipe_id)) out[m] = empty;
      else out[m] = { recipe_id: c.recipe_id, leftover: m === "lunch" && a.leftoverLunch ? c.leftover : false };
    }
    return out;
  });
  // Leftover lunch must match the previous day's dinner.
  days.forEach((d, i) => {
    if (d.lunch.leftover) {
      const prev = days[i - 1];
      if (!prev || prev.dinner.recipe_id !== d.lunch.recipe_id) d.lunch = { ...d.lunch, leftover: false };
    }
  });
  return { days };
}

export const generatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { weekStart: string; answers: CheckInAnswers }) =>
    z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), answers: answersZ }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: recipes, error } = await supabase.from("recipes").select("*");
    if (error) throw new Error("Couldn't load your recipes.");
    if (!recipes?.length) throw new Error("Add some recipes before planning a week.");

    const { data: last } = await supabase
      .from("plans")
      .select("plan_json, week_start")
      .lt("week_start", data.weekStart)
      .order("week_start", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastIds = new Set<string>();
    (last?.plan_json as PlanJson | undefined)?.days?.forEach((d) =>
      MEALS.forEach((m) => d[m]?.recipe_id && lastIds.add(d[m].recipe_id)),
    );
    const lastNames = (recipes as Recipe[]).filter((r) => lastIds.has(r.id)).map((r) => r.name);

    const a = data.answers;
    const raw = await claudeJSON({
      system:
        "You plan a household's week of meals using ONLY the saved recipe library (use exact ids). Rules:\n" +
        "1. Only use recipe ids from the library. Use recipe_id \"\" for a slot with no meal.\n" +
        "2. Only fill the requested meal types; others get \"\".\n" +
        "3. On busy days, dinner must be a QUICK recipe.\n" +
        "4. On no-cook days, every slot is \"\".\n" +
        "5. If Sunday is excluded, all Sunday slots are \"\".\n" +
        "6. If leftover lunches are allowed, lunch may reuse the previous day's dinner recipe_id with leftover=true. Otherwise leftover=false everywhere.\n" +
        "7. Don't use any of last week's dishes unless marked CAN_REPEAT.\n" +
        "8. Prefer recipes whose meal type matches the slot (any fits all). Prefer recipes that use fridge items. Vary dishes across the week.\n" +
        "Return exactly 7 days Mon..Sun.",
      user:
        `Library:\n${libraryText(recipes as Recipe[])}\n\n` +
        `Meals to plan: ${a.meals.join(", ") || "none"}\nPeople: ${a.people}\n` +
        `Busy days: ${a.busyDays.join(", ") || "none"}\nNo-cook days: ${a.noCookDays.join(", ") || "none"}\n` +
        `Include Sunday: ${a.includeSunday}\nLeftover lunches allowed: ${a.leftoverLunch}\n` +
        `Fridge: ${a.fridge.join(", ") || "nothing listed"}\n` +
        `Last week's dishes: ${lastNames.join(", ") || "none"}`,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["days"],
        properties: {
          days: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["day", "breakfast", "lunch", "dinner"],
              properties: {
                day: { type: "string", enum: [...DAYS] },
                breakfast: cellSchema,
                lunch: cellSchema,
                dinner: cellSchema,
              },
            },
          },
        },
      },
      validator: planZ,
    });
    const plan = enforce(raw as PlanJson, a, recipes as Recipe[]);

    const { data: ci } = await supabase
      .from("check_ins")
      .insert({ week_start: data.weekStart, answers: a })
      .select("id")
      .single();
    const { data: saved, error: saveErr } = await supabase
      .from("plans")
      .insert({ week_start: data.weekStart, plan_json: plan, check_in_id: ci?.id ?? null, locked: [] })
      .select("id")
      .single();
    if (saveErr) throw new Error("Couldn't save the plan.");
    return { id: saved.id };
  });

export const suggestSwap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string; day: string; meal: string }) =>
    z.object({ planId: z.string().uuid(), day: z.enum(DAYS), meal: z.enum(MEALS) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: plan }, { data: recipes }] = await Promise.all([
      supabase.from("plans").select("*, check_ins(answers)").eq("id", data.planId).single(),
      supabase.from("recipes").select("*"),
    ]);
    if (!plan || !recipes?.length) throw new Error("Plan not found.");
    const pj = plan.plan_json as PlanJson;
    const answers = (plan as { check_ins?: { answers: CheckInAnswers } | null }).check_ins?.answers;
    const current = pj.days.find((d) => d.day === data.day)?.[data.meal]?.recipe_id ?? "";
    const used = new Set<string>();
    pj.days.forEach((d) => MEALS.forEach((m) => d[m]?.recipe_id && used.add(d[m].recipe_id)));
    const needsQuick = data.meal === "dinner" && !!answers?.busyDays.includes(data.day);
    const candidates = (recipes as Recipe[]).filter((r) => r.id !== current && (!needsQuick || r.is_quick));
    const typed = candidates.filter((r) => !r.meal_type || r.meal_type === "any" || r.meal_type === data.meal);
    if (typed.length) candidates.splice(0, candidates.length, ...typed);
    if (!candidates.length) throw new Error("No other recipe fits this slot. Add more recipes.");

    const out = await claudeJSON({
      system:
        "Suggest ONE replacement recipe from the candidate list for a meal slot. Use an exact id from the list. " +
        "Prefer dishes not already in the week and ones that use fridge items.",
      user:
        `Slot: ${data.day} ${data.meal}${needsQuick ? " (busy day: must be quick)" : ""}\n` +
        `Already this week: ${(recipes as Recipe[]).filter((r) => used.has(r.id)).map((r) => r.name).join(", ")}\n` +
        `Fridge: ${answers?.fridge.join(", ") || "nothing"}\nCandidates:\n${libraryText(candidates)}`,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["recipe_id"],
        properties: { recipe_id: { type: "string" } },
      },
      validator: z.object({ recipe_id: z.string() }),
      maxTokens: 2000,
    });
    const pick = candidates.find((c) => c.id === out.recipe_id) ?? candidates[0]!;
    const days = pj.days.map((d) => (d.day === data.day ? { ...d, [data.meal]: { recipe_id: pick.id, leftover: false } } : d));
    const { error } = await supabase.from("plans").update({ plan_json: { days } }).eq("id", data.planId);
    if (error) throw new Error("Couldn't save the swap.");
    return { recipe_id: pick.id, name: pick.name };
  });
