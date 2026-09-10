import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/appError";
import { bindEmployeeCredential, type EmployeeCredential } from "./employeeCredential";

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

  const credential: EmployeeCredential = { token: null, generation: 0 };
  const client = createClient(url, anonKey, {
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      const requestUrl = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (requestUrl.origin === new URL(url).origin && requestUrl.pathname.startsWith("/rest/v1/") && credential.token && !headers.has("x-pos-employee-token")) headers.set("x-pos-employee-token", credential.token);
      return fetch(input, { ...init, headers });
    } },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  bindEmployeeCredential(client, credential);
  let storeId: string | undefined;
  client.auth.onAuthStateChange((event, session) => {
    const nextStoreId = session?.user.id;
    if (event === "SIGNED_OUT" || nextStoreId !== storeId) { credential.token = null; credential.generation++; }
    storeId = nextStoreId;
  });
  return client;
};
