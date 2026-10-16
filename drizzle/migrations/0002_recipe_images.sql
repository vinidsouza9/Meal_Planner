ALTER TABLE public.recipes ADD COLUMN image_url text;

CREATE POLICY "Anyone can read recipe images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'recipe-images');

CREATE POLICY "Users upload their own recipe images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update their own recipe images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete their own recipe images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = auth.uid()::text);