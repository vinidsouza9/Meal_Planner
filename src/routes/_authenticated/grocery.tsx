import { pageMeta } from "@/lib/metadata";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy, Printer, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ListSkeleton, CookingLoader } from "@/components/Loading";
import { ShareMenu } from "@/components/ShareMenu";
import { supabase } from "@/integrations/supabase/client";
import { buildGroceryPdf } from "@/lib/pdf";
import { AISLES, buildGrocery, groceryText, weekRangeLabel, type GroceryItem } from "@/lib/plan";
import { allRecipesQuery, latestPlanQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/grocery")({
  head: () => pageMeta("Grocery list", "Shop your household grocery list grouped by aisle."),
  component: GroceryPage,
});

function GroceryPage() {
  const qc = useQueryClient();
  const { data: plan, isLoading } = useQuery(latestPlanQuery);
  const { data: recipes } = useQuery(allRecipesQuery);
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await supabase.from("profiles").select("household_size").maybeSingle()).data,
  });
  const listQ = useQuery({
    queryKey: ["grocery", plan?.id],
    enabled: !!plan,
    queryFn: async () => (await supabase.from("grocery_lists").select("id, items").eq("plan_id", plan!.id).maybeSingle()).data,
  });
  const [items, setItems] = useState<GroceryItem[] | null>(null);

  const people = plan?.answers?.people ?? profile?.household_size ?? 2;

  async function rebuild(persist = true) {
    if (!plan || !recipes) return;
    const built = buildGrocery(plan.plan_json, recipes, people, plan.answers?.fridge ?? []);
    setItems(built);
    if (persist) {
      await supabase.from("grocery_lists").upsert({ plan_id: plan.id, items: built }, { onConflict: "plan_id" });
      qc.invalidateQueries({ queryKey: ["grocery", plan.id] });
    }
  }

  useEffect(() => {
    if (!plan || !recipes || listQ.isLoading || items) return;
    if (listQ.data) setItems(listQ.data.items as unknown as GroceryItem[]);
    else rebuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, recipes, listQ.isLoading, listQ.data]);

  async function toggle(i: GroceryItem) {
    if (!items || !plan) return;
    const next = items.map((x) => (x === i ? { ...x, checked: !x.checked } : x));
    setItems(next);
    await supabase.from("grocery_lists").update({ items: next }).eq("plan_id", plan.id);
  }

  function copy() {
    if (!items) return;
    navigator.clipboard.writeText(groceryText(items)).then(() => toast.success("Copied to clipboard"));
  }


  if (isLoading) return <main className="mx-auto max-w-xl px-5 pt-6"><ListSkeleton label="Loading grocery list" /></main>;
  if (!plan)
    return (
      <main className="mx-auto max-w-xl px-5 pt-6">
        <h1 className="font-display text-3xl">Groceries</h1>
        <div className="surface mt-6 p-8 text-center">
          <p className="text-muted-foreground">Plan a week first and your list will appear here.</p>
          <Button asChild className="mt-5"><Link to="/checkin">Plan my week</Link></Button>
        </div>
      </main>
    );

  return (
    <main className="mx-auto max-w-xl px-5 pt-6">
      <div>
        <h1 className="font-display text-3xl">Groceries</h1>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-3 py-1 text-sm font-medium text-amber-foreground">
          <Users className="size-4" /> Quantities for {people} {people === 1 ? "person" : "people"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Fridge items are left off.</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <ShareMenu
          build={() => buildGroceryPdf(items ?? [], plan.week_start, people)}
          cacheKey={[items, plan.week_start, people]}
          title={`Grocery list: ${weekRangeLabel(plan.week_start)}`}
          disabled={!items?.length}
        />
        <Button variant="secondary" onClick={copy} disabled={!items?.length}><Copy /> Copy</Button>
        <Button asChild variant="outline"><Link to="/grocery-print"><Printer /> Print</Link></Button>
        <Button variant="outline" size="icon" onClick={() => rebuild()} aria-label="Rebuild list"><RefreshCw /></Button>
      </div>
      {!items ? (
        listQ.isLoading ? <ListSkeleton label="Loading grocery list" /> : <CookingLoader task="grocery" className="mt-6" />
      ) : items.length === 0 ? (
        <p className="surface mt-6 p-6 text-muted-foreground">Nothing to buy — you're all set.</p>
      ) : (
        <div className="mt-6 space-y-5">
          {AISLES.map((a) => {
            const rows = items.filter((i) => i.aisle === a);
            if (!rows.length) return null;
            return (
              <section key={a}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">{a}</h2>
                <ul className="surface divide-y overflow-hidden">
                  {rows.map((i) => (
                    <li key={i.name + i.qty}>
                      <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4">
                        <Checkbox checked={i.checked} onCheckedChange={() => toggle(i)} className="size-5" />
                        <span className={`flex-1 ${i.checked ? "text-muted-foreground line-through" : ""}`}>{i.name}</span>
                        <span className="text-sm text-muted-foreground">{i.qty}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
