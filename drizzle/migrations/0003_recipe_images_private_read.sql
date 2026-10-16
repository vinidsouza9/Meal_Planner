DROP POLICY "Anyone can read recipe images" ON storage.objects;

CREATE POLICY "Users read their own recipe images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'recipe-images' AND (storage.foldername(name))[1] = auth.uid()::text);