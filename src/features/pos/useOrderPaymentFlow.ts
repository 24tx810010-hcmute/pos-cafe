import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePorts } from "@/features/shared/portsContext";
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
    // Fire-and-forget: cập nhật UI ngay (đóng drawer, mở popup gửi bếp), đồng bộ
    // các query nền song song; máy khác nhận trễ tối đa ~5s (poll/realtime).
    onSuccess: (result, input) => {
      void invalidateAfterOrderMutation(queryClient, result.orderId ?? input.context.orderId).catch(() => {});
    },
  });
};

export const usePayOrderMutation = () => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PayOrderFlowInput) => payOrderAndPrint(ports, input),
    onSuccess: (result) => {
      void invalidateAfterOrderMutation(queryClient, result.orderId).catch(() => {});
    },
  });
};
