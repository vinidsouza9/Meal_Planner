import { describe, expect, it } from 'vitest';
import { PHOTO_SIZES } from '@/lib/photo-crop';
import { cleanDraft, emptyDraft } from '@/components/RecipeFields';
import { DAYS, enforceMealTypes, type PlanJson, type Recipe } from '@/lib/plan';

describe('photo output dimensions', () => {
  it('crops recipes to 4:3 at 1200 pixels wide', () => {
    expect(PHOTO_SIZES.recipe).toEqual({ width: 1200, height: 900, aspect: 4 / 3 });
  });
  it('crops avatars to a 400 pixel square', () => {
    expect(PHOTO_SIZES.avatar).toEqual({ width: 400, height: 400, aspect: 1 });
  });
});
describe('recipe meal tags', () => {
  it('requires at least one selected meal type', () => {
    expect(() => cleanDraft({ ...emptyDraft(), meal_types: [] })).toThrow();
  });
  it('preserves multiple selected meal types', () => {
    expect(cleanDraft({ ...emptyDraft(), meal_types: ['breakfast', 'lunch'] }).meal_types).toEqual(['breakfast', 'lunch']);
  });
  it('removes generated meals in untagged slots, including leftovers', () => {
    const cell = { recipe_id: 'recipe', leftover: false };
    const plan: PlanJson = { days: DAYS.map((day) => ({ day, breakfast: cell, lunch: { ...cell, leftover: true }, dinner: cell })) };
    const recipe = { id: 'recipe', meal_types: ['breakfast', 'dinner'] } as Recipe;
    const result = enforceMealTypes(plan, [recipe]);
    expect(result.days[0]?.breakfast.recipe_id).toBe('recipe');
    expect(result.days[0]?.dinner.recipe_id).toBe('recipe');
    expect(result.days[0]?.lunch).toEqual({ recipe_id: '', leftover: false });
  });
});