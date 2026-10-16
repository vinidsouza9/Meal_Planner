import { supabase } from "@/integrations/supabase/client";

const BUCKET = "recipe-images";

/** Upload a resized image blob; returns the storage path to save on the recipe row. */
export async function uploadRecipeImage(blob: Blob, userId: string): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("Couldn't upload the photo.");
  return path;
}

/** Stage uploads without deleting old photos until the recipe row saves successfully. */
export async function prepareRecipePhoto(draft: { photoBlob?: Blob | null; originalBlob?: Blob | null; removePhoto?: boolean; image_crop?: import('./photo-crop').PhotoCrop | null }, previous: { image_url?: string | null; original_image_url?: string | null }) {
  const uploaded: string[] = [];
  let image_url = previous.image_url ?? null;
  let original_image_url = previous.original_image_url ?? previous.image_url ?? null;
  try {
    if (draft.removePhoto) { image_url = null; original_image_url = null; }
    else if (draft.photoBlob) {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('Please log in again.');
      image_url = await uploadRecipeImage(draft.photoBlob, data.user.id); uploaded.push(image_url);
      if (draft.originalBlob) { original_image_url = await uploadRecipeImage(draft.originalBlob, data.user.id); uploaded.push(original_image_url); }
    }
  } catch (e) { await Promise.all(uploaded.map(removeRecipeImage)); throw e; }
  return {
    row: { image_url, original_image_url, image_crop: draft.removePhoto ? null : draft.image_crop ?? null },
    rollback: () => Promise.all(uploaded.map(removeRecipeImage)),
    commit: () => Promise.all([...new Set([previous.image_url, previous.original_image_url])].filter((path): path is string => !!path && path !== image_url && path !== original_image_url).map(removeRecipeImage)),
  };
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
