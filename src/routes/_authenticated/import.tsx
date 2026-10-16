import { readablePhoto } from "@/lib/photo-crop";
import { pageMeta } from "@/lib/metadata";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Camera, ImagePlus, Sparkles, X } from "lucide-react";
import { CookingLoader, LoadingButton, useSlowAction } from "@/components/Loading";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { parseRecipePhotosWithAI, parseRecipesWithAI } from "@/lib/ai.functions";
import { resizeImage } from "@/lib/image-resize";
import { prepareRecipePhoto } from "@/lib/recipe-images";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecipeFields, cleanDraft, type RecipeDraft } from "@/components/RecipeFields";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => pageMeta("Add recipes with AI", "Import your recipes from text or photos."),
  component: ImportPage,
});

function ImportPage() {
  const parse = useServerFn(parseRecipesWithAI);
  const parsePhotos = useServerFn(parseRecipePhotosWithAI);
  const [photos, setPhotos] = useState<{ mediaType: "image/jpeg"; data: string; preview: string; original: Blob }[]>([]);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setPhotoErr(null);
    const room = 3 - photos.length;
    const list = [...files].slice(0, room);
    if (files.length > room) setPhotoErr("You can add up to 3 photos.");
    const out: typeof photos = [];
    for (const f of list) {
      if (!/^image\/(jpeg|png|heic|heif)$/i.test(f.type) && !/\.(jpe?g|png|heic|heif)$/i.test(f.name)) {
        setPhotoErr("Please use JPG, PNG or HEIC photos.");
        continue;
      }
      try {
        const original = await readablePhoto(f);
        out.push({ ...await resizeImage(original), original });
      } catch {
        setPhotoErr(/heic|heif/i.test(f.type + f.name) ? "This device can't open HEIC photos. Try a JPG or PNG instead." : "We couldn't open that photo.");
      }
    }
    setPhotos((p) => [...p, ...out].slice(0, 3));
  }

  async function runPhotos() {
    setPhotoErr(null);
    await slow.run(async () => {
      const out = await parsePhotos({ data: { images: photos.map(({ mediaType, data }) => ({ mediaType, data })) } });
      setDrafts(out.map((r, i) => ({ ...r, can_repeat: false, image_url: null, ...(i === 0 && usePhoto && photos[0] ? { originalBlob: photos[0].original, photoPreview: photos[0].preview } : {}) })));
    });
  }
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const slow = useSlowAction();
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<RecipeDraft[] | null>(null);
  const [usePhoto, setUsePhoto] = useState(true);

  async function run() {
    await slow.run(async () => {
      const out = await parse({ data: { text } });
      if (!out.length) throw new Error("We couldn't find a recipe in that text. Try adding a dish name or ingredients.");
      setDrafts(out.map((r) => ({ ...r, can_repeat: false, image_url: null })));
    });
  }

  async function saveAll() {
    if (!drafts) return;
    if (drafts.some((d) => d.originalBlob && !d.photoBlob)) { toast.error("Adjust the recipe picture before saving."); return; }
    setSaving(true);
    try {
      await doSaveAll();
    } finally {
      setSaving(false);
    }
  }

  async function doSaveAll() {
    if (!drafts) return;
    const staged = [];
    try {
      for (const draft of drafts) {
        if (!draft.name.trim()) continue;
        const photo = await prepareRecipePhoto(draft, {});
        staged.push({ row: { ...cleanDraft(draft), ...photo.row }, photo });
      }
      const { error } = await supabase.from("recipes").insert(staged.map((x) => x.row));
      if (error) throw error;
    } catch (e) {
      await Promise.all(staged.map((x) => x.photo.rollback()));
      toast.error(e instanceof Error ? e.message : "Couldn't save recipes.");
      return;
    }
    const rows = staged.map((x) => x.row);
    qc.invalidateQueries({ queryKey: ["recipes"] });
    toast.success(`Saved ${rows.length} recipe${rows.length > 1 ? "s" : ""}`);
    navigate({ to: "/recipes" });
  }

  if (drafts) {
    return (
      <main className="mx-auto max-w-3xl px-5 pt-6">
        <h1 className="font-display text-3xl">Review {drafts.length} recipe{drafts.length > 1 ? "s" : ""}</h1>
        <p className="mt-1 text-muted-foreground">Fix anything that looks off, then save.</p>
        {photos.length > 0 && (
          <label className="surface mt-4 flex min-h-12 items-center justify-between gap-3 px-4">
            <span className="text-sm font-medium">Use this photo as the recipe picture</span>
            <Switch checked={usePhoto} onCheckedChange={(checked) => { setUsePhoto(checked); setDrafts(drafts.map((d, i) => i === 0 ? { ...d, originalBlob: checked && photos[0] ? photos[0].original : null, photoBlob: null, photoPreview: checked ? photos[0]?.preview ?? null : null } : d)); }} />
          </label>
        )}
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
          <LoadingButton className="flex-1" onClick={saveAll} disabled={!drafts.length} loading={saving} loadingText="Saving...">Save all</LoadingButton>
        </div>
      </main>
    );
  }

  if (slow.active) {
    return (
      <main className="mx-auto max-w-3xl px-5 pt-10">
        <CookingLoader task="recipe" error={slow.error} onRetry={slow.retry} onCancel={slow.reset} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pt-6">
      <h1 className="font-display text-3xl">Add with AI</h1>
      <p className="mt-1 text-muted-foreground">Paste text or snap a photo — you'll review everything before saving.</p>
      <Tabs defaultValue="text" className="mt-5">
        <TabsList className="grid h-12 w-full grid-cols-2 rounded-xl">
          <TabsTrigger value="text" className="rounded-lg">Paste text</TabsTrigger>
          <TabsTrigger value="photo" className="rounded-lg">Upload a photo</TabsTrigger>
        </TabsList>
        <TabsContent value="text">
          <Label htmlFor="ai-text" className="mt-3 block">Recipes or dish names (one per line)</Label>
          <Textarea
            id="ai-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder={"Chicken stir fry\nLentil soup\nShakshuka"}
            className="mt-2 rounded-2xl bg-card text-base"
          />
          <Button size="lg" className="mt-4 w-full" onClick={run} disabled={text.trim().length < 2}>
            <Sparkles /> Turn into recipes
          </Button>
        </TabsContent>
        <TabsContent value="photo">
          <p className="mt-3 text-sm text-muted-foreground">JPG, PNG or HEIC · up to 3 photos of one recipe.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className={`surface flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 p-4 text-sm font-medium ${photos.length >= 3 ? "pointer-events-none opacity-50" : ""}`}>
              <ImagePlus className="size-6 text-primary" />
              Choose from gallery
              <input type="file" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} disabled={photos.length >= 3} />
            </label>
            <label className={`surface flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 p-4 text-sm font-medium ${photos.length >= 3 ? "pointer-events-none opacity-50" : ""}`}>
              <Camera className="size-6 text-warm" />
              Take a photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} disabled={photos.length >= 3} />
            </label>
          </div>
          {photos.length > 0 && (
            <ul className="mt-4 flex gap-3">
              {photos.map((p, i) => (
                <li key={i} className="relative">
                  <img src={p.preview} alt={`Recipe photo ${i + 1}`} className="size-24 rounded-xl object-cover" />
                  <button
                    onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                    className="absolute -right-2 -top-2 grid size-8 place-items-center rounded-full bg-foreground text-background"
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {photoErr && <p role="alert" className="mt-3 text-sm text-destructive">{photoErr}</p>}
          <Button size="lg" variant="warm" className="mt-4 w-full" onClick={runPhotos} disabled={photos.length === 0}>
            <Sparkles /> Read recipe from photo
          </Button>
        </TabsContent>
      </Tabs>
    </main>
  );
}
