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
  meal_type: MealType;
};

export const emptyDraft = (): RecipeDraft => ({
  name: "",
  ingredients: [],
  steps: "",
  cook_time: 30,
  is_quick: false,
  can_repeat: false,
  meal_type: "any",
});

export function RecipeFields({ value, onChange, idPrefix = "r" }: { value: RecipeDraft; onChange: (v: RecipeDraft) => void; idPrefix?: string }) {
  const set = <K extends keyof RecipeDraft>(k: K, v: RecipeDraft[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input id={`${idPrefix}-name`} value={value.name} onChange={(e) => set("name", e.target.value)} className="h-12 rounded-xl" placeholder="e.g. Chicken stir fry" />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Meal type</legend>
        <div className="flex flex-wrap gap-2">
          {MEAL_TYPES.map((m) => (
            <button key={m} type="button" className="chip capitalize" data-on={value.meal_type === m} aria-pressed={value.meal_type === m} onClick={() => set("meal_type", m)}>
              {m}
            </button>
          ))}
        </div>
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
  return {
    name: d.name.trim(),
    ingredients: d.ingredients.map((i) => i.trim()).filter(Boolean),
    steps: d.steps.trim() || null,
    cook_time: Math.max(0, Math.round(d.cook_time)),
    is_quick: d.cook_time <= 20 && d.is_quick,
    can_repeat: d.can_repeat,
    meal_type: d.meal_type,
  };
}
