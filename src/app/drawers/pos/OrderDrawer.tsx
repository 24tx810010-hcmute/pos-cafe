import { AlertTriangle, CreditCard } from "lucide-react";
import clsx from "clsx";
import { Button } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { MenuItem } from "@/domain";
import {
  addDraftMenuItem,
  adjustDraftQuantity,
  buildCartLines,
  calculateCartTotal,
  getOrderPrimaryAction,
  isDraftChangedFromOrder,
  orderDetailToDraft,
  useFloorPlanQuery,
  useMenuQuery,
  useOrderDetailQuery,
  useSubmitOrderMutation,
} from "@/features/pos";
import { notifyUiError, toToastError } from "../../appErrors";
import { PortalDrawer } from "../../components/PortalDrawer";
import { PortalPopup } from "../../components/PortalPopup";
import { useAppStore } from "../../useAppStore";
import { OrderCartPane } from "./OrderCartPane";
import { OrderMenuPane } from "./OrderMenuPane";

export function OrderDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const openPayment = useAppStore((state) => state.openPayment);
  const context = useAppStore((state) => state.orderContext);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const draftItems = useAppStore((state) => state.draftItems);
  const setDraftItems = useAppStore((state) => state.setDraftItems);
  const activeCategoryId = useAppStore((state) => state.activeCategoryId);
  const setActiveCategoryId = useAppStore((state) => state.setActiveCategoryId);

  const [search, setSearch] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);

  const menuQuery = useMenuQuery();
  const floorPlanQuery = useFloorPlanQuery();
  const orderQuery = useOrderDetailQuery(context?.orderId ?? null);
  const submitMutation = useSubmitOrderMutation();

  useEffect(() => {
    const firstCategory = menuQuery.data?.categories[0]?.id;
    if (!activeCategoryId && firstCategory) setActiveCategoryId(firstCategory);
  }, [activeCategoryId, menuQuery.data, setActiveCategoryId]);

  useEffect(() => {
    if (context?.orderId && orderQuery.data) {
      setDraftItems(orderDetailToDraft(orderQuery.data));
    }
    if (context && !context.orderId) setDraftItems([]);
  }, [context, orderQuery.data, setDraftItems]);

  const menu = menuQuery.data;
  const categoryId = activeCategoryId ?? menu?.categories[0]?.id ?? "";
  const allCategoryItems = menu?.menuItems.filter((item) => item.categoryId === categoryId) ?? [];
  const items = search
    ? (menu?.menuItems.filter((item) => item.name.toLowerCase().includes(search.toLowerCase())) ?? [])
    : allCategoryItems;
  const orderDetail = orderQuery.data ?? null;
  const table = context?.tableId ? floorPlanQuery.data?.tables.find((candidate) => candidate.id === context.tableId) : null;
  const cartLines = useMemo(() => (menu ? buildCartLines(menu, draftItems) : []), [draftItems, menu]);
  const total = calculateCartTotal(cartLines);
  const isDirty = draftItems.length > 0;
  const draftChanged = isDraftChangedFromOrder(orderDetail, draftItems);
  const primaryAction = getOrderPrimaryAction(orderDetail, draftItems);
  const submitDisabled =
    submitMutation.isPending || menuQuery.isError || orderQuery.isError || (!!context?.orderId && orderQuery.isLoading);
  const primaryDisabled =
    primaryAction === "closed"
      ? true
      : primaryAction === "payment"
        ? !orderDetail || submitMutation.isPending
        : submitDisabled;
  const primaryActionLabel = submitMutation.isPending
    ? "Đang gửi..."
    : primaryAction === "closed"
      ? orderDetail?.status === "paid"
        ? "Đã thanh toán"
        : "Đơn đã đóng"
      : primaryAction === "payment"
        ? "Thanh toán"
        : "In/Gửi đơn";

  const handleClose = () => {
    if (isDirty && !orderDetail) {
      setConfirmClose(true);
      return;
    }
    closeDrawer();
  };

  const addItem = (menuItem: MenuItem) => {
    if (!menuItem.isAvailable) return;
    setDraftItems(addDraftMenuItem(draftItems, menuItem));
  };

  const adjustQuantity = (id: string, delta: number) => {
    setDraftItems(adjustDraftQuantity(draftItems, id, delta));
  };

  const handleSubmitError = (error: unknown) => {
    const uiError = notifyUiError(error);
    if (uiError.action === "refreshMenu") {
      void menuQuery.refetch();
    }
    if (uiError.action === "reloadOrder") {
      if (context?.orderId) {
        void orderQuery.refetch();
      }
      void floorPlanQuery.refetch();
    }
  };

  const submitOrder = () => {
    if (!context || !currentEmployee) return;

    submitMutation.mutate(
      {
        context,
        employeeId: currentEmployee.id,
        expectedVersion: orderDetail?.lockVersion ?? null,
        items: draftItems,
      },
      {
        onSuccess: (result) => {
          toast.success(result.status === "void" ? "Đã huỷ đơn mở." : "Đã in/gửi đơn.");
          closeDrawer();
        },
        onError: handleSubmitError,
      },
    );
  };

  const runPrimaryAction = () => {
    if (primaryAction === "closed") {
      toast("Đơn này đã được cập nhật trên thiết bị khác.");
      return;
    }

    if (primaryAction === "payment" && orderDetail) {
      openPayment(orderDetail.id);
      return;
    }

    submitOrder();
  };

  const updateNote = (id: string, note: string) => {
    setDraftItems(draftItems.map((draft) => (draft.id === id ? { ...draft, note: note || null } : draft)));
  };

  const orderTypeLabel = context?.orderType === "takeaway" ? "Mang đi" : `Bàn ${table?.name ?? "?"}`;
  const titleLabel = orderDetail ? `${orderTypeLabel} · Đơn #${orderDetail.orderNo}` : `${orderTypeLabel} · Đơn mới`;

  return (
    <PortalDrawer testId="order-drawer">
      {confirmClose && (
        <PortalPopup placement="Centered" viewport="workspace" overlayClassName="bg-slate-900/50">
          <div className="grid w-[min(360px,90vw)] gap-3 rounded-pos bg-pos-surface p-6 shadow-[0_20px_60px_rgb(0_0_0_/_25%)] [&_h3]:m-0 [&_p]:m-0 [&_p]:text-sm [&_p]:text-pos-muted">
            <h3>Bỏ đơn chưa gửi?</h3>
            <p>Các món vừa chọn sẽ không được lưu.</p>
            <div className="flex flex-wrap justify-end gap-2.5 [&_.MuiButton-root]:min-w-24">
              <Button variant="outlined" onClick={() => setConfirmClose(false)}>
                Tiếp tục chỉnh sửa
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => {
                  setConfirmClose(false);
                  closeDrawer();
                }}
              >
                Bỏ đơn
              </Button>
            </div>
          </div>
        </PortalPopup>
      )}

      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
        <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap">
          <h2>{titleLabel}</h2>
          <p>
            <span className={clsx("inline-block rounded px-1.5 py-px text-[11px] font-bold", context?.orderType === "takeaway" ? "bg-[#ede9fe] text-[#7c3aed]" : "bg-pos-primarySoft text-pos-primary")}>
              {context?.orderType === "takeaway" ? "Mang đi" : "Tại bàn"}
            </span>
            {" · "}
            {orderDetail?.status === "paid" ? "Đã thanh toán" : orderDetail ? "Đã gửi" : "Chưa gửi"}
            {" · "}
            <span className="mr-1 inline-block h-[7px] w-[7px] align-middle rounded-full bg-[#22c55e]" />
            online
          </p>
        </div>
        <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2.5 [&>*]:shrink-0 [&_.MuiButton-root]:min-h-9 [&_.MuiButton-root]:whitespace-nowrap max-sm:w-full max-sm:justify-start max-sm:[&_.MuiButton-root]:flex-[1_1_128px] max-[980px]:gap-2 max-[980px]:[&_.MuiButton-root]:min-h-[34px]">
          <Button variant="outlined" onClick={handleClose}>
            Đóng
          </Button>
          {orderDetail && draftChanged && primaryAction !== "closed" && (
            <Button variant="outlined" startIcon={<CreditCard size={16} />} disabled>
              Thanh toán
            </Button>
          )}
          <Button
            variant="contained"
            data-testid="submit-order-button"
            disabled={primaryDisabled}
            onClick={runPrimaryAction}
          >
            {primaryActionLabel}
          </Button>
        </div>
      </header>

      <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2">
        {orderQuery.isError && (
          <div className="mx-3.5 mt-2.5 flex items-center gap-2.5 rounded-pos border border-[#fbbf24] bg-[#fffbeb] px-3 py-2.5 text-[#92400e] [&_.MuiButton-root]:ml-auto [&_.MuiButton-root]:shrink-0 [&_p]:mb-0 [&_p]:mt-0.5 [&_p]:text-[13px] [&_p]:text-[#92400e]" data-testid="order-error-state">
            <AlertTriangle size={18} />
            <div>
              <strong>Không tải được đơn hiện tại</strong>
              <p>{toToastError(orderQuery.error)}</p>
            </div>
            <Button size="small" variant="outlined" onClick={() => void orderQuery.refetch()}>
              Thử lại
            </Button>
          </div>
        )}
        {primaryAction === "closed" && (
          <div className="mx-3.5 mt-2.5 flex items-center gap-2.5 rounded-pos border border-[#fbbf24] bg-[#fffbeb] px-3 py-2.5 text-[#92400e] [&_.MuiButton-root]:ml-auto [&_.MuiButton-root]:shrink-0 [&_p]:mb-0 [&_p]:mt-0.5 [&_p]:text-[13px] [&_p]:text-[#92400e]" data-testid="order-closed-state">
            <AlertTriangle size={18} />
            <div>
              <strong>Đơn đã được cập nhật</strong>
              <p>Thiết bị khác đã thanh toán hoặc đóng đơn này. Quay lại sơ đồ để xem trạng thái mới nhất.</p>
            </div>
          </div>
        )}
        <div className="grid h-full min-h-0 min-w-[620px] grid-cols-[minmax(300px,1fr)_minmax(280px,360px)] gap-2.5">
          <OrderMenuPane
            categories={menu?.categories}
            items={items}
            categoryId={categoryId}
            search={search}
            isLoading={menuQuery.isLoading}
            isError={menuQuery.isError}
            error={menuQuery.error}
            onSelectCategory={(selectedCategoryId) => {
              setActiveCategoryId(selectedCategoryId);
              setSearch("");
            }}
            onSearchChange={setSearch}
            onRetry={() => void menuQuery.refetch()}
            onAddItem={addItem}
          />
          <OrderCartPane
            cartLines={cartLines}
            draftItems={draftItems}
            noteOpenId={noteOpenId}
            total={total}
            showPaymentHint={!!orderDetail && draftChanged && primaryAction !== "closed"}
            primaryDisabled={primaryDisabled}
            primaryActionLabel={primaryActionLabel}
            onAdjustQuantity={adjustQuantity}
            onToggleNote={(lineId) => setNoteOpenId(noteOpenId === lineId ? null : lineId)}
            onUpdateNote={updateNote}
            onPrimaryAction={runPrimaryAction}
          />
        </div>
      </div>
    </PortalDrawer>
  );
}
