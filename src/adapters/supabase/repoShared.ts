
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/appError";
import { requireData, throwIfError } from "./errors";

export type SupabaseAnyClient = SupabaseClient;
export type TableRow = Record<string, unknown>;

export const stripUndefined = (row: TableRow): TableRow =>
  Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));

export const requireStoreId = async (client: SupabaseAnyClient): Promise<string> => {
  const { data, error } = await client.auth.getSession();
  throwIfError(error, "AUTH_REQUIRED");

  const storeId = data.session?.user.id;

  if (!storeId) {
    throw new AppError("AUTH_REQUIRED", "Phiên cửa hàng không hợp lệ.");
  }

  return storeId;
};

export const hashPin = async (client: SupabaseAnyClient, pin: string): Promise<string> => {
  const { data, error } = await client.rpc("hash_employee_pin", { p_pin: pin });
  return requireData<string>(data as string | null, error);
};

export const insertRows = async (client: SupabaseAnyClient, table: string, rows: TableRow[]): Promise<void> => {
  if (rows.length === 0) {
    return;
  }

  const { error } = await client.from(table).insert(rows);
  throwIfError(error);
};

export const upsertRows = async (client: SupabaseAnyClient, table: string, rows: TableRow[]): Promise<void> => {
  if (rows.length === 0) {
    return;
  }

  const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
  throwIfError(error);
};

export const updateRow = async (client: SupabaseAnyClient, table: string, id: string, row: TableRow): Promise<void> => {
  const update = stripUndefined(row);

  if (Object.keys(update).length === 0) {
    return;
  }

  const { error } = await client.from(table).update(update).eq("id", id);
  throwIfError(error);
};

export const tombstoneRow = async (
  client: SupabaseAnyClient,
  table: string,
  id: string,
  deletedByEmployeeId?: string | null,
): Promise<void> => {
  const { error } = await client
    .from(table)
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by_employee_id: deletedByEmployeeId ?? null,
    })
    .eq("id", id);
  throwIfError(error);
};
