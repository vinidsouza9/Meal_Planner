import { supabase } from "@/integrations/supabase/client";

const BUCKET = "recipe-images";

/** Upload a resized image blob; returns the storage path to save on the recipe row. */
export async function uploadRecipeImage(blob: Blob, userId: string): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("Couldn't upload the photo.");
  return path;
}

export async function removeRecipeImage(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}

/** Batch-sign storage paths into short-lived URLs for display. */
export async function signImagePaths(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unique, 3600);
  data?.forEach((r) => {
    if (r.path && r.signedUrl) map.set(r.path, r.signedUrl);
  });
  return map;
}
