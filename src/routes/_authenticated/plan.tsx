import { pageMeta } from "@/lib/metadata";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Clock, GripVertical, Lock, Printer, RefreshCw, ShoppingBasket, Sparkles, Unlock, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ShareMenu } from "@/components/ShareMenu";
import { CookingLoader, PlanGridSkeleton, useSlowAction } from "@/components/Loading";
import { supabase } from "@/integrations/supabase/client";
import { suggestSwap } from "@/lib/ai.functions";
import { buildPlanPdf } from "@/lib/pdf";
import { DAYS, MEALS, cellKey, cookingRecipe, currentCookingSlot, dayDateLabel, longDinnerOnBusyDay, shiftWeek, swapCells, weekRangeLabel, type Day, type Meal, type PlanJson, type Recipe } from "@/lib/plan";
import { allRecipesQuery, latestPlanQuery, planForWeekQuery, type PlanRow } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => pageMeta("This week", "View and adjust your weekly meals."),
  component: PlanPage,
});

type CellInfo = { day: Day; meal: Meal; recipe: Recipe | undefined; leftover: boolean; locked: boolean; noCook: boolean; empty: boolean };

function Tag({ children, tone = "" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${tone}`}>{children}</span>;
}

function MealCard({ info, dragging, overlay }: { info: CellInfo; dragging?: boolean; overlay?: boolean }) {
  if (info.empty) {
    return (
      <div className="flex min-h-24 w-full items-center justify-center rounded-2xl border border-dashed border-border p-3 text-sm text-muted-foreground/70">
        {info.noCook ? <Tag>No cooking</Tag> : "—"}
      </div>
    );
  }
  return (
    <div
      className={`relative flex min-h-24 w-full flex-col justify-between gap-2 rounded-2xl border meal-${info.meal} p-3 text-left text-sm transition-all duration-200 ${
        dragging ? "opacity-40" : ""
      } ${overlay ? "rotate-2 scale-105 shadow-xl" : "shadow-card"}`}
    >
      <p className="font-semibold leading-snug">{info.recipe?.name ?? "Removed recipe"}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {info.recipe && (
          <Tag>
            <Clock className="size-3" />
            {info.recipe.cook_time}m
          </Tag>
        )}
        {info.recipe?.is_quick && !info.leftover && (
          <Tag tone="tag-quick">
            <Zap className="size-3" />
            Quick
          </Tag>
        )}
        {info.leftover && <Tag tone="tag-leftover">Leftover</Tag>}
      </div>
      {info.locked && <Lock className="absolute right-2.5 top-2.5 size-3.5 text-primary" aria-label="Locked" />}
    </div>
  );
}

function Slot({ info, onOpen, canDrag, dragging }: { info: CellInfo; onOpen: () => void; canDrag: boolean; dragging: boolean }) {
  const id = cellKey(info.day, info.meal);
  const draggable = canDrag && !info.empty && !info.locked;
  const drag = useDraggable({ id, disabled: !draggable, data: info });
  const drop = useDroppable({ id, disabled: info.locked || info.empty, data: info });
  return (
    <div
      ref={(n) => {
        drag.setNodeRef(n);
        drop.setNodeRef(n);
      }}
      className={`rounded-2xl transition-shadow ${drop.isOver ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
    >
      <button
        type="button"
        onClick={() => !info.empty && onOpen()}
        disabled={info.empty}
        className="group relative block w-full rounded-2xl text-left transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={info.empty ? `${info.day} ${info.meal}: empty` : `${info.day} ${info.meal}: ${info.recipe?.name ?? "meal"}. Open options`}
        {...(draggable ? drag.listeners : {})}
        {...(draggable ? drag.attributes : {})}
        aria-roledescription={draggable ? "draggable meal" : undefined}
      >
        <MealCard info={info} dragging={drag.isDragging || dragging} />
        {draggable && <GripVertical className="absolute bottom-2.5 right-2 size-4 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />}
      </button>
    </div>
  );
}

function PlanPage() {
  const qc = useQueryClient();
  const swap = useServerFn(suggestSwap);
  const { data: latest, isLoading } = useQuery(latestPlanQuery);
  const { data: recipes = [] } = useQuery(allRecipesQuery);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const week = weekStart ?? latest?.week_start ?? null;
  const { data: weekPlan } = useQuery({ ...planForWeekQuery(week ?? ""), enabled: !!week });
  const plan = weekStart ? (weekPlan ?? null) : (latest ?? null);
  const [sel, setSel] = useState<{ day: Day; meal: Meal } | null>(null);
  const swapTask = useSlowAction();
  const busy = swapTask.active;
  const [active, setActive] = useState<CellInfo | null>(null);
  const [mobileDay, setMobileDay] = useState<Day>("Mon");
  const [nowSlot, setNowSlot] = useState<ReturnType<typeof currentCookingSlot> | null>(null);
  useEffect(() => {
    const update = () => setNowSlot(currentCookingSlot());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const byId = new Map(recipes.map((r) => [r.id, r]));

  useEffect(() => {
    if (!weekStart && latest) setWeekStart(latest.week_start);
  }, [latest, weekStart]);

  if (isLoading) return <main className="mx-auto max-w-6xl px-5 pt-6"><PlanGridSkeleton /></main>;

  if (!latest) {
    return (
      <main className="mx-auto max-w-xl px-5 pt-6">
        <h1 className="font-display text-3xl">This week</h1>
        <div className="surface mt-6 p-8 text-center">
          <p className="font-medium">No plan yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {recipes.length ? "Answer a few quick questions and we'll plan the week." : "Add a few recipes first, then plan your week."}
          </p>
          <Button asChild size="lg" className="mt-6 w-full">
            {recipes.length ? <Link to="/checkin"><Sparkles /> Plan my week</Link> : <Link to="/import">Add recipes</Link>}
          </Button>
        </div>
      </main>
    );
  }

  const shownDays: readonly Day[] = plan?.answers && !plan.answers.includeSunday ? DAYS.filter((d) => d !== "Sun") : DAYS;
  const shownMeals = plan?.answers?.meals.length ? MEALS.filter((m) => plan.answers!.meals.includes(m)) : MEALS;
  const info = (day: Day, meal: Meal): CellInfo => {
    const c = plan?.plan_json.days.find((x) => x.day === day)?.[meal];
    return {
      day,
      meal,
      recipe: c?.recipe_id ? byId.get(c.recipe_id) : undefined,
      leftover: !!c?.leftover,
      locked: plan?.locked.includes(cellKey(day, meal)) ?? false,
      noCook: !!plan?.answers?.noCookDays.includes(day),
      empty: !c?.recipe_id,
    };
  };
  const selInfo = sel ? info(sel.day, sel.meal) : null;

  async function savePlan(next: PlanJson, prev: PlanJson) {
    if (!plan) return;
    const key = planForWeekQuery(plan.week_start).queryKey;
    qc.setQueryData<PlanRow | null>(key, (old) => (old ? { ...old, plan_json: next } : old));
    qc.setQueryData<PlanRow | null>(latestPlanQuery.queryKey, (old) => (old?.id === plan.id ? { ...old, plan_json: next } : old));
    const { error } = await supabase.from("plans").update({ plan_json: next }).eq("id", plan.id);
    if (error) {
      qc.setQueryData<PlanRow | null>(key, (old) => (old ? { ...old, plan_json: prev } : old));
      qc.setQueryData<PlanRow | null>(latestPlanQuery.queryKey, (old) => (old?.id === plan.id ? { ...old, plan_json: prev } : old));
      toast.error("Couldn't save the move.");
      return false;
    }
    qc.invalidateQueries({ queryKey: ["grocery"] });
    return true;
  }

  async function onDragEnd(e: DragEndEvent) {
    setActive(null);
    if (!plan || !e.over) return;
    const a = e.active.data.current as CellInfo;
    const b = e.over.data.current as CellInfo;
    const prev = plan.plan_json;
    const next = swapCells(prev, plan.locked, a, b);
    if (!next) return;
    if (await savePlan(next, prev)) {
      // A moved recipe lands in b's slot; a's recipe lands in a's old slot.
      if (longDinnerOnBusyDay(plan.answers, a.recipe, b.day, b.meal)) {
        toast.warning(`${a.recipe!.name} takes ${a.recipe!.cook_time} min — ${b.day} is a busy day.`, {
          action: { label: "Undo", onClick: () => savePlan(prev, next) },
        });
        return;
      }
      toast.success(`Swapped ${a.day} ${a.meal} with ${b.day} ${b.meal}`, {
        action: { label: "Undo", onClick: () => savePlan(prev, next) },
      });
    }
  }

  async function toggleLock() {
    if (!sel || !plan || !selInfo) return;
    const k = cellKey(sel.day, sel.meal);
    const locked = selInfo.locked ? plan.locked.filter((x) => x !== k) : [...plan.locked, k];
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
    const target = { planId: plan.id, day: sel.day, meal: sel.meal };
    await swapTask.run(async () => {
      const r = await swap({ data: target });
      await qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["grocery"] });
      toast.success(`Swapped in ${r.name}`);
      setSel(null);
    });
  }

  const curMobile = shownDays.includes(mobileDay) ? mobileDay : shownDays[0]!;
  const wk = plan?.week_start ?? week!;
  const nowRecipe = nowSlot && plan ? cookingRecipe(plan.plan_json, recipes, nowSlot) : undefined;

  return (
    <main className="mx-auto max-w-6xl px-5 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Week of {weekRangeLabel(wk)}</h1>
          <div className="mt-2 flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setWeekStart(shiftWeek(wk, -1))}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setWeekStart(shiftWeek(wk, 1))}>
              <ChevronRight />
            </Button>
          </div>
        </div>
        {plan && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/grocery"><ShoppingBasket /> Grocery list</Link></Button>
            <ShareMenu
              build={() => buildPlanPdf(plan.plan_json, recipes, plan.week_start)}
              title="Meal plan"
              message={`Here's our meal plan for ${weekRangeLabel(plan.week_start)}.`}
              emailSubject={`Meal plan: ${weekRangeLabel(plan.week_start)}`}
            />
            <Button asChild variant="outline" size="icon" aria-label="Print plan"><Link to="/print" search={{ week: plan.week_start }}><Printer /></Link></Button>
            <Button asChild variant="secondary"><Link to="/checkin"><RefreshCw /> Plan my week</Link></Button>
          </div>
        )}
      </div>

      {!plan ? (
        <div className="surface mt-6 p-8 text-center">
          <p className="font-medium">No plan for this week</p>
          <p className="mt-1 text-sm text-muted-foreground">Go back to a planned week, or plan your week.</p>
          <Button asChild className="mt-5"><Link to="/checkin"><Sparkles /> Plan my week</Link></Button>
        </div>
      ) : (
        <>
          <p className="mt-3 hidden text-xs font-medium text-muted-foreground md:block">Drag any meal onto another to swap · Tap a meal for options</p>

          <DndContext
            sensors={sensors}
            onDragStart={(e: DragStartEvent) => setActive(e.active.data.current as CellInfo)}
            onDragCancel={() => setActive(null)}
            onDragEnd={onDragEnd}
          >
            {/* Desktop grid */}
            <div className="mt-5 hidden md:block">
              <div className="grid gap-3" style={{ gridTemplateColumns: `6.5rem repeat(${shownDays.length}, minmax(0, 1fr))` }}>
                <div />
                {shownDays.map((d) => (
                  <div key={d} className="rounded-xl border bg-card py-2 text-center text-sm font-semibold">{dayDateLabel(wk, d)}</div>
                ))}
                {shownMeals.map((m) => (
                  <div key={m} className="contents">
                    <div className={`flex items-center text-xs font-semibold capitalize meal-label-${m}`}>{m}</div>
                    {shownDays.map((d) => (
                      <Slot key={d} info={info(d, m)} onOpen={() => setSel({ day: d, meal: m })} canDrag dragging={false} />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile: one day at a time */}
            <div className="mt-5 md:hidden">
              <div role="tablist" aria-label="Day" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2">
                {shownDays.map((d) => (
                  <button
                    key={d}
                    role="tab"
                    aria-selected={curMobile === d}
                    onClick={() => setMobileDay(d)}
                    className={`min-h-11 min-w-14 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                      curMobile === d ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground"
                    }`}
                  >
                    {dayDateLabel(wk, d)}
                  </button>
                ))}
              </div>
              <div
                className="mt-3 space-y-3"
                onTouchStart={(e) => ((e.currentTarget as HTMLDivElement).dataset["x"] = String(e.touches[0]!.clientX))}
                onTouchEnd={(e) => {
                  const x0 = Number((e.currentTarget as HTMLDivElement).dataset["x"]);
                  const dx = e.changedTouches[0]!.clientX - x0;
                  if (Math.abs(dx) < 60) return;
                  const i = shownDays.indexOf(curMobile);
                  const n = shownDays[dx < 0 ? Math.min(shownDays.length - 1, i + 1) : Math.max(0, i - 1)]!;
                  setMobileDay(n);
                }}
              >
                {shownMeals.map((m) => (
                  <div key={m}>
                    <p className={`mb-1.5 text-xs font-semibold capitalize meal-label-${m}`}>{m}</p>
                    <Slot info={info(curMobile, m)} onOpen={() => setSel({ day: curMobile, meal: m })} canDrag dragging={false} />
                  </div>
                ))}
              </div>
            </div>

            <DragOverlay dropAnimation={{ duration: 180 }}>{active ? <MealCard info={active} overlay /> : null}</DragOverlay>
          </DndContext>

          {nowSlot && (
            <section aria-label="Current meal" aria-live="polite" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{nowSlot.meal}</p>
                <p className="mt-1 font-semibold">{nowRecipe?.name ?? "No meal planned"}</p>
                {nowRecipe && <p className="mt-1 text-sm text-muted-foreground">{nowRecipe.cook_time} min</p>}
              </div>
               {nowRecipe && <Button variant="outline" onClick={() => setShowRecipe(true)}>View recipe</Button>}
            </section>
          )}

        </>
      )}

      <Drawer open={!!sel} onOpenChange={(o) => { if (!o) { setSel(null); swapTask.reset(); } }}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-md px-5 pb-8">
            <DrawerHeader className="px-0 text-left">
              <DrawerDescription className="capitalize">{sel?.day} · {sel?.meal}</DrawerDescription>
              <DrawerTitle className="font-display text-2xl">{selInfo?.recipe?.name ?? ""}</DrawerTitle>
            </DrawerHeader>
            {busy ? (
              <CookingLoader task="other" error={swapTask.error} slow={swapTask.status === "slow"} onRetry={swapTask.retry} onCancel={swapTask.reset} />
            ) : (
            <div className="grid gap-3">
              <Button size="lg" onClick={doSwap} disabled={!!selInfo?.locked}>
                <Sparkles />
                {selInfo?.locked ? "Unlock to swap" : "Swap for something else"}
              </Button>
              <Button size="lg" variant="outline" onClick={toggleLock} disabled={busy}>
                {selInfo?.locked ? <><Unlock /> Unlock</> : <><Lock /> Lock this meal</>}
              </Button>
            </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </main>
  );
}
