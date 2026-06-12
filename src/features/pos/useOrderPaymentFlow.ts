import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePorts } from "@/ports/portsContext";
import { invalidateAfterOrderMutation } from "./posInvalidation";
import {
  payOrderAndPrint,
  submitOrderAndPrint,
  type PayOrderFlowInput,
  type SubmitOrderFlowInput,
} from "./orderFlow";

export const useSubmitOrderMutation = () => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitOrderFlowInput) => submitOrderAndPrint(ports, input),
    onSuccess: async (result, input) => {
      await invalidateAfterOrderMutation(queryClient, result.orderId ?? input.context.orderId);
    },
  });
};

export const usePayOrderMutation = () => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PayOrderFlowInput) => payOrderAndPrint(ports, input),
    onSuccess: async (result) => {
      await invalidateAfterOrderMutation(queryClient, result.orderId);
    },
  });
};
