import { supabase } from "@/integrations/supabase/client";
import type { CheckInAnswers, PlanJson, Recipe } from "./plan";

export type PlanRow = {
  id: string;
  week_start: string;
  plan_json: PlanJson;
  locked: string[];
  answers: CheckInAnswers | null;
};

export const latestPlanQuery = {
  queryKey: ["plan", "latest"],
  queryFn: async (): Promise<PlanRow | null> => {
    const { data, error } = await supabase
      .from("plans")
      .select("id, week_start, plan_json, locked, check_ins(answers)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const ci = (data as unknown as { check_ins: { answers: CheckInAnswers } | null }).check_ins;
    return {
      id: data.id,
      week_start: data.week_start,
      plan_json: data.plan_json as unknown as PlanJson,
      locked: (data.locked as unknown as string[]) ?? [],
      answers: ci?.answers ?? null,
    };
  },
};

export const allRecipesQuery = {
  queryKey: ["recipes"],
  queryFn: async () => {
    const { data, error } = await supabase.from("recipes").select("*").order("name");
    if (error) throw error;
    return data as Recipe[];
  },
};
