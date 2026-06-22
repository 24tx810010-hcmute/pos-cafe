import type { ISettingsRepo } from "@/ports";
import type { StoreSettings, StoreSettingsUpdate } from "@/domain";
import { AppError } from "@/core/appError";
import { clone, type MockState } from "./mockState";

export class MockSettingsRepo implements ISettingsRepo {
  constructor(private readonly state: MockState) {}

  async getSettings(): Promise<StoreSettings> {
    return clone(this.state.settings);
  }

  async updateSettings(input: StoreSettingsUpdate): Promise<StoreSettings> {
    this.state.settings = { ...this.state.settings, ...input };
    return clone(this.state.settings);
  }

  async clearDemoData(): Promise<void> {
    if (this.state.orders.some((order) => order.status === "open")) {
      throw new AppError("OPEN_ORDERS_BLOCK_CLEAR_DEMO", "Còn đơn đang mở, không thể xoá demo data.");
    }
  }
}
