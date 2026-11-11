CREATE TABLE public.ai_usage (
  user_id uuid PRIMARY KEY,
  free_limit integer NOT NULL DEFAULT 3,
  used integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own usage" ON public.ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.ai_uses_left()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT GREATEST(free_limit - used, 0) FROM public.ai_usage WHERE user_id = auth.uid()), 3)
$$;

CREATE OR REPLACE FUNCTION public.consume_ai_use()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE left_now integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  INSERT INTO public.ai_usage(user_id) VALUES (auth.uid()) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.ai_usage SET used = used + 1, updated_at = now()
    WHERE user_id = auth.uid() AND used < free_limit
    RETURNING free_limit - used INTO left_now;
  IF left_now IS NULL THEN RAISE EXCEPTION 'AI_LIMIT'; END IF;
  RETURN left_now;
END $$;

REVOKE EXECUTE ON FUNCTION public.ai_uses_left() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.consume_ai_use() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ai_uses_left() TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_use() TO authenticated;