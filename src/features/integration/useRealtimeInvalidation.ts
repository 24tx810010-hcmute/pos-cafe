import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePorts } from "@/app/portsContext";
import { startRealtimeInvalidation } from "./realtimeInvalidation";

export const useRealtimeInvalidation = (storeId: string | null | undefined): void => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!storeId) {
      return undefined;
    }

    return startRealtimeInvalidation(ports, queryClient, storeId);
  }, [ports, queryClient, storeId]);
};
