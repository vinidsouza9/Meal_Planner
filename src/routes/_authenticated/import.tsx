import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { parseRecipesWithAI } from "@/lib/ai.functions";
import { RecipeFields, cleanDraft, type RecipeDraft } from "@/components/RecipeFields";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({ meta: [{ title: "Add recipes with AI — Weeknight" }] }),
  component: ImportPage,
});

function ImportPage() {
  const parse = useServerFn(parseRecipesWithAI);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<RecipeDraft[] | null>(null);

  async function run() {
    setBusy(true);
    try {
      const out = await parse({ data: { text } });
      if (!out.length) toast.error("No recipes found in that text.");
      else setDrafts(out.map((r) => ({ ...r, can_repeat: false })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    if (!drafts) return;
    const rows = drafts.map(cleanDraft).filter((r) => r.name);
    const { error } = await supabase.from("recipes").insert(rows);
    if (error) {
      toast.error("Couldn't save recipes.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["recipes"] });
    toast.success(`Saved ${rows.length} recipe${rows.length > 1 ? "s" : ""}`);
    navigate({ to: "/recipes" });
  }

  if (drafts) {
    return (
      <main className="mx-auto max-w-3xl px-5 pt-6">
        <h1 className="font-display text-3xl">Review {drafts.length} recipe{drafts.length > 1 ? "s" : ""}</h1>
        <p className="mt-1 text-muted-foreground">Fix anything that looks off, then save.</p>
        <div className="mt-6 space-y-4">
          {drafts.map((d, i) => (
            <div key={i} className="surface relative p-5">
              <button
                onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}
                className="absolute right-3 top-3 grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
                aria-label="Remove"
              >
                <X className="size-5" />
              </button>
              <RecipeFields idPrefix={`d${i}`} value={d} onChange={(v) => setDrafts(drafts.map((x, j) => (j === i ? v : x)))} />
            </div>
          ))}
        </div>
        <div className="sticky bottom-20 mt-6 flex gap-3 bg-background/90 py-3 backdrop-blur">
          <Button variant="outline" className="flex-1" onClick={() => setDrafts(null)}>Back</Button>
          <Button className="flex-1" onClick={saveAll} disabled={!drafts.length}>Save all</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pt-6">
      <h1 className="font-display text-3xl">Add with AI</h1>
      <p className="mt-1 text-muted-foreground">Paste a full recipe, or just list dish names — one per line.</p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        placeholder={"Chicken stir fry\nLentil soup\nShakshuka"}
        className="mt-5 rounded-2xl bg-card text-base"
      />
      <Button size="lg" className="mt-4 w-full" onClick={run} disabled={busy || text.trim().length < 2}>
        {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {busy ? "Reading your recipes…" : "Turn into recipes"}
      </Button>
    </main>
  );
}
