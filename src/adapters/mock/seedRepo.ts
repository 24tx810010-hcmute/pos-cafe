import type { ISeedRepo } from "@/ports";

export class MockSeedRepo implements ISeedRepo {
  async seedDemo(): Promise<void> {
    await Promise.resolve();
  }

  async retrySeedDemo(): Promise<void> {
    await Promise.resolve();
  }

  async seedBlank(): Promise<void> {
    await Promise.resolve();
  }
}
