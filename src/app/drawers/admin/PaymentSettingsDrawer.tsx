import clsx from "clsx";
import { CreditCard, QrCode, Save, ShieldAlert } from "lucide-react";
import { Button, TextField } from "@mui/material";
import { useState } from "react";
import toast from "react-hot-toast";
import { canAccessModule } from "@/core/guards";
import { useAppStore } from "../../useAppStore";
import { PortalDrawer } from "../../components/PortalDrawer";
import { PortalPopup } from "../../components/PortalPopup";

type PaymentMethodKey = "cash" | "qr" | "bank" | "other";
interface PaymentForm {
  qrEnabled: boolean;
  bankEnabled: boolean;
  bankName: string;
  accountNo: string;
  accountHolder: string;
  qrInfo: string;
  showQrOnBill: boolean;
}

const INITIAL_PAYMENT: PaymentForm = {
  qrEnabled: false,
  bankEnabled: false,
  bankName: "",
  accountNo: "",
  accountHolder: "",
  qrInfo: "",
  showQrOnBill: false,
};

export function PaymentSettingsDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const allowed = canAccessModule(currentEmployee, "settings");

  const [base, setBase] = useState<PaymentForm>(INITIAL_PAYMENT);
  const [form, setForm] = useState<PaymentForm>(INITIAL_PAYMENT);
  const [method, setMethod] = useState<PaymentMethodKey>("cash");
  const [accountError, setAccountError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(base);
  const patch = (p: Partial<PaymentForm>) => setForm((prev) => ({ ...prev, ...p }));

  const accountValid = (v: string) => /^\d{6,20}$/.test(v.trim());

  const handleSave = () => {
    if (form.bankEnabled && !accountValid(form.accountNo)) {
      setAccountError("Số tài khoản phải gồm 6–20 chữ số.");
      setMethod("bank");
      return;
    }
    setAccountError("");
    setBase(form);
    toast.success("Đã lưu cài đặt thanh toán");
  };
  const handleCancel = () => {
    if (dirty) setConfirmCancel(true);
    else closeDrawer();
  };

  const methods: Array<{ key: PaymentMethodKey; label: string; on: boolean; disabled?: boolean }> = [
    { key: "cash", label: "Tiền mặt", on: true },
    { key: "qr", label: "QR", on: form.qrEnabled },
    { key: "bank", label: "Chuyển khoản", on: form.bankEnabled },
  ];

  if (!allowed) {
    return (
      <PortalDrawer testId="payment-settings-drawer" onOutsideClick={closeDrawer}>
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
          <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap"><h2>Cài đặt thanh toán</h2><p>Chỉ dành cho quản lý</p></div>
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </header>
        <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2 grid h-full place-items-center content-center gap-2.5 text-center [&_h3]:m-0">
          <ShieldAlert size={42} color="#b45309" />
          <h3>Không có quyền</h3>
          <p className="text-pos-muted">Tài khoản hiện tại không thể chỉnh cài đặt thanh toán.</p>
        </div>
      </PortalDrawer>
    );
  }

  return (
    <PortalDrawer testId="payment-settings-drawer" onOutsideClick={closeDrawer}>
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
        <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap">
          <h2>Cài đặt thanh toán {dirty && <span className="ml-2 inline-flex items-center rounded-full bg-[#fff7ed] px-2 py-px text-[11px] font-extrabold text-[#c2410c]" data-testid="payment-dirty-badge">Chưa lưu</span>}</h2>
          <p><span className="mr-1 inline-block h-[7px] w-[7px] align-middle rounded-full bg-[#22c55e]" />Phương thức thanh toán · online</p>
        </div>
        <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2.5 [&>*]:shrink-0 [&_.MuiButton-root]:min-h-9 [&_.MuiButton-root]:whitespace-nowrap max-sm:w-full max-sm:justify-start max-sm:[&_.MuiButton-root]:flex-[1_1_128px] max-[980px]:gap-2 max-[980px]:[&_.MuiButton-root]:min-h-[34px]">
          <Button variant="text" onClick={handleCancel}>Huỷ</Button>
          <Button variant="contained" startIcon={<Save size={15} />} data-testid="save-payment-button" onClick={handleSave}>
            Lưu cài đặt
          </Button>
        </div>
      </header>

      <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2 grid grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto overflow-y-hidden px-0.5 pb-0.5 pt-px [scrollbar-width:thin]">
          {methods.map((m) => (
            <button
              key={m.key}
              className={clsx(
                "inline-flex min-h-9 flex-[1_0_112px] cursor-pointer items-center justify-center rounded-[7px] border px-2.5 py-2 text-xs font-extrabold max-sm:basis-[104px]",
                "gap-2",
                method === m.key
                  ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary"
                  : "border-pos-line bg-pos-surface text-pos-muted",
              )}
              onClick={() => setMethod(m.key)}
            >
              <span className={clsx("h-2 w-2 shrink-0 rounded-full bg-[#cbd5e1]", m.on && "bg-[#22c55e]")} />
              {m.label}
              <span className="text-[11px] font-bold text-pos-muted">{m.on ? "Bật" : "Tắt"}</span>
            </button>
          ))}
        </div>

        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
          <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">{methods.find((m) => m.key === method)?.label}</div>
          <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2 grid content-start gap-3">
            {method === "cash" ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-pos-muted">Tiền mặt</span>
                  <span className="inline-flex min-h-[22px] w-fit items-center rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-0.5 text-[11px] font-bold text-pos-success">● Luôn bật</span>
                </div>
                <p className="text-pos-muted">Tiền mặt là phương thức mặc định và luôn khả dụng.</p>
              </>
            ) : method === "qr" ? (
              <>
                <div className="grid gap-1.5">
                  <span className="text-xs font-extrabold text-pos-muted">Kích hoạt QR</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button className={clsx("min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border px-2.5 py-2 text-[13px] font-bold transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line", form.qrEnabled ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary" : "border-pos-line bg-pos-surface text-pos-ink")} onClick={() => patch({ qrEnabled: true })}>Bật</button>
                    <button className={clsx("min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border px-2.5 py-2 text-[13px] font-bold transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line", !form.qrEnabled ? "border-[#fecaca] bg-[#fef2f2] text-pos-danger" : "border-pos-line bg-pos-surface text-pos-ink")} onClick={() => patch({ qrEnabled: false })}>Tắt</button>
                  </div>
                </div>
                <TextField
                  label="Nội dung hiển thị cạnh mã QR"
                  value={form.qrInfo}
                  onChange={(e) => patch({ qrInfo: e.target.value })}
                  helperText="Chỉ là thông tin hiển thị trên hoá đơn in."
                  size="small"
                  fullWidth
                  multiline
                  minRows={2}
                  disabled={!form.qrEnabled}
                  inputProps={{ "data-testid": "qr-info-input" }}
                />
                <button className={clsx("cursor-pointer whitespace-nowrap rounded-[7px] border px-3 py-[7px] text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50", form.showQrOnBill ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary" : "border-pos-line bg-pos-surface text-pos-muted")} disabled={!form.qrEnabled} onClick={() => patch({ showQrOnBill: !form.showQrOnBill })}>
                  {form.showQrOnBill ? "✓ Hiện QR trên hoá đơn" : "Hiện QR trên hoá đơn"}
                </button>
                <p className="text-pos-muted">QR hiện chỉ in kèm hoá đơn, chưa nhận thanh toán tự động.</p>
              </>
            ) : method === "bank" ? (
              <>
                <div className="grid gap-1.5">
                  <span className="text-xs font-extrabold text-pos-muted">Kích hoạt chuyển khoản</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button className={clsx("min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border px-2.5 py-2 text-[13px] font-bold transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line", form.bankEnabled ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary" : "border-pos-line bg-pos-surface text-pos-ink")} onClick={() => patch({ bankEnabled: true })}>Bật</button>
                    <button className={clsx("min-w-[84px] flex-[1_1_0] cursor-pointer rounded-[7px] border px-2.5 py-2 text-[13px] font-bold transition-[border-color,background,color] hover:border-pos-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-pos-line", !form.bankEnabled ? "border-[#fecaca] bg-[#fef2f2] text-pos-danger" : "border-pos-line bg-pos-surface text-pos-ink")} onClick={() => patch({ bankEnabled: false })}>Tắt</button>
                  </div>
                </div>
                <TextField label="Ngân hàng" value={form.bankName} onChange={(e) => patch({ bankName: e.target.value })} size="small" fullWidth disabled={!form.bankEnabled} />
                <TextField
                  label="Số tài khoản"
                  value={form.accountNo}
                  onChange={(e) => { patch({ accountNo: e.target.value.replace(/[^\d]/g, "") }); setAccountError(""); }}
                  error={!!accountError || (form.bankEnabled && form.accountNo !== "" && !accountValid(form.accountNo))}
                  helperText={accountError || (form.bankEnabled && form.accountNo !== "" && !accountValid(form.accountNo) ? "Số tài khoản 6–20 chữ số." : "")}
                  size="small"
                  fullWidth
                  disabled={!form.bankEnabled}
                  inputProps={{ inputMode: "numeric", "data-testid": "account-no-input" }}
                />
                <TextField label="Chủ tài khoản" value={form.accountHolder} onChange={(e) => patch({ accountHolder: e.target.value })} size="small" fullWidth disabled={!form.bankEnabled} />
                <p className="text-pos-muted">Thông tin tài khoản chỉ hiển thị trên hoá đơn để khách chuyển khoản thủ công.</p>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted">
                <CreditCard size={30} color="#94a3b8" />
                <p>Phương thức này chưa kích hoạt.</p>
              </div>
            )}

            {method !== "cash" && (
              <div className="grid gap-1.5 border-t border-dashed border-pos-line pt-3">
                <span className="text-xs font-extrabold text-pos-muted">Xem trước hoá đơn</span>
                <div className="grid justify-items-center gap-1.5 rounded-pos border border-dashed border-pos-line bg-white p-4 text-center text-[13px]">
                  <strong className="text-base tracking-[0.02em]">Tên quán</strong>
                  <span className="text-xs text-pos-muted">Địa chỉ quán</span>
                  <div className="my-1 w-full border-t border-dashed border-pos-line" />
                  <div className="flex w-full justify-between gap-2"><span>Cà phê sữa × 2</span><span>58.000</span></div>
                  <div className="flex w-full justify-between gap-2"><span>Trà đào × 1</span><span>42.000</span></div>
                  <div className="my-1 w-full border-t border-dashed border-pos-line" />
                  <div className="flex w-full justify-between gap-2 font-extrabold"><strong>Tổng</strong><strong>100.000đ</strong></div>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    <span className="shrink-0 self-start rounded-full border border-pos-primaryLine bg-pos-primarySoft px-2 py-px text-[11px] font-bold text-pos-primary">Tiền mặt</span>
                    {form.qrEnabled && <span className="shrink-0 self-start rounded-full border border-pos-primaryLine bg-pos-primarySoft px-2 py-px text-[11px] font-bold text-pos-primary">QR</span>}
                    {form.bankEnabled && <span className="shrink-0 self-start rounded-full border border-pos-line px-2 py-px text-[11px] font-bold border-[#fde047] bg-[#fef9c3] text-[#854d0e]">Chuyển khoản</span>}
                  </div>
                  {form.bankEnabled && (form.bankName || form.accountNo) && (
                    <div className="mt-2 grid w-full gap-0.5 rounded-pos border border-pos-line bg-pos-surface2 px-2.5 py-2 text-left text-xs [&_strong]:text-[13px]">
                      <strong>{form.bankName || "Ngân hàng"}</strong>
                      <span>{form.accountNo || "Số tài khoản"}</span>
                      <span>{form.accountHolder || "Chủ tài khoản"}</span>
                    </div>
                  )}
                  {form.qrEnabled && form.showQrOnBill && (
                    <div className="mx-auto mb-1 mt-2.5 grid justify-items-center gap-1.5 rounded-[10px] border border-dashed border-pos-line bg-white p-3.5 text-pos-ink [&_span]:text-[11px] [&_span]:text-pos-muted" data-testid="pay-qr-preview">
                      <QrCode size={64} />
                      <span>{form.qrInfo.trim() || "Quét để thanh toán"}</span>
                    </div>
                  )}
                  <div className="mt-1.5 text-xs italic text-pos-muted">Cảm ơn quý khách</div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {confirmCancel && (
        <PortalPopup
          placement="Centered"
          viewport="workspace"
          overlayClassName="bg-slate-900/50"
          onOutsideClick={() => setConfirmCancel(false)}
        >
          <div className="grid w-[min(360px,90vw)] gap-3 rounded-pos bg-pos-surface p-6 shadow-[0_20px_60px_rgb(0_0_0_/_25%)] [&_h3]:m-0 [&_p]:m-0 [&_p]:text-sm [&_p]:text-pos-muted" onClick={(e) => e.stopPropagation()}>
            <h3>Bỏ thay đổi?</h3>
            <p>Các chỉnh sửa thanh toán chưa lưu sẽ bị huỷ.</p>
            <div className="flex flex-wrap justify-end gap-2.5 [&_.MuiButton-root]:min-w-24">
              <Button variant="outlined" onClick={() => setConfirmCancel(false)}>Ở lại</Button>
              <Button variant="contained" color="error" onClick={() => { setConfirmCancel(false); closeDrawer(); }}>Bỏ thay đổi</Button>
            </div>
          </div>
        </PortalPopup>
      )}
    </PortalDrawer>
  );
}
