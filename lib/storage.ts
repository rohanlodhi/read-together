import { createClient } from "@/lib/supabase/server";

const BUCKET = "books";

export async function signedUrl(path: string, expiresIn = 3600) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function signedUrls(paths: string[], expiresIn = 3600) {
  const cleaned = Array.from(new Set(paths.filter(Boolean)));
  if (cleaned.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(cleaned, expiresIn);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  }
  return map;
}

export const STORAGE_BUCKET = BUCKET;
