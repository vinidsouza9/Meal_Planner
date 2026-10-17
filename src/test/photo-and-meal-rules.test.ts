import { describe, expect, it } from 'vitest';
import { PHOTO_SIZES } from '@/lib/photo-crop';
import { cleanDraft, emptyDraft } from '@/components/RecipeFields';
import { DAYS, enforceMealTypes, swapCells, varietyNotes, type PlanJson, type Recipe } from '@/lib/plan';

describe('photo output dimensions', () => {
  it('crops recipes to 4:3 at 1200 pixels wide', () => {
    expect(PHOTO_SIZES.recipe).toEqual({ width: 1200, height: 900, aspect: 4 / 3 });
  });
  it('crops avatars to a 400 pixel square', () => {
    expect(PHOTO_SIZES.avatar).toEqual({ width: 400, height: 400, aspect: 1 });
  });
});
describe('recipe meal tags', () => {
  it('defaults manual recipes to dinner only', () => {
    expect(emptyDraft().meal_types).toEqual(['dinner']);
  });
  it('requires at least one selected meal type', () => {
    expect(() => cleanDraft({ ...emptyDraft(), meal_types: [] })).toThrow();
  });
  it('preserves multiple selected meal types', () => {
    expect(cleanDraft({ ...emptyDraft(), meal_types: ['breakfast', 'lunch'] }).meal_types).toEqual(['breakfast', 'lunch']);
  });
  it('shows a clear error when no tagged replacement exists', () => {
    const cell = { recipe_id: 'recipe', leftover: false };
    const plan: PlanJson = { days: DAYS.map((day) => ({ day, breakfast: cell, lunch: { ...cell, leftover: true }, dinner: cell })) };
    const recipe = { id: 'recipe', meal_types: ['breakfast', 'dinner'] } as Recipe;
    expect(() => enforceMealTypes(plan, [recipe])).toThrow('Add a lunch recipe');
  });
  it('repairs wrong slots using a tagged replacement and drops leftovers', () => {
    const cell = { recipe_id: 'toast', leftover: true };
    const plan: PlanJson = { days: DAYS.map(day => ({ day, breakfast: cell, lunch: cell, dinner: cell })) };
    const recipes = [{ id: 'toast', meal_types: ['breakfast'] }, { id: 'chicken', meal_types: ['lunch', 'dinner'] }] as Recipe[];
    expect(enforceMealTypes(plan, recipes).days[0]?.lunch).toEqual({ recipe_id: 'chicken', leftover: false });
  });
  it('blocks a drag swap into an untagged meal', () => {
    const empty = { recipe_id: '', leftover: false };
    const plan: PlanJson = { days: [{ day: 'Mon', breakfast: { recipe_id: 'toast', leftover: false }, lunch: empty, dinner: { recipe_id: 'chicken', leftover: false } }] };
    const recipes = [{ id: 'toast', meal_types: ['breakfast'] }, { id: 'chicken', meal_types: ['dinner'] }] as Recipe[];
    expect(swapCells(plan, [], { day: 'Mon', meal: 'breakfast' }, { day: 'Mon', meal: 'dinner' }, recipes)).toBeNull();
  });
  it('notes variety when only one breakfast recipe exists', () => {
    expect(varietyNotes([{ id: 'toast', meal_types: ['breakfast'] }] as Recipe[], ['breakfast'])).toHaveLength(1);
  });
});