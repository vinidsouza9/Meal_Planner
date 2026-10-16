import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, ShoppingBasket, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meal Planner — calm weekly meal planning" },
      { name: "description", content: "Meal Planner plans your household's week from your own recipes, then writes the grocery list." },
      { property: "og:title", content: "Meal Planner — calm weekly meal planning" },
      { property: "og:description", content: "Plan the week from your own recipes, then get a grocery list grouped by aisle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/plan" });
    });
  }, [navigate]);

  const points = [
    { icon: Sparkles, t: "Paste recipes, AI tidies them up" },
    { icon: CalendarDays, t: "A week that fits busy nights" },
    { icon: ShoppingBasket, t: "Grocery list by aisle" },
  ];
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">Meal Planner</p>
      <h1 className="mt-3 font-display text-5xl leading-tight text-foreground">Dinner, decided.</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        A quiet weekly meal planner for your household, built from the recipes you already cook.
      </p>
      <ul className="mt-8 space-y-3">
        {points.map(({ icon: Icon, t }) => (
          <li key={t} className="surface flex items-center gap-3 p-4">
            <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
              <Icon className="size-5" />
            </span>
            <span className="font-medium">{t}</span>
          </li>
        ))}
      </ul>
      <Button asChild size="lg" className="mt-10 w-full">
        <Link to="/auth">Get started</Link>
      </Button>
    </main>
  );
}
