import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  Camera,
  ClipboardCheck,
  CalendarDays,
  GripVertical,
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
      {
        name: "description",
        content:
          "Add your own recipes, tell us about your week, and get a meal plan plus a grocery list sized for your household.",
      },
      { property: "og:title", content: "Meal Planner — plan your week of meals in minutes" },
      {
        property: "og:description",
        content: "Your recipes, your week: a meal plan and grocery list in minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap",
      },
    ],
  }),
  component: Index,
});

// Warm & cozy palette, scoped to the landing page only.
const HAND = "font-['Caveat',cursive]";

const STEPS = [
  {
    icon: BookOpen,
    t: "Add your recipes",
    d: "Type them, paste them or snap a photo of a cookbook page.",
    wash: "#F5DD9B",
  },
  {
    icon: ClipboardCheck,
    t: "Plan my week",
    d: "Which nights are busy, who's eating, what's in the fridge.",
    wash: "#CFDCC1",
  },
  {
    icon: CalendarDays,
    t: "Get your plan",
    d: "A week of meals that fits your nights. Drag to rearrange.",
    wash: "#F2C9A0",
  },
  {
    icon: ShoppingBasket,
    t: "Get your grocery list",
    d: "Grouped by aisle and sized for your household.",
    wash: "#E8C3B6",
  },
];

const FEATURES = [
  {
    icon: Camera,
    t: "AI recipe import",
    d: "Paste text or upload a photo — AI turns it into a tidy recipe you can edit.",
    wash: "#F2C9A0",
  },
  {
    icon: Zap,
    t: "Busy-day quick meals",
    d: "Mark busy nights and get 20-minute dinners on those days.",
    wash: "#F5DD9B",
  },
  {
    icon: Soup,
    t: "Leftovers planning",
    d: "Cook once, eat twice: tomorrow's lunch from tonight's dinner.",
    wash: "#CFDCC1",
  },
  {
    icon: Users,
    t: "Household-size list",
    d: "Quantities scale to the number of people you cook for.",
    wash: "#E8C3B6",
  },
  {
    icon: Printer,
    t: "Printable fridge chart",
    d: "A clean one-page plan to stick on the fridge.",
    wash: "#F5DD9B",
  },
  {
    icon: MessageCircle,
    t: "Share on WhatsApp",
    d: "Send the grocery list to whoever's shopping in one tap.",
    wash: "#CFDCC1",
  },
];

// Static sample week for the preview section (illustration only, not user data).
type SampleMeal = { t: string; kind?: "busy" | "left" | "drag" | undefined };
const m = (t: string, kind?: SampleMeal["kind"]): SampleMeal => ({ t, kind });
const SAMPLE_WEEK: { d: string; n: number; busy?: boolean; meals: SampleMeal[] }[] = [
  {
    d: "Mon",
    n: 2,
    busy: true,
    meals: [m("Overnight oats"), m("Lentil soup"), m("Veggie fried rice", "busy")],
  },
  {
    d: "Tue",
    n: 3,
    meals: [m("Yogurt & berries"), m("Fried rice", "left"), m("Green chicken curry")],
  },
  {
    d: "Wed",
    n: 4,
    busy: true,
    meals: [m("Overnight oats"), m("Chicken curry", "left"), m("Black bean tacos", "busy")],
  },
  {
    d: "Thu",
    n: 5,
    meals: [m("Avocado toast"), m("Bean tacos", "left"), m("Lemon chickpea pasta", "drag")],
  },
  {
    d: "Fri",
    n: 6,
    meals: [m("Yogurt & berries"), m("Chickpea pasta", "left"), m("Sheet-pan salmon")],
  },
  { d: "Sat", n: 7, meals: [m("Banana pancakes"), m("Greek salad"), m("Margherita flatbread")] },
  {
    d: "Sun",
    n: 8,
    meals: [m("Banana pancakes"), m("Flatbread", "left"), m("Roast veg traybake")],
  },
];
const SLOTS = [
  { label: "breakfast", color: "text-[#8A5A12]" },
  { label: "lunch", color: "text-[#4F6340]" },
  { label: "dinner", color: "text-[#A8432E]" },
];
const SAMPLE_GROCERY = [
  { aisle: "Produce", items: "Spinach · Lemons ×3 · Avocados ×2 · Bananas ×6" },
  { aisle: "Pantry", items: "Chickpeas ×2 cans · Black beans · Basmati rice" },
  { aisle: "Dairy", items: "Greek yogurt 1 kg · Mozzarella" },
  { aisle: "Meat & fish", items: "Chicken thighs 500 g · Salmon fillets ×2" },
];
const SAMPLE_RECIPES = [
  {
    name: "Green chicken curry",
    meta: "Dinner · 35 min",
    c: ["#7DAA4F", "#F2E3C6", "#E9C46A", "#3C6E2F"],
  },
  {
    name: "Lemon chickpea pasta",
    meta: "Dinner · 20 min",
    c: ["#F2D27A", "#E8B04B", "#9CC36B", "#C0392B"],
  },
  {
    name: "Black bean tacos",
    meta: "Busy-night pick · 20 min",
    c: ["#E7B36A", "#3B2A2A", "#E85D3F", "#8DC26F"],
  },
  {
    name: "Overnight oats",
    meta: "Breakfast · 5 min",
    c: ["#EADBC4", "#C8455B", "#6A5ACD", "#F4A259"],
  },
];

function Wash({
  color,
  children,
  size = 56,
}: {
  color: string;
  children: ReactNode;
  size?: number;
}) {
  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" className="absolute inset-0 size-full">
        <circle cx="32" cy="32" r="28" fill={color} filter="url(#mp-watercolor)" opacity="0.85" />
      </svg>
      <span className="relative text-[#3B2A20]">{children}</span>
    </span>
  );
}

function Plate({ c }: { c: string[] }) {
  return (
    <svg viewBox="0 0 120 120" className="h-36 w-full" aria-hidden="true">
      <g filter="url(#mp-watercolor)">
        <circle cx="60" cy="62" r="52" fill="#F3E4CC" />
        <circle cx="60" cy="60" r="38" fill={c[0]} opacity="0.85" />
        <circle cx="47" cy="52" r="12" fill={c[1]} opacity="0.9" />
        <circle cx="72" cy="66" r="13" fill={c[2]} opacity="0.85" />
        <circle cx="64" cy="42" r="7" fill={c[3]} opacity="0.85" />
      </g>
      <circle
        cx="60"
        cy="60"
        r="50"
        fill="none"
        stroke="#3B2A20"
        strokeWidth="1.2"
        strokeDasharray="70 8 30 6"
      />
    </svg>
  );
}

function Index() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/plan", replace: true });
    });
  }, [navigate]);

  const primaryCta =
    "h-auto min-h-[60px] rounded-2xl bg-[#A8432E] px-7 text-lg font-bold text-white shadow-[0_8px_0_#6E2A1C] hover:bg-[#953A27] active:translate-y-1 active:shadow-[0_4px_0_#6E2A1C]";
  const outlineCta =
    "h-auto min-h-[60px] rounded-2xl border-2 border-[#3B2A20] bg-transparent px-6 text-[17px] font-semibold text-[#3B2A20] hover:bg-[#F6E8D2]";

  return (
    <div className="min-h-screen bg-[#FBF3E6] text-[#3B2A20]">
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id="mp-watercolor">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="9" />
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
      </svg>

      <header className="sticky top-0 z-20 border-b border-[#EAD6B8] bg-[#FBF3E6]/90 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-5">
          <Link
            to="/"
            className="flex items-center gap-2.5 font-display text-2xl font-semibold text-[#A8432E]"
          >
            <span className="grid size-11 place-items-center rounded-[14px] bg-[#E0B04B] text-[#3B2A20]">
              <Soup className="size-6" />
            </span>
            Meal Planner
          </Link>
          <nav className="hidden items-center gap-2 sm:flex">
            <Button
              asChild
              variant="ghost"
              className="h-11 px-4 text-base font-semibold text-[#3B2A20] hover:bg-[#F6E8D2]"
            >
              <Link to="/auth">Log in</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-[14px] border-2 border-[#3B2A20] bg-transparent px-5 text-base font-bold text-[#3B2A20] hover:bg-[#F6E8D2]"
            >
              <Link to="/auth" search={{ mode: "signup" }}>
                Sign up
              </Link>
            </Button>
          </nav>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 sm:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
        {open && (
          <nav className="grid gap-2 border-t border-[#EAD6B8] px-5 py-4 sm:hidden">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-2 border-[#3B2A20] bg-transparent text-[#3B2A20]"
            >
              <Link to="/auth">Log in</Link>
            </Button>
            <Button asChild size="lg" className="bg-[#A8432E] text-white hover:bg-[#953A27]">
              <Link to="/auth" search={{ mode: "signup" }}>
                Sign up
              </Link>
            </Button>
          </nav>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <svg
            viewBox="0 0 1440 640"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 size-full"
            aria-hidden="true"
          >
            <g filter="url(#mp-watercolor)" opacity="0.5">
              <ellipse cx="1180" cy="120" rx="260" ry="180" fill="#F2C9A0" />
              <ellipse cx="160" cy="560" rx="240" ry="140" fill="#CFDCC1" />
              <ellipse cx="760" cy="40" rx="160" ry="80" fill="#F5DD9B" />
            </g>
          </svg>
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 md:grid-cols-2 md:py-20">
            <div>
              <p className={`${HAND} inline-block -rotate-2 text-3xl font-bold text-[#A8432E]`}>
                your recipes, your week ~
              </p>
              <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-[68px]">
                Plan your week of meals in minutes
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#5A4636]">
                Add your own recipes, tell us about your week, and get a meal plan plus a grocery
                list — no more 6pm "what's for dinner?".
              </p>
              <div className="mt-8 flex flex-wrap gap-3.5">
                <Button asChild className={primaryCta}>
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Plan my week — it's free
                  </Link>
                </Button>
                <Button asChild variant="outline" className={outlineCta}>
                  <Link to="/auth">Log in</Link>
                </Button>
              </div>
              <p className={`${HAND} mt-5 text-2xl text-[#5A4636]`}>
                free · 5 minutes to set up · dinner sorted tonight
              </p>
            </div>
            <div className="relative p-2 sm:p-5">
              <figure className="relative rotate-[2.5deg] rounded-md bg-white p-3.5 pb-14 shadow-[0_24px_40px_-20px_rgba(59,42,32,0.45)]">
                <img
                  src={hero}
                  alt="Colourful illustrated spread of salad, pasta, pancakes, tacos and roasted vegetables"
                  width={1280}
                  height={1024}
                  className="h-64 w-full rounded-sm object-cover sm:h-[340px]"
                />
                <figcaption
                  className={`${HAND} absolute inset-x-0 bottom-3 text-center text-[28px] font-bold`}
                >
                  this week at our table
                </figcaption>
              </figure>
              <div
                className="absolute -left-2 -top-2 z-10 -rotate-[4deg] rounded-2xl border-2 border-dashed border-[#8FA37E] bg-[#FDF7EC] px-4 py-2.5"
                aria-hidden="true"
              >
                <p className={`${HAND} text-2xl font-bold text-[#4F6340]`}>
                  Wed is busy → 20-min tacos
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-[#F6E8D2]">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
            <h2 className="text-center font-display text-4xl font-semibold md:text-5xl">
              How it works
            </h2>
            <p className={`${HAND} mt-1 text-center text-[26px] text-[#A8432E]`}>
              four little steps
            </p>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ icon: Icon, t, d, wash }, i) => (
                <li
                  key={t}
                  className="flex flex-col gap-3 rounded-3xl border-2 border-[#EAD6B8] bg-[#FDF7EC] p-6"
                >
                  <div className="flex items-center justify-between">
                    <Wash color={wash} size={64}>
                      <Icon className="size-6" strokeWidth={1.8} />
                    </Wash>
                    <span className={`${HAND} text-[44px] font-bold text-[#A8432E]`}>{i + 1}</span>
                  </div>
                  <h3 className="font-display text-[22px] font-semibold">{t}</h3>
                  <p className="leading-relaxed text-[#5A4636]">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Sample week preview (static illustration) */}
        <section aria-labelledby="week-preview">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
            <h2
              id="week-preview"
              className="text-center font-display text-4xl font-semibold md:text-5xl"
            >
              The week, pinned to the fridge
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-lg leading-relaxed text-[#5A4636]">
              Busy nights get quick dinners. Leftovers cover tomorrow's lunch. Drag any meal to swap
              it.
            </p>
            <div className="mt-10 flex flex-wrap items-start gap-7">
              <div className="min-w-0 flex-[999_1_640px] overflow-x-auto rounded-[20px] border-2 border-[#EAD6B8] bg-[#FFFDF8] shadow-[0_20px_40px_-28px_rgba(59,42,32,0.5)]">
                <div
                  className="grid min-w-[860px] grid-cols-[104px_repeat(7,minmax(0,1fr))]"
                  role="img"
                  aria-label="Sample weekly plan with breakfast, lunch and dinner for Monday to Sunday"
                >
                  <div className="flex flex-col">
                    <div className="h-16" />
                    {SLOTS.map((s) => (
                      <div
                        key={s.label}
                        className={`${HAND} flex h-[100px] items-center border-t border-dashed border-[#DCC6A6] px-3.5 text-2xl font-bold ${s.color}`}
                      >
                        {s.label}
                      </div>
                    ))}
                  </div>
                  {SAMPLE_WEEK.map((day) => (
                    <div
                      key={day.d}
                      className="flex flex-col border-l border-dashed border-[#DCC6A6]"
                    >
                      <div className="flex h-16 flex-col justify-center px-2.5">
                        <span className="font-display text-[19px] font-semibold">
                          {day.d} <span className="font-medium text-[#7A6452]">{day.n}</span>
                        </span>
                        {day.busy && (
                          <span className={`${HAND} text-lg font-bold leading-none text-[#A8432E]`}>
                            busy day!
                          </span>
                        )}
                      </div>
                      {day.meals.map((meal, i) => (
                        <div
                          key={i}
                          className="relative flex h-[100px] flex-col justify-between border-t border-dashed border-[#DCC6A6] p-2.5"
                        >
                          <span className="text-sm font-semibold leading-snug">{meal.t}</span>
                          {meal.kind === "busy" && (
                            <span className="self-start rounded-full bg-[#F7D9C9] px-2.5 py-0.5 text-xs font-bold text-[#6E2A1C]">
                              20 min
                            </span>
                          )}
                          {meal.kind === "left" && (
                            <span className="self-start rounded-full bg-[#DDE7D2] px-2.5 py-0.5 text-xs font-bold text-[#3E5131]">
                              leftovers
                            </span>
                          )}
                          {meal.kind === "drag" && (
                            <div className="absolute inset-y-1 -right-3 left-2 flex -rotate-[4deg] flex-col justify-between rounded-md bg-[#FFF6D8] gap-1 p-2 shadow-[0_16px_26px_-10px_rgba(59,42,32,0.5)]">
                              <span className="line-clamp-2 text-sm font-bold leading-tight">
                                {meal.t}
                              </span>
                              <span
                                className={`${HAND} text-lg font-bold leading-none text-[#A8432E]`}
                              >
                                drop to swap
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <aside
                aria-label="Sample grocery list"
                className="min-w-0 flex-[1_1_290px] rotate-1 rounded-md bg-[#FFFDF8] bg-[repeating-linear-gradient(#FFFDF8_0_31px,#EFE2CC_31px_32px)] px-6 py-6 shadow-[0_20px_40px_-24px_rgba(59,42,32,0.5)]"
              >
                <h3 className={`${HAND} text-4xl font-bold leading-none text-[#A8432E]`}>
                  Grocery list
                </h3>
                <p className="mt-1.5 text-sm text-[#5A4636]">for 2 · grouped by aisle</p>
                {SAMPLE_GROCERY.map((g) => (
                  <div key={g.aisle} className="py-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#4F6340]">
                      {g.aisle}
                    </p>
                    <p className={`${HAND} mt-1 text-[22px] font-medium leading-snug`}>{g.items}</p>
                  </div>
                ))}
                <p className="mt-2 text-sm font-semibold text-[#5A4636]">
                  Print · Share on WhatsApp
                </p>
              </aside>
            </div>
            <ul
              className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
              aria-label="Sample recipes"
            >
              {SAMPLE_RECIPES.map((r) => (
                <li
                  key={r.name}
                  className="flex flex-col gap-2.5 rounded-3xl border-2 border-[#EAD6B8] bg-[#FFFDF8] p-4"
                >
                  <Plate c={r.c} />
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-display text-[19px] font-semibold">{r.name}</h3>
                      <p className="mt-1 text-sm text-[#5A4636]">{r.meta}</p>
                    </div>
                    <span
                      className="grid size-11 shrink-0 place-items-center rounded-[14px] border-2 border-[#EAD6B8] bg-[#FBF3E6]"
                      aria-hidden="true"
                    >
                      <GripVertical className="size-4" />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features */}
        <section className="bg-[#EEF2E8]">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
            <h2 className="text-center font-display text-4xl font-semibold md:text-5xl">
              Everything for a calmer week
            </h2>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, t, d, wash }) => (
                <li
                  key={t}
                  className="flex items-start gap-4 rounded-[22px] bg-[#FFFDF8] p-6 transition-transform hover:-translate-y-0.5"
                >
                  <Wash color={wash}>
                    <Icon className="size-6" strokeWidth={1.8} />
                  </Wash>
                  <div>
                    <h3 className="font-display text-xl font-semibold">{t}</h3>
                    <p className="mt-1.5 leading-relaxed text-[#5A4636]">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="relative overflow-hidden rounded-[32px] bg-[#A8432E] px-6 py-14 text-center text-[#FFF6EC] md:px-12">
            <svg
              viewBox="0 0 800 300"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 size-full"
              aria-hidden="true"
            >
              <g filter="url(#mp-watercolor)" opacity="0.25">
                <ellipse cx="80" cy="260" rx="160" ry="90" fill="#E0B04B" />
                <ellipse cx="740" cy="40" rx="150" ry="90" fill="#F2C9A0" />
              </g>
            </svg>
            <div className="relative">
              <h2 className="font-display text-4xl font-semibold md:text-6xl">Dinner, decided.</h2>
              <p className="mx-auto mt-3 max-w-md text-lg leading-relaxed">
                Set up in five minutes and get your first week planned tonight.
              </p>
              <Button
                asChild
                className="mt-8 h-auto min-h-[60px] rounded-2xl bg-[#FFF6EC] px-7 text-lg font-bold text-[#3B2A20] shadow-[0_8px_0_#6E2A1C] hover:bg-white active:translate-y-1 active:shadow-[0_4px_0_#6E2A1C]"
              >
                <Link to="/auth" search={{ mode: "signup" }}>
                  Create your free account
                </Link>
              </Button>
              <p className={`${HAND} mt-5 text-[26px]`}>made with love for busy kitchens</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-dashed border-[#EAD6B8]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-[#5A4636]">
          <span className="font-display text-xl font-semibold text-[#A8432E]">Meal Planner</span>
          <span>© {new Date().getFullYear()} Meal Planner. Made for busy households.</span>
        </div>
      </footer>
    </div>
  );
}
