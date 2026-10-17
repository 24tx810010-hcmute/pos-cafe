import type { PermissionCatalogSignal, PermissionSignal } from "@/domain/permissions";
import type { IPermissionSignalPort } from "@/ports/permissions";

export class MockPermissionSignalPort implements IPermissionSignalPort {
  private subscribers = new Set<Parameters<IPermissionSignalPort["subscribe"]>[0]>();

  subscribe(input: Parameters<IPermissionSignalPort["subscribe"]>[0]): () => void {
    this.subscribers.add(input);
    return () => { this.subscribers.delete(input); };
  }

  emitStore(signal: PermissionSignal): void {
    for (const subscriber of this.subscribers) if (subscriber.storeId === signal.storeId) subscriber.onStoreSignal(signal);
  }

  emitCatalog(signal: PermissionCatalogSignal): void {
    for (const subscriber of this.subscribers) subscriber.onCatalogSignal(signal);
  }

  reconnect(): void {
    for (const subscriber of this.subscribers) subscriber.onReconnect?.();
  }
}

