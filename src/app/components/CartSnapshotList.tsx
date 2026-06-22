import type { OrderDetail } from "@/domain";
import { formatVnd } from "@/core/money";

export function CartSnapshotList({ order }: { order: OrderDetail | undefined }) {
  if (!order) {
    return <p className="text-pos-muted">Đang tải đơn...</p>;
  }

  return (
    <div className="grid gap-2">
      {order.items.map((item) => (
        <div className="grid gap-1.5 rounded-pos border border-pos-line bg-white px-3.5 py-3" key={item.id}>
          <div className="flex items-start justify-between gap-3 text-sm">
            <strong>{item.itemName}</strong>
            <strong>{formatVnd(item.quantity * (item.unitPrice + item.options.reduce((sum, option) => sum + option.priceDelta, 0)))}</strong>
          </div>
          <span className="text-pos-muted">
            x{item.quantity}
            {item.options.length ? ` · ${item.options.map((option) => option.optionName).join(", ")}` : ""}
          </span>
        </div>
      ))}
      <div className="grid gap-1 rounded-pos border border-pos-primaryLine bg-pos-primarySoft px-3.5 py-3">
        <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-pos-muted">Tổng cần thu</span>
        <strong className="text-xl font-black text-pos-primary">{formatVnd(order.total)}</strong>
      </div>
    </div>
  );
}
