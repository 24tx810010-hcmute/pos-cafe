import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Save, ShieldAlert, Trash2 } from "lucide-react";
import { Button, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { canAccessModule } from "@/core/guards";
import {
  useOpenOrdersQuery,
} from "@/features/pos";
import {
  useClearDemoDataMutation,
  useStoreSettingsQuery,
  useUpdateSettingsMutation,
} from "@/features/admin";
import { useAppStore } from "../../useAppStore";
import { notifyUiError, toToastError } from "../../appErrors";
import { PortalDrawer } from "../../components/PortalDrawer";
import { PortalPopup } from "../../components/PortalPopup";

type SettingsSection = "info" | "bill" | "demo";
interface SettingsForm {
  displayName: string;
  address: string;
  billFooter: string;
}

export function GeneralSettingsDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const allowed = canAccessModule(currentEmployee, "settings");
  const settingsQuery = useStoreSettingsQuery();
  const updateSettingsMutation = useUpdateSettingsMutation(currentEmployee);

  const [seeded, setSeeded] = useState(false);
  const [base, setBase] = useState<SettingsForm | null>(null);
  const [form, setForm] = useState<SettingsForm>({ displayName: "", address: "", billFooter: "" });
  const [section, setSection] = useState<SettingsSection>("info");
  const [nameError, setNameError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  useEffect(() => {
    if (settingsQuery.data && !seeded) {
      const f: SettingsForm = {
        displayName: settingsQuery.data.displayName,
        address: settingsQuery.data.address,
        billFooter: settingsQuery.data.billFooter,
      };
      setForm(f);
      setBase(f);
      setSeeded(true);
    }
  }, [settingsQuery.data, seeded]);

  const dirty = !!base && (form.displayName !== base.displayName || form.address !== base.address || form.billFooter !== base.billFooter);

  const patch = (p: Partial<SettingsForm>) => setForm((prev) => ({ ...prev, ...p }));

  const handleSave = () => {
    if (!form.displayName.trim()) {
      setNameError("Tên hiển thị bắt buộc.");
      setSection("info");
      return;
    }
    setNameError("");
    updateSettingsMutation.mutate(
      {
        settings: {
          displayName: form.displayName.trim(),
          address: form.address,
          billFooter: form.billFooter,
        },
      },
      {
        onSuccess: (saved) => {
          const next = {
            displayName: saved.displayName,
            address: saved.address,
            billFooter: saved.billFooter,
          };
          setBase(next);
          setForm(next);
          toast.success("Đã lưu cài đặt");
        },
        onError: (error) => toast.error(toToastError(error)),
      },
    );
  };
  const handleCancel = () => {
    if (dirty) setConfirmCancel(true);
    else closeDrawer();
  };

  const sections: Array<{ key: SettingsSection; label: string }> = [
    { key: "info", label: "Thông tin quán" },
    { key: "bill", label: "Hoá đơn" },
    { key: "demo", label: "Bảo trì dữ liệu" },
  ];

  if (!allowed) {
    return (
      <PortalDrawer testId="settings-drawer" onOutsideClick={closeDrawer}>
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
          <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap"><h2>Cài đặt chung</h2><p>Chỉ dành cho quản lý</p></div>
          <Button variant="outlined" onClick={closeDrawer}>Đóng</Button>
        </header>
        <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2 grid h-full place-items-center content-center gap-2.5 text-center [&_h3]:m-0">
          <ShieldAlert size={42} color="#b45309" />
          <h3>Không có quyền</h3>
          <p className="text-pos-muted">Tài khoản hiện tại không thể chỉnh cài đặt.</p>
        </div>
      </PortalDrawer>
    );
  }

  return (
    <PortalDrawer testId="settings-drawer" onOutsideClick={closeDrawer}>
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-pos-line bg-white/95 px-[18px] py-3 max-[980px]:min-h-[50px] max-[980px]:gap-x-2.5 max-[980px]:gap-y-2 max-[980px]:px-2.5 max-[980px]:py-2">
        <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] [&_h2]:overflow-hidden [&_h2]:text-ellipsis [&_h2]:whitespace-nowrap [&_h3]:overflow-hidden [&_h3]:text-ellipsis [&_h3]:whitespace-nowrap">
          <h2>Cài đặt chung {dirty && <span className="ml-2 inline-flex items-center rounded-full bg-[#fff7ed] px-2 py-px text-[11px] font-extrabold text-[#c2410c]" data-testid="settings-dirty-badge">Chưa lưu</span>}</h2>
          <p><span className="mr-1 inline-block h-[7px] w-[7px] align-middle rounded-full bg-[#22c55e]" />Cấu hình quán · online</p>
        </div>
        <div className="flex min-w-0 flex-[0_1_auto] flex-wrap items-center justify-end gap-2.5 [&>*]:shrink-0 [&_.MuiButton-root]:min-h-9 [&_.MuiButton-root]:whitespace-nowrap max-sm:w-full max-sm:justify-start max-sm:[&_.MuiButton-root]:flex-[1_1_128px] max-[980px]:gap-2 max-[980px]:[&_.MuiButton-root]:min-h-[34px]">
          <Button variant="text" onClick={handleCancel}>Huỷ</Button>
          <Button
            variant="contained"
            startIcon={<Save size={15} />}
            data-testid="save-settings-button"
            disabled={!seeded || !dirty || updateSettingsMutation.isPending}
            onClick={handleSave}
          >
            {updateSettingsMutation.isPending ? "Đang lưu..." : "Lưu cài đặt"}
          </Button>
        </div>
      </header>

      <div className="min-h-0 overflow-auto bg-pos-bg p-3 max-[980px]:p-2 grid grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
        {settingsQuery.isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-pos-muted" data-testid="settings-error-state">
            <AlertTriangle size={32} color="#b45309" />
            <strong>Không tải được cài đặt</strong>
            <p>{toToastError(settingsQuery.error)}</p>
            <Button variant="contained" size="small" onClick={() => void settingsQuery.refetch()}>
              Thử tải lại
            </Button>
          </div>
        ) : !seeded ? (
          <p className="text-pos-muted p-4">Đang tải cài đặt...</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 overflow-x-auto overflow-y-hidden px-0.5 pb-0.5 pt-px [scrollbar-width:thin]">
              {sections.map((s) => (
                <button
                  key={s.key}
                  className={clsx(
                    "inline-flex min-h-9 flex-[1_0_112px] cursor-pointer items-center justify-center rounded-[7px] border px-2.5 py-2 text-xs font-extrabold max-sm:basis-[104px]",
                    section === s.key
                      ? "border-pos-primaryLine bg-pos-primarySoft text-pos-primary"
                      : "border-pos-line bg-pos-surface text-pos-muted",
                  )}
                  onClick={() => setSection(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
              <div className="flex min-h-11 items-center justify-between gap-2.5 border-b border-pos-line bg-[#fbfcfd] px-3 py-2.5 font-black max-[980px]:min-h-9 max-[980px]:px-2 max-[980px]:py-[7px] max-[980px]:text-xs">{sections.find((s) => s.key === section)?.label}</div>
              <div className="min-h-0 overflow-auto p-2.5 max-[980px]:p-2 grid content-start gap-3">
                {section === "info" ? (
                  <>
                    <TextField
                      label="Tên hiển thị quán"
                      value={form.displayName}
                      onChange={(e) => { patch({ displayName: e.target.value }); setNameError(""); }}
                      error={!!nameError}
                      helperText={nameError}
                      size="small"
                      fullWidth
                      inputProps={{ "data-testid": "settings-name-input" }}
                    />
                    <TextField label="Địa chỉ" value={form.address} onChange={(e) => patch({ address: e.target.value })} size="small" fullWidth multiline minRows={2} />
                  </>
                ) : section === "bill" ? (
                  <>
                    <TextField label="Chân hoá đơn" value={form.billFooter} onChange={(e) => patch({ billFooter: e.target.value })} size="small" fullWidth multiline minRows={3} helperText="Hiển thị cuối hoá đơn in." />
                    <div className="grid gap-1.5 border-t border-dashed border-pos-line pt-3">
                      <span className="text-xs font-extrabold text-pos-muted">Xem trước hoá đơn</span>
                      <div className="grid justify-items-center gap-1.5 rounded-pos border border-dashed border-pos-line bg-white p-4 text-center text-[13px]">
                        <strong className="text-base tracking-[0.02em]">{form.displayName || "Tên quán"}</strong>
                        {form.address && <span className="text-xs text-pos-muted">{form.address}</span>}
                        <div className="my-1 w-full border-t border-dashed border-pos-line" />
                        <div className="flex w-full justify-between gap-2"><span>Cà phê sữa × 2</span><span>58.000</span></div>
                        <div className="flex w-full justify-between gap-2"><span>Trà đào × 1</span><span>42.000</span></div>
                        <div className="my-1 w-full border-t border-dashed border-pos-line" />
                        <div className="flex w-full justify-between gap-2 font-extrabold"><strong>Tổng</strong><strong>100.000đ</strong></div>
                        <div className="mt-1.5 text-xs italic text-pos-muted">{form.billFooter || "Cảm ơn quý khách"}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid justify-items-start gap-2.5 rounded-pos border border-[#fde68a] bg-[#fffbeb] p-3.5 [&_p]:m-0 [&_strong]:text-sm">
                    <strong>Dữ liệu mẫu</strong>
                    <p className="text-pos-muted">Chỉ đặt lại dữ liệu mẫu có sẵn, không xoá dữ liệu người dùng tự tạo.</p>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<Trash2 size={15} />}
                      data-testid="open-clear-demo"
                      onClick={(event) => {
                        event.stopPropagation();
                        setClearOpen(true);
                      }}
                    >
                      Đặt lại dữ liệu mẫu
                    </Button>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
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
            <p>Các chỉnh sửa cài đặt chưa lưu sẽ bị huỷ.</p>
            <div className="flex flex-wrap justify-end gap-2.5 [&_.MuiButton-root]:min-w-24">
              <Button variant="outlined" onClick={() => setConfirmCancel(false)}>Ở lại</Button>
              <Button variant="contained" color="error" onClick={() => { setConfirmCancel(false); closeDrawer(); }}>Bỏ thay đổi</Button>
            </div>
          </div>
        </PortalPopup>
      )}

      {clearOpen && <ClearDemoDialog onClose={() => setClearOpen(false)} />}
    </PortalDrawer>
  );
}

function ClearDemoDialog({ onClose }: { onClose: () => void }) {
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const openOrdersQuery = useOpenOrdersQuery();
  const clearDemoMutation = useClearDemoDataMutation(currentEmployee);
  const openCount = openOrdersQuery.data?.length ?? 0;
  const [confirmText, setConfirmText] = useState("");

  const checkingOpenOrders = openOrdersQuery.isLoading || (openOrdersQuery.isFetching && !openOrdersQuery.data);
  const openOrdersError = openOrdersQuery.isError;
  const blocked = openOrdersQuery.isSuccess && openCount > 0;
  const ready = openOrdersQuery.isSuccess && !blocked && confirmText.trim().toUpperCase() === "CLEAR";
  const processing = clearDemoMutation.isPending;

  const checklist = ["Menu mẫu", "Sơ đồ bàn mẫu", "Trang trí mẫu", "Nhân viên mẫu", "Giữ lại tài khoản quản lý"];

  const handleClear = () => {
    clearDemoMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Đã đặt lại dữ liệu mẫu");
        onClose();
      },
      onError: (error) => {
        const uiError = notifyUiError(error);
        if (uiError.action === "closeOpenOrders") {
          void openOrdersQuery.refetch();
        }
      },
    });
  };

  return (
    <PortalPopup
      placement="Centered"
      viewport="workspace"
      overlayClassName="bg-slate-900/50"
      onOutsideClick={processing ? undefined : onClose}
    >
      <div className="grid w-[min(360px,90vw)] gap-3 rounded-pos bg-pos-surface p-6 shadow-[0_20px_60px_rgb(0_0_0_/_25%)] [&_h3]:m-0 [&_p]:m-0 [&_p]:text-sm [&_p]:text-pos-muted max-h-[88%] w-[min(600px,92vw)] overflow-auto text-left" data-testid="clear-demo-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 [&_h3]:m-0">
          <AlertTriangle size={20} color="#b45309" />
          <h3>Đặt lại dữ liệu mẫu</h3>
        </div>
        <p>Thao tác này chỉ đặt lại dữ liệu mẫu có sẵn, không xoá dữ liệu người dùng tự tạo và giữ lại tài khoản quản lý hiện tại.</p>

        {checkingOpenOrders ? (
          <div className="grid gap-1 rounded-pos border border-[#fecaca] bg-[#fef2f2] p-3 [&_strong]:text-pos-danger" data-testid="clear-demo-loading">
            <strong>Đang kiểm tra đơn đang mở...</strong>
            <span className="text-pos-muted">Chờ hệ thống tải danh sách đơn trước khi cho phép đặt lại dữ liệu mẫu.</span>
          </div>
        ) : openOrdersError ? (
          <div className="grid gap-1 rounded-pos border border-[#fecaca] bg-[#fef2f2] p-3 [&_strong]:text-pos-danger" data-testid="clear-demo-error">
            <strong>Không kiểm tra được đơn đang mở</strong>
            <span className="text-pos-muted">{toToastError(openOrdersQuery.error)}</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <Button variant="contained" size="small" onClick={() => void openOrdersQuery.refetch()}>
                Thử kiểm tra lại
              </Button>
            </div>
          </div>
        ) : blocked ? (
          <div className="grid gap-1 rounded-pos border border-[#fecaca] bg-[#fef2f2] p-3 [&_strong]:text-pos-danger" data-testid="clear-demo-blocked">
            <strong>Còn {openCount} đơn đang mở</strong>
            <span className="text-pos-muted">Cần thanh toán hoặc huỷ các đơn đang mở trước khi đặt lại dữ liệu mẫu.</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <Button variant="contained" size="small" onClick={onClose}>Đóng đơn đang mở trước</Button>
            </div>
          </div>
        ) : (
          <>
            <ul className="m-0 grid list-none gap-1.5 p-0 [&_li]:flex [&_li]:items-center [&_li]:gap-2 [&_li]:text-[13px] [&_li]:font-semibold">
              {checklist.map((c) => (
                <li key={c}><CheckCircle2 size={14} color="#0F766E" /> {c}</li>
              ))}
            </ul>
            <TextField
              label='Gõ "CLEAR" để xác nhận'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              size="small"
              fullWidth
              inputProps={{ "data-testid": "clear-demo-confirm-input" }}
            />
          </>
        )}

        <div className="flex flex-wrap justify-end gap-2.5 [&_.MuiButton-root]:min-w-24">
          <Button variant="outlined" onClick={onClose} disabled={processing}>Huỷ</Button>
          <Button
            variant="contained"
            color="error"
            data-testid="clear-demo-confirm-button"
            disabled={!ready || processing || checkingOpenOrders || openOrdersError}
            onClick={handleClear}
          >
            {processing ? "Đang xử lý..." : "Đặt lại dữ liệu"}
          </Button>
        </div>
      </div>
    </PortalPopup>
  );
}
