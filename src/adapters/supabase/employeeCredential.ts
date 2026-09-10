import type { SupabaseClient } from "@supabase/supabase-js";

// One credential per client instance. Never persisted alongside the store JWT.
export type EmployeeCredential = { token: string | null; generation: number };
const credentials = new WeakMap<SupabaseClient, EmployeeCredential>();
export const employeeCredential = (client: SupabaseClient): EmployeeCredential => {
  let credential = credentials.get(client);
  if (!credential) { credential = { token: null, generation: 0 }; credentials.set(client, credential); }
  return credential;
};
export const bindEmployeeCredential = (client: SupabaseClient, credential: EmployeeCredential): void => { credentials.set(client, credential); };
export const clearEmployeeCredential = (client: SupabaseClient): void => {
  const credential = employeeCredential(client);
  credential.token = null;
  credential.generation++;
};
