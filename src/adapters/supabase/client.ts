import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/appError";
import { writeError } from "@/core/writeErrors";
import { bindEmployeeCredential, type EmployeeCredential } from "./employeeCredential";

export type SupabaseEnv = {
  url?: string;
  anonKey?: string;
  isCompatibilityBlocked?: () => boolean;
};

export const PERMISSION_CONTRACT_HEADER = "x-pos-permission-contract";

/** Attach the candidate marker only to this project's PostgREST surface. */
export const createPermissionContractFetch = (supabaseUrl: string, fetchImpl: typeof fetch = fetch,
  isCompatibilityBlocked: () => boolean = () => false): typeof fetch => {
  const configuredOrigin = new URL(supabaseUrl).origin;
  return (input, init) => {
    const requestUrl = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (requestUrl.origin === configuredOrigin && isCompatibilityBlocked()) return Promise.reject(writeError("WRITE_PROTOCOL_UNSUPPORTED"));
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (requestUrl.origin === configuredOrigin && requestUrl.pathname.startsWith("/rest/v1/")) {
      headers.set(PERMISSION_CONTRACT_HEADER, "2");
    } else {
      headers.delete(PERMISSION_CONTRACT_HEADER);
    }
    return fetchImpl(input, { ...init, headers });
  };
};

export const createSupabaseBrowserClient = (env: SupabaseEnv = {}): SupabaseClient => {
  const url = env.url ?? import.meta.env.VITE_SUPABASE_URL;
  const anonKey = env.anonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new AppError("AUTH_REQUIRED", "Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY.");
  }

  const credential: EmployeeCredential = { token: null, generation: 0 };
  const contractFetch = createPermissionContractFetch(url, fetch, env.isCompatibilityBlocked);
  const client = createClient(url, anonKey, {
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      const requestUrl = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (requestUrl.origin === new URL(url).origin && requestUrl.pathname.startsWith("/rest/v1/") && credential.token && !headers.has("x-pos-employee-token")) headers.set("x-pos-employee-token", credential.token);
      return contractFetch(input, { ...init, headers });
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
