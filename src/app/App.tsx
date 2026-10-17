import { useEffect } from "react";
import toast from "react-hot-toast";
import { useStoreSessionQuery } from "@/features/session";
import { PermissionLifecycle } from "./PermissionLifecycle";
import { useAppStore } from "./useAppStore";
import { toToastError } from "./appErrors";
import { RotateGuidance } from "./screens/RotateGuidance";
import { LandingScreen } from "./screens/LandingScreen";
import { StorePairingScreen } from "./screens/StorePairingScreen";
import { CreateStoreScreen } from "./screens/CreateStoreScreen";
import { PasscodeScreen } from "./screens/PasscodeScreen";
import { RequiredPinChangeScreen } from "./screens/RequiredPinChangeScreen";
import { AppShell } from "./shell/AppShell";
import { requireCompatibilityUpdate } from "./compatibilityGate";
import { usePermissionSession } from "@/features/shared/permissionSession";
import { InitialSeedLifecycle } from "./InitialSeedLifecycle";
import { usePorts } from "@/features/shared/portsContext";

export const wasPageReloaded = (entries: readonly Pick<PerformanceNavigationTiming, "type">[] =
  performance.getEntriesByType("navigation") as PerformanceNavigationTiming[]): boolean =>
  entries.some(entry => entry.type === "reload");

export function ReloadRecoveryNotice({ reloaded = wasPageReloaded() }: { reloaded?: boolean }) {
  if (!reloaded) return null;
  return <p className="fixed left-1/2 top-3 z-[1500] m-0 w-[min(680px,calc(100%-24px))] -translate-x-1/2 rounded-pos border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-center text-sm font-semibold text-[#92400e] shadow-lg"
    role="status" data-testid="reload-store-key-notice">
    Trang đã tải lại. Nếu bạn vừa tạo quán, hãy dùng Store Key đã lưu để ghép quán khi cần. Hệ thống không thể hiển thị lại Store Key chưa được lưu.
  </p>;
}

export function CompatibilityUpdateGate({ reload = () => window.location.reload(), acknowledgeCreatedStore }: {
  reload?: () => void; acknowledgeCreatedStore?: () => void;
}) {
  const createdStoreResult = useAppStore(state => state.createdStoreResult);
  const setCreatedStoreResult = useAppStore(state => state.setCreatedStoreResult);
  const setPendingStoreCreationInput = useAppStore(state => state.setPendingStoreCreationInput);
  useEffect(() => {
    if (!createdStoreResult) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [createdStoreResult]);
  const acknowledge = () => {
    acknowledgeCreatedStore?.();
    setCreatedStoreResult(null);
    setPendingStoreCreationInput(null);
    reload();
  };
  return <main className="fixed inset-0 z-[3000] grid place-content-center gap-5 bg-pos-bg p-6 text-center" data-testid="compatibility-update-gate">
    <p role="alert" className="m-0 text-lg font-semibold">Phiên bản ứng dụng chưa tương thích. Vui lòng tải phiên bản mới trước khi tiếp tục.</p>
    {createdStoreResult && <section className="grid gap-2 rounded-pos border border-pos-line bg-pos-surface p-4" data-testid="compatibility-created-store-result">
      <p className="m-0">Quán đã được tạo. Lưu thông tin này trước khi tải lại.</p>
      <strong data-testid="compatibility-store-key">Store Key: {createdStoreResult.storeKey}</strong>
      <strong data-testid="compatibility-admin-pin">PIN tạm thời: {createdStoreResult.adminPin}</strong>
    </section>}
    <button className="rounded-pos bg-pos-primary px-5 py-3 font-bold text-white" onClick={createdStoreResult ? acknowledge : reload}>
      {createdStoreResult ? "Tôi đã lưu Store Key." : "Tải lại ứng dụng"}
    </button>
  </main>;
}

function ConnectedCompatibilityUpdateGate() {
  const createdStoreResult = useAppStore(state => state.createdStoreResult);
  if (!createdStoreResult) return <CompatibilityUpdateGate />;
  return <CreatedStoreCompatibilityUpdateGate />;
}

function CreatedStoreCompatibilityUpdateGate() {
  const ports = usePorts();
  return <CompatibilityUpdateGate acknowledgeCreatedStore={() => ports.auth.acknowledgeCreatedStore()} />;
}

export function App() {
  const updateRequired = useAppStore((state) => state.updateRequired);
  if (updateRequired) return <ConnectedCompatibilityUpdateGate />;
  return <ActiveApp />;
}

function ActiveApp() {
  const screen = useAppStore((state) => state.screen);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const createdStoreResult = useAppStore(state => state.createdStoreResult);
  const pendingStoreCreationInput = useAppStore(state => state.pendingStoreCreationInput);
  const requiredPinSession = usePermissionSession(state => state.requiredPinSession);
  const setScreen = useAppStore((state) => state.setScreen);
  const setCurrentEmployee = useAppStore((state) => state.setCurrentEmployee);
  const storeSessionQuery = useStoreSessionQuery();
  const storeSession = storeSessionQuery.data?.session ?? null;


  useEffect(() => {
    if (!storeSessionQuery.data) {
      return;
    }

    if (storeSessionQuery.data.status === "paired" && screen === "landing") {
      setScreen("passcode");
    }

    if (storeSessionQuery.data.status === "unpaired" && (screen === "passcode" || currentEmployee)) {
      setCurrentEmployee(null);
      setScreen("landing");
    }
  }, [currentEmployee, screen, setCurrentEmployee, setScreen, storeSessionQuery.data]);

  useEffect(() => {
    if (storeSessionQuery.error) {
      if (requireCompatibilityUpdate(storeSessionQuery.error)) return;
      toast.error(toToastError(storeSessionQuery.error));
      setCurrentEmployee(null);
      setScreen("landing");
    }
  }, [setCurrentEmployee, setScreen, storeSessionQuery.error]);

  return (
    <>
      {!currentEmployee && !requiredPinSession && <ReloadRecoveryNotice />}
      {currentEmployee && <PermissionLifecycle />}
      {createdStoreResult || pendingStoreCreationInput ? (
        <CreateStoreScreen />
      ) : requiredPinSession ? (
        <RequiredPinChangeScreen />
      ) : currentEmployee ? (
        <>
          <RotateGuidance />
          <InitialSeedLifecycle />
          <AppShell />
        </>
      ) : screen === "landing" ? (
        <LandingScreen />
      ) : screen === "storePairing" ? (
        <StorePairingScreen />
      ) : screen === "createStore" ? (
        <CreateStoreScreen />
      ) : (
        <PasscodeScreen />
      )}
    </>
  );
}
