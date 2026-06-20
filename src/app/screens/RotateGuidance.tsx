import { Store } from "lucide-react";

export function RotateGuidance() {
  return (
    <div
      className="hidden min-h-screen place-items-center bg-pos-bg p-6 [@media(orientation:portrait)]:grid"
      data-testid="rotate-guidance"
    >
      <section className="w-[min(380px,100%)] rounded-pos border border-pos-line bg-pos-surface p-[22px] text-center shadow-[0_16px_42px_rgb(15_23_42_/_10%)]">
        <Store size={36} color="#0F766E" />
        <h1>Xoay ngang thiết bị</h1>
        <p className="text-pos-muted">POS dùng màn hình ngang để giữ đủ bàn, menu, thanh toán và báo cáo.</p>
      </section>
    </div>
  );
}
