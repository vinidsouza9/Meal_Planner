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
import { DAYS, MEALS, upcomingMonday, type CheckInAnswers, type Day } from "@/lib/plan";

export const Route = createFileRoute("/_authenticated/checkin")({
  head: () => ({ meta: [{ title: "Weekly check-in — Meal Planner" }] }),
  component: CheckIn,
});

const FRIDGE_SUGGESTIONS = ["Eggs", "Milk", "Chicken", "Spinach", "Tomatoes", "Onions", "Cheese", "Rice", "Pasta", "Potatoes", "Yogurt", "Bread"];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" data-on={on} onClick={onClick} className="chip">
      {children}
    </button>
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
  const [step, setStep] = useState(0);
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
  const last = step === steps.length - 1;
  const s = steps[step]!;

  async function finish() {
    if (!a.meals.length) {
      toast.error("Pick at least one meal.");
      return;
    }
    const answers = { ...a, busyDays: a.busyDays.filter((d) => days.includes(d)), noCookDays: a.noCookDays.filter((d) => days.includes(d)) };
    await slow.run(async () => {
      await gen({ data: { weekStart: upcomingMonday(), answers } });
      await qc.invalidateQueries({ queryKey: ["plan"] });
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
    <main className="mx-auto max-w-xl px-5 pt-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => (step ? setStep(step - 1) : navigate({ to: "/plan" }))}
          className="grid size-11 place-items-center rounded-xl hover:bg-muted"
          aria-label="Back"
        >
          <ChevronLeft className="size-5" />
        </button>
        <Progress value={((step + 1) / steps.length) * 100} className="h-2 flex-1" />
        <span className="w-10 text-right text-sm text-muted-foreground">{step + 1}/{steps.length}</span>
      </div>
      <h1 className="mt-8 font-display text-3xl">{s.title}</h1>
      {"hint" in s && s.hint && <p className="mt-2 text-muted-foreground">{s.hint}</p>}
      <div className="mt-8">{s.body}</div>
      <Button size="lg" className="mt-10 w-full" onClick={() => (last ? finish() : setStep(step + 1))} >
        {last ? <><Sparkles /> Plan my week</> : "Next"}
      </Button>
    </main>
  );
}
