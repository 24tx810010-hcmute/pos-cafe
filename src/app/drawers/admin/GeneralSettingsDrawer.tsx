import clsx from "clsx";
import { AlertTriangle, Database, PackagePlus, ReceiptText, Save, ShieldAlert, Store, Trash2 } from "lucide-react";
import { Button, TextField } from "@mui/material";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { canAccessModule } from "@/core/guards";
import { useStoreSessionQuery } from "@/features/session";
import {
  useSeedDemoDataMutation,
  useStoreSettingsQuery,
  useUpdateSettingsMutation,
} from "@/features/admin";
import { useAppStore } from "../../useAppStore";
import { toToastError } from "../../appErrors";
import { PortalDrawer } from "../../components/PortalDrawer";
import { PortalPopup } from "../../components/PortalPopup";
import { ClearDemoDialog } from "./ClearDemoDialog";

type SettingsSection = "info" | "bill" | "demo";
interface SettingsForm {
  displayName: string;
  address: string;
  billFooter: string;
}

const SECTIONS: Array<{ key: SettingsSection; label: string; desc: string; detail: string; icon: ReactNode }> = [
  { key: "info", label: "Thông tin quán", desc: "Tên hiển thị, địa chỉ", detail: "Hiển thị ở màn hình chọn bàn và phần đầu của hoá đơn in.", icon: <Store size={18} /> },
  { key: "bill", label: "Hoá đơn", desc: "Chân hoá đơn, xem trước bill", detail: "Dòng chữ in ở cuối mỗi hoá đơn.", icon: <ReceiptText size={18} /> },
  { key: "demo", label: "Bảo trì dữ liệu", desc: "Dữ liệu mẫu, đặt lại", detail: "Chỉ ảnh hưởng dữ liệu mẫu — dữ liệu bạn tự tạo được giữ nguyên.", icon: <Database size={18} /> },
];

export function GeneralSettingsDrawer() {
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const allowed = canAccessModule(currentEmployee, "settings");
  const settingsQuery = useStoreSettingsQuery();
  const sessionQuery = useStoreSessionQuery();
  const storeNoLabel = sessionQuery.data?.status === "paired" ? String(sessionQuery.data.session.storeNo).padStart(4, "0") : "—";
  const updateSettingsMutation = useUpdateSettingsMutation(currentEmployee);
  const seedDemoMutation = useSeedDemoDataMutation(currentEmployee);

  const handleSeedDemo = () => {
    seedDemoMutation.mutate(undefined, {
      onSuccess: () => toast.success("Đã khởi tạo dữ liệu mẫu"),
      onError: (error) => toast.error(toToastError(error)),
    });
  };

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

  const activeSection = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0];

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

      <div className="min-h-0 overflow-hidden bg-pos-bg">
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
          <div className="grid h-full min-h-0 grid-cols-[264px_minmax(0,1fr)] max-[980px]:grid-cols-1 max-[980px]:grid-rows-[auto_minmax(0,1fr)]">
            <aside className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3 border-r border-pos-line bg-pos-surface2 p-3.5 max-[980px]:grid-rows-none max-[980px]:border-b max-[980px]:border-r-0 max-[980px]:p-2">
              <div className="grid content-start gap-2 overflow-auto [scrollbar-width:thin] max-[980px]:flex max-[980px]:overflow-x-auto max-[980px]:overflow-y-hidden">
                {SECTIONS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={clsx(
                      "flex min-h-14 cursor-pointer items-center gap-3 rounded-[10px] border p-3 text-left max-[980px]:min-h-11 max-[980px]:min-w-[150px] max-[980px]:shrink-0 max-[980px]:p-2.5",
                      section === s.key
                        ? "border-pos-primaryLine bg-white shadow-[0_8px_18px_rgb(15_23_42_/_6%)]"
                        : "border-transparent bg-transparent",
                    )}
                    data-testid={`settings-section-${s.key}`}
                    onClick={() => setSection(s.key)}
                  >
                    <span
                      className={clsx(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-[9px]",
                        section === s.key
                          ? "bg-pos-primarySoft text-pos-primary"
                          : s.key === "demo"
                            ? "bg-[#fffbeb] text-pos-warning"
                            : "bg-[#eef2f7] text-pos-muted",
                      )}
                    >
                      {s.icon}
                    </span>
                    <span className="grid min-w-0 gap-0.5">
                      <strong className={clsx("text-[13.5px] leading-tight", section === s.key && "text-pos-primary")}>{s.label}</strong>
                      <span aria-hidden="true" className="text-[11.5px] leading-tight text-pos-muted max-[980px]:hidden">{s.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="grid gap-0.5 rounded-[10px] border border-pos-line bg-white p-3 max-[980px]:hidden">
                <span className="text-[9.5px] font-black uppercase tracking-[0.05em] text-[#64748b]">Mã quán</span>
                <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px]">{storeNoLabel} · {form.displayName || "Chưa đặt tên"}</strong>
              </div>
            </aside>

            <section className="grid min-h-0 content-start gap-3.5 overflow-auto p-5 max-[980px]:p-3">
              <div className="[&_h3]:m-0 [&_h3]:text-base [&_p]:mb-0 [&_p]:mt-1 [&_p]:text-[12.5px] [&_p]:text-pos-muted">
                <h3>{activeSection.label}</h3>
                <p>{activeSection.detail}</p>
              </div>

              {section === "info" ? (
                <div className="grid content-start gap-5 rounded-pos border border-pos-line bg-pos-surface p-5 max-[980px]:p-3">
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
                  <TextField label="Địa chỉ" value={form.address} onChange={(e) => patch({ address: e.target.value })} size="small" fullWidth multiline minRows={2} helperText="In ngay dưới tên quán trên hoá đơn." />
                </div>
              ) : section === "bill" ? (
                <div className="grid content-start gap-5 rounded-pos border border-pos-line bg-pos-surface p-5 max-[980px]:p-3">
                  <TextField label="Chân hoá đơn" value={form.billFooter} onChange={(e) => patch({ billFooter: e.target.value })} size="small" fullWidth multiline minRows={3} helperText="Xuống dòng để in thành nhiều dòng." />
                  <div className="grid gap-1.5 border-t border-dashed border-pos-line pt-3">
                    <span className="text-xs font-extrabold text-pos-muted">Xem trước hoá đơn</span>
                    <div className="grid justify-items-center gap-1.5 rounded-pos border border-dashed border-pos-line bg-pos-surface2 p-4 text-center text-[13px]">
                      <strong className="text-base tracking-[0.02em]">{form.displayName || "Tên quán"}</strong>
                      {form.address && <span className="text-xs text-pos-muted">{form.address}</span>}
                      <div className="my-1 w-full border-t border-dashed border-pos-line" />
                      <div className="flex w-full justify-between gap-2"><span>Cà phê sữa × 2</span><span>58.000</span></div>
                      <div className="flex w-full justify-between gap-2"><span>Trà đào × 1</span><span>42.000</span></div>
                      <div className="my-1 w-full border-t border-dashed border-pos-line" />
                      <div className="flex w-full justify-between gap-2 font-extrabold"><strong>Tổng</strong><strong>100.000đ</strong></div>
                      <div className="mt-1.5 whitespace-pre-line text-xs italic text-pos-muted">{form.billFooter || "Cảm ơn quý khách"}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid justify-items-start gap-2.5 rounded-pos border border-[#fde68a] bg-[#fffbeb] p-3.5 [&_p]:m-0 [&_strong]:text-sm">
                  <strong>Dữ liệu mẫu</strong>
                  <p className="text-pos-muted">Khởi tạo bộ dữ liệu mẫu (menu, sơ đồ bàn, thu ngân demo) để thử nhanh, hoặc đặt lại/xoá phần dữ liệu mẫu. Không ảnh hưởng dữ liệu bạn tự tạo.</p>
                  <div className="flex flex-wrap gap-2.5">
                    <Button
                      variant="outlined"
                      startIcon={<PackagePlus size={15} />}
                      data-testid="seed-demo-button"
                      disabled={seedDemoMutation.isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleSeedDemo();
                      }}
                    >
                      {seedDemoMutation.isPending ? "Đang khởi tạo..." : "Khởi tạo dữ liệu mẫu"}
                    </Button>
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
                </div>
              )}
            </section>
          </div>
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
