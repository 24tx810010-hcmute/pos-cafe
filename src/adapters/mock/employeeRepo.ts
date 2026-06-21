import type { IEmployeeRepo } from "@/ports";
import type { Employee, EmployeeInput, EmployeeUpdate } from "@/domain";
import { AppError } from "@/core/appError";
import { clone, type MockState } from "./mockState";

export class MockEmployeeRepo implements IEmployeeRepo {
  constructor(private readonly state: MockState) {}

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
    const employee: Employee = { id: input.id, name: input.name, role: input.role, isActive: true };
    this.state.employees.push(employee);
    this.state.pins[input.id] = input.pin;
    return clone(employee);
  }

  async updateEmployee(input: EmployeeUpdate): Promise<Employee> {
    const employee = this.state.employees.find((candidate) => candidate.id === input.id);

    if (!employee) {
      throw new AppError("NOT_FOUND", "Không tìm thấy nhân viên.");
    }

    Object.assign(employee, input);
    return clone(employee);
  }

  async resetPin(employeeId: string, newPin: string): Promise<void> {
    const employee = this.state.employees.find((candidate) => candidate.id === employeeId);

    if (!employee) {
      throw new AppError("NOT_FOUND", "Không tìm thấy nhân viên.");
    }

    this.state.pins[employeeId] = newPin;
  }
}
