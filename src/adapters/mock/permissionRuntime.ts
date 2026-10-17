import type { CreateStoreInput, CreateStoreResult, PrintReceipt, PrintTicket, StoreSession, WritePayloadV1 } from "@/domain";
import type { PermissionCode, PermissionEmployee } from "@/domain/permissions";
import type { IAuthRepo, IMenuImagePort, IPrintPort, MenuItemImageUploadInput, MenuItemImageUploadResult } from "@/ports";
import { AppError } from "@/core/appError";
import { createAuthoritySnapshot, hasCatalogPermission } from "@/core/permissionAuthority";
import { writePermission } from "@/core/writePayload";
import { MockPermissionChangesRepo } from "./permissionChangesRepo";
import { MockPermissionIdentityRepo, mockPermissionReplaceCredentials, requireMockNormalPermissionActor } from "./permissionIdentityRepo";
import { createMockPermissionPorts } from "./permissionRepos";
import { mockPermissionResetPinChangeFlags, type MockPermissionState } from "./permissionState";
import { MockPermissionMenuImagePort } from "./permissionMenuImagePort";
import { MockPermissionSignalPort } from "./permissionSignalPort";
import { MockPermissionPrintRegistry, MockPermissionPrintRepo } from "./permissionPrintRepo";
import { MockWriteOperationRepo } from "./writeOperationRepo";
import { mockWriteState, type MockWriteAuthorization } from "./writeState";
import { clone, createMockState } from "./mockState";
import { initializeMockInitialSeed, MockInitialSeedRepo, MockPermissionSeedRepo } from "./permissionInitialSeedRepo";

const sessionMessage = "Phiên nhân viên không còn hợp lệ. Vui lòng đăng nhập lại.";
const parseStoreNo = (storeKey: string): number => {
  const value = Number.parseInt(storeKey.split("-")[0], 10); return Number.isFinite(value) ? value : 1;
};

function currentActor(state: MockPermissionState): PermissionEmployee {
  return requireMockNormalPermissionActor(state);
}

function writeAuthorization(state: MockPermissionState): MockWriteAuthorization {
  const has = (permission: PermissionCode): boolean => {
    const employee = currentActor(state), snapshot = createAuthoritySnapshot(state.catalog, employee, true);
    return hasCatalogPermission(state.catalog, { status: "verified", snapshot }, permission);
  };
  return {
    actor(payload?: WritePayloadV1) {
      const employee = currentActor(state);
      if (payload && !has(writePermission(payload))) throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
      return { id: employee.id, name: employee.name };
    },
    has,
  };
}

function requirePermission(state: MockPermissionState, permission: PermissionCode): PermissionEmployee {
  const employee = currentActor(state), snapshot = createAuthoritySnapshot(state.catalog, employee, true);
  if (!hasCatalogPermission(state.catalog, { status: "verified", snapshot }, permission))
    throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
  return employee;
}

type PendingCreate = { canonical: string; result: CreateStoreResult | null; acknowledged: boolean };
const pendingCreates = new WeakMap<MockPermissionState, PendingCreate>();

function canonicalCreateInput(input: CreateStoreInput): { displayName: string; address: string; seedDemo: boolean; canonical: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)
    || Object.keys(input).some(key => !["displayName", "address", "seedDemo"].includes(key))
    || typeof input.displayName !== "string" || typeof input.seedDemo !== "boolean"
    || (input.address !== undefined && typeof input.address !== "string"))
    throw new AppError("INVALID_WRITE_REQUEST", "Dữ liệu thao tác không hợp lệ.");
  const displayName = input.displayName.trim();
  const address = (input.address ?? "").trim();
  if ([...displayName].length < 1 || [...displayName].length > 120 || [...address].length > 500)
    throw new AppError("INVALID_WRITE_REQUEST", "Dữ liệu thao tác không hợp lệ.");
  return { displayName, address, seedDemo: input.seedDemo, canonical: JSON.stringify({ displayName, address, seedDemo: input.seedDemo }) };
}

class PermissionMockAuthRepo implements IAuthRepo {
  constructor(private readonly state: MockPermissionState) {}
  acknowledgeCreatedStore(): void {
    const pending = pendingCreates.get(this.state);
    if (!pending || pending.acknowledged) return;
    pending.result = null;
    pending.acknowledged = true;
  }
  async pairStore(storeKey: string): Promise<void> {
    this.state.session = null; this.state.paired = true;
    this.state.business.session = { storeId: this.state.storeId, storeNo: parseStoreNo(storeKey) };
  }
  async createStore(input: CreateStoreInput): Promise<CreateStoreResult> {
    const parsed = canonicalCreateInput(input);
    const existing = pendingCreates.get(this.state);
    if (existing) {
      if (existing.canonical !== parsed.canonical || existing.acknowledged || !existing.result)
        throw new AppError("BOOTSTRAP_CONFLICT", "Cửa hàng đã được khởi tạo; không thể thay chủ quán bằng thao tác này.");
      return clone(existing.result);
    }

    const owner = this.state.employees.find(employee => employee.role === "owner");
    if (!owner) throw new AppError("PERMISSION_UPDATE_UNAVAILABLE", "Chưa thể xác nhận thay đổi. Kiểm tra kết quả trước khi thử lại.");
    owner.name = "Chủ quán";
    owner.isActive = true;
    owner.permissionRevision = 0;
    owner.overrides = null;
    this.state.employees.splice(0, this.state.employees.length, owner);
    mockPermissionReplaceCredentials(this.state, [{ employeeId: owner.id, pin: "123456" }]);
    mockPermissionResetPinChangeFlags(this.state, [owner.id]);

    const business = createMockState();
    business.session = { storeId: this.state.storeId, storeNo: 1 };
    business.employees = [];
    business.pins = {};
    business.settings = { ...business.settings, storeId: this.state.storeId, displayName: parsed.displayName, address: parsed.address };
    Object.assign(this.state.business, business);
    const writes = mockWriteState(this.state.business);
    writes.operations = {};
    writes.sessions = {};
    writes.events = [];
    writes.removedItems = [];
    this.state.session = null;
    this.state.paired = true;
    initializeMockInitialSeed(this.state, parsed.seedDemo);
    const result: CreateStoreResult = {
      storeId: this.state.storeId,
      storeNo: 1,
      storeKey: "0001-X8F3QA",
      adminPin: "123456",
      seedStatus: parsed.seedDemo ? "pending" : "seeded",
      canRetrySeed: false,
    };
    pendingCreates.set(this.state, { canonical: parsed.canonical, result: clone(result), acknowledged: false });
    return clone(result);
  }
  async unpairStore(): Promise<void> { if (this.state.session) this.state.session.revoked = true; this.state.session = null; this.state.paired = false; this.state.business.session = null; }
  async getStoreSession(): Promise<StoreSession | null> { return clone(this.state.business.session); }
}

class PermissionMockLegacyPrintPort implements IPrintPort {
  constructor(private readonly state: MockPermissionState) {}
  async renderOrderTicket(ticket: PrintTicket): Promise<void> {
    requireMockNormalPermissionActor(this.state);
    this.state.business.lastTicket = ticket;
  }
  async renderReceipt(receipt: PrintReceipt): Promise<void> {
    requireMockNormalPermissionActor(this.state);
    this.state.business.lastReceipt = receipt;
  }
}

class PermissionMockMenuImagePort implements IMenuImagePort {
  private readonly urls = new Map<string, string>();
  constructor(private readonly state: MockPermissionState) {}
  async uploadMenuItemImage(input: MenuItemImageUploadInput): Promise<MenuItemImageUploadResult> {
    requirePermission(this.state, "menu.manage");
    const extension = input.file.type === "image/jpeg" ? "jpg" : input.file.type === "image/png" ? "png" : input.file.type === "image/webp" ? "webp" : input.file.name.split(".").pop()?.toLowerCase() || "bin";
    const assetKey = `menu-item-images/${this.state.storeId}/menu-items/${input.itemId}/mock-upload.${extension}`;
    const publicUrl = typeof URL !== "undefined" && typeof URL.createObjectURL === "function" ? URL.createObjectURL(input.file) : `mock-menu-image://${assetKey}`;
    this.urls.set(assetKey, publicUrl); return { assetKey, publicUrl };
  }
  async deleteMenuItemImage(assetKey: string): Promise<void> {
    requirePermission(this.state, "menu.manage"); const url = this.urls.get(assetKey);
    if (url?.startsWith("blob:") && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
    this.urls.delete(assetKey);
  }
  getImageUrl(assetKey: string | null | undefined): string | null {
    requirePermission(this.state, "menu.manage");
    return assetKey ? this.urls.get(assetKey) ?? null : null;
  }
}

class GuardedMockPermissionMenuImagePort extends MockPermissionMenuImagePort {
  constructor(private readonly state: MockPermissionState) {
    super(() => { requirePermission(state, "menu.manage"); }, state);
  }
  override getImageUrl(assetKey: string | null | undefined): string | null {
    currentActor(this.state);
    return super.getImageUrl(assetKey);
  }
}

/** New production mock composition: permission identity is the sole actor/session/rights authority. */
export function createMockPermissionRuntime(state: MockPermissionState) {
  if (state.paired && !state.business.session) state.business.session = { storeId: state.storeId, storeNo: 1 };
  if (!state.paired) state.business.session = null;
  const foundation = createMockPermissionPorts(state);
  const initialSeed = new MockInitialSeedRepo(state);
  const permissionImages = new GuardedMockPermissionMenuImagePort(state);
  const printRegistry = new MockPermissionPrintRegistry();
  const printContext = {
    state: state.business,
    storeId: () => state.storeId,
    employeeId: () => currentActor(state).id,
    session: () => { currentActor(state); if (!state.session) throw new AppError("EMPLOYEE_SESSION_REQUIRED", sessionMessage); return state.session; },
    require: (permission: "payment.take" | "receipt.reprint" | "orderHistory.view") => { requirePermission(state, permission); },
  };
  return {
    ...foundation,
    changes: new MockPermissionChangesRepo(state, permissionImages),
    session: new MockPermissionIdentityRepo(state),
    signals: new MockPermissionSignalPort(),
    write: new MockWriteOperationRepo(state.business, { token: null }, writeAuthorization(state), { registry: printRegistry, storeId: printContext.storeId, session: printContext.session }),
    auth: new PermissionMockAuthRepo(state),
    seed: new MockPermissionSeedRepo(initialSeed),
    initialSeed,
    legacyPrint: new PermissionMockLegacyPrintPort(state),
    legacyMenuImages: new PermissionMockMenuImagePort(state),
    menuImages: permissionImages,
    print: new MockPermissionPrintRepo(printRegistry, printContext),
  };
}
