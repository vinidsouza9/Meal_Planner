import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Clock, Pencil, Plus, Repeat, Search, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { RecipeFields, cleanDraft, emptyDraft, type RecipeDraft } from "@/components/RecipeFields";
import type { MealType, Recipe } from "@/lib/plan";
import { allRecipesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/recipes")({
  head: () => ({ meta: [{ title: "Recipes — Meal Planner" }] }),
  component: RecipesPage,
});

type TimeF = "any" | "quick" | "mid" | "long";
type SortF = "az" | "za" | "quickest";
const TYPE_CHIPS: { v: "all" | Exclude<MealType, "any">; l: string }[] = [
  { v: "all", l: "All" },
  { v: "breakfast", l: "Breakfast" },
  { v: "lunch", l: "Lunch" },
  { v: "dinner", l: "Dinner" },
];
const TYPE_TAG: Record<MealType, string> = {
  breakfast: "bg-breakfast-soft text-breakfast",
  lunch: "bg-lunch-soft text-lunch",
  dinner: "bg-dinner-soft text-dinner",
  any: "bg-muted text-muted-foreground",
};

const toDraft = (r: Recipe): RecipeDraft => ({
  name: r.name,
  ingredients: r.ingredients,
  steps: r.steps ?? "",
  cook_time: r.cook_time,
  is_quick: r.is_quick,
  can_repeat: r.can_repeat,
  meal_type: r.meal_type ?? "any",
});

function RecipesPage() {
  const qc = useQueryClient();
  const { data: recipes = [], isLoading } = useQuery(allRecipesQuery);
  const [q, setQ] = useState("");
  const [type, setType] = useState<(typeof TYPE_CHIPS)[number]["v"]>("all");
  const [time, setTime] = useState<TimeF>("any");
  const [sort, setSort] = useState<SortF>("az");
  const [quickOnly, setQuickOnly] = useState(false);
  const [editing, setEditing] = useState<{ id?: string; draft: RecipeDraft } | null>(null);
  const [viewing, setViewing] = useState<Recipe | null>(null);
  const [deleting, setDeleting] = useState<Recipe | null>(null);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    const out = recipes.filter((r) => {
      if (s && !r.name.toLowerCase().includes(s) && !r.ingredients.some((i) => i.toLowerCase().includes(s))) return false;
      if (type !== "all" && r.meal_type !== type && r.meal_type !== "any") return false;
      if (time === "quick" && r.cook_time > 20) return false;
      if (time === "mid" && (r.cook_time <= 20 || r.cook_time > 40)) return false;
      if (time === "long" && r.cook_time <= 40) return false;
      if (quickOnly && !r.is_quick) return false;
      return true;
    });
    return out.sort((a, b) => (sort === "za" ? b.name.localeCompare(a.name) : sort === "quickest" ? a.cook_time - b.cook_time : a.name.localeCompare(b.name)));
  }, [recipes, q, type, time, sort, quickOnly]);

  const dirty = q !== "" || type !== "all" || time !== "any" || quickOnly || sort !== "az";
  const clear = () => {
    setQ("");
    setType("all");
    setTime("any");
    setSort("az");
    setQuickOnly(false);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const row = cleanDraft(editing.draft);
      if (!row.name) throw new Error("Give the recipe a name");
      const { error } = editing.id ? await supabase.from("recipes").update(row).eq("id", editing.id) : await supabase.from("recipes").insert(row);
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
      setDeleting(null);
      toast.success("Recipe deleted");
    },
    onError: () => toast.error("Couldn't delete. It may be used in a plan."),
  });

  return (
    <TooltipProvider>
      <main className="mx-auto max-w-3xl px-5 pt-6">
        <div className="flex items-end justify-between gap-3">
          <h1 className="font-display text-3xl">Recipes</h1>
          <Button onClick={() => setEditing({ draft: emptyDraft() })}>
            <Plus /> New
          </Button>
        </div>

        <div className="surface mt-5 space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="recipe-search">Search</Label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="recipe-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recipe or ingredient" className="h-12 rounded-xl pl-11" />
            </div>
          </div>
          <div role="group" aria-label="Meal type" className="flex flex-wrap gap-2">
            {TYPE_CHIPS.map((c) => (
              <button key={c.v} className="chip" data-on={type === c.v} aria-pressed={type === c.v} onClick={() => setType(c.v)}>
                {c.l}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="f-time">Cook time</Label>
              <Select value={time} onValueChange={(v) => setTime(v as TimeF)}>
                <SelectTrigger id="f-time" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="quick">20 min or less</SelectItem>
                  <SelectItem value="mid">20–40 min</SelectItem>
                  <SelectItem value="long">40+ min</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-sort">Sort</Label>
              <Select value={sort} onValueChange={(v) => setSort(v as SortF)}>
                <SelectTrigger id="f-sort" className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="az">A to Z</SelectItem>
                  <SelectItem value="za">Z to A</SelectItem>
                  <SelectItem value="quickest">Quickest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex h-11 items-center justify-between gap-2 self-end rounded-xl bg-muted px-4">
              <span className="text-sm font-medium">Quick meals only</span>
              <Switch checked={quickOnly} onCheckedChange={setQuickOnly} />
            </label>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground" aria-live="polite">
              {filtered.length} recipe{filtered.length === 1 ? "" : "s"}
            </span>
            {dirty && (
              <Button variant="ghost" size="sm" onClick={clear}>Clear filters</Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <p className="mt-8 text-muted-foreground">Loading…</p>
        ) : recipes.length === 0 ? (
          <div className="surface mt-6 p-8 text-center">
            <p className="font-medium">No recipes yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first one, or paste or snap a few and let AI sort them.</p>
            <Button asChild variant="warm" className="mt-5">
              <Link to="/import">Add with AI</Link>
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="surface mt-6 p-6 text-center text-muted-foreground">No recipes match these filters.</p>
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {filtered.map((r) => (
              <li key={r.id} className="surface relative flex transition-colors hover:border-primary/40">
                <button onClick={() => setViewing(r)} className="min-w-0 flex-1 p-4 text-left" aria-label={`View ${r.name}`}>
                  <p className="pr-2 font-semibold">{r.name}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"><Clock className="size-3" />{r.cook_time} min</span>
                    <span className={`rounded-full px-2.5 py-1 capitalize ${TYPE_TAG[r.meal_type ?? "any"]}`}>{r.meal_type === "any" ? "Any meal" : r.meal_type}</span>
                    {r.is_quick && <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-2.5 py-1 text-amber-foreground"><Zap className="size-3" />Quick</span>}
                    {r.can_repeat && <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground"><Repeat className="size-3" />Weekly</span>}
                  </div>
                </button>
                <div className="flex flex-col gap-1 p-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Edit ${r.name}`} onClick={() => setEditing({ id: r.id, draft: toDraft(r) })}><Pencil /></Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive" aria-label={`Delete ${r.name}`} onClick={() => setDeleting(r)}><Trash2 /></Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{viewing?.name}</DialogTitle>
              <DialogDescription className="capitalize">
                {viewing?.cook_time} min · {viewing?.meal_type === "any" ? "any meal" : viewing?.meal_type}
                {viewing?.is_quick ? " · quick" : ""}
              </DialogDescription>
            </DialogHeader>
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-primary">Ingredients</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {viewing?.ingredients.map((i) => <li key={i}>{i}</li>)}
              </ul>
            </section>
            {viewing?.steps && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-primary">Steps</h3>
                <p className="mt-2 whitespace-pre-line text-sm">{viewing.steps}</p>
              </section>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  if (viewing) setEditing({ id: viewing.id, draft: toDraft(viewing) });
                  setViewing(null);
                }}
              >
                <Pencil /> Edit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Edit recipe" : "New recipe"}</DialogTitle>
            </DialogHeader>
            {editing && <RecipeFields value={editing.draft} onChange={(d) => setEditing({ ...editing, draft: d })} />}
            <DialogFooter>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>Save recipe</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this recipe?</AlertDialogTitle>
              <AlertDialogDescription>“{deleting?.name}” will be removed. This can't be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  if (deleting) del.mutate(deleting.id);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </TooltipProvider>
  );
}
