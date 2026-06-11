import { createMockPorts } from "@/adapters/mock";
import { createSupabaseBrowserClient, createSupabasePorts } from "@/adapters/supabase";
import type { AppPorts } from "@/ports";

export type AppDataMode = "mock" | "supabase";

export type RuntimePortEnv = {
  mode?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const hasSupabaseEnv = (env: RuntimePortEnv): boolean => Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const resolveAppDataMode = (env: RuntimePortEnv): AppDataMode => {
  if (env.mode === "mock" || env.mode === "supabase") {
    return env.mode;
  }

  return hasSupabaseEnv(env) ? "supabase" : "mock";
};

export const createAppPorts = (env: RuntimePortEnv = {}): AppPorts => {
  const mode = resolveAppDataMode(env);

  if (mode === "supabase") {
    return createSupabasePorts(
      createSupabaseBrowserClient({
        url: env.supabaseUrl,
        anonKey: env.supabaseAnonKey,
      }),
    );
  }

  return createMockPorts();
};

export const createAppPortsFromViteEnv = (): AppPorts =>
  createAppPorts({
    mode: import.meta.env.VITE_DATA_MODE,
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  });
