import { Button } from "@mui/material";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useActiveEmployeesQuery, useStoreSessionQuery, useUnpairStoreMutation, useVerifyEmployeeMutation } from "@/features/session";
import { useAppStore } from "../useAppStore";
import { toToastError } from "../appErrors";
import clsx from "clsx";
export function PasscodeScreen() {
  const setScreen = useAppStore((state) => state.setScreen);
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

  return (
    <main className="grid h-screen w-screen grid-cols-[minmax(280px,0.95fr)_minmax(520px,1.4fr)] overflow-hidden bg-pos-bg [@media(orientation:portrait)]:hidden" data-testid="passcode-screen">
      <section className="grid content-between bg-[#111827] p-[clamp(28px,5vw,72px)] text-white">
        <div className="flex items-center gap-3">
          <div className="grid h-[42px] w-[42px] place-items-center rounded-pos bg-pos-primary font-black text-white">P</div>
          <div>
            <div className="text-base font-bold text-[#f1f5f9]">
              Cửa hàng #{String(storeSessionQuery.data?.session?.storeNo ?? 1).padStart(4, "0")}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#94a3b8]">
              <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#4ade80]" />
              Realtime online
            </div>
          </div>
        </div>
        <div className="grid gap-1">
          <div className="text-[clamp(40px,8vw,72px)] font-extrabold leading-none tracking-normal text-[#f8fafc]">{timeStr}</div>
          <div className="text-[13px] text-[#94a3b8]">{dateStr}</div>
          <p className="mb-0 mt-3 max-w-[340px] text-[13px] leading-[1.5] text-[#64748b]">Nhân viên chọn tên và nhập PIN để mở phiên làm việc.</p>
        </div>
        <span
          className="inline-flex h-[30px] w-fit cursor-pointer items-center rounded-full bg-white px-3.5 text-xs font-bold text-[#475569]"
          onClick={unpair}
        >
          ← Đổi quán / Gỡ ghép
        </span>
      </section>

      <section className={clsx("grid min-h-0 min-w-0 content-center gap-[18px] p-[clamp(22px,4vw,58px)]", shaking && "animate-[pin-shake_0.45s_ease]")}>
        <div className="min-w-0 flex-[1_1_240px] grid gap-1 [&_h1]:m-0 [&_h1]:leading-[1.15] [&_h1]:tracking-normal [&_h2]:m-0 [&_h2]:leading-[1.15] [&_h2]:tracking-normal [&_h3]:m-0 [&_h3]:leading-[1.15] [&_h3]:tracking-normal [&_p]:mb-0 [&_p]:mt-1 [&_p]:overflow-hidden [&_p]:text-ellipsis [&_p]:whitespace-nowrap [&_p]:text-xs [&_p]:text-pos-muted max-sm:[&_h1]:text-[17px] max-sm:[&_h2]:text-[15px] max-sm:[&_h3]:text-[15px]">
          <h2>Chọn nhân viên</h2>
          <p>Ca làm việc · {dateStr}</p>
        </div>

        {employeesQuery.isLoading ? (
          <div className="rounded-pos border border-dashed border-pos-line p-4 text-center text-sm text-pos-muted">Đang tải danh sách nhân viên...</div>
        ) : !employeesQuery.data?.length ? (
          <div className="rounded-pos border border-dashed border-pos-line p-4 text-center text-sm text-pos-muted">Chưa có nhân viên active.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {employeesQuery.data.map((employee) => (
              <button
                key={employee.id}
                className={clsx("grid min-h-[52px] content-start gap-2 rounded-pos border border-pos-line bg-pos-surface px-3 py-2.5 text-left font-extrabold text-pos-ink", employee.id === selectedEmployeeId && "border-[rgb(15_118_110_/_45%)] bg-pos-primarySoft text-pos-primary")}
                data-testid={`employee-${employee.id}`}
                onClick={() => { setSelectedEmployeeId(employee.id); setPinError(""); setPin(""); }}
              >
                <strong className="text-base font-extrabold leading-[1.2] text-pos-ink">{employee.name}</strong>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex min-h-[22px] w-fit items-center rounded-full border border-pos-line bg-pos-surface2 px-2 py-0.5 text-[11px] font-bold text-pos-muted">{roleLabel[employee.role] ?? employee.role}</span>
                  {!employee.isActive && <span className="inline-flex min-h-[22px] w-fit items-center rounded-full border border-pos-line bg-pos-surface2 px-2 py-0.5 text-[11px] font-bold text-pos-muted border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]">Tạm nghỉ</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className={clsx("flex h-[52px] items-center justify-center gap-2.5 rounded-pos border border-pos-line bg-pos-surface", pinError && "border-pos-danger")} aria-label="PIN hiện tại">
          {Array.from({ length: 6 }).map((_, index) => (
            <span className={clsx("h-2.5 w-2.5 rounded-full bg-pos-primary", index < pin.length && "scale-[1.15]")} key={index} />
          ))}
        </div>
        {pinError && <p className="-mt-2.5 mb-0 text-[13px] font-semibold text-pos-danger">{pinError}</p>}

        <div className="grid grid-cols-3 gap-2.5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((value) => (
            <button className="min-h-[52px] rounded-pos border border-pos-line bg-pos-surface px-3 py-2.5 font-extrabold text-pos-ink" data-testid={`pin-${value}`} key={value} onClick={() => appendPin(value)}>
              {value}
            </button>
          ))}
          <button className="min-h-[52px] rounded-pos border border-pos-line bg-pos-surface px-3 py-2.5 font-extrabold text-pos-ink" onClick={backspace} aria-label="Xoá ký tự">⌫</button>
          <button className="min-h-[52px] rounded-pos border border-pos-line bg-pos-surface px-3 py-2.5 font-extrabold text-pos-ink" data-testid="pin-0" onClick={() => appendPin("0")}>0</button>
          <Button
            variant="contained"
            data-testid="unlock-button"
            disabled={!selectedEmployeeId || pin.length < 4 || verifyMutation.isPending}
            onClick={verifyPin}
            className="!rounded-pos !font-bold"
          >
            {verifyMutation.isPending ? "..." : "Mở khoá"}
          </Button>
        </div>
      </section>
    </main>
  );
}
