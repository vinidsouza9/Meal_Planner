import { pageMeta } from "@/lib/metadata";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronLeft, Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { CookingLoader, useSlowAction } from "@/components/Loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { generatePlan } from "@/lib/ai.functions";
import { DAYS, MEALS, upcomingMonday, weekRangeLabel, type CheckInAnswers, type Day } from "@/lib/plan";

export const Route = createFileRoute("/_authenticated/checkin")({
  head: () => pageMeta("Plan my week", "Answer questions about your week to generate a household meal plan."),
  component: CheckIn,
});

const FRIDGE_SUGGESTIONS = ["Eggs", "Milk", "Chicken", "Spinach", "Tomatoes", "Onions", "Cheese", "Rice", "Pasta", "Potatoes", "Yogurt", "Bread"];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button variant="outline" type="button" data-on={on} aria-pressed={on} onClick={onClick} className="chip">
      {children}
    </Button>
  );
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function CheckIn() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const gen = useServerFn(generatePlan);
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await supabase.from("profiles").select("household_size").maybeSingle()).data,
  });

  const slow = useSlowAction();
  const [newItem, setNewItem] = useState("");
  const [a, setA] = useState<CheckInAnswers>({
    meals: ["dinner"],
    people: 2,
    busyDays: [],
    noCookDays: [],
    includeSunday: true,
    leftoverLunch: true,
    fridge: [],
  });
  useEffect(() => {
    if (profile?.household_size) setA((x) => ({ ...x, people: profile.household_size }));
  }, [profile?.household_size]);

  const days: Day[] = a.includeSunday ? [...DAYS] : DAYS.filter((d) => d !== "Sun");
  const steps = [
    {
      title: "Which meals should we plan?",
      body: (
        <div className="flex flex-wrap gap-2">
          {MEALS.map((m) => (
            <Chip key={m} on={a.meals.includes(m)} onClick={() => setA({ ...a, meals: toggle(a.meals, m) })}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </Chip>
          ))}
        </div>
      ),
    },
    {
      title: "How many people this week?",
      body: (
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 8].map((n) => (
            <Chip key={n} on={a.people === n} onClick={() => setA({ ...a, people: n })}>{n}</Chip>
          ))}
        </div>
      ),
    },
    {
      title: "Include Sunday?",
      body: (
        <div className="flex gap-2">
          <Chip on={a.includeSunday} onClick={() => setA({ ...a, includeSunday: true })}>Yes</Chip>
          <Chip on={!a.includeSunday} onClick={() => setA({ ...a, includeSunday: false })}>No</Chip>
        </div>
      ),
    },
    {
      title: "Busy days?",
      hint: "Dinner will be quick on these days.",
      body: (
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <Chip key={d} on={a.busyDays.includes(d)} onClick={() => setA({ ...a, busyDays: toggle(a.busyDays, d) })}>{d}</Chip>
          ))}
        </div>
      ),
    },
    {
      title: "Any no-cook days?",
      hint: "Eating out or takeaway — no meals planned.",
      body: (
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <Chip key={d} on={a.noCookDays.includes(d)} onClick={() => setA({ ...a, noCookDays: toggle(a.noCookDays, d) })}>{d}</Chip>
          ))}
        </div>
      ),
    },
    {
      title: "Can dinner leftovers cover next-day lunch?",
      body: (
        <div className="flex gap-2">
          <Chip on={a.leftoverLunch} onClick={() => setA({ ...a, leftoverLunch: true })}>Yes</Chip>
          <Chip on={!a.leftoverLunch} onClick={() => setA({ ...a, leftoverLunch: false })}>No</Chip>
        </div>
      ),
    },
    {
      title: "What's in the fridge?",
      hint: "We'll use these up and leave them off the grocery list.",
      body: (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[...new Set([...FRIDGE_SUGGESTIONS, ...a.fridge])].map((f) => (
              <Chip key={f} on={a.fridge.includes(f)} onClick={() => setA({ ...a, fridge: toggle(a.fridge, f) })}>
                {f}
                {a.fridge.includes(f) && !FRIDGE_SUGGESTIONS.includes(f) && <X className="size-3" />}
              </Chip>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = newItem.trim();
              if (v && !a.fridge.includes(v)) setA({ ...a, fridge: [...a.fridge, v] });
              setNewItem("");
            }}
          >
            <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add an item" className="h-11 rounded-xl bg-card" />
            <Button type="submit" variant="secondary" size="icon" aria-label="Add item"><Plus /></Button>
          </form>
        </div>
      ),
    },
  ];
  const week = upcomingMonday();

  async function finish() {
    if (!a.meals.length) {
      toast.error("Pick at least one meal.");
      return;
    }
    const answers = { ...a, busyDays: a.busyDays.filter((d) => days.includes(d)), noCookDays: a.noCookDays.filter((d) => days.includes(d)) };
    await slow.run(async () => {
      await gen({ data: { weekStart: week, answers } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["plan"] }), qc.invalidateQueries({ queryKey: ["plans"] }), qc.invalidateQueries({ queryKey: ["grocery"] })]);
      navigate({ to: "/plan" });
    });
  }

  if (slow.active) {
    return (
      <main className="mx-auto max-w-xl px-5 pt-10">
        <CookingLoader task="plan" error={slow.error} onRetry={slow.retry} onCancel={slow.reset} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 pb-8 pt-6">
      <h1 className="font-display text-3xl">Plan my week</h1>
      <p className="mt-2 text-muted-foreground">Answer a few questions about your week and we'll build your meal plan.</p>
      <p className="mt-4 font-medium text-primary">Planning for {weekRangeLabel(week)}</p>
      <div className="mt-6 divide-y">{steps.map((section) => <section key={section.title} className="space-y-4 py-6"><h2 className="text-lg font-semibold">{section.title}</h2>{"hint" in section && section.hint && <p className="text-sm text-muted-foreground">{section.hint}</p>}{section.body}</section>)}</div>
      <div className="sticky bottom-0 border-t bg-background/95 py-4 backdrop-blur sm:static"><Button size="lg" className="w-full" onClick={finish} disabled={!a.meals.length}><Sparkles />Generate my plan</Button></div>
    </main>
  );
}
