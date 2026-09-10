import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "./useAppStore";

/** Capture before an asynchronous read that could later start a write or preview. */
export function useViewLifetime(context: unknown) {
  const lifetime = useRef({ generation: 0, context });
  if (lifetime.current.context !== context) {
    lifetime.current.context = context;
    lifetime.current.generation += 1;
  }
  useEffect(() => {
    const invalidate = () => { lifetime.current.generation += 1; };
    const stop = useAppStore.subscribe((state, previous) => {
      if (state.currentEmployee !== previous.currentEmployee || state.drawer !== previous.drawer
        || state.orderContext !== previous.orderContext || state.paymentOrderId !== previous.paymentOrderId) invalidate();
    });
    window.addEventListener("offline", invalidate);
    return () => { invalidate(); stop(); window.removeEventListener("offline", invalidate); };
  }, []);
  return useCallback(() => {
    const generation = lifetime.current.generation;
    return () => generation === lifetime.current.generation && navigator.onLine;
  }, []);
}
