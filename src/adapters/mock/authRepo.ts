import type { IAuthRepo } from "@/ports";
import type { CreateStoreInput, CreateStoreResult, StoreSession } from "@/domain";
import { mockStoreId } from "./mockData";
import { applyDemoSeed } from "./demoSeedHelpers";
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

  async createStore(input: CreateStoreInput): Promise<CreateStoreResult> {
    this.state.session = { storeId: mockStoreId, storeNo: 1 };
    this.state.settings = {
      ...this.state.settings,
      displayName: input.displayName?.trim() || this.state.settings.displayName,
      address: input.address?.trim() ?? this.state.settings.address,
    };

    if (input.seedDemo) {
      applyDemoSeed(this.state);
    }

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
