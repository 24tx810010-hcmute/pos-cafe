type ExitGuard = (navigate: () => void) => void;
let currentGuard: ExitGuard | null = null;

/** Navigation intent is memory-only and never executes a server write. */
export function registerDrawerExitGuard(guard: ExitGuard): () => void {
  currentGuard = guard;
  return () => { if (currentGuard === guard) currentGuard = null; };
}
export function clearDrawerExitGuard(): void { currentGuard = null; }
export function requestDrawerExit(navigate: () => void): void {
  if (currentGuard) currentGuard(navigate);
  else navigate();
}
