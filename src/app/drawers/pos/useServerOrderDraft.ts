import { useEffect, useRef, useState } from "react";
import type { OrderDetail } from "@/domain";
import { isDraftChangedFromOrder, orderDetailToDraft } from "@/features/pos/orderFlow";
import { useAppStore, type OrderDrawerContext } from "../../useAppStore";

export function useServerOrderDraft(context: OrderDrawerContext | null, current: OrderDetail | undefined) {
  const setDraftItems = useAppStore((state) => state.setDraftItems);
  const [editingOrder, setEditingOrder] = useState<OrderDetail | null>(null);
  const baseline = useRef<OrderDetail | null>(null);
  const contextKey = useRef<string | null>(null);
  const [remoteConflict, setRemoteConflict] = useState(false);
  const acceptCurrent = () => {
    if (!current) return;
    baseline.current = current;
    setEditingOrder(current);
    setDraftItems(orderDetailToDraft(current));
    setRemoteConflict(false);
  };
  useEffect(() => {
    const key = context ? `${context.orderId ?? "new"}:${context.tableId ?? "takeaway"}` : null;
    if (key !== contextKey.current) {
      contextKey.current = key;
      baseline.current = null;
      setEditingOrder(null);
      setRemoteConflict(false);
      setDraftItems([]);
    }
    if (!context?.orderId || !current) return;
    const previous = baseline.current;
    if (previous?.id === current.id && previous.lockVersion === current.lockVersion) return;
    if (previous && isDraftChangedFromOrder(previous, useAppStore.getState().draftItems)) {
      setRemoteConflict(true);
      return;
    }
    baseline.current = current;
    setEditingOrder(current);
    setDraftItems(orderDetailToDraft(current));
  }, [context, current, setDraftItems]);
  return { editingOrder, remoteConflict, acceptCurrent };
}
