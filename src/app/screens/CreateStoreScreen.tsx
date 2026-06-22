import { ArrowLeft, CheckCircle2, Copy, Info, Store } from "lucide-react";
import { Button, TextField } from "@mui/material";
import { useState } from "react";
import toast from "react-hot-toast";
import { useCreateStoreMutation } from "@/features/session";
import { useAppStore } from "../useAppStore";
import { toToastError } from "../appErrors";

export function CreateStoreScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [nameError, setNameError] = useState("");
  const createStoreMutation = useCreateStoreMutation();
  const [result, setResult] = useState<{ storeKey: string; adminPin: string; seedStatus: string; canRetrySeed: boolean } | null>(null);

  const handleCreate = () => {
    if (!storeName.trim()) {
      setNameError("Tên quán không được để trống.");
      return;
    }
    setNameError("");
    createStoreMutation.mutate(
      { displayName: storeName.trim() },
      {
        onSuccess: ({ store }) => {
          setResult({
            storeKey: store.storeKey,
            adminPin: store.adminPin,
            seedStatus: store.seedStatus,
            canRetrySeed: store.canRetrySeed,
          });
        },
        onError: (error) => {
          const message = toToastError(error);
          setNameError(message);
          toast.error(message);
        },
      },
    );
  };

  const loading = createStoreMutation.isPending;

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`Đã copy ${label}`),
      () => toast(`Không copy tự động được ${label}.`),
    );
  };

  return (
    <main className="box-border grid h-screen w-screen place-items-center overflow-auto bg-pos-bg p-4" data-testid="create-store-screen">
      <div className="w-[min(960px,100%)] overflow-hidden rounded-pos border border-pos-line bg-pos-surface">
        <header className="flex items-center justify-between border-b border-pos-line bg-pos-surface px-5 py-3.5">
          <button className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent px-0 py-1 text-sm font-semibold text-pos-primary hover:underline" onClick={() => setScreen("landing")}>
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
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-pos-muted">Admin PIN</span>
                <span className="text-[clamp(18px,3vw,24px)] font-extrabold tracking-[0.04em] text-pos-primary" data-testid="result-admin-pin">{result.adminPin}</span>
                <button className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-md border border-pos-line bg-transparent px-2.5 py-1 text-xs font-semibold text-pos-muted hover:border-pos-primary hover:text-pos-primary" onClick={() => copyText(result.adminPin, "Admin PIN")}>
                  <Copy size={14} /> Copy
                </button>
              </div>
            </div>

            <p className="box-border m-0 flex w-full items-start gap-2 rounded-md border border-pos-primaryLine bg-pos-primarySoft px-3 py-2.5 text-[13px] leading-[1.5] text-pos-ink">
              <Info size={15} className="shrink-0 text-pos-primary mt-0.5" />
              Lưu lại Store Key và Admin PIN. Bạn sẽ cần chúng để đăng nhập trên thiết bị khác.
            </p>

            <Button variant="contained" data-testid="go-passcode" onClick={() => setScreen("passcode")}>
              Vào màn hình PIN
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
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
                />
              </div>

              <p className="m-0 flex items-start gap-2 text-[13px] leading-[1.5] text-pos-muted">
                <Info size={15} className="shrink-0 text-pos-primary mt-0.5" />
                Hệ thống sẽ tạo sẵn menu và sơ đồ mẫu để bạn bắt đầu nhanh.
              </p>

              <Button
                variant="contained"
                fullWidth
                data-testid="create-store-button"
                disabled={loading}
                onClick={handleCreate}
              >
                {loading ? "Đang tạo quán..." : "Tạo quán"}
              </Button>

              <button className="cursor-pointer border-0 bg-transparent p-0 text-left text-[13px] font-semibold text-pos-primary hover:underline" onClick={() => setScreen("storePairing")}>
                Đã có quán? Ghép thiết bị
              </button>
            </div>

            <aside className="grid content-start gap-5 border-l border-pos-line bg-pos-surface2 p-[clamp(20px,4vw,40px)]">
              <div className="flex items-start gap-2.5 [&_p]:m-0 [&_p]:text-[13px] [&_p]:leading-[1.5] [&_p]:text-pos-muted">
                <Store size={16} className="shrink-0 text-pos-primary mt-0.5" />
                <p>Store Key sinh ra sau khi tạo, dùng để ghép nhiều thiết bị vào cùng một quán.</p>
              </div>
              <div className="flex items-start gap-2.5 [&_p]:m-0 [&_p]:text-[13px] [&_p]:leading-[1.5] [&_p]:text-pos-muted">
                <CheckCircle2 size={16} className="shrink-0 text-pos-primary mt-0.5" />
                <p>Admin PIN mặc định <strong>123456</strong>. Đổi PIN sau khi vào hệ thống.</p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
