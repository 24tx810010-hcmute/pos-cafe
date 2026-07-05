import { LogIn, Store } from "lucide-react";
import { useAppStore } from "../useAppStore";

export function LandingScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  return (
    <main className="min-h-[100dvh] w-full overflow-y-auto bg-pos-bg" data-testid="landing-screen">
      <div className="flex min-h-[100dvh] w-full items-center justify-center px-[clamp(16px,4vw,48px)] py-[clamp(20px,4vw,56px)]">
        <div className="grid w-[min(960px,100%)] gap-[clamp(18px,3.5vw,28px)]">
          <header className="flex items-center gap-3">
            <div className="grid h-[42px] w-[42px] place-items-center rounded-pos bg-pos-primary font-black text-white">P</div>
            <span className="text-base font-bold text-pos-ink">POS Cafe</span>
          </header>
          <div className="[&_h1]:mb-2 [&_h1]:mt-0 [&_h1]:text-[clamp(26px,5vw,44px)] [&_h1]:leading-[1.1] [&_h1]:tracking-normal [&_p]:m-0 [&_p]:max-w-[520px] [&_p]:text-[clamp(13px,2vw,15px)] [&_p]:text-pos-muted">
            <h1>POS quán cà phê</h1>
            <p>Quản lý order, bàn, menu và thanh toán trên nhiều thiết bị.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              className="grid cursor-pointer gap-1.5 rounded-pos border-[1.5px] border-pos-line bg-pos-surface p-[clamp(14px,3vw,26px)] text-left transition-[border-color,box-shadow] hover:border-pos-primary hover:shadow-[0_0_0_3px_rgb(15_118_110_/_12%)] focus-visible:border-pos-primary focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgb(15_118_110_/_12%)] [&_span]:text-[13px] [&_span]:leading-[1.4] [&_span]:text-pos-muted [&_strong]:block [&_strong]:text-[clamp(15px,2.2vw,19px)] [&_strong]:text-pos-ink"
              data-testid="go-store-pairing"
              onClick={() => setScreen("storePairing")}
              onKeyDown={(e) => e.key === "Enter" && setScreen("storePairing")}
            >
              <LogIn size={26} className="shrink-0 text-pos-primary" />
              <strong>Đã có quán</strong>
              <span>Nhập Store Key để ghép máy vào quán hiện có.</span>
            </button>
            <button
              className="grid cursor-pointer gap-1.5 rounded-pos border-[1.5px] border-pos-line bg-pos-surface p-[clamp(14px,3vw,26px)] text-left transition-[border-color,box-shadow] hover:border-pos-primary hover:shadow-[0_0_0_3px_rgb(15_118_110_/_12%)] focus-visible:border-pos-primary focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgb(15_118_110_/_12%)] [&_span]:text-[13px] [&_span]:leading-[1.4] [&_span]:text-pos-muted [&_strong]:block [&_strong]:text-[clamp(15px,2.2vw,19px)] [&_strong]:text-pos-ink"
              data-testid="go-create-store"
              onClick={() => setScreen("createStore")}
              onKeyDown={(e) => e.key === "Enter" && setScreen("createStore")}
            >
              <Store size={26} className="shrink-0 text-pos-primary" />
              <strong>Tạo quán mới</strong>
              <span>Thiết lập quán và nhận Store Key + Admin PIN.</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
