import type { IEmployeeRepo } from "@/ports";
import type { Employee, EmployeeInput, EmployeeUpdate, EmployeeSession } from "@/domain";
import { AppError } from "@/core/appError";
import { clone, type MockState } from "./mockState";
import { mockActor, mockWriteState, type MockEmployeeCredential } from "./writeState";
import { writeError } from "@/core/writeErrors";

export class MockEmployeeRepo implements IEmployeeRepo {
  constructor(private readonly state: MockState, private readonly credential: MockEmployeeCredential = { token: null }) {}

  async startSession(employeeId: string, pin: string): Promise<EmployeeSession> {
    this.credential.token = null;
    if (!this.state.session) throw writeError("AUTH_REQUIRED");
    const employee = this.state.employees.find(e => e.id === employeeId && e.isActive);
    if (!employee || !/^[0-9]{6}$/.test(pin) || this.state.pins[employeeId] !== pin) throw writeError("INVALID_PIN");
    const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const writes = mockWriteState(this.state);
    const expiresAt = writes.now() + 12 * 60 * 60 * 1000;
    writes.sessions[token] = { storeId: this.state.session.storeId, employeeId, expiresAt, revoked: false };
    this.credential.token = token;
    return { employee: clone(employee), token, expiresAt: new Date(expiresAt).toISOString() };
  }

  async revokeSession(): Promise<void> {
    const token = this.credential.token;
    this.credential.token = null;
    if (token && mockWriteState(this.state).sessions[token]) mockWriteState(this.state).sessions[token].revoked = true;
  }

  private requireAdmin(): void {
    if (mockActor(this.state, this.credential).role !== "admin") throw writeError("FORBIDDEN");
  }

  async listEmployees(): Promise<Employee[]> {
    return clone(this.state.employees);
  }

  async listActiveEmployees(): Promise<Employee[]> {
    return clone(this.state.employees.filter((employee) => employee.isActive));
  }

  async verifyPin(employeeId: string, pin: string): Promise<Employee> {
    const employee = this.state.employees.find((candidate) => candidate.id === employeeId && candidate.isActive);

    if (!employee || this.state.pins[employeeId] !== pin) {
      throw new AppError("INVALID_PIN", "PIN không đúng.");
    }

    return clone(employee);
  }

  async createEmployee(input: EmployeeInput): Promise<Employee> {
    this.requireAdmin();
    if (!/^[0-9]{6}$/.test(input.pin)) throw writeError("INVALID_WRITE_REQUEST");
    const employee: Employee = { id: input.id, name: input.name, role: input.role, isActive: true };
    this.state.employees.push(employee);
    this.state.pins[input.id] = input.pin;
    return clone(employee);
  }

  async updateEmployee(input: EmployeeUpdate): Promise<Employee> {
    this.requireAdmin();
    const employee = this.state.employees.find((candidate) => candidate.id === input.id);

    if (!employee) {
      throw new AppError("NOT_FOUND", "Không tìm thấy nhân viên.");
    }

    const { permissionOverrides, ...updates } = input;
    Object.assign(employee, updates);
    if (permissionOverrides !== undefined) {
      employee.permissionOverrides = permissionOverrides ?? undefined;
    }
    if (!employee.isActive) for (const session of Object.values(mockWriteState(this.state).sessions)) if (session.employeeId === employee.id) session.revoked = true;
    return clone(employee);
  }

  async resetPin(employeeId: string, newPin: string): Promise<void> {
    this.requireAdmin();
    if (!/^[0-9]{6}$/.test(newPin)) throw writeError("INVALID_WRITE_REQUEST");
    const employee = this.state.employees.find((candidate) => candidate.id === employeeId);

    if (!employee) {
      throw new AppError("NOT_FOUND", "Không tìm thấy nhân viên.");
    }

    this.state.pins[employeeId] = newPin;
    for (const session of Object.values(mockWriteState(this.state).sessions)) if (session.employeeId === employeeId) session.revoked = true;
  }
}
