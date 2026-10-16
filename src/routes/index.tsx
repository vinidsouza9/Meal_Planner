import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Camera,
  ClipboardCheck,
  CalendarDays,
  Menu,
  MessageCircle,
  Printer,
  ShoppingBasket,
  Soup,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import hero from "@/assets/hero-meals.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meal Planner — plan your week of meals in minutes" },
      { name: "description", content: "Add your own recipes, tell us about your week, and get a meal plan plus a grocery list sized for your household." },
      { property: "og:title", content: "Meal Planner — plan your week of meals in minutes" },
      { property: "og:description", content: "Your recipes, your week: a meal plan and grocery list in minutes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const STEPS = [
  { icon: BookOpen, t: "Add your recipes", d: "Type them, paste them or snap a photo of a cookbook page.", tone: "bg-lunch-soft text-lunch" },
  { icon: ClipboardCheck, t: "Plan my week", d: "Which nights are busy, who's eating, what's in the fridge.", tone: "bg-breakfast-soft text-breakfast" },
  { icon: CalendarDays, t: "Get your plan", d: "A week of meals that fits your nights. Drag to rearrange.", tone: "bg-dinner-soft text-dinner" },
  { icon: ShoppingBasket, t: "Get your grocery list", d: "Grouped by aisle and sized for your household.", tone: "bg-secondary text-primary" },
];

const FEATURES = [
  { icon: Camera, t: "AI recipe import", d: "Paste text or upload a photo — AI turns it into a tidy recipe you can edit." },
  { icon: Zap, t: "Busy-day quick meals", d: "Mark busy nights and get 20-minute dinners on those days." },
  { icon: Soup, t: "Leftovers planning", d: "Cook once, eat twice: tomorrow's lunch from tonight's dinner." },
  { icon: Users, t: "Household-size list", d: "Quantities scale to the number of people you cook for." },
  { icon: Printer, t: "Printable fridge chart", d: "A clean one-page plan to stick on the fridge." },
  { icon: MessageCircle, t: "Share on WhatsApp", d: "Send the grocery list to whoever's shopping in one tap." },
];

function Index() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/plan", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2 font-display text-2xl text-primary">
            <span className="grid size-9 place-items-center rounded-xl bg-warm text-warm-foreground"><Soup className="size-5" /></span>
            Meal Planner
          </Link>
          <nav className="hidden items-center gap-2 sm:flex">
            <Button asChild variant="ghost"><Link to="/auth">Log in</Link></Button>
            <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Sign up</Link></Button>
          </nav>
          <Button variant="ghost" size="icon" className="sm:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </Button>
        </div>
        {open && (
          <nav className="grid gap-2 border-t px-5 py-4 sm:hidden">
            <Button asChild variant="outline" size="lg"><Link to="/auth">Log in</Link></Button>
            <Button asChild size="lg"><Link to="/auth" search={{ mode: "signup" }}>Sign up</Link></Button>
          </nav>
        )}
      </header>

      <main>
        <section className="bg-gradient-to-b from-breakfast-soft via-warm-soft to-background">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 md:grid-cols-2 md:py-20">
            <div>
              <p className="inline-flex rounded-full bg-card px-3 py-1 text-sm font-semibold text-warm shadow-card">Your recipes, your week</p>
              <h1 className="mt-4 font-display text-5xl leading-tight text-foreground md:text-6xl">Plan your week of meals in minutes</h1>
              <p className="mt-5 max-w-lg text-lg text-muted-foreground">
                Add your own recipes, tell us about your week, and get a meal plan plus a grocery list — no more 6pm "what's for dinner?".
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" variant="warm"><Link to="/auth" search={{ mode: "signup" }}>Get started — it's free</Link></Button>
                <Button asChild size="lg" variant="outline"><Link to="/auth">Log in</Link></Button>
              </div>
            </div>
            <img src={hero} alt="Colourful illustrated spread of salad, pasta, pancakes, tacos and roasted vegetables" width={1280} height={1024} className="w-full rounded-3xl shadow-card" />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-center font-display text-4xl">How it works</h2>
          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, t, d, tone }, i) => (
              <li key={t} className="surface p-6">
                <div className="flex items-center justify-between">
                  <span className={`grid size-12 place-items-center rounded-2xl ${tone}`}><Icon className="size-6" /></span>
                  <span className="font-display text-3xl text-muted-foreground/50">{i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-lunch-soft">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-center font-display text-4xl">Everything for a calmer week</h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, t, d }, i) => (
                <li key={t} className="surface p-6 transition-transform hover:-translate-y-0.5">
                  <span className={`grid size-12 place-items-center rounded-2xl ${["bg-warm-soft text-warm", "bg-amber-soft text-amber-foreground", "bg-secondary text-primary"][i % 3]}`}>
                    <Icon className="size-6" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="rounded-3xl bg-primary px-6 py-12 text-center text-primary-foreground md:px-12">
            <h2 className="font-display text-4xl">Dinner, decided.</h2>
            <p className="mx-auto mt-3 max-w-md opacity-90">Set up in five minutes and get your first week planned tonight.</p>
            <Button asChild size="lg" variant="warm" className="mt-7"><Link to="/auth" search={{ mode: "signup" }}>Create your free account</Link></Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted-foreground">
          <span className="font-display text-lg text-primary">Meal Planner</span>
          <span>© {new Date().getFullYear()} Meal Planner. Made for busy households.</span>
        </div>
      </footer>
    </div>
  );
}
