/** One explicit click per correlation ID. A network retry retains the ID; invalidation never replays it. */
export class ReceiptPrintClick {
  private generation = 0;
  private requestId: string | null = null;
  private pending = false;
  private cancelDispatch?: () => void;
  constructor(private readonly input: {
    eligible(): boolean;
    authorize(requestId: string): Promise<void>;
    dispatch(isCurrent: () => boolean, markDispatched: () => boolean): (() => void) | undefined;
    changed(pending: boolean): void;
    failed(error: unknown): void;
    sent(): void;
  }) {}
  invalidate(): void {
    this.generation++; this.requestId = null; this.pending = false;
    this.cancelDispatch?.(); this.cancelDispatch = undefined; this.input.changed(false);
  }
  async click(): Promise<void> {
    if (this.pending || !this.input.eligible()) return;
    const generation = this.generation, requestId = this.requestId ??= crypto.randomUUID();
    let dispatched = false;
    const current = () => generation === this.generation && this.input.eligible() && !dispatched;
    this.pending = true; this.input.changed(true);
    try {
      await this.input.authorize(requestId);
      if (!current()) { if (generation === this.generation) this.invalidate(); return; }
      this.cancelDispatch = this.input.dispatch(current, () => {
        if (!current()) return false;
        dispatched = true; this.requestId = null; this.pending = false; this.cancelDispatch = undefined;
        this.input.changed(false); this.input.sent(); return true;
      });
      if (!this.cancelDispatch && !dispatched) throw new Error("Không thể mở hộp thoại in. Vui lòng thử lại.");
    } catch (error) {
      if (generation === this.generation) { this.pending = false; this.input.changed(false); this.input.failed(error); }
    }
  }
}
