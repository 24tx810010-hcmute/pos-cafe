import type { AuthorityBundle, AuthorityRevision, NormalPermissionSession } from "@/domain/permissions";
import { AppError } from "./appError";
import { validatePermissionCatalog } from "./permissionCatalog";

export type PermissionLifecycleStatus = "unverified" | "verified" | "unavailable";
export type PermissionLifecycleInput = {
  getRevision(): Promise<AuthorityRevision>;
  getAuthority(): Promise<AuthorityBundle>;
  /** Runs synchronously; consumers must close/purge affected state before publishing the new bundle. */
  apply(bundle: AuthorityBundle, previous: AuthorityBundle | null): void;
  status(status: PermissionLifecycleStatus): void;
  expired(): void;
  unsupported?(): void;
  now?: () => number;
};

/** One foreground scheduler per application instance. It never retries a write or carries a credential. */
export class PermissionLifecycle {
  private generation = 0;
  private request = 0;
  private bundle: AuthorityBundle | null = null;
  private expiresAt = 0;
  private visible = false;
  private running: Promise<void> | null = null;
  private requestedAgain = false;
  private fallbackAt = 0;
  private fallbackTimer?: ReturnType<typeof setTimeout>;
  private expiryTimer?: ReturnType<typeof setTimeout>;
  private requestTimer?: ReturnType<typeof setTimeout>;
  private requestDeadlineAt = 0;
  private cancelDeadline?: () => void;
  private readonly now: () => number;

  constructor(private readonly input: PermissionLifecycleInput) { this.now = input.now ?? Date.now; }

  start(session: NormalPermissionSession, visible: boolean): void {
    this.stop();
    if (session.kind !== "normal" || session.pinChangeRequired !== false) { this.input.expired(); return; }
    this.expiresAt = Date.parse(session.expiresAt);
    if (!Number.isFinite(this.expiresAt) || this.expiresAt <= this.now()) { this.input.expired(); return; }
    this.validate(session.authority);
    this.bundle = session.authority;
    this.visible = visible;
    this.input.apply(session.authority, null);
    this.input.status(visible ? "verified" : "unverified");
    this.expiryTimer = setTimeout(() => this.expire(), this.expiresAt - this.now());
    if (visible) this.schedule(this.now() + 30_000);
  }

  stop(): void {
    this.generation++; this.cancelRead();
    clearTimeout(this.fallbackTimer); clearTimeout(this.expiryTimer);
    this.fallbackTimer = undefined; this.bundle = null; this.visible = false;
  }

  /** Visibility/focus/reconnect gates protected rendering immediately, before awaiting the server. */
  resume(): Promise<void> {
    if (!this.bundle) return Promise.resolve();
    this.cancelRead();
    this.visible = true;
    this.input.status("unverified");
    if (!this.fallbackTimer) this.schedule(this.now() + 30_000);
    return this.refresh();
  }

  hide(): void {
    this.cancelRead();
    this.visible = false;
    clearTimeout(this.fallbackTimer); this.fallbackTimer = undefined;
    this.input.status("unverified");
  }

  /** A new committed revision may arrive after an in-flight read took its snapshot. */
  signal(): Promise<void> {
    if (!this.visible || !this.bundle) return Promise.resolve();
    // Restart against the new commit, but a busy store cannot extend the original
    // freshness deadline indefinitely. At that deadline protected UI fails closed.
    this.cancelRead(true);
    return this.refresh();
  }

  /** Events never move the fallback deadline, and duplicates share the pending request. */
  refresh(): Promise<void> {
    if (!this.bundle || !this.visible) return Promise.resolve();
    if (this.now() >= this.expiresAt) { this.expire(); return Promise.resolve(); }
    if (this.running) { this.requestedAgain = true; return this.running; }
    const generation = this.generation, request = ++this.request;
    this.requestDeadlineAt ||= this.now() + 5_000;
    const current = () => generation === this.generation && request === this.request && this.bundle !== null;
    let timedOut = false;
    const deadline = new Promise<never>((_, reject) => {
      this.cancelDeadline = () => reject(new Error("Authority read cancelled"));
      this.requestTimer = setTimeout(() => { timedOut = true; reject(new AppError("PERMISSION_REFRESH_UNAVAILABLE", "Chưa thể cập nhật quyền. Vui lòng thử lại.")); }, Math.max(0, this.requestDeadlineAt - this.now()));
    });
    const read = async () => {
      const revision = await this.input.getRevision();
      if (!current() || timedOut) return;
      if (!Number.isSafeInteger(revision.employeeRevision) || !Number.isSafeInteger(revision.catalogRevision)
        || revision.employeeRevision < this.bundle!.snapshot.employeeRevision || revision.catalogRevision < this.bundle!.snapshot.catalogRevision)
        throw new AppError("PERMISSION_REFRESH_UNAVAILABLE", "Chưa thể cập nhật quyền. Vui lòng thử lại.");
      let next = this.bundle!;
      if (revision.employeeRevision !== next.snapshot.employeeRevision || revision.catalogRevision !== next.snapshot.catalogRevision) {
        next = await this.input.getAuthority();
        if (!current() || timedOut) return;
        this.validate(next);
        if (next.snapshot.employeeRevision < revision.employeeRevision || next.snapshot.catalogRevision < revision.catalogRevision)
          throw new AppError("PERMISSION_REFRESH_UNAVAILABLE", "Chưa thể cập nhật quyền. Vui lòng thử lại.");
      }
      if (!current() || timedOut) return;
      if (this.now() >= this.expiresAt) { this.expire(); return; }
      if (next !== this.bundle) { this.input.apply(next, this.bundle); this.bundle = next; }
      if (this.visible) this.input.status("verified");
    };
    const task = Promise.race([read(), deadline]).catch(error => {
      if (!current()) return;
      if (error instanceof AppError && error.code === "WRITE_PROTOCOL_UNSUPPORTED") this.input.unsupported?.();
      else if (error instanceof AppError && ["EMPLOYEE_SESSION_REQUIRED", "EMPLOYEE_ROLE_UNAVAILABLE", "AUTH_REQUIRED"].includes(error.code)) this.expire();
      else this.input.status("unavailable");
    }).finally(() => {
      if (generation !== this.generation || this.running !== task) return;
      clearTimeout(this.requestTimer); this.requestTimer = undefined; this.running = null;
      this.requestDeadlineAt = 0;
      this.cancelDeadline = undefined;
      if (this.requestedAgain) { this.requestedAgain = false; void this.refresh(); }
    });
    this.running = task;
    return task;
  }

  private schedule(at: number): void {
    clearTimeout(this.fallbackTimer); this.fallbackAt = at;
    this.fallbackTimer = setTimeout(() => {
      this.fallbackTimer = undefined;
      if (!this.visible || !this.bundle) return;
      const started = this.fallbackAt;
      void this.refresh();
      this.schedule(Math.max(started + 30_000, this.now() + 1));
    }, Math.max(0, at - this.now()));
  }

  private expire(): void { this.stop(); this.input.expired(); }

  private cancelRead(preserveDeadline = false): void {
    this.request++; this.running = null; this.requestedAgain = false;
    clearTimeout(this.requestTimer); this.requestTimer = undefined;
    if (!preserveDeadline) this.requestDeadlineAt = 0;
    this.cancelDeadline?.(); this.cancelDeadline = undefined;
  }

  private validate(bundle: AuthorityBundle): void {
    validatePermissionCatalog(bundle.catalog);
    const snapshot = bundle.snapshot, previous = this.bundle?.snapshot;
    if (!snapshot.active || snapshot.catalogRevision !== bundle.catalog.revision
      || !bundle.catalog.roles.some(role => role.code === snapshot.role && role.enabled)
      || previous && (snapshot.employeeId !== previous.employeeId || snapshot.storeId !== previous.storeId
        || snapshot.employeeRevision < previous.employeeRevision || snapshot.catalogRevision < previous.catalogRevision))
      throw new AppError("EMPLOYEE_SESSION_REQUIRED", "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.");
  }
}
