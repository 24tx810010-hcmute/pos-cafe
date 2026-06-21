import type { IAuthRepo } from "@/ports";
import type { StoreSession } from "@/domain";
import { mockStoreId } from "./mockData";
import { clone, type MockState } from "./mockState";

const parseStoreNo = (storeKey: string): number => {
  const [storeNo] = storeKey.split("-");
  const parsed = Number.parseInt(storeNo, 10);
  return Number.isFinite(parsed) ? parsed : 1;
};

export class MockAuthRepo implements IAuthRepo {
  constructor(private readonly state: MockState) {}

  async pairStore(storeKey: string): Promise<void> {
    this.state.session = { storeId: mockStoreId, storeNo: parseStoreNo(storeKey) };
  }

  async createStore(): Promise<import("@/domain").CreateStoreResult> {
    this.state.session = { storeId: mockStoreId, storeNo: 1 };
    return {
      storeId: mockStoreId,
      storeNo: 1,
      storeKey: "0001-X8F3QA",
      adminPin: "123456",
      seedStatus: "seeded",
      canRetrySeed: false,
    };
  }

  async unpairStore(): Promise<void> {
    this.state.session = null;
  }

  async getStoreSession(): Promise<StoreSession | null> {
    return clone(this.state.session);
  }
}
