import { describe, expect, it } from "vitest";
import { DAYS, cookingRecipe, currentCookingSlot, dayDateLabel, groceryText, longDinnerOnBusyDay, shiftWeek, swapCells, weekRangeLabel, type CheckInAnswers, type PlanJson, type Recipe } from "@/lib/plan";

const c = (id: string) => ({ recipe_id: id, leftover: false });

describe("today's cooking slot", () => {
  it("uses the local weekday", () => {
    expect(currentCookingSlot(new Date(2026, 9, 16, 15, 23))).toEqual({ day: "Fri", meal: "lunch" });
  });
  it("selects breakfast before 11", () => {
    expect(currentCookingSlot(new Date(2026, 9, 16, 10, 59)).meal).toBe("breakfast");
  });
  it("selects lunch from 11 until 16", () => {
    expect(currentCookingSlot(new Date(2026, 9, 16, 11, 0)).meal).toBe("lunch");
    expect(currentCookingSlot(new Date(2026, 9, 16, 15, 59)).meal).toBe("lunch");
  });
  it("selects dinner from 16 onward", () => {
    expect(currentCookingSlot(new Date(2026, 9, 16, 16, 0)).meal).toBe("dinner");
    expect(currentCookingSlot(new Date(2026, 9, 16, 23, 59)).meal).toBe("dinner");
  });
  it("shows Green Chicken from the displayed calendar's Friday dinner", () => {
    const displayedPlan: PlanJson = { days: [{ day: "Fri", breakfast: c(""), lunch: c("butter"), dinner: c("green") }] };
    const recipes = [{ id: "green", name: "Green Chicken", cook_time: 35 }, { id: "butter", name: "Butter Chicken", cook_time: 40 }] as Recipe[];
    const result = cookingRecipe(displayedPlan, recipes, currentCookingSlot(new Date(2026, 9, 16, 16, 0)));
    expect(result?.name).toBe("Green Chicken");
    expect(result?.cook_time).toBe(35);
  });
});
const plan: PlanJson = {
  days: DAYS.map((day, i) => ({ day, breakfast: c(`b${i}`), lunch: c(`l${i}`), dinner: c(`d${i}`) })),
};

describe("drag and drop swaps", () => {
  it("swaps two dinners", () => {
    const out = swapCells(plan, [], { day: "Mon", meal: "dinner" }, { day: "Wed", meal: "dinner" })!;
    expect(out.days[0]!.dinner.recipe_id).toBe("d2");
    expect(out.days[2]!.dinner.recipe_id).toBe("d0");
  });
  it("swaps across meal types within the same day", () => {
    const out = swapCells(plan, [], { day: "Mon", meal: "breakfast" }, { day: "Mon", meal: "dinner" })!;
    expect(out.days[0]!.breakfast.recipe_id).toBe("d0");
    expect(out.days[0]!.dinner.recipe_id).toBe("b0");
  });
  it("swaps across days and meal types", () => {
    const out = swapCells(plan, [], { day: "Mon", meal: "lunch" }, { day: "Tue", meal: "dinner" })!;
    expect(out.days[0]!.lunch.recipe_id).toBe("d1");
    expect(out.days[1]!.dinner.recipe_id).toBe("l0");
  });
  it("refuses to swap a cell with itself", () => {
    expect(swapCells(plan, [], { day: "Mon", meal: "dinner" }, { day: "Mon", meal: "dinner" })).toBeNull();
  });
  it("refuses to move a locked meal", () => {
    expect(swapCells(plan, ["Tue-dinner"], { day: "Mon", meal: "dinner" }, { day: "Tue", meal: "dinner" })).toBeNull();
  });
});

describe("busy-day dinner warning", () => {
  const answers = { busyDays: ["Tue"] } as CheckInAnswers;
  const long = { cook_time: 45 } as Recipe;
  const quick = { cook_time: 15 } as Recipe;
  it("warns when a long recipe lands in dinner on a busy day", () => {
    expect(longDinnerOnBusyDay(answers, long, "Tue", "dinner")).toBe(true);
  });
  it("stays quiet for quick recipes, other meals, and calm days", () => {
    expect(longDinnerOnBusyDay(answers, quick, "Tue", "dinner")).toBe(false);
    expect(longDinnerOnBusyDay(answers, long, "Tue", "lunch")).toBe(false);
    expect(longDinnerOnBusyDay(answers, long, "Wed", "dinner")).toBe(false);
  });
});

describe("week labels", () => {
  it("shifts by whole weeks", () => {
    expect(shiftWeek("2026-10-19", 1)).toBe("2026-10-26");
    expect(shiftWeek("2026-10-19", -1)).toBe("2026-10-12");
  });
  it("formats the week range", () => {
    expect(weekRangeLabel("2026-10-19")).toBe("Oct 19 – 25, 2026");
  });
  it("formats a day with its date", () => {
    expect(dayDateLabel("2026-10-19", "Mon")).toBe("Mon, Oct 19");
    expect(dayDateLabel("2026-10-19", "Sun")).toBe("Sun, Oct 25");
  });
});

describe("grocery share text", () => {
  it("groups by aisle and skips checked items", () => {
    const t = groceryText([
      { name: "Onion", qty: "2", aisle: "Produce", checked: false },
      { name: "Milk", qty: "1 l", aisle: "Dairy", checked: true },
    ]);
    expect(t).toBe("Produce\n- Onion (2)");
  });
});
