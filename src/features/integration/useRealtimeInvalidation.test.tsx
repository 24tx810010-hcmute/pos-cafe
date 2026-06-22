import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMockPorts } from "@/adapters/mock";
import { PortsContext } from "@/features/shared/portsContext";
import type { AppPorts } from "@/ports";
import { useRealtimeInvalidation } from "./useRealtimeInvalidation";

function Probe({ storeId }: { storeId: string | null }) {
  useRealtimeInvalidation(storeId);
  return null;
}

const renderProbe = (ports: AppPorts, storeId: string | null) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <PortsContext.Provider value={ports}>
      <QueryClientProvider client={queryClient}>
        <Probe storeId={storeId} />
      </QueryClientProvider>
    </PortsContext.Provider>,
  );
};

describe("useRealtimeInvalidation", () => {
  it("does not start realtime before a store session exists", () => {
    const ports = createMockPorts();
    const startSpy = vi.spyOn(ports.realtime, "startStoreInvalidation");

    renderProbe(ports, null);

    expect(startSpy).not.toHaveBeenCalled();
  });

  it("starts realtime for the active store and cleans up on store change/unmount", () => {
    const ports = createMockPorts();
    const cleanup = vi.fn();
    const startSpy = vi.spyOn(ports.realtime, "startStoreInvalidation").mockReturnValue(cleanup);
    const view = renderProbe(ports, "store-demo-001");

    expect(startSpy).toHaveBeenCalledOnce();
    expect(startSpy.mock.calls[0][0].storeId).toBe("store-demo-001");

    view.rerender(
      <PortsContext.Provider value={ports}>
        <QueryClientProvider client={new QueryClient()}>
          <Probe storeId="store-demo-002" />
        </QueryClientProvider>
      </PortsContext.Provider>,
    );

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(startSpy).toHaveBeenCalledTimes(2);
    expect(startSpy.mock.calls[1][0].storeId).toBe("store-demo-002");

    view.unmount();
    expect(cleanup).toHaveBeenCalledTimes(2);
  });
});
