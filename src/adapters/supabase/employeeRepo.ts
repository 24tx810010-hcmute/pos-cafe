
import type { IEmployeeRepo } from "@/ports";
import type { Employee, EmployeeInput, EmployeeUpdate, EmployeeSession } from "@/domain";
import { requireData, throwIfError } from "./errors";
import { mapEmployee, mapRpcEmployee, type Row } from "./mappers";
import { stripUndefined, type SupabaseAnyClient } from "./repoShared";
import { employeeCredential, clearEmployeeCredential } from "./employeeCredential";
import { writeError } from "@/core/writeErrors";

export class SupabaseEmployeeRepo implements IEmployeeRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async startSession(employeeId: string, pin: string): Promise<EmployeeSession> {
    clearEmployeeCredential(this.client);
    const credential = employeeCredential(this.client);
    const generation = credential.generation;
    if (!/^[0-9]{6}$/.test(pin)) throw writeError("INVALID_PIN");
    const { data, error } = await this.client.rpc("start_employee_session", { p_employee_id: employeeId, p_pin: pin });
    throwIfError(error, "INVALID_PIN");
    if (data?.ok === false) throw writeError(data.error.code);
    if (!data?.employee || !/^[A-Za-z0-9_-]{43}$/.test(data.token) || !Number.isFinite(Date.parse(data.expiresAt))) throw writeError("WRITE_PROTOCOL_UNSUPPORTED");
    if (generation !== credential.generation) throw writeError("EMPLOYEE_SESSION_REQUIRED");
    credential.token = data.token;
    return { ...data, employee: mapRpcEmployee(data.employee) } as EmployeeSession;
  }

  async revokeSession(): Promise<void> {
    const token = employeeCredential(this.client).token;
    clearEmployeeCredential(this.client);
    if (!token) return;
    const { error } = await this.client.rpc("revoke_employee_session").setHeader("x-pos-employee-token", token);
    throwIfError(error, "WRITE_TEMPORARILY_UNAVAILABLE");
  }

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
    return (await this.startSession(employeeId, pin)).employee;
  }

  async createEmployee(input: EmployeeInput): Promise<Employee> {
    const { data, error } = await this.client.rpc("create_employee", { p_employee_id: input.id, p_name: input.name, p_role: input.role, p_pin: input.pin });
    throwIfError(error);
    if (data?.ok === false) throw writeError(data.error.code);
    return mapRpcEmployee(requireData<Row>(data?.employee as Row | null, null));
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
    const { data, error } = await this.client.rpc("reset_employee_pin", { p_employee_id: employeeId, p_pin: newPin });
    throwIfError(error, "NOT_FOUND");
    if (data?.ok === false) throw writeError(data.error.code);
  }
}
