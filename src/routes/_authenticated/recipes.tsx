import { pageMeta } from "@/lib/metadata";
import { Loader2 } from "lucide-react";
import { LoadingButton, RecipeCardsSkeleton } from "@/components/Loading";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Clock, Pencil, Plus, Repeat, Search, Trash2, UtensilsCrossed, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { removeRecipeImage, prepareRecipePhoto } from "@/lib/recipe-images";
import type { MealType, Recipe } from "@/lib/plan";
import { allRecipesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/recipes")({
  head: () => pageMeta("Recipes", "Browse and manage your saved recipes and recipe pictures."),
  validateSearch: (s: Record<string, unknown>) => ({ recipe: typeof s["recipe"] === "string" ? (s["recipe"] as string) : undefined }),
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

const toDraft = (r: Recipe): RecipeDraft => ({
  name: r.name,
  ingredients: r.ingredients,
  steps: r.steps ?? "",
  cook_time: r.cook_time,
  is_quick: r.is_quick,
  can_repeat: r.can_repeat,
  meal_types: r.meal_types,
  original_image_url: r.original_image_url ?? null,
  image_crop: r.image_crop ?? null,
  image_url: r.image_url ?? null,
  photoPreview: r.imageSrc ?? null,
});

function RecipeImage({ src, name }: { src?: string | null; name: string }) {
  if (!src) {
    return (
      <div className="grid aspect-[4/3] w-full place-items-center rounded-t-2xl bg-muted text-muted-foreground/60">
        <UtensilsCrossed className="size-8" aria-hidden />
      </div>
    );
  }
  return <img src={src} alt={name} className="aspect-[4/3] w-full rounded-t-2xl object-cover" />;
}

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
  const search = Route.useSearch();
  useEffect(() => {
    if (search.recipe && !viewing) {
      const r = recipes.find((x) => x.id === search.recipe);
      if (r) setViewing(r);
    }
  }, [search.recipe, recipes, viewing]);
  const [deleting, setDeleting] = useState<Recipe | null>(null);

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    const out = recipes.filter((r) => {
      if (s && !r.name.toLowerCase().includes(s) && !r.ingredients.some((i) => i.toLowerCase().includes(s))) return false;
      if (type !== "all" && !r.meal_types.includes(type)) return false;
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
      const previous = recipes.find((r) => r.id === editing.id) ?? {};
      const photo = await prepareRecipePhoto(editing.draft, previous);
      const { error } = editing.id
        ? await supabase.from("recipes").update({ ...row, ...photo.row }).eq("id", editing.id)
        : await supabase.from("recipes").insert({ ...row, ...photo.row });
      if (error) { await photo.rollback(); throw error; }
      await photo.commit();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (r: Recipe) => {
      const { error } = await supabase.from("recipes").delete().eq("id", r.id);
      if (error) throw error;
      await Promise.all([...new Set([r.image_url, r.original_image_url])].filter((p): p is string => !!p).map(removeRecipeImage));
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
          <RecipeCardsSkeleton />
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
              <li key={r.id} className="surface relative flex flex-col overflow-hidden transition-colors hover:border-primary/40">
                <button onClick={() => setViewing(r)} className="min-w-0 flex-1 text-left" aria-label={`View ${r.name}`}>
                  <RecipeImage src={r.imageSrc} name={r.name} />
                  <div className="p-4">
                    <p className="pr-2 font-semibold">{r.name}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                      <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-muted-foreground"><Clock className="size-3" />{r.cook_time} min</span>
                      {r.meal_types.map((m) => <span key={m} className="rounded-full border px-2.5 py-1 capitalize text-muted-foreground">{m}</span>)}
                      {r.is_quick && <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-muted-foreground"><Zap className="size-3" />Quick</span>}
                      {r.can_repeat && <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-muted-foreground"><Repeat className="size-3" />Weekly</span>}
                    </div>
                  </div>
                </button>
                <div className="absolute right-2 top-2 flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="secondary" size="icon" aria-label={`Edit ${r.name}`} onClick={() => setEditing({ id: r.id, draft: toDraft(r) })}><Pencil /></Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="secondary" size="icon" className="text-destructive" aria-label={`Delete ${r.name}`} onClick={() => setDeleting(r)}><Trash2 /></Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
          <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-2xl p-0">
            <DialogHeader className="border-b p-5 text-left">
              <DialogTitle className="font-display text-2xl">{viewing?.name}</DialogTitle>
              <DialogDescription className="capitalize">
                {viewing?.cook_time} min · {viewing?.meal_types.join(" · ")}
                {viewing?.is_quick ? " · quick" : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto overscroll-contain p-5">
              {viewing?.imageSrc && <img src={viewing.imageSrc} alt={viewing.name} className="mb-4 aspect-[4/3] w-full rounded-xl object-cover" />}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-primary">Ingredients</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {viewing?.ingredients.map((i) => <li key={i}>{i}</li>)}
                </ul>
              </section>
              {viewing?.steps && (
                <section className="mt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-primary">Steps</h3>
                  <p className="mt-2 whitespace-pre-line text-sm">{viewing.steps}</p>
                </section>
              )}
            </div>
            <div className="border-t p-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (viewing) setEditing({ id: viewing.id, draft: toDraft(viewing) });
                  setViewing(null);
                }}
              >
                <Pencil /> Edit
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-2xl p-0">
            <DialogHeader className="border-b p-5 text-left">
              <DialogTitle>{editing?.id ? "Edit recipe" : "New recipe"}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto overscroll-contain p-5">
              {editing && <RecipeFields value={editing.draft} onChange={(d) => setEditing({ ...editing, draft: d })} />}
            </div>
            <div className="border-t p-4">
              <LoadingButton className="w-full" onClick={() => save.mutate()} loading={save.isPending} loadingText="Saving...">Save recipe</LoadingButton>
            </div>
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
                disabled={del.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  if (deleting) del.mutate(deleting);
                }}
              >
                {del.isPending ? <><Loader2 className="animate-spin" aria-hidden="true" /> Deleting...</> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </TooltipProvider>
  );
}
