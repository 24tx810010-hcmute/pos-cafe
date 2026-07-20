
import type { IEmployeeRepo } from "@/ports";
import type { Employee, EmployeeInput, EmployeeUpdate } from "@/domain";
import { requireData, throwIfError } from "./errors";
import { mapEmployee, type Row } from "./mappers";
import { hashPin, requireStoreId, stripUndefined, type SupabaseAnyClient } from "./repoShared";

export class SupabaseEmployeeRepo implements IEmployeeRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async listEmployees(): Promise<Employee[]> {
    const { data, error } = await this.client
      .from("employees")
      .select("id,name,role,is_active,permission_overrides")
      .order("name");
    throwIfError(error);
    return ((data ?? []) as Row[]).map(mapEmployee);
  }

  async listActiveEmployees(): Promise<Employee[]> {
    const { data, error } = await this.client
      .from("employees")
      .select("id,name,role,is_active,permission_overrides")
      .eq("is_active", true)
      .order("name");
    throwIfError(error);
    return ((data ?? []) as Row[]).map(mapEmployee);
  }

  async verifyPin(employeeId: string, pin: string): Promise<Employee> {
    const { data, error } = await this.client.rpc("verify_employee_pin", {
      p_employee_id: employeeId,
      p_pin: pin,
    });
    throwIfError(error, "INVALID_PIN");

    const row = Array.isArray(data) ? data[0] : data;
    return { ...mapEmployee(requireData<Row>(row as Row | null, null)), isActive: true };
  }

  async createEmployee(input: EmployeeInput): Promise<Employee> {
    const storeId = await requireStoreId(this.client);
    const passcodeHash = await hashPin(this.client, input.pin);
    const { data, error } = await this.client
      .from("employees")
      .insert({
        id: input.id,
        store_id: storeId,
        name: input.name,
        role: input.role,
        passcode_hash: passcodeHash,
        is_active: true,
      })
      .select("id,name,role,is_active,permission_overrides")
      .single();
    return mapEmployee(requireData<Row>(data as Row | null, error));
  }

  async updateEmployee(input: EmployeeUpdate): Promise<Employee> {
    const { data, error } = await this.client
      .from("employees")
      .update(
        stripUndefined({
          name: input.name,
          role: input.role,
          is_active: input.isActive,
          permission_overrides: input.permissionOverrides,
        }),
      )
      .eq("id", input.id)
      .select("id,name,role,is_active,permission_overrides")
      .single();
    return mapEmployee(requireData<Row>(data as Row | null, error, "NOT_FOUND"));
  }

  async resetPin(employeeId: string, newPin: string): Promise<void> {
    const passcodeHash = await hashPin(this.client, newPin);
    const { error } = await this.client.from("employees").update({ passcode_hash: passcodeHash }).eq("id", employeeId);
    throwIfError(error, "NOT_FOUND");
  }
}
