import { supabase } from "@/integrations/supabase/client";

export const FREE_AI_USES = 3;
export const aiUsesQuery = {
  queryKey: ["ai-uses"],
  queryFn: async (): Promise<number> => {
    const { data, error } = await supabase.rpc("ai_uses_left");
    if (error) throw error;
    return data ?? 0;
  },
};
export const isAiLimitError = (e: unknown) => e instanceof Error && e.message.includes("[AI_LIMIT]");
