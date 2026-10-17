import { ArrowLeft, CheckCircle2, Copy, Info, Store } from "lucide-react";
import { Button, Checkbox, FormControlLabel, TextField } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useCreateStoreMutation } from "@/features/session";
import { useAppStore } from "../useAppStore";
import { toToastError } from "../appErrors";
import { usePorts } from "@/features/shared/portsContext";
import { isAppError } from "@/core/appError";

const createStoreErrorMessage = (error: unknown): string => {
  if (!isAppError(error)) return toToastError(error);
  switch (error.code) {
    case "AUTH_REQUIRED": return "Chưa xác nhận được tài khoản cửa hàng. Giữ trang này và thử lại.";
    case "INVALID_WRITE_REQUEST": return "Tên quán phải có 1–120 ký tự, địa chỉ tối đa 500 ký tự và lựa chọn dữ liệu mẫu phải hợp lệ.";
    case "BOOTSTRAP_CONFLICT": return "Thông tin tạo quán không khớp yêu cầu ban đầu. Đã dừng để tránh tạo trùng quán.";
    case "PERMISSION_UPDATE_UNAVAILABLE": return "Chưa xác nhận được việc tạo quán. Giữ trang này và thử lại để tiếp tục cùng yêu cầu.";
    default: return toToastError(error);
  }
};

export function CreateStoreScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const createdStoreResult = useAppStore((state) => state.createdStoreResult);
  const setCreatedStoreResult = useAppStore((state) => state.setCreatedStoreResult);
  const pendingStoreCreationInput = useAppStore(state => state.pendingStoreCreationInput);
  const setPendingStoreCreationInput = useAppStore(state => state.setPendingStoreCreationInput);
  const ports = usePorts();
  const [storeName, setStoreName] = useState(pendingStoreCreationInput?.displayName ?? "");
  const [address, setAddress] = useState(pendingStoreCreationInput?.address ?? "");
  const [seedDemo, setSeedDemo] = useState(pendingStoreCreationInput?.seedDemo ?? false);
  const [nameError, setNameError] = useState("");
  const [keyLossAcknowledged, setKeyLossAcknowledged] = useState(!!pendingStoreCreationInput);
  const submitLatched = useRef(false);
  const createStoreMutation = useCreateStoreMutation((store) => setCreatedStoreResult({
    storeKey: store.storeKey, adminPin: store.adminPin, seedStatus: store.seedStatus, canRetrySeed: store.canRetrySeed,
  }));
  const result = createdStoreResult;

  const handleCreate = () => {
    const canonicalName = pendingStoreCreationInput?.displayName ?? storeName.trim();
    const canonicalAddress = pendingStoreCreationInput?.address ?? address.trim();
    if (!canonicalName || Array.from(canonicalName).length > 120 || Array.from(canonicalAddress).length > 500) {
      setNameError("Tên quán phải có 1–120 ký tự, địa chỉ tối đa 500 ký tự và lựa chọn dữ liệu mẫu phải hợp lệ.");
      return;
    }
    if (!keyLossAcknowledged) {
      setNameError("Hãy xác nhận bạn đã hiểu cách lưu Store Key trước khi tạo quán.");
      return;
    }
    if (submitLatched.current || createStoreMutation.isPending) return;
    submitLatched.current = true;
    setNameError("");
    const input = pendingStoreCreationInput ?? { displayName: canonicalName, address: canonicalAddress || undefined, seedDemo };
    if (!pendingStoreCreationInput) {
      // Freeze the same canonical values that the long-lived runtime context uses.
      // Keeping the disabled form canonical also makes a same-mount retry and a
      // remount retry visibly identical after an uncertain network result.
      setStoreName(canonicalName);
      setAddress(canonicalAddress);
      setPendingStoreCreationInput(input);
    }
    createStoreMutation.mutate(
      input,
      {
        onSuccess: () => { submitLatched.current = false; },
        onError: (error) => {
          submitLatched.current = false;
          const message = createStoreErrorMessage(error);
          setNameError(message);
          toast.error(message);
        },
      },
    );
  };

  const loading = createStoreMutation.isPending;
  const acknowledgeStoreKey = () => {
    ports.auth.acknowledgeCreatedStore();
    setCreatedStoreResult(null);
    setPendingStoreCreationInput(null);
    setScreen("passcode");
  };

  useEffect(() => {
    if (!loading && !result && !pendingStoreCreationInput) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [loading, pendingStoreCreationInput, result]);

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`Đã copy ${label}`),
      () => toast(`Không copy tự động được ${label}.`),
    );
  };

  return (
    <main className="box-border grid min-h-[100dvh] w-full place-items-center overflow-y-auto overflow-x-hidden bg-pos-bg p-4" data-testid="create-store-screen">
      <div className="w-[min(960px,100%)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
        <header className="flex items-center justify-between border-b border-pos-line bg-pos-surface px-5 py-3.5">
          <button className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent px-0 py-1 text-sm font-semibold text-pos-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setScreen("landing")} disabled={!!result || loading || !!pendingStoreCreationInput}>
            <ArrowLeft size={16} />
            Quay lại
          </button>
          <div className="flex items-center gap-2.5">
            <div className="grid h-[42px] w-[42px] place-items-center rounded-pos bg-pos-primary font-black text-white">P</div>
            <span className="text-base font-bold text-pos-ink">POS Cafe</span>
          </div>
        </header>

        {result ? (
          <div className="grid justify-items-start gap-[18px] p-[clamp(24px,5vw,48px)] [&_h2]:m-0 [&_h2]:text-[clamp(20px,3vw,28px)]" data-testid="create-store-result">
            <div className="mb-1">
              <CheckCircle2 size={40} color="#15803d" />
            </div>
            <h2>Tạo quán thành công!</h2>
            <p className="text-pos-muted">Lưu lại thông tin bên dưới trước khi tiếp tục.</p>

            <div className="flex w-full flex-wrap gap-4">
              <div className="grid flex-[1_1_180px] gap-1.5 rounded-pos border border-pos-line bg-pos-surface2 px-4 py-3.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-pos-muted">Store Key</span>
                <span className="text-[clamp(18px,3vw,24px)] font-extrabold tracking-[0.04em] text-pos-primary" data-testid="result-store-key">{result.storeKey}</span>
                <button className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-md border border-pos-line bg-transparent px-2.5 py-1 text-xs font-semibold text-pos-muted hover:border-pos-primary hover:text-pos-primary" onClick={() => copyText(result.storeKey, "Store Key")}>
                  <Copy size={14} /> Copy
                </button>
              </div>
              <div className="grid flex-[1_1_180px] gap-1.5 rounded-pos border border-pos-line bg-pos-surface2 px-4 py-3.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-pos-muted">PIN tạm thời</span>
                <span className="text-[clamp(18px,3vw,24px)] font-extrabold tracking-[0.04em] text-pos-primary" data-testid="result-admin-pin">{result.adminPin}</span>
                <button className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-md border border-pos-line bg-transparent px-2.5 py-1 text-xs font-semibold text-pos-muted hover:border-pos-primary hover:text-pos-primary" onClick={() => copyText(result.adminPin, "PIN tạm thời")}>
                  <Copy size={14} /> Copy
                </button>
              </div>
            </div>

            <p className="box-border m-0 flex w-full items-start gap-2 rounded-md border border-pos-primaryLine bg-pos-primarySoft px-3 py-2.5 text-[13px] leading-[1.5] text-pos-ink">
              <Info size={15} className="shrink-0 text-pos-primary mt-0.5" />
              PIN tạm thời: 123456. Bạn phải đổi PIN trước khi sử dụng quán.
            </p>

            <Button variant="contained" data-testid="acknowledge-store-key" onClick={acknowledgeStoreKey}>
              Tôi đã lưu Store Key.
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] max-[700px]:grid-cols-1">
            <div className="grid gap-4 p-[clamp(20px,4vw,40px)]">
              <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] mb-5">
                <h2>Tạo quán mới</h2>
                <p>Thiết lập thông tin quán để nhận Store Key và Admin PIN.</p>
              </div>

              <div className="grid gap-1">
                <TextField
                  label="Tên quán"
                  placeholder="Cafe Sáng"
                  value={storeName}
                  onChange={(e) => { setStoreName(e.target.value); setNameError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  error={!!nameError}
                  helperText={nameError}
                  fullWidth
                  size="small"
                  disabled={!!pendingStoreCreationInput}
                  inputProps={{ "data-testid": "store-name-input" }}
                />
              </div>

              <div className="grid gap-1">
                <TextField
                  label="Địa chỉ (tuỳ chọn)"
                  placeholder="123 Nguyễn Huệ, Q.1"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  fullWidth
                  size="small"
                  disabled={!!pendingStoreCreationInput}
                />
              </div>

              <FormControlLabel
                className="m-0 items-start"
                control={
                  <Checkbox
                    size="small"
                    checked={seedDemo}
                    onChange={(e) => setSeedDemo(e.target.checked)}
                    disabled={!!pendingStoreCreationInput}
                    inputProps={{ "data-testid": "seed-demo-checkbox" } as Record<string, string>}
                  />
                }
                label={
                  <span className="text-[13px] leading-[1.5] text-pos-ink">
                    Khởi tạo sẵn dữ liệu mẫu để demo nhanh
                    <span className="block text-xs text-pos-muted">Tạo thêm vài món, sơ đồ bàn mẫu và một thu ngân demo. Bỏ trống nếu muốn quán trống.</span>
                  </span>
                }
              />

              <FormControlLabel
                className="m-0 items-start"
                control={<Checkbox size="small" checked={keyLossAcknowledged}
                  onChange={event => { setKeyLossAcknowledged(event.target.checked); setNameError(""); }}
                  disabled={!!pendingStoreCreationInput}
                  inputProps={{ "data-testid": "key-loss-acknowledgement" } as Record<string, string>} />}
                label={<span className="text-[13px] leading-[1.5] text-pos-ink">
                  Tôi hiểu và sẽ lưu Store Key trước khi rời trang.
                  <span className="block text-xs text-pos-muted">Store Key chỉ hiển thị trong lần tạo quán này. Nếu tải lại hoặc đóng trang trước khi lưu mã, bạn có thể mất quyền truy cập quán.</span>
                </span>}
              />

              <Button
                variant="contained"
                fullWidth
                data-testid="create-store-button"
                disabled={loading || !keyLossAcknowledged}
                onClick={handleCreate}
              >
                {loading ? "Đang tạo quán..." : pendingStoreCreationInput ? "Thử lại tạo quán" : "Tạo quán"}
              </Button>

              <button className="cursor-pointer border-0 bg-transparent p-0 text-left text-[13px] font-semibold text-pos-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50" disabled={!!pendingStoreCreationInput || loading} onClick={() => setScreen("storePairing")}>
                Đã có quán? Ghép thiết bị
              </button>
            </div>

            <aside className="grid content-start gap-5 border-l border-pos-line bg-pos-surface2 p-[clamp(20px,4vw,40px)] max-[700px]:border-l-0 max-[700px]:border-t">
              <div className="flex items-start gap-2.5 [&_p]:m-0 [&_p]:text-[13px] [&_p]:leading-[1.5] [&_p]:text-pos-muted">
                <Store size={16} className="shrink-0 text-pos-primary mt-0.5" />
                <p>Store Key sinh ra sau khi tạo, dùng để ghép nhiều thiết bị vào cùng một quán.</p>
              </div>
              <div className="flex items-start gap-2.5 [&_p]:m-0 [&_p]:text-[13px] [&_p]:leading-[1.5] [&_p]:text-pos-muted">
                <CheckCircle2 size={16} className="shrink-0 text-pos-primary mt-0.5" />
                <p>PIN tạm thời <strong>123456</strong>. Bạn phải đổi PIN trước khi sử dụng quán.</p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
