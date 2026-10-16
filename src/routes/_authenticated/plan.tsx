import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Clock, Coffee, GripVertical, Loader2, Lock, Printer, RefreshCw, Salad, ShoppingBasket, Sparkles, Unlock, UtensilsCrossed, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { suggestSwap } from "@/lib/ai.functions";
import { DAYS, MEALS, cellKey, swapCells, type Day, type Meal, type PlanJson, type Recipe } from "@/lib/plan";
import { allRecipesQuery, latestPlanQuery, type PlanRow } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({ meta: [{ title: "This week — Meal Planner" }] }),
  component: PlanPage,
});

const MEAL_STYLE: Record<Meal, { icon: typeof Coffee; card: string; label: string; dot: string }> = {
  breakfast: { icon: Coffee, card: "bg-breakfast-soft border-breakfast/25", label: "text-breakfast", dot: "bg-breakfast" },
  lunch: { icon: Salad, card: "bg-lunch-soft border-lunch/25", label: "text-lunch", dot: "bg-lunch" },
  dinner: { icon: UtensilsCrossed, card: "bg-dinner-soft border-dinner/25", label: "text-dinner", dot: "bg-dinner" },
};
const DAY_BAND = ["bg-lunch-soft", "bg-breakfast-soft", "bg-dinner-soft", "bg-secondary", "bg-amber-soft", "bg-warm-soft", "bg-lunch-soft"];

type CellInfo = { day: Day; meal: Meal; recipe: Recipe | undefined; leftover: boolean; locked: boolean; noCook: boolean; empty: boolean };

function MealCard({ info, dragging, overlay }: { info: CellInfo; dragging?: boolean; overlay?: boolean }) {
  const st = MEAL_STYLE[info.meal];
  const Icon = st.icon;
  if (info.empty) {
    return (
      <div className={`flex min-h-24 w-full items-center justify-center rounded-2xl border-2 border-dashed p-3 text-sm ${info.noCook ? "border-muted-foreground/30 bg-muted text-muted-foreground" : "border-border text-muted-foreground/70"}`}>
        {info.noCook ? "No cooking" : "—"}
      </div>
    );
  }
  return (
    <div
      className={`relative flex min-h-24 w-full flex-col justify-between gap-2 rounded-2xl border p-3 text-left text-sm transition-all duration-200 ${
        info.leftover ? "border-2 border-dashed border-lunch/50 bg-lunch-soft" : st.card
      } ${dragging ? "opacity-40" : ""} ${overlay ? "rotate-2 scale-105 shadow-xl" : "shadow-card"}`}
    >
      <div className="flex items-start gap-2">
        <span className={`grid size-7 shrink-0 place-items-center rounded-lg bg-card/80 ${st.label}`}><Icon className="size-4" /></span>
        <span className="font-semibold leading-snug">{info.recipe?.name ?? "Removed recipe"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
        {info.recipe && <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="size-3" />{info.recipe.cook_time}m</span>}
        {info.recipe?.is_quick && !info.leftover && <span className="inline-flex items-center gap-0.5 rounded-full bg-amber px-1.5 py-0.5 text-amber-foreground"><Zap className="size-3" />Quick</span>}
        {info.leftover && <span className="rounded-full bg-card px-1.5 py-0.5 text-lunch">Leftover</span>}
      </div>
      {info.locked && <Lock className="absolute right-2.5 top-2.5 size-3.5 text-primary" aria-label="Locked" />}
    </div>
  );
}

function Slot({ info, onOpen, canDrag, activeMeal }: { info: CellInfo; onOpen: () => void; canDrag: boolean; activeMeal: Meal | null }) {
  const id = cellKey(info.day, info.meal);
  const draggable = canDrag && !info.empty && !info.locked;
  const drag = useDraggable({ id, disabled: !draggable, data: info });
  const drop = useDroppable({ id, disabled: info.locked || info.empty, data: info });
  const targetable = activeMeal === info.meal && !info.locked && !info.empty;
  return (
    <div
      ref={(n) => {
        drag.setNodeRef(n);
        drop.setNodeRef(n);
      }}
      className={`rounded-2xl transition-shadow ${drop.isOver && targetable ? "ring-4 ring-warm ring-offset-2 ring-offset-background" : targetable && !drag.isDragging ? "ring-2 ring-warm/30" : ""}`}
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
        <MealCard info={info} dragging={drag.isDragging} />
        {draggable && <GripVertical className="absolute bottom-2.5 right-2 size-4 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />}
      </button>
    </div>
  );
}

function PlanPage() {
  const qc = useQueryClient();
  const swap = useServerFn(suggestSwap);
  const { data: plan, isLoading } = useQuery(latestPlanQuery);
  const { data: recipes = [] } = useQuery(allRecipesQuery);
  const [sel, setSel] = useState<{ day: Day; meal: Meal } | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<CellInfo | null>(null);
  const [mobileDay, setMobileDay] = useState<Day>("Mon");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const byId = new Map(recipes.map((r) => [r.id, r]));

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

  const shownDays: readonly Day[] = plan.answers && !plan.answers.includeSunday ? DAYS.filter((d) => d !== "Sun") : DAYS;
  const shownMeals = plan.answers?.meals.length ? MEALS.filter((m) => plan.answers!.meals.includes(m)) : MEALS;
  const info = (day: Day, meal: Meal): CellInfo => {
    const c = plan.plan_json.days.find((x) => x.day === day)?.[meal];
    return {
      day,
      meal,
      recipe: c?.recipe_id ? byId.get(c.recipe_id) : undefined,
      leftover: !!c?.leftover,
      locked: plan.locked.includes(cellKey(day, meal)),
      noCook: !!plan.answers?.noCookDays.includes(day),
      empty: !c?.recipe_id,
    };
  };
  const selInfo = sel ? info(sel.day, sel.meal) : null;

  async function savePlan(next: PlanJson, prev: PlanJson) {
    if (!plan) return;
    const key = latestPlanQuery.queryKey;
    qc.setQueryData<PlanRow | null>(key, (old) => (old ? { ...old, plan_json: next } : old));
    const { error } = await supabase.from("plans").update({ plan_json: next }).eq("id", plan.id);
    if (error) {
      qc.setQueryData<PlanRow | null>(key, (old) => (old ? { ...old, plan_json: prev } : old));
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
      toast.success(`Swapped ${a.day} and ${b.day} ${a.meal}`, {
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
    setBusy(true);
    try {
      const r = await swap({ data: { planId: plan.id, day: sel.day, meal: sel.meal } });
      toast.success(`Swapped in ${r.name}`);
      await qc.invalidateQueries({ queryKey: ["plan"] });
      qc.invalidateQueries({ queryKey: ["grocery"] });
      setSel(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Swap failed");
    } finally {
      setBusy(false);
    }
  }

  const weekLabel = new Date(plan.week_start + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const curMobile = shownDays.includes(mobileDay) ? mobileDay : shownDays[0]!;

  return (
    <main className="mx-auto max-w-6xl px-5 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-warm">Week of {weekLabel}</p>
          <h1 className="font-display text-3xl">This week</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Print plan"><Link to="/print"><Printer /></Link></Button>
          <Button asChild variant="secondary"><Link to="/checkin"><RefreshCw /> New plan</Link></Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
        {MEALS.map((m) => (
          <span key={m} className="inline-flex items-center gap-1.5 capitalize"><span className={`size-2.5 rounded-full ${MEAL_STYLE[m].dot}`} />{m}</span>
        ))}
        <span className="hidden md:inline">· Drag a meal onto another day to swap · Tap for options</span>
      </div>

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
            {shownDays.map((d, i) => (
              <div key={d} className={`rounded-xl py-2 text-center text-sm font-bold ${DAY_BAND[i]}`}>{d}</div>
            ))}
            {shownMeals.map((m) => {
              const Icon = MEAL_STYLE[m].icon;
              return (
                <div key={m} className="contents">
                  <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${MEAL_STYLE[m].label}`}><Icon className="size-4" />{m}</div>
                  {shownDays.map((d) => (
                    <Slot key={d} info={info(d, m)} onOpen={() => setSel({ day: d, meal: m })} canDrag activeMeal={active?.meal ?? null} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile: one day at a time */}
        <div className="mt-5 md:hidden">
          <div role="tablist" aria-label="Day" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2">
            {shownDays.map((d, i) => (
              <button
                key={d}
                role="tab"
                aria-selected={curMobile === d}
                onClick={() => setMobileDay(d)}
                className={`min-h-11 min-w-14 rounded-xl px-3 text-sm font-bold transition-colors ${curMobile === d ? "bg-primary text-primary-foreground" : DAY_BAND[i]}`}
              >
                {d}
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
            {shownMeals.map((m) => {
              const Icon = MEAL_STYLE[m].icon;
              return (
                <div key={m}>
                  <p className={`mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${MEAL_STYLE[m].label}`}><Icon className="size-4" />{m}</p>
                  <Slot info={info(curMobile, m)} onOpen={() => setSel({ day: curMobile, meal: m })} canDrag={false} activeMeal={null} />
                </div>
              );
            })}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 180 }}>{active ? <MealCard info={active} overlay /> : null}</DragOverlay>
      </DndContext>

      <Button asChild size="lg" variant="warm" className="mt-8 w-full sm:w-auto">
        <Link to="/grocery"><ShoppingBasket /> Grocery list</Link>
      </Button>

      <Drawer open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-md px-5 pb-8">
            <DrawerHeader className="px-0 text-left">
              <DrawerDescription className="capitalize">{sel?.day} · {sel?.meal}</DrawerDescription>
              <DrawerTitle className="font-display text-2xl">{selInfo?.recipe?.name ?? ""}</DrawerTitle>
            </DrawerHeader>
            <div className="grid gap-3">
              <Button size="lg" onClick={doSwap} disabled={busy || !!selInfo?.locked}>
                {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {selInfo?.locked ? "Unlock to swap" : "Swap for something else"}
              </Button>
              <Button size="lg" variant="outline" onClick={toggleLock} disabled={busy}>
                {selInfo?.locked ? <><Unlock /> Unlock</> : <><Lock /> Lock this meal</>}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </main>
  );
}
