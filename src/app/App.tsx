import { useEffect } from "react";
import toast from "react-hot-toast";
import { useStoreSessionQuery } from "@/features/session";
import { useRealtimeInvalidation } from "@/features/integration";
import { useAppStore } from "./useAppStore";
import { toToastError } from "./appErrors";
import { RotateGuidance } from "./screens/RotateGuidance";
import { LandingScreen } from "./screens/LandingScreen";
import { StorePairingScreen } from "./screens/StorePairingScreen";
import { CreateStoreScreen } from "./screens/CreateStoreScreen";
import { PasscodeScreen } from "./screens/PasscodeScreen";
import { AppShell } from "./shell/AppShell";

export function App() {
  const screen = useAppStore((state) => state.screen);
  const currentEmployee = useAppStore((state) => state.currentEmployee);
  const setScreen = useAppStore((state) => state.setScreen);
  const setCurrentEmployee = useAppStore((state) => state.setCurrentEmployee);
  const storeSessionQuery = useStoreSessionQuery();
  const storeSession = storeSessionQuery.data?.session ?? null;

  useRealtimeInvalidation(currentEmployee ? storeSession?.storeId : null);

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
      toast.error(toToastError(storeSessionQuery.error));
      setCurrentEmployee(null);
      setScreen("landing");
    }
  }, [setCurrentEmployee, setScreen, storeSessionQuery.error]);

  return (
    <>
      {currentEmployee ? (
        <>
          <RotateGuidance />
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
