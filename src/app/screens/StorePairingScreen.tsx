import { ArrowLeft, KeyRound, RotateCcw, Store } from "lucide-react";
import { Button, TextField } from "@mui/material";
import { useState } from "react";
import toast from "react-hot-toast";
import { usePairStoreMutation } from "@/features/session";
import { useAppStore } from "../useAppStore";
import { toToastError } from "../appErrors";

const sampleStoreKey = "0001-X8F3QA";

export function StorePairingScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const pairMutation = usePairStoreMutation();

  const validateKey = (value: string) => {
    const parts = value.split("-");
    if (parts.length < 2) return false;
    const [before, ...rest] = parts;
    const after = rest.join("-");
    return /\d/.test(before) && after.length >= 4;
  };

  const handleSubmit = () => {
    if (!validateKey(key)) {
      setError("Sai định dạng. Ví dụ: 0001-X8F3QA");
      return;
    }
    setError("");
    pairMutation.mutate(key.trim(), {
      onSuccess: () => {
        toast.success("Đã ghép thiết bị");
        setScreen("passcode");
      },
      onError: (submitError) => {
        setError(toToastError(submitError));
      },
    });
  };

  const loading = pairMutation.isPending;


  return (
    <main className="box-border grid h-screen w-screen place-items-center overflow-auto bg-pos-bg p-4" data-testid="store-pairing-screen">
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

        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="grid gap-4 p-[clamp(20px,4vw,40px)]">
            <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px] mb-5">
              <h2>Ghép thiết bị với quán</h2>
              <p>Nhập Store Key do quản lý cung cấp để ghép thiết bị vào quán.</p>
            </div>

            <div className="grid gap-1">
              <TextField
                label="Store Key"
                placeholder={sampleStoreKey}
                value={key}
                onChange={(e) => { setKey(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                error={!!error}
                helperText={error || "Mỗi thiết bị chỉ cần ghép một lần với quán."}
                fullWidth
                size="small"
                inputProps={{ "data-testid": "store-key-input" }}
              />
            </div>

            <Button
              variant="contained"
              fullWidth
              data-testid="go-passcode"
              disabled={loading}
              onClick={handleSubmit}
            >
              {loading ? "Đang ghép..." : "Ghép thiết bị"}
            </Button>

            <button className="cursor-pointer border-0 bg-transparent p-0 text-left text-[13px] font-semibold text-pos-primary hover:underline" onClick={() => setScreen("createStore")}>
              Chưa có quán? Tạo quán mới
            </button>
          </div>

          <aside className="grid content-start gap-5 border-l border-pos-line bg-pos-surface2 p-[clamp(20px,4vw,40px)]">
            <div className="flex items-start gap-2.5 [&_p]:m-0 [&_p]:text-[13px] [&_p]:leading-[1.5] [&_p]:text-pos-muted">
              <Store size={16} className="shrink-0 text-pos-primary mt-0.5" />
              <p>Một Store Key dùng được cho nhiều thiết bị trong cùng quán.</p>
            </div>
            <div className="flex items-start gap-2.5 [&_p]:m-0 [&_p]:text-[13px] [&_p]:leading-[1.5] [&_p]:text-pos-muted">
              <KeyRound size={16} className="shrink-0 text-pos-primary mt-0.5" />
              <p>Mỗi ngày nhân viên chọn tên và nhập mã PIN để vào ca.</p>
            </div>
            <div className="flex items-start gap-2.5 [&_p]:m-0 [&_p]:text-[13px] [&_p]:leading-[1.5] [&_p]:text-pos-muted">
              <RotateCcw size={16} className="shrink-0 text-pos-primary mt-0.5" />
              <p>Có thể đổi quán bất cứ lúc nào từ màn hình đăng nhập.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
