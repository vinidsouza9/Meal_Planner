import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AISLES, DAYS, MEALS, buildGrocery, dayDateLabel, weekRangeLabel } from "@/lib/plan";
import { allRecipesQuery, recentPlansQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — Meal Planner" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const { data: plans = [], isLoading } = useQuery(recentPlansQuery(2));
  const { data: recipes = [] } = useQuery(allRecipesQuery);
  const byId = new Map(recipes.map((r) => [r.id, r]));

  return (
    <main className="mx-auto max-w-4xl px-5 pt-6">
      <h1 className="font-display text-3xl">History</h1>
      {isLoading ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : plans.length === 0 ? (
        <div className="surface mt-6 p-8 text-center text-muted-foreground">Your past plans will show up here.</div>
      ) : (
        <Accordion type="single" collapsible className="mt-6 space-y-3">
          {plans.map((p) => {
            const shownDays = p.answers && !p.answers.includeSunday ? DAYS.filter((d) => d !== "Sun") : DAYS;
            const shownMeals = p.answers?.meals.length ? MEALS.filter((m) => p.answers!.meals.includes(m)) : MEALS;
            const grocery = buildGrocery(p.plan_json, recipes, p.answers?.people ?? 2, p.answers?.fridge ?? []);
            return (
              <AccordionItem key={p.id} value={p.id} className="surface overflow-hidden border-b-0">
                <AccordionTrigger className="px-5 py-4 hover:no-underline">
                  <span className="flex items-center gap-2 text-left">
                    <span className="font-display text-lg">Week of {weekRangeLabel(p.week_start)}</span>
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[560px] gap-2" style={{ gridTemplateColumns: `5.5rem repeat(${shownDays.length}, minmax(0, 1fr))` }}>
                      <div />
                      {shownDays.map((d) => (
                        <div key={d} className="rounded-lg border bg-card py-1.5 text-center text-xs font-semibold">{dayDateLabel(p.week_start, d)}</div>
                      ))}
                      {shownMeals.map((m) => (
                        <div key={m} className="contents">
                          <div className="flex items-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{m}</div>
                          {shownDays.map((d) => {
                            const c = p.plan_json.days.find((x) => x.day === d)?.[m];
                            return (
                              <div key={d} className="min-h-14 rounded-lg border bg-card p-2 text-xs">
                                {c?.recipe_id ? (
                                  <>
                                    <span className="font-medium">{byId.get(c.recipe_id)?.name ?? "Removed recipe"}</span>
                                    {c.leftover && <span className="mt-1 inline-block rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground">Leftover</span>}
                                  </>
                                ) : (
                                  <span className="text-muted-foreground/70">{p.answers?.noCookDays.includes(d) ? "No cooking" : "—"}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  <h3 className="mt-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Grocery list</h3>
                  {grocery.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">Nothing to buy for this week.</p>
                  ) : (
                    <div className="mt-2 grid gap-4 sm:grid-cols-2">
                      {AISLES.map((a) => {
                        const rows = grocery.filter((i) => i.aisle === a);
                        if (!rows.length) return null;
                        return (
                          <section key={a}>
                            <h4 className="text-xs font-semibold text-muted-foreground">{a}</h4>
                            <ul className="mt-1 space-y-0.5 text-sm">
                              {rows.map((i) => (
                                <li key={i.name + i.qty} className="flex justify-between gap-3">
                                  <span>{i.name}</span>
                                  <span className="text-muted-foreground">{i.qty}</span>
                                </li>
                              ))}
                            </ul>
                          </section>
                        );
                      })}
                    </div>
                  )}

                  <Button asChild variant="outline" className="mt-5">
                    <Link to="/print" search={{ week: p.week_start }}><Printer /> Print</Link>
                  </Button>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </main>
  );
}
