import { Button, TextField } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { isAppError } from "@/core/appError";
import { usePorts } from "@/features/shared/portsContext";
import { usePermissionSession } from "@/features/shared/permissionSession";
import { useAppStore } from "../useAppStore";
import { useUnpairStoreMutation } from "@/features/session";

const SESSION_ENDED = "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.";
const LOST_ACK = "Chưa xác nhận được việc đổi PIN. Vui lòng đăng nhập lại bằng PIN mới; nếu chưa được, thử lại bằng PIN tạm.";

export function RequiredPinChangeScreen() {
  const ports = usePorts();
  const unpairStore = useUnpairStoreMutation();
  const restricted = usePermissionSession(state => state.requiredPinSession);
  const setScreen = useAppStore(state => state.setScreen);
  const setCurrentEmployee = useAppStore(state => state.setCurrentEmployee);
  const setSessionNotice = useAppStore(state => state.setSessionNotice);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [proofReady, setProofReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const lifetimeGeneration = useRef(0);
  const proofSequence = useRef(0);
  const completionSequence = useRef(0);
  const submittingRef = useRef(false);

  const returnToLogin = useCallback((notice: string) => {
    lifetimeGeneration.current += 1;
    proofSequence.current += 1;
    completionSequence.current += 1;
    submittingRef.current = false;
    setNewPin("");
    setConfirmPin("");
    setCurrentEmployee(null);
    setSessionNotice(notice);
    setScreen("passcode");
  }, [setCurrentEmployee, setScreen, setSessionNotice]);

  const checkProof = useCallback(async () => {
    const expected = usePermissionSession.getState().requiredPinSession;
    if (!expected || document.visibilityState === "hidden" || !navigator.onLine || submittingRef.current) return;
    const lifetime = lifetimeGeneration.current;
    const proof = ++proofSequence.current;
    const storeGeneration = usePermissionSession.getState().generation;
    setChecking(true);
    setProofReady(false);
    setError("");
    try {
      const result = await ports.permission.session.checkRequiredPinSession();
      const current = usePermissionSession.getState();
      if (lifetime !== lifetimeGeneration.current || proof !== proofSequence.current || current.generation !== storeGeneration
        || current.requiredPinSession?.employeeId !== expected.employeeId) return;
      if (result.employeeRevision !== expected.employeeRevision) {
        returnToLogin("PIN hoặc trạng thái tài khoản đã thay đổi. Vui lòng đăng nhập lại.");
        return;
      }
      setProofReady(true);
    } catch (cause) {
      if (lifetime !== lifetimeGeneration.current || proof !== proofSequence.current
        || usePermissionSession.getState().generation !== storeGeneration) return;
      if (isAppError(cause) && cause.code === "EMPLOYEE_SESSION_REQUIRED") {
        returnToLogin(SESSION_ENDED);
        return;
      }
      setError("Chưa kiểm tra được phiên. Vui lòng thử lại khi có kết nối.");
    } finally {
      if (lifetime === lifetimeGeneration.current && proof === proofSequence.current) setChecking(false);
    }
  }, [ports.permission.session, returnToLogin]);

  useEffect(() => {
    void checkProof();
    const gate = () => {
      proofSequence.current += 1;
      setProofReady(false);
      setChecking(false);
    };
    const resume = () => { if (!submittingRef.current) void checkProof(); };
    const visibility = () => document.visibilityState === "hidden" ? gate() : resume();
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    window.addEventListener("blur", gate);
    window.addEventListener("offline", gate);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      lifetimeGeneration.current += 1;
      proofSequence.current += 1;
      completionSequence.current += 1;
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("blur", gate);
      window.removeEventListener("offline", gate);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [checkProof]);

  useEffect(() => {
    if (!restricted) return;
    const remaining = Date.parse(restricted.expiresAt) - Date.now();
    if (remaining <= 0) {
      returnToLogin(SESSION_ENDED);
      return;
    }
    const timer = window.setTimeout(() => returnToLogin(SESSION_ENDED), remaining);
    return () => window.clearTimeout(timer);
  }, [restricted, returnToLogin]);

  const submit = async () => {
    if (!restricted || submitting || !proofReady) return;
    if (!/^[0-9]{6}$/.test(newPin)) {
      setError("PIN mới phải gồm 6 chữ số.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("Hai lần nhập PIN mới chưa khớp.");
      return;
    }
    const lifetime = lifetimeGeneration.current;
    const completion = ++completionSequence.current;
    const storeGeneration = usePermissionSession.getState().generation;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      await ports.permission.session.completeRequiredPinChange({
        requestId: crypto.randomUUID(), expectedRevision: restricted.employeeRevision, newPin,
      });
      if (lifetime !== lifetimeGeneration.current || completion !== completionSequence.current
        || usePermissionSession.getState().generation !== storeGeneration) return;
      returnToLogin("Đã đổi PIN. Vui lòng đăng nhập bằng PIN mới.");
    } catch (cause) {
      if (lifetime !== lifetimeGeneration.current || completion !== completionSequence.current
        || usePermissionSession.getState().generation !== storeGeneration) return;
      if (isAppError(cause) && cause.code === "PIN_REUSE_NOT_ALLOWED") {
        setError("PIN mới phải khác PIN tạm đang dùng.");
      } else if (isAppError(cause) && cause.code === "INVALID_EMPLOYEE_REQUEST") {
        setError("Yêu cầu đổi PIN không hợp lệ. Vui lòng thử lại.");
      } else if (isAppError(cause) && cause.code === "EMPLOYEE_SESSION_REQUIRED") {
        returnToLogin(SESSION_ENDED);
      } else if (isAppError(cause) && cause.code === "EMPLOYEE_VERSION_CONFLICT") {
        returnToLogin("PIN hoặc trạng thái tài khoản đã thay đổi. Vui lòng đăng nhập lại.");
      } else {
        returnToLogin(LOST_ACK);
      }
    } finally {
      if (lifetime === lifetimeGeneration.current && completion === completionSequence.current) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  };

  const logout = async () => {
    const revoke = ports.permission.session.revokeSession().catch(() => undefined);
    returnToLogin("");
    await revoke;
  };

  const changeStore = () => {
    void ports.permission.session.revokeSession().catch(() => undefined);
    lifetimeGeneration.current += 1;
    proofSequence.current += 1;
    completionSequence.current += 1;
    submittingRef.current = false;
    setNewPin("");
    setConfirmPin("");
    setCurrentEmployee(null);
    setSessionNotice(null);
    setScreen("landing");
    const generation = usePermissionSession.getState().generation;
    void unpairStore.mutateAsync().then(() => {
      const session = usePermissionSession.getState();
      const screen = useAppStore.getState().screen;
      if (session.generation === generation && !session.requiredPinSession && !session.session
        && (screen === "landing" || screen === "passcode")) setScreen("landing");
    }).catch(() => undefined);
  };

  if (!restricted) return null;
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-pos-bg p-4" data-testid="required-pin-change-screen">
      <section className="grid w-[min(480px,100%)] gap-4 rounded-pos border border-pos-line bg-pos-surface p-6 shadow-lg">
        <div>
          <h1 className="m-0 text-2xl font-extrabold text-pos-ink">Đổi PIN tạm</h1>
          <p className="mb-0 text-sm text-pos-muted">Bạn cần đổi PIN tạm trước khi sử dụng quán.</p>
        </div>
        <p className="m-0 text-sm font-semibold text-pos-ink">Tài khoản: {restricted.name}</p>
        <TextField label="PIN mới" type="password" inputMode="numeric" autoComplete="new-password" value={newPin}
          onChange={event => { setNewPin(event.target.value); setError(""); }} inputProps={{ maxLength: 6, "data-testid": "required-new-pin" }} />
        <TextField label="Nhập lại PIN mới" type="password" inputMode="numeric" autoComplete="new-password" value={confirmPin}
          onChange={event => { setConfirmPin(event.target.value); setError(""); }} inputProps={{ maxLength: 6, "data-testid": "required-confirm-pin" }} />
        {checking && <p className="m-0 text-sm text-pos-muted" role="status">Đang kiểm tra phiên...</p>}
        {error && <p className="m-0 text-sm font-semibold text-pos-danger" role="alert">{error}</p>}
        {!proofReady && !checking && <Button variant="outlined" onClick={() => void checkProof()}>Thử lại</Button>}
        <Button variant="contained" disabled={!proofReady || submitting} onClick={() => void submit()} data-testid="complete-required-pin">
          {submitting ? "Đang đổi PIN..." : "Đổi PIN"}
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="text" onClick={() => void logout()}>Đăng xuất</Button>
          <Button variant="text" onClick={changeStore}>Đổi quán</Button>
        </div>
      </section>
    </main>
  );
}
