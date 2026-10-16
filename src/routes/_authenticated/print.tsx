import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DAYS, MEALS } from "@/lib/plan";
import { allRecipesQuery, latestPlanQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/print")({
  head: () => ({ meta: [{ title: "Print plan — Meal Planner" }] }),
  component: PrintPage,
});

function PrintPage() {
  const { data: plan } = useQuery(latestPlanQuery);
  const { data: recipes = [] } = useQuery(allRecipesQuery);
  const names = new Map(recipes.map((r) => [r.id, r.name]));
  return (
    <main className="mx-auto max-w-4xl bg-card px-6 py-8 text-foreground">
      <div className="print-hide mb-6 flex justify-between">
        <Button asChild variant="ghost"><Link to="/plan"><ChevronLeft /> Back</Link></Button>
        <Button onClick={() => window.print()}><Printer /> Print</Button>
      </div>
      <h1 className="font-display text-3xl">Meal Planner</h1>
      {plan && <p className="mb-4 text-sm">Week of {plan.week_start}</p>}
      {!plan ? (
        <p>No plan yet.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-foreground p-2 text-left">Day</th>
              {MEALS.map((m) => (
                <th key={m} className="border border-foreground p-2 text-left capitalize">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => {
              const row = plan.plan_json.days.find((x) => x.day === d);
              return (
                <tr key={d}>
                  <td className="border border-foreground p-2 font-semibold">{d}</td>
                  {MEALS.map((m) => {
                    const c = row?.[m];
                    return (
                      <td key={m} className="border border-foreground p-2">
                        {c?.recipe_id ? `${names.get(c.recipe_id) ?? ""}${c.leftover ? " (leftovers)" : ""}` : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
