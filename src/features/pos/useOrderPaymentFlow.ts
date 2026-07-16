import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePorts } from "@/features/shared/portsContext";
import { invalidateAfterOrderMutation } from "./posInvalidation";
import {
  payOrderAndPrint,
  payOrderItemsAndPrint,
  submitOrderAndPrint,
  voidPaidOrder,
  type PayOrderFlowInput,
  type PayOrderItemsFlowInput,
  type SubmitOrderFlowInput,
  type VoidPaidOrderFlowInput,
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

/** Instant pay theo selection: tự rẽ nhánh trả toàn bộ / tách đơn trả riêng trong flow. */
export const usePayOrderItemsMutation = () => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PayOrderItemsFlowInput) => payOrderItemsAndPrint(ports, input),
    onSuccess: (result) => {
      // Tách đơn: đơn gốc trên bàn cũng đổi (order_no mới, tổng mới) -> invalidate cả hai.
      const sourceOrderId = result.mode === "split" ? result.sourceOrderId : result.orderId;
      void invalidateAfterOrderMutation(queryClient, sourceOrderId).catch(() => {});
    },
  });
};

export const useVoidOrderMutation = () => {
  const ports = usePorts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: VoidPaidOrderFlowInput) => voidPaidOrder(ports, input),
    onSuccess: (result) => {
      // Đơn chuyển 'void': history + order detail + report đều cần cập nhật.
      void invalidateAfterOrderMutation(queryClient, result.orderId).catch(() => {});
    },
  });
};
