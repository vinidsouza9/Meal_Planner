import { jsPDF } from "jspdf";
import { AISLES, DAYS, MEALS, dayDateLabel, weekRangeLabel, type GroceryItem, type PlanJson, type Recipe } from "./plan";

// Soft pastels that also print as light greys in black and white.
const PASTELS: [number, number, number][] = [
  [253, 232, 222], // pale peach
  [226, 242, 230], // mint
  [253, 246, 214], // butter yellow
  [236, 232, 247], // lavender
];
const INK: [number, number, number] = [60, 60, 60];
const GREY: [number, number, number] = [130, 130, 130];
const GREEN: [number, number, number] = [74, 124, 89];

function doc() {
  return new jsPDF({ unit: "pt", format: "letter" });
}

function header(d: jsPDF, title: string, subtitle: string) {
  const W = d.internal.pageSize.getWidth();
  const mint = PASTELS[1]!;
  d.setFillColor(mint[0], mint[1], mint[2]);
  d.roundedRect(32, 32, W - 64, 64, 14, 14, "F");
  d.setFont("times", "bold");
  d.setFontSize(22);
  d.setTextColor(...INK);
  d.text(title, 52, 62);
  d.setFont("helvetica", "normal");
  d.setFontSize(11);
  d.setTextColor(...GREY);
  d.text(subtitle, 52, 82);
}

/** Weekly plan PDF: one portrait page, pastel day rows, dates next to each day. */
export function buildPlanPdf(plan: PlanJson, recipes: Recipe[], weekStart: string): File {
  const d = doc();
  const W = d.internal.pageSize.getWidth();
  const range = weekRangeLabel(weekStart);
  header(d, "Meal Planner", `Week of ${range}`);

  const byId = new Map(recipes.map((r) => [r.id, r]));
  const shownDays = DAYS.filter((day) => plan.days.some((x) => x.day === day));
  const top = 116;
  const rowH = Math.min(76, (d.internal.pageSize.getHeight() - top - 48) / Math.max(shownDays.length, 1));
  const colW = (W - 64 - 92) / MEALS.length;

  // Column headers
  d.setFont("helvetica", "bold");
  d.setFontSize(9);
  d.setTextColor(...GREY);
  MEALS.forEach((m, i) => {
    d.text(m.toUpperCase(), 32 + 92 + i * colW + 10, top - 8);
  });

  shownDays.forEach((day, r) => {
    const y = top + r * rowH;
    const pastel = PASTELS[r % PASTELS.length]!;
    d.setFillColor(pastel[0], pastel[1], pastel[2]);
    d.roundedRect(32, y, W - 64, rowH - 8, 10, 10, "F");

    // Day + date
    d.setFont("helvetica", "bold");
    d.setFontSize(10);
    d.setTextColor(...INK);
    const [dayName, date] = dayDateLabel(weekStart, day).split(", ");
    d.text(dayName!, 42, y + 20);
    d.setFont("helvetica", "normal");
    d.setFontSize(9);
    d.setTextColor(...GREY);
    d.text(date!, 42, y + 33);
    // Small plate icon: circle + inner circle
    d.setDrawColor(...GREY);
    d.setLineWidth(0.8);
    d.circle(58, y + rowH - 26, 7, "S");
    d.circle(58, y + rowH - 26, 3.5, "S");

    const row = plan.days.find((x) => x.day === day);
    MEALS.forEach((m, i) => {
      const x = 32 + 92 + i * colW + 10;
      const c = row?.[m];
      d.setFont("helvetica", "normal");
      d.setFontSize(10);
      d.setTextColor(...INK);
      if (!c?.recipe_id) {
        d.setTextColor(...GREY);
        d.text("—", x, y + 22);
        return;
      }
      const name = byId.get(c.recipe_id)?.name ?? "Removed recipe";
      const lines = d.splitTextToSize(name, colW - 18) as string[];
      d.text(lines.slice(0, 2), x, y + 22);
      if (c.leftover) {
        d.setFontSize(8);
        d.setTextColor(...GREEN);
        d.text("Leftovers", x, y + 22 + lines.slice(0, 2).length * 12);
      }
    });
  });

  d.setFont("helvetica", "normal");
  d.setFontSize(8);
  d.setTextColor(...GREY);
  d.text("Made with Meal Planner", 32, d.internal.pageSize.getHeight() - 24);

  return new File([d.output("blob")], `meal-plan-${weekStart}.pdf`, { type: "application/pdf" });
}

/** Grocery list PDF: title, week range, household size, aisles with checkboxes. */
export function buildGroceryPdf(items: GroceryItem[], weekStart: string, people: number): File {
  const d = doc();
  const W = d.internal.pageSize.getWidth();
  const H = d.internal.pageSize.getHeight();
  header(d, "Grocery list", `Week of ${weekRangeLabel(weekStart)} · for ${people} ${people === 1 ? "person" : "people"}`);

  const colW = (W - 64 - 24) / 2;
  const colX: [number, number] = [32, 32 + colW + 24];
  const colY: [number, number] = [116, 116];

  const unchecked = items.filter((i) => !i.checked);
  const list = unchecked.length ? unchecked : items;

  AISLES.forEach((aisle) => {
    const rows = list.filter((i) => i.aisle === aisle);
    if (!rows.length) return;
    let col = colY[0] <= colY[1] ? 0 : 1;
    let y = colY[col]!;
    const need = 22 + rows.length * 16;
    if (y + need > H - 40 && col === 0) {
      col = 1;
      y = colY[1]!;
    }
    const x = colX[col]! as number;
    d.setFont("helvetica", "bold");
    d.setFontSize(10);
    d.setTextColor(...GREEN);
    d.text(aisle.toUpperCase(), x, y);
    d.setDrawColor(200, 200, 200);
    d.setLineWidth(0.6);
    d.line(x, y + 5, x + colW, y + 5);
    y += 20;
    d.setFont("helvetica", "normal");
    d.setFontSize(10);
    rows.forEach((i) => {
      if (y > H - 40) return;
      d.setDrawColor(...GREY);
      d.setLineWidth(0.8);
      d.rect(x, y - 8, 9, 9, "S");
      d.setTextColor(...INK);
      const name = d.splitTextToSize(i.name, colW - 90) as string[];
      d.text(name[0]!, x + 16, y);
      d.setTextColor(...GREY);
      d.setFontSize(9);
      d.text(i.qty, x + colW - d.getTextWidth(i.qty), y);
      d.setFontSize(10);
      y += 16;
    });
    colY[col] = y + 14;
  });

  d.setFont("helvetica", "normal");
  d.setFontSize(8);
  d.setTextColor(...GREY);
  d.text("Made with Meal Planner", 32, H - 24);

  return new File([d.output("blob")], `grocery-list-${weekStart}.pdf`, { type: "application/pdf" });
}
