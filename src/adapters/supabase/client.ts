import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/appError";

export type SupabaseEnv = {
  url?: string;
  anonKey?: string;
};

export const createSupabaseBrowserClient = (env: SupabaseEnv = {}): SupabaseClient => {
  const url = env.url ?? import.meta.env.VITE_SUPABASE_URL;
  const anonKey = env.anonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new AppError("AUTH_REQUIRED", "Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.");
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
};
