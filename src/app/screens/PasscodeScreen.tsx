import { Button } from "@mui/material";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useActiveEmployeesQuery, useStoreSessionQuery, useUnpairStoreMutation, useVerifyEmployeeMutation } from "@/features/session";
import { useAppStore } from "../useAppStore";
import { toToastError } from "../appErrors";
import clsx from "clsx";
export function PasscodeScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
  const setCurrentEmployee = useAppStore((state) => state.setCurrentEmployee);
  const storeSessionQuery = useStoreSessionQuery();
  const employeesQuery = useActiveEmployeesQuery();
  const verifyMutation = useVerifyEmployeeMutation();
  const unpairMutation = useUnpairStoreMutation();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [shaking, setShaking] = useState(false);

  const roleLabel: Record<string, string> = { admin: "Quản lý", cashier: "Thu ngân", kitchen: "Bếp" };

  const now = new Date();
  const dateStr = now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    if (!selectedEmployeeId && employeesQuery.data?.length) {
      setSelectedEmployeeId(employeesQuery.data[0].id);
    }
  }, [employeesQuery.data, selectedEmployeeId]);

  const verifyPin = () => {
    verifyMutation.mutate(
      { employeeId: selectedEmployeeId, pin },
      {
        onSuccess: (employee) => {
          setCurrentEmployee(employee);
          toast.success(`Xin chào ${employee.name}`);
        },
        onError: (error) => {
          const msg = toToastError(error);
          setPinError(msg);
          setPin("");
          setShaking(true);
          setTimeout(() => setShaking(false), 500);
        },
      },
    );
  };

  const unpair = () => {
    unpairMutation.mutate(undefined, {
      onSuccess: () => {
        setCurrentEmployee(null);
        setPin("");
        setSelectedEmployeeId("");
        setScreen("landing");
        toast.success("Đã gỡ ghép thiết bị");
      },
      onError: (error) => {
        const msg = toToastError(error);
        setPinError(msg);
        toast.error(msg);
      },
    });
  };

  const appendPin = (value: string) => {
    setPinError("");
    setPin((current) => (current.length < 6 ? `${current}${value}` : current));
  };

  const backspace = () => {
    setPinError("");
    setPin((current) => current.slice(0, -1));
  };

  const keypadButtonClass = "flex min-h-0 items-center justify-center rounded-pos border border-pos-line bg-pos-surface text-[clamp(18px,3dvh,38px)] font-extrabold text-pos-ink";

  return (
    <main
      className="flex min-h-[100dvh] w-full flex-col overflow-y-auto overflow-x-hidden bg-pos-bg"
      data-testid="passcode-screen"
    >
      {/* Top nav — flush to the top edge, full width */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-[#111827] px-[clamp(16px,2.5vw,48px)] py-[clamp(10px,1.4vw,22px)] text-white">
        <div className="flex min-w-0 items-center gap-[clamp(10px,1vw,18px)]">
          <div className="grid h-[clamp(40px,3.2vw,60px)] w-[clamp(40px,3.2vw,60px)] shrink-0 place-items-center rounded-pos bg-pos-primary text-[clamp(16px,1.6vw,26px)] font-black text-white">P</div>
          <div className="min-w-0">
            <div className="truncate text-[clamp(15px,1.1vw,24px)] font-bold text-[#f1f5f9]">
              Cửa hàng #{String(storeSessionQuery.data?.session?.storeNo ?? 1).padStart(4, "0")}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[clamp(11px,0.8vw,15px)] text-[#94a3b8]">
              <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#4ade80]" />
              Realtime online
            </div>
          </div>
        </div>
        <div className="text-[clamp(16px,1.6vw,30px)] font-bold text-[#f8fafc] max-[560px]:hidden">{timeStr}</div>
        <span
          className="inline-flex h-[clamp(30px,2.4vw,44px)] w-fit shrink-0 cursor-pointer items-center rounded-full bg-white px-[clamp(14px,1vw,22px)] text-[clamp(12px,0.9vw,16px)] font-bold text-[#475569]"
          onClick={unpair}
        >
          ← Đổi quán / Gỡ ghép
        </span>
      </header>

      {/* Body — split in two halves with a small gap */}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-[clamp(10px,1.5vw,24px)] p-[clamp(12px,2vw,40px)] max-[700px]:flex max-[700px]:flex-col max-[700px]:gap-3 max-[700px]:p-3">
        {/* Left — employee picker, only this column scrolls */}
        <section className="flex min-h-0 flex-col gap-[clamp(8px,1vh,16px)] max-[700px]:shrink-0">
          <div className="shrink-0">
            <h2 className="m-0 text-[clamp(16px,1.6vw,30px)] font-bold leading-tight tracking-normal text-pos-ink">Chọn nhân viên</h2>
            <p className="m-0 mt-0.5 truncate text-[clamp(12px,0.9vw,16px)] text-pos-muted">Ca làm việc · {dateStr}</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-0.5 max-[700px]:max-h-[150px] max-[700px]:flex-none">
            {employeesQuery.isLoading ? (
              <div className="rounded-pos border border-dashed border-pos-line p-4 text-center text-sm text-pos-muted">Đang tải danh sách nhân viên...</div>
            ) : !employeesQuery.data?.length ? (
              <div className="rounded-pos border border-dashed border-pos-line p-4 text-center text-sm text-pos-muted">Chưa có nhân viên active.</div>
            ) : (
              <div className="grid grid-cols-2 content-start gap-[clamp(8px,1vw,18px)] [grid-auto-rows:min-content] xl:grid-cols-3">
                {employeesQuery.data.map((employee) => (
                  <button
                    key={employee.id}
                    className={clsx(
                      "grid min-h-[clamp(64px,9dvh,116px)] content-start gap-[clamp(6px,0.8dvh,12px)] rounded-pos border px-[clamp(12px,1.1vw,26px)] py-[clamp(10px,1dvh,20px)] text-left font-extrabold max-[700px]:min-h-[54px] max-[700px]:gap-1.5 max-[700px]:px-3 max-[700px]:py-2",
                      employee.id === selectedEmployeeId
                        ? "border-[rgb(15_118_110_/_45%)] bg-pos-primarySoft text-pos-primary"
                        : "border-pos-line bg-pos-surface text-pos-ink",
                    )}
                    data-testid={`employee-${employee.id}`}
                    onClick={() => { setSelectedEmployeeId(employee.id); setPinError(""); setPin(""); }}
                  >
                    <strong className="truncate text-[clamp(15px,1.1vw,24px)] font-extrabold leading-[1.2] text-pos-ink">{employee.name}</strong>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex min-h-[22px] w-fit items-center rounded-full border border-pos-line bg-pos-surface2 px-2 py-0.5 text-[clamp(11px,0.7vw,14px)] font-bold text-pos-muted">{roleLabel[employee.role] ?? employee.role}</span>
                      {!employee.isActive && <span className="inline-flex min-h-[22px] w-fit items-center rounded-full border border-[#fed7aa] bg-[#fff7ed] px-2 py-0.5 text-[clamp(11px,0.7vw,14px)] font-bold text-[#c2410c]">Tạm nghỉ</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right — passcode entry, scales with the viewport, never scrolls */}
        <section className="flex min-h-0 items-center justify-center max-[700px]:items-start">
          <div className={clsx("flex h-full max-h-[min(86dvh,630px)] w-full max-w-[min(92%,560px)] flex-col gap-[clamp(8px,1.6dvh,22px)] max-[700px]:h-[300px] max-[700px]:max-h-none max-[700px]:max-w-none max-[700px]:gap-2", shaking && "animate-[pin-shake_0.45s_ease]")}>
            <div className={clsx("flex h-[clamp(44px,8dvh,96px)] shrink-0 items-center justify-center gap-[clamp(8px,1vw,18px)] rounded-pos border border-pos-line bg-pos-surface", pinError && "border-pos-danger")} aria-label="PIN hiện tại">
              {Array.from({ length: 6 }).map((_, index) => (
                <span className={clsx("h-[clamp(10px,1.2dvh,18px)] w-[clamp(10px,1.2dvh,18px)] rounded-full transition-colors", index < pin.length ? "bg-pos-ink" : "bg-transparent")} key={index} />
              ))}
            </div>
            {pinError && <p className="m-0 shrink-0 text-center text-[clamp(12px,1vw,16px)] font-semibold text-pos-danger">{pinError}</p>}

            <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-4 gap-[clamp(6px,1.2dvh,18px)]">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((value) => (
                <button className={keypadButtonClass} data-testid={`pin-${value}`} key={value} onClick={() => appendPin(value)}>
                  {value}
                </button>
              ))}
              <button className={keypadButtonClass} onClick={backspace} aria-label="Xoá ký tự">⌫</button>
              <button className={keypadButtonClass} data-testid="pin-0" onClick={() => appendPin("0")}>0</button>
              <Button
                variant="contained"
                data-testid="unlock-button"
                disabled={!selectedEmployeeId || pin.length < 4 || verifyMutation.isPending}
                onClick={verifyPin}
                className="!min-h-0 !rounded-pos !text-[clamp(14px,1.3vw,24px)] !font-bold"
              >
                {verifyMutation.isPending ? "..." : "Mở khoá"}
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
