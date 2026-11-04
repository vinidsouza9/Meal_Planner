import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { visibleMeals, type PlanJson } from "@/lib/plan";

const fresh = {
  id: "new",
  week_start: "2026-11-09",
  plan_json: { days: [{ day: "Mon", breakfast: { recipe_id: "", leftover: false }, lunch: { recipe_id: "l", leftover: false }, dinner: { recipe_id: "d", leftover: false } }] },
  locked: [],
  check_ins: { answers: { meals: ["lunch", "dinner"] } },
};

vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  for (const k of ["select", "order", "limit", "eq"]) chain[k] = () => chain;
  chain.maybeSingle = async () => ({ data: fresh, error: null });
  return { supabase: { from: () => chain } };
});

describe("planner shows only the selected meals", () => {
  it("lunch and dinner selected shows no breakfast row", () => {
    const plan = fresh.plan_json as PlanJson;
    expect(visibleMeals(plan, { meals: ["lunch", "dinner"] })).toEqual(["lunch", "dinner"]);
  });

  it("without saved choices, hides meals with no dishes instead of showing breakfast", () => {
    expect(visibleMeals(fresh.plan_json as PlanJson, null)).toEqual(["lunch", "dinner"]);
  });

  it("after generating, the previous week's cached plan with breakfast is replaced before display", async () => {
    const { loadFreshPlan, latestPlanQuery, planForWeekQuery } = await import("@/lib/queries");
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
    const old = { id: "old", week_start: "2026-11-09", plan_json: { days: [] }, locked: [], answers: { meals: ["breakfast", "lunch", "dinner"] } };
    qc.setQueryData(latestPlanQuery.queryKey, old);
    qc.setQueryData(planForWeekQuery("2026-11-09").queryKey, old);

    await loadFreshPlan(qc, "2026-11-09");

    const latest = qc.getQueryData<{ id: string; answers: { meals: string[] } }>(latestPlanQuery.queryKey);
    const week = qc.getQueryData<{ id: string; answers: { meals: string[] } }>(planForWeekQuery("2026-11-09").queryKey);
    expect(latest?.id).toBe("new");
    expect(latest?.answers.meals).toEqual(["lunch", "dinner"]);
    expect(week?.answers.meals).toEqual(["lunch", "dinner"]);
  });
});
