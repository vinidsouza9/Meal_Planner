import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Lock, Printer, RefreshCw, ShoppingBasket, Sparkles, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { suggestSwap } from "@/lib/ai.functions";
import { DAYS, MEALS, cellKey, type Day, type Meal } from "@/lib/plan";
import { allRecipesQuery, latestPlanQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({ meta: [{ title: "This week — Weeknight" }] }),
  component: PlanPage,
});

function PlanPage() {
  const qc = useQueryClient();
  const swap = useServerFn(suggestSwap);
  const { data: plan, isLoading } = useQuery(latestPlanQuery);
  const { data: recipes = [] } = useQuery(allRecipesQuery);
  const [sel, setSel] = useState<{ day: Day; meal: Meal } | null>(null);
  const [busy, setBusy] = useState(false);
  const names = new Map(recipes.map((r) => [r.id, r.name]));

  if (isLoading) return <main className="mx-auto max-w-3xl px-5 pt-6 text-muted-foreground">Loading…</main>;

  if (!plan) {
    return (
      <main className="mx-auto max-w-xl px-5 pt-6">
        <h1 className="font-display text-3xl">This week</h1>
        <div className="surface mt-6 p-8 text-center">
          <p className="font-medium">No plan yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {recipes.length ? "Answer a few quick questions and we'll plan the week." : "Add a few recipes first, then plan your week."}
          </p>
          <Button asChild size="lg" className="mt-6 w-full">
            {recipes.length ? <Link to="/checkin"><Sparkles /> Start weekly check-in</Link> : <Link to="/import">Add recipes</Link>}
          </Button>
        </div>
      </main>
    );
  }

  const shownDays = plan.answers && !plan.answers.includeSunday ? DAYS.filter((d) => d !== "Sun") : DAYS;
  const shownMeals = plan.answers?.meals.length ? MEALS.filter((m) => plan.answers!.meals.includes(m)) : MEALS;
  const selCell = sel ? plan.plan_json.days.find((d) => d.day === sel.day)?.[sel.meal] : null;
  const selLocked = sel ? plan.locked.includes(cellKey(sel.day, sel.meal)) : false;

  async function toggleLock() {
    if (!sel || !plan) return;
    const k = cellKey(sel.day, sel.meal);
    const locked = selLocked ? plan.locked.filter((x) => x !== k) : [...plan.locked, k];
    const { error } = await supabase.from("plans").update({ locked }).eq("id", plan.id);
    if (error) {
      toast.error("Couldn't update.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["plan"] });
    setSel(null);
  }

  async function doSwap() {
    if (!sel || !plan) return;
    setBusy(true);
    try {
      const r = await swap({ data: { planId: plan.id, day: sel.day, meal: sel.meal } });
      toast.success(`Swapped in ${r.name}`);
      await qc.invalidateQueries({ queryKey: ["plan"] });
      setSel(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Swap failed");
    } finally {
      setBusy(false);
    }
  }

  const weekLabel = new Date(plan.week_start + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <main className="mx-auto max-w-5xl px-5 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Week of {weekLabel}</p>
          <h1 className="font-display text-3xl">This week</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Print"><Link to="/print"><Printer /></Link></Button>
          <Button asChild variant="secondary"><Link to="/checkin"><RefreshCw /> New plan</Link></Button>
        </div>
      </div>

      <div className="-mx-5 mt-6 overflow-x-auto px-5 pb-2">
        <table className="w-full min-w-[720px] border-separate border-spacing-1.5">
          <thead>
            <tr>
              <th className="w-20" />
              {shownDays.map((d) => (
                <th key={d} className="pb-1 text-sm font-semibold text-muted-foreground">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shownMeals.map((m) => (
              <tr key={m}>
                <th className="pr-1 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground">{m}</th>
                {shownDays.map((d) => {
                  const c = plan.plan_json.days.find((x) => x.day === d)?.[m];
                  const locked = plan.locked.includes(cellKey(d, m));
                  const empty = !c?.recipe_id;
                  return (
                    <td key={d} className="align-top">
                      <button
                        onClick={() => !empty && setSel({ day: d, meal: m })}
                        disabled={empty}
                        className={`relative flex min-h-20 w-full flex-col justify-between rounded-xl border p-2.5 text-left text-sm transition-colors ${
                          empty ? "border-dashed bg-transparent text-muted-foreground" : "bg-card shadow-card hover:border-primary/50"
                        } ${locked ? "border-primary" : ""}`}
                      >
                        <span className="font-medium leading-snug">{empty ? "—" : names.get(c!.recipe_id) ?? "Removed recipe"}</span>
                        <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          {c?.leftover && "Leftovers"}
                          {locked && <Lock className="size-3 text-primary" />}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button asChild size="lg" className="mt-6 w-full sm:w-auto">
        <Link to="/grocery"><ShoppingBasket /> Grocery list</Link>
      </Button>

      <Drawer open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-md px-5 pb-8">
            <DrawerHeader className="px-0 text-left">
              <DrawerDescription className="capitalize">{sel?.day} · {sel?.meal}</DrawerDescription>
              <DrawerTitle className="font-display text-2xl">{selCell ? names.get(selCell.recipe_id) : ""}</DrawerTitle>
            </DrawerHeader>
            <div className="grid gap-3">
              <Button size="lg" onClick={doSwap} disabled={busy || selLocked}>
                {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {selLocked ? "Unlock to swap" : "Swap for something else"}
              </Button>
              <Button size="lg" variant="outline" onClick={toggleLock} disabled={busy}>
                {selLocked ? <><Unlock /> Unlock</> : <><Lock /> Lock this meal</>}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </main>
  );
}
