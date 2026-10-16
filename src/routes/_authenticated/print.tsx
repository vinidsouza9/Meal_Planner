import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Coffee, Printer, Salad, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DAYS, MEALS, dayDateLabel, weekRangeLabel, type Meal } from "@/lib/plan";
import { allRecipesQuery, latestPlanQuery, planForWeekQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/print")({
  validateSearch: (s: Record<string, unknown>) => ({ week: typeof s.week === "string" ? s.week : undefined }),
  head: () => ({ meta: [{ title: "Print plan — Meal Planner" }] }),
  component: PrintPage,
});

const MEAL_ICON: Record<Meal, typeof Coffee> = { breakfast: Coffee, lunch: Salad, dinner: UtensilsCrossed };
const PASTEL = ["bg-pastel-peach", "bg-pastel-mint", "bg-pastel-butter", "bg-pastel-lavender"];

function PrintPage() {
  const { week } = Route.useSearch();
  const { data: latest } = useQuery({ ...latestPlanQuery, enabled: !week });
  const { data: weekPlan } = useQuery({ ...planForWeekQuery(week ?? ""), enabled: !!week });
  const plan = week ? weekPlan : latest;
  const { data: recipes = [] } = useQuery(allRecipesQuery);
  const byId = new Map(recipes.map((r) => [r.id, r]));

  const shownDays = plan?.answers && !plan.answers.includeSunday ? DAYS.filter((d) => d !== "Sun") : DAYS;
  const shownMeals = plan?.answers?.meals.length ? MEALS.filter((m) => plan.answers!.meals.includes(m)) : MEALS;

  return (
    <main className="mx-auto max-w-4xl bg-card px-6 py-8 text-foreground print:max-w-none print:px-0 print:py-0">
      <div className="print-hide mb-6 flex justify-between">
        <Button asChild variant="ghost"><Link to="/plan"><ChevronLeft /> Back</Link></Button>
        <Button onClick={() => window.print()}><Printer /> Print</Button>
      </div>

      {/* Decorative header */}
      <div className="rounded-3xl bg-pastel-mint px-6 py-5 print:rounded-2xl">
        <h1 className="font-display text-3xl">Meal Planner</h1>
        {plan && <p className="mt-1 text-sm text-muted-foreground">Week of {weekRangeLabel(plan.week_start)}</p>}
      </div>

      {!plan ? (
        <p className="mt-6">No plan yet.</p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {shownDays.map((d, i) => {
            const row = plan.plan_json.days.find((x) => x.day === d);
            return (
              <section key={d} className={`flex gap-4 rounded-2xl px-4 py-3 ${PASTEL[i % PASTEL.length]}`}>
                <div className="w-20 shrink-0">
                  <p className="text-sm font-bold">{d}</p>
                  <p className="text-xs text-muted-foreground">{dayDateLabel(plan.week_start, d).split(", ")[1]}</p>
                </div>
                <div className="grid flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${shownMeals.length}, minmax(0, 1fr))` }}>
                  {shownMeals.map((m) => {
                    const c = row?.[m];
                    const Icon = MEAL_ICON[m];
                    return (
                      <div key={m} className="rounded-xl bg-card/70 px-3 py-2">
                        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          <Icon className="size-3" aria-hidden /> {m}
                        </p>
                        <p className="mt-0.5 text-sm font-medium leading-snug">
                          {c?.recipe_id ? byId.get(c.recipe_id)?.name ?? "Removed recipe" : "—"}
                        </p>
                        {c?.leftover && <p className="text-[10px] text-muted-foreground">Leftovers</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
