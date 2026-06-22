import type { IRealtimePort } from "@/ports";

export class MockRealtimePort implements IRealtimePort {
  startStoreInvalidation(): () => void {
    return () => undefined;
  }
}
