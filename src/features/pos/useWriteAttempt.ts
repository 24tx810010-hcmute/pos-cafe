import { useEffect, useState, useSyncExternalStore } from "react";
import { usePorts } from "@/features/shared/portsContext";
import { getWriteCoordinator } from "./writeOperationFlow";

export function useWriteAttempt() {
  const ports = usePorts();
  const coordinator = getWriteCoordinator(ports.write);
  const attempt = useSyncExternalStore(coordinator.subscribe, coordinator.snapshot, coordinator.snapshot);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return { coordinator, attempt, online, blocked: !online || (!!attempt && attempt.status !== "settled") };
}
