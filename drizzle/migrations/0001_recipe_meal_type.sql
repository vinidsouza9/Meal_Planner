ALTER TABLE public.recipes ADD COLUMN meal_type text NOT NULL DEFAULT 'any';
ALTER TABLE public.recipes ADD CONSTRAINT recipes_meal_type_check CHECK (meal_type IN ('breakfast','lunch','dinner','any'));
UPDATE public.recipes SET meal_type = 'any';