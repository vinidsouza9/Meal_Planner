import { supabase } from "@/integrations/supabase/client";
import type { CheckInAnswers, PlanJson, Recipe } from "./plan";
import { signImagePaths } from "./recipe-images";

export type PlanRow = {
  id: string;
  week_start: string;
  plan_json: PlanJson;
  locked: string[];
  answers: CheckInAnswers | null;
};

type PlanSelect = { id: string; week_start: string; plan_json: unknown; locked: unknown; check_ins: { answers: CheckInAnswers } | null };

const toPlanRow = (data: PlanSelect): PlanRow => ({
  id: data.id,
  week_start: data.week_start,
  plan_json: data.plan_json as PlanJson,
  locked: (data.locked as string[]) ?? [],
  answers: data.check_ins?.answers ?? null,
});

const PLAN_SELECT = "id, week_start, plan_json, locked, check_ins(answers)";

export const latestPlanQuery = {
  queryKey: ["plan", "latest"],
  queryFn: async (): Promise<PlanRow | null> => {
    const { data, error } = await supabase
      .from("plans")
      .select(PLAN_SELECT)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? toPlanRow(data as unknown as PlanSelect) : null;
  },
};

/** Plan for a specific week (latest saved for that week_start). */
export const planForWeekQuery = (weekStart: string) => ({
  queryKey: ["plan", "week", weekStart],
  queryFn: async (): Promise<PlanRow | null> => {
    const { data, error } = await supabase
      .from("plans")
      .select(PLAN_SELECT)
      .eq("week_start", weekStart)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? toPlanRow(data as unknown as PlanSelect) : null;
  },
});

/** Most recent saved plans, newest week first (for History). */
export const recentPlansQuery = (limit: number) => ({
  queryKey: ["plans", "recent", limit],
  queryFn: async (): Promise<PlanRow[]> => {
    const { data, error } = await supabase
      .from("plans")
      .select(PLAN_SELECT)
      .order("week_start", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as unknown as PlanSelect[]).map(toPlanRow);
  },
});

export const allRecipesQuery = {
  queryKey: ["recipes"],
  queryFn: async () => {
    const { data, error } = await supabase.from("recipes").select("*").order("name");
    if (error) throw error;
    const recipes = data as Recipe[];
    const signed = await signImagePaths(recipes.map((r) => r.image_url).filter((p): p is string => !!p));
    return recipes.map((r) => ({ ...r, imageSrc: r.image_url ? (signed.get(r.image_url) ?? null) : null }));
  },
};
