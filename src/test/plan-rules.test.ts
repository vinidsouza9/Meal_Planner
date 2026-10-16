import { describe, expect, it } from "vitest";
import { DAYS, swapCells, groceryText, type PlanJson } from "@/lib/plan";

const c = (id: string) => ({ recipe_id: id, leftover: false });
const plan: PlanJson = {
  days: DAYS.map((day, i) => ({ day, breakfast: c(`b${i}`), lunch: c(`l${i}`), dinner: c(`d${i}`) })),
};

describe("drag and drop swaps", () => {
  it("swaps two dinners", () => {
    const out = swapCells(plan, [], { day: "Mon", meal: "dinner" }, { day: "Wed", meal: "dinner" })!;
    expect(out.days[0]!.dinner.recipe_id).toBe("d2");
    expect(out.days[2]!.dinner.recipe_id).toBe("d0");
  });
  it("refuses to swap across meal types", () => {
    expect(swapCells(plan, [], { day: "Mon", meal: "lunch" }, { day: "Tue", meal: "dinner" })).toBeNull();
  });
  it("refuses to move a locked meal", () => {
    expect(swapCells(plan, ["Tue-dinner"], { day: "Mon", meal: "dinner" }, { day: "Tue", meal: "dinner" })).toBeNull();
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
