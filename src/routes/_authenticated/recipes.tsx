import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Clock, Plus, Repeat, Search, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { RecipeFields, cleanDraft, emptyDraft, type RecipeDraft } from "@/components/RecipeFields";
import type { Recipe } from "@/lib/plan";

export const Route = createFileRoute("/_authenticated/recipes")({
  head: () => ({ meta: [{ title: "Recipes — Weeknight" }] }),
  component: RecipesPage,
});

export const recipesQuery = {
  queryKey: ["recipes"],
  queryFn: async () => {
    const { data, error } = await supabase.from("recipes").select("*").order("name");
    if (error) throw error;
    return data as Recipe[];
  },
};

function RecipesPage() {
  const qc = useQueryClient();
  const { data: recipes = [], isLoading } = useQuery(recipesQuery);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id?: string; draft: RecipeDraft } | null>(null);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return s ? recipes.filter((r) => r.name.toLowerCase().includes(s) || r.ingredients.some((i) => i.toLowerCase().includes(s))) : recipes;
  }, [recipes, q]);

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const row = cleanDraft(editing.draft);
      if (!row.name) throw new Error("Give the recipe a name");
      const { error } = editing.id
        ? await supabase.from("recipes").update(row).eq("id", editing.id)
        : await supabase.from("recipes").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recipes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      setEditing(null);
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-5 pt-6">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl">Recipes</h1>
        <Button onClick={() => setEditing({ draft: emptyDraft() })}>
          <Plus /> New
        </Button>
      </div>
      <div className="relative mt-5">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recipes or ingredients" className="h-12 rounded-xl bg-card pl-11" />
      </div>

      {isLoading ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : recipes.length === 0 ? (
        <div className="surface mt-8 p-8 text-center">
          <p className="font-medium">No recipes yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add your first one, or paste a few and let AI sort them.</p>
          <Button asChild variant="secondary" className="mt-5">
            <Link to="/import">Add with AI</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {filtered.map((r) => (
            <li key={r.id}>
              <button
                onClick={() =>
                  setEditing({
                    id: r.id,
                    draft: { name: r.name, ingredients: r.ingredients, steps: r.steps ?? "", cook_time: r.cook_time, is_quick: r.is_quick, can_repeat: r.can_repeat },
                  })
                }
                className="surface w-full p-4 text-left transition-colors hover:border-primary/40"
              >
                <p className="font-semibold">{r.name}</p>
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{r.ingredients.join(", ")}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"><Clock className="size-3" />{r.cook_time} min</span>
                  {r.is_quick && <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground"><Zap className="size-3" />Quick</span>}
                  {r.can_repeat && <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground"><Repeat className="size-3" />Weekly</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit recipe" : "New recipe"}</DialogTitle>
          </DialogHeader>
          {editing && <RecipeFields value={editing.draft} onChange={(d) => setEditing({ ...editing, draft: d })} />}
          <DialogFooter className="gap-2 sm:justify-between">
            {editing?.id ? (
              <Button variant="ghost" className="text-destructive" onClick={() => del.mutate(editing.id!)}>
                <Trash2 /> Delete
              </Button>
            ) : <span />}
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Save recipe</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
