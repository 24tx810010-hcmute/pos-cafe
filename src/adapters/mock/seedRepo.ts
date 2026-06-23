import type { ISeedRepo } from "@/ports";
import { applyDemoSeed } from "./demoSeedHelpers";
import type { MockState } from "./mockState";

export class MockSeedRepo implements ISeedRepo {
  constructor(private readonly state: MockState) {}

  async seedDemo(): Promise<void> {
    applyDemoSeed(this.state);
  }

  async retrySeedDemo(): Promise<void> {
    applyDemoSeed(this.state);
  }

  async seedBlank(): Promise<void> {
    // Store trống: không tạo gì thêm.
    await Promise.resolve();
  }
}
