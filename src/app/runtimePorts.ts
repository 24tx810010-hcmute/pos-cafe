import { createMockPermissionRuntime, createMockPermissionState } from "@/adapters/mock";
import { createSupabaseBrowserClient, createSupabasePorts } from "@/adapters/supabase";
import type { AppPorts } from "@/ports";
import { usePermissionSession } from "@/features/shared/permissionSession";

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
        isCompatibilityBlocked: () => usePermissionSession.getState().compatibilityBlocked,
      }), env.supabaseUrl,
    );
  }

  const state = createMockPermissionState({ demoCredentials: true });
  state.paired = false;
  const runtime = createMockPermissionRuntime(state);
  return {
    permission: {
      authority: runtime.authority,
      employeeAdmin: runtime.employeeAdmin,
      read: runtime.read,
      session: runtime.session,
      initialSeed: runtime.initialSeed,
      changes: runtime.changes,
      signals: runtime.signals,
      menuImages: runtime.menuImages,
      print: runtime.print,
    },
    write: runtime.write,
    auth: runtime.auth,
    seed: runtime.seed,
    print: runtime.legacyPrint,
  };
};

let viteEnvPorts: AppPorts | null = null;

export const createAppPortsFromViteEnv = (): AppPorts =>
  (viteEnvPorts ??= createAppPorts({
    mode: import.meta.env.VITE_DATA_MODE,
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  }));
