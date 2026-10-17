import { pageMeta } from "@/lib/metadata";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Coffee, Printer, Salad, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanGridSkeleton } from "@/components/Loading";
import { DAYS, MEALS, dayDateLabel, weekRangeLabel, type Meal } from "@/lib/plan";
import { allRecipesQuery, latestPlanQuery, planForWeekQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/print")({
  validateSearch: (s: Record<string, unknown>) => ({ week: typeof s["week"] === "string" ? (s["week"] as string) : undefined }),
  head: () => pageMeta("Print plan", "Print your weekly meal planner with dates."),
  component: PrintPage,
});

const MEAL_ICON: Record<Meal, typeof Coffee> = { breakfast: Coffee, lunch: Salad, dinner: UtensilsCrossed };

function PrintPage() {
  const { week } = Route.useSearch();
  const { data: latest, isLoading: latestLoading } = useQuery({ ...latestPlanQuery, enabled: !week });
  const { data: weekPlan, isLoading: weekLoading } = useQuery({ ...planForWeekQuery(week ?? ""), enabled: !!week });
  const plan = week ? weekPlan : latest;
  const { data: recipes = [], isLoading: recipesLoading } = useQuery(allRecipesQuery);
  const byId = new Map(recipes.map((r) => [r.id, r]));

  const shownDays = plan?.answers && !plan.answers.includeSunday ? DAYS.filter((d) => d !== "Sun") : DAYS;
  const shownMeals = plan?.answers?.meals.length ? MEALS.filter((m) => plan.answers!.meals.includes(m)) : MEALS;

  if (recipesLoading || (week ? weekLoading : latestLoading)) return <main className="mx-auto max-w-4xl px-6 py-8"><PlanGridSkeleton /></main>;

  return (
    <main className="mx-auto max-w-4xl bg-card px-6 py-8 text-foreground print:max-w-none print:px-0 print:py-0">
      <div className="print-hide mb-6 flex justify-between">
        <Button asChild variant="ghost"><Link to="/plan"><ChevronLeft /> Back</Link></Button>
        <Button onClick={() => window.print()}><Printer /> Print</Button>
      </div>

      {/* Decorative header */}
      <div className="rounded-3xl border-t-4 border-secondary bg-card px-6 py-5 print:rounded-2xl">
        <h1 className="font-display text-3xl">Meal Planner</h1>
        {plan && <p className="mt-1 text-sm text-muted-foreground">Week of {weekRangeLabel(plan.week_start)}</p>}
      </div>

      {!plan ? (
        <p className="mt-6">No plan yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="print-grid table-fixed text-left">
            <thead><tr><th className="w-24 text-xs">Day</th>{shownMeals.map((m) => <th key={m} className="text-xs capitalize">{m}</th>)}</tr></thead>
            <tbody>{shownDays.map((d) => {
            const row = plan.plan_json.days.find((x) => x.day === d);
            return (
              <tr key={d}>
                <th scope="row" className="w-24">
                  <p className="text-sm font-bold">{d}</p>
                  <p className="text-xs text-muted-foreground">{dayDateLabel(plan.week_start, d).split(", ")[1]}</p>
                </th>
                  {shownMeals.map((m) => {
                    const c = row?.[m];
                    const Icon = MEAL_ICON[m];
                    return (
                      <td key={m} className="bg-card/70">
                        <p className={`inline-flex items-center gap-1 rounded px-1 text-[10px] font-semibold uppercase text-muted-foreground ${m === "breakfast" ? "bg-pastel-butter" : m === "lunch" ? "bg-pastel-mint" : "bg-pastel-peach"}`}>
                          <Icon className="size-3" aria-hidden /> {m}
                        </p>
                        <p className="mt-0.5 text-sm font-medium leading-snug">
                          {c?.recipe_id ? byId.get(c.recipe_id)?.name ?? "Removed recipe" : "—"}
                        </p>
                        {c?.leftover && <p className="text-[10px] text-muted-foreground">Leftovers</p>}
                      </td>
                    );
                  })}
              </tr>
            );
          })}</tbody></table>
        </div>
      )}
    </main>
  );
}
