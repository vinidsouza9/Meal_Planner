import { describe, expect, it } from "vitest";
import { FREE_AI_USES, isAiLimitError } from "@/lib/ai-usage";
import { matchDishPhoto } from "@/lib/dish-photos";

describe("AI free uses", () => {
  it("gives every user 3 free AI uses", () => expect(FREE_AI_USES).toBe(3));
  it("recognises the limit error", () => {
    expect(isAiLimitError(new Error("You've used all 3 free AI uses. [AI_LIMIT]"))).toBe(true);
    expect(isAiLimitError(new Error("AI is busy [AI_429]"))).toBe(false);
  });
});

describe("dish photo matching", () => {
  it("matches by name before ingredients", () => {
    expect(matchDishPhoto("Lentil soup", ["chicken"])).toBe(matchDishPhoto("Tomato soup"));
    expect(matchDishPhoto("Lentil soup")).not.toBe(matchDishPhoto("Chicken tacos"));
  });
  it("falls back to a photo for unknown dishes", () => expect(matchDishPhoto("Mystery dish")).toBeTruthy());
});
