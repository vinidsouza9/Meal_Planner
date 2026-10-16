import { pageMeta } from "@/lib/metadata";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AISLES, buildGrocery, type GroceryItem } from "@/lib/plan";
import { allRecipesQuery, latestPlanQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/grocery-print")({
  head: () => pageMeta("Print grocery list", "Print your household grocery list."),
  component: GroceryPrint,
});

function fmtRange(start: string) {
  const d = new Date(start + "T00:00:00");
  const e = new Date(d);
  e.setDate(d.getDate() + 6);
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${d.toLocaleDateString(undefined, o)} – ${e.toLocaleDateString(undefined, o)}`;
}

function GroceryPrint() {
  const { data: plan } = useQuery(latestPlanQuery);
  const { data: recipes } = useQuery(allRecipesQuery);
  const { data: saved } = useQuery({
    queryKey: ["grocery", plan?.id],
    enabled: !!plan,
    queryFn: async () => (await supabase.from("grocery_lists").select("id, items").eq("plan_id", plan!.id).maybeSingle()).data,
  });
  const items: GroceryItem[] =
    (saved?.items as unknown as GroceryItem[] | undefined) ??
    (plan && recipes ? buildGrocery(plan.plan_json, recipes, plan.answers?.people ?? 2, plan.answers?.fridge ?? []) : []);

  return (
    <main className="mx-auto max-w-3xl bg-card px-6 py-8 text-foreground">
      <div className="print-hide mb-6 flex justify-between">
        <Button asChild variant="ghost"><Link to="/grocery"><ChevronLeft /> Back</Link></Button>
        <Button onClick={() => window.print()}><Printer /> Print</Button>
      </div>
      <h1 className="font-display text-3xl">Grocery list</h1>
      {plan && <p className="mb-5 text-sm">Week of {fmtRange(plan.week_start)} · for {plan.answers?.people ?? 2} people</p>}
      <div className="columns-2 gap-8 text-sm">
        {AISLES.map((a) => {
          const rows = items.filter((i) => i.aisle === a);
          if (!rows.length) return null;
          return (
            <section key={a} className="mb-4 break-inside-avoid">
              <h2 className="mb-1 border-b border-foreground pb-0.5 text-xs font-bold uppercase tracking-widest">{a}</h2>
              <ul>
                {rows.map((i) => (
                  <li key={i.name + i.qty} className="flex items-center gap-2 py-0.5">
                    <span className="inline-block size-3.5 shrink-0 border border-foreground" aria-hidden />
                    <span className="flex-1">{i.name}</span>
                    <span className="text-xs">{i.qty}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
