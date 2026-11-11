import curry from "@/assets/dish-curry.jpg";
import pasta from "@/assets/dish-pasta.jpg";
import tacos from "@/assets/dish-tacos.jpg";
import oats from "@/assets/dish-oats.jpg";
import salad from "@/assets/dish-salad.jpg";
import soup from "@/assets/dish-soup.jpg";
import bowl from "@/assets/dish-bowl.jpg";
import eggs from "@/assets/dish-eggs.jpg";

/** Keyword groups checked in order; the first match wins. */
const RULES: { photo: string; words: string[] }[] = [
  { photo: soup, words: ["soup", "stew", "chili", "chowder", "broth", "dal", "lentil", "ramen", "pho"] },
  { photo: curry, words: ["curry", "masala", "korma", "tikka", "butter chicken", "vindaloo", "paneer", "biryani"] },
  { photo: pasta, words: ["pasta", "spaghetti", "penne", "noodle", "lasagna", "linguine", "macaroni", "fettuccine", "gnocchi"] },
  { photo: tacos, words: ["taco", "burrito", "enchilada", "quesadilla", "fajita", "nacho", "tortilla", "mexican"] },
  { photo: oats, words: ["oat", "porridge", "granola", "smoothie", "yogurt", "pancake", "waffle", "chia"] },
  { photo: eggs, words: ["egg", "omelet", "omelette", "shakshuka", "frittata", "toast", "breakfast", "avocado"] },
  { photo: salad, words: ["salad", "slaw", "greens", "wrap", "sandwich"] },
  { photo: bowl, words: ["bowl", "rice", "stir fry", "stir-fry", "chicken", "fish", "salmon", "shrimp", "tofu", "beef", "grill"] },
];

/** Pick the most fitting sample photo for a recipe from its name, then its ingredients. */
export function matchDishPhoto(name: string, ingredients: string[] = []): string {
  const title = name.toLowerCase();
  const all = `${title} ${ingredients.join(" ").toLowerCase()}`;
  for (const text of [title, all]) {
    const hit = RULES.find((r) => r.words.some((w) => text.includes(w)));
    if (hit) return hit.photo;
  }
  return bowl;
}
