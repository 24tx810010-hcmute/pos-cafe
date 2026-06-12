import { createContext, useContext } from "react";
import type { AppPorts } from "@/ports";

export const PortsContext = createContext<AppPorts | null>(null);

export const usePorts = (): AppPorts => {
  const ports = useContext(PortsContext);

  if (!ports) {
    throw new Error("PortsContext is not configured.");
  }

  return ports;
};
