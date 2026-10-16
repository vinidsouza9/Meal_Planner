import { useEffect, useState } from "react";
import { PhotoEditor } from "@/components/PhotoEditor";
import { Button } from "@/components/ui/button";
import { readablePhoto, type PhotoCrop } from "@/lib/photo-crop";
import { signImagePaths } from "@/lib/recipe-images";
import { Camera, ImagePlus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MEAL_TYPES, type MealType } from "@/lib/plan";

export type RecipeDraft = {
  name: string;
  ingredients: string[];
  steps: string;
  cook_time: number;
  is_quick: boolean;
  can_repeat: boolean;
  meal_types: MealType[];
  original_image_url?: string | null;
  image_crop?: PhotoCrop | null;
  originalBlob?: Blob | null;
  /** Existing storage path (null when none). */
  image_url: string | null;
  /** Newly chosen photo, pending upload on save. */
  photoBlob?: Blob | null;
  /** Preview URL: local data URL for a new photo, signed URL for an existing one. */
  photoPreview?: string | null;
  /** True when the user removed an existing photo. */
  removePhoto?: boolean;
};

export const emptyDraft = (): RecipeDraft => ({
  name: "",
  ingredients: [],
  steps: "",
  cook_time: 30,
  is_quick: false,
  can_repeat: false,
  meal_types: [...MEAL_TYPES],
  image_url: null,
});

function RecipePhotoField({ value, onChange, idPrefix }: { value: RecipeDraft; onChange: (v: RecipeDraft) => void; idPrefix: string }) {
  const [editor, setEditor] = useState<{ src: string; original?: Blob; crop?: PhotoCrop | null } | null>(null);
  useEffect(() => {
    if (value.originalBlob && !value.photoBlob && !value.removePhoto) setEditor({ src: URL.createObjectURL(value.originalBlob), original: value.originalBlob });
  }, [value.originalBlob]);
  const preview = value.removePhoto ? null : (value.photoPreview ?? null);

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!/^image\/(jpeg|png|heic|heif)$/i.test(f.type) && !/\.(jpe?g|png|heic|heif)$/i.test(f.name)) {
      toast.error("Please use a JPG, PNG or HEIC photo.");
      return;
    }
    try {
      const original = await readablePhoto(f);
      setEditor({ src: URL.createObjectURL(original), original });
    } catch {
      toast.error(/heic|heif/i.test(f.type + f.name) ? "This device can't open HEIC photos. Try a JPG or PNG instead." : "We couldn't open that photo.");
    }
  }

  async function adjust() {
    if (value.originalBlob) { setEditor({ src: URL.createObjectURL(value.originalBlob), original: value.originalBlob, crop: value.image_crop ?? null }); return; }
    const path = value.original_image_url || value.image_url;
    if (!path) return;
    const signed = await signImagePaths([path]);
    const src = signed.get(path);
    if (!src) { toast.error("Couldn't open the original photo."); return; }
    setEditor({ src, crop: value.image_crop ?? null });
  }
  function closeEditor() { if (editor?.src.startsWith("blob:")) URL.revokeObjectURL(editor.src); setEditor(null); }
  return (
    <div className="space-y-2">
      {editor && <PhotoEditor src={editor.src} kind="recipe" initial={editor.crop ?? null} onCancel={() => { if (value.originalBlob && !value.photoBlob) onChange({ ...value, originalBlob: null, photoPreview: null }); closeEditor(); }} onSave={(blob, crop) => {
        const reader = new FileReader();
        reader.onload = () => { onChange({ ...value, photoBlob: blob, photoPreview: String(reader.result), originalBlob: editor.original ?? value.originalBlob ?? null, image_crop: crop, removePhoto: false }); closeEditor(); };
        reader.readAsDataURL(blob);
      }} />}
      <Label>Recipe photo</Label>
      {preview ? (
        <div className="relative">
          <img src={preview} alt="Recipe photo" className="aspect-[4/3] w-full rounded-xl object-cover" />
          <Button
            variant="secondary" size="icon" type="button"
            onClick={() => onChange({ ...value, photoBlob: null, originalBlob: null, photoPreview: null, removePhoto: true })}
            className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-card/90 text-destructive shadow"
            aria-label="Remove photo"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="grid aspect-[4/3] w-full place-items-center rounded-xl bg-muted text-muted-foreground">
          <UtensilsCrossed className="size-8" aria-hidden />
        </div>
      )}
      {preview && <Button type="button" variant="outline" className="w-full" onClick={adjust}>Adjust photo</Button>}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border bg-card text-sm font-medium">
          <ImagePlus className="size-4 text-primary" />
          {preview ? "Replace" : "Gallery"}
          <input type="file" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" className="sr-only" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
        </label>
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border bg-card text-sm font-medium">
          <Camera className="size-4 text-primary" />
          Camera
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
    </div>
  );
}

export function RecipeFields({ value, onChange, idPrefix = "r" }: { value: RecipeDraft; onChange: (v: RecipeDraft) => void; idPrefix?: string }) {
  const set = <K extends keyof RecipeDraft>(k: K, v: RecipeDraft[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <RecipePhotoField value={value} onChange={onChange} idPrefix={idPrefix} />
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input id={`${idPrefix}-name`} value={value.name} onChange={(e) => set("name", e.target.value)} className="h-12 rounded-xl" placeholder="e.g. Chicken stir fry" />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Meal type</legend>
        <div className="flex flex-wrap gap-2">
          {MEAL_TYPES.map((m) => (
            <Button key={m} variant={value.meal_types.includes(m) ? "default" : "outline"} type="button" className="min-h-11 rounded-full border px-4 capitalize" data-on={value.meal_types.includes(m)} aria-pressed={value.meal_types.includes(m)} onClick={() => set("meal_types", value.meal_types.includes(m) ? value.meal_types.filter((x) => x !== m) : [...value.meal_types, m])}>
              {m}
            </Button>
          ))}
        </div>
        {!value.meal_types.length && <p role="alert" className="text-sm text-destructive">Select at least one meal type.</p>}
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-ing`}>Ingredients (one per line)</Label>
        <Textarea
          id={`${idPrefix}-ing`}
          rows={5}
          value={value.ingredients.join("\n")}
          onChange={(e) => set("ingredients", e.target.value.split("\n"))}
          className="rounded-xl"
          placeholder={"200 g chicken thighs\n1 onion"}
        />
        <p className="text-xs text-muted-foreground">Leave out salt, oil and spices — they're pantry staples.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-steps`}>Steps (optional)</Label>
        <Textarea id={`${idPrefix}-steps`} rows={3} value={value.steps} onChange={(e) => set("steps", e.target.value)} className="rounded-xl" />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-time`}>Cook time (minutes)</Label>
        <Input
          id={`${idPrefix}-time`}
          type="number"
          min={0}
          inputMode="numeric"
          value={value.cook_time}
          onChange={(e) => {
            const t = Number(e.target.value) || 0;
            onChange({ ...value, cook_time: t, is_quick: t <= 20 ? value.is_quick : false });
          }}
          className="h-12 rounded-xl"
        />
      </div>
      <label className="flex min-h-12 items-center justify-between rounded-xl bg-muted px-4">
        <span className="text-sm font-medium">Quick meal (20 min or less)</span>
        <Switch checked={value.is_quick} onCheckedChange={(c) => set("is_quick", c)} disabled={value.cook_time > 20} />
      </label>
      <label className="flex min-h-12 items-center justify-between rounded-xl bg-muted px-4">
        <span className="text-sm font-medium">Can repeat every week</span>
        <Switch checked={value.can_repeat} onCheckedChange={(c) => set("can_repeat", c)} />
      </label>
    </div>
  );
}

export function cleanDraft(d: RecipeDraft) {
  if (!d.meal_types.length) throw new Error("Select at least one meal type.");
  return {
    name: d.name.trim(),
    ingredients: d.ingredients.map((i) => i.trim()).filter(Boolean),
    steps: d.steps.trim() || null,
    cook_time: Math.max(0, Math.round(d.cook_time)),
    is_quick: d.cook_time <= 20 && d.is_quick,
    can_repeat: d.can_repeat,
    meal_types: [...new Set(d.meal_types)],
  };
}
