import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppPorts,
  IAuthRepo,
  IEmployeeRepo,
  IFloorPlanRepo,
  IMenuRepo,
  IOrderRepo,
  IPaymentRepo,
  IPrintPort,
  IRealtimePort,
  IReportRepo,
  ISeedRepo,
  ISettingsRepo,
  RealtimeInvalidationInput,
} from "@/ports";
import type {
  CoreReport,
  CreateStoreInput,
  CreateStoreResult,
  Employee,
  EmployeeInput,
  EmployeeUpdate,
  FloorPlan,
  FloorPlanChanges,
  MenuCatalog,
  MenuChanges,
  OrderDetail,
  OrderHistoryFilter,
  OrderSummary,
  OrderSummaryPage,
  PayOrderInput,
  PayOrderResult,
  PrintReceipt,
  PrintTicket,
  ReportFilter,
  StoreSession,
  StoreSettings,
  StoreSettingsUpdate,
  SubmitOrderChangesInput,
  SubmitOrderChangesResult,
} from "@/domain";
import { AppError } from "@/core/appError";
import { deterministicUuid } from "./deterministicId";
import { mapSupabaseError, requireData, throwIfError } from "./errors";
import {
  emptyCoreReport,
  mapEmployee,
  mapFloorPlan,
  mapMenuCatalog,
  mapOrderDetail,
  mapOrderSummary,
  mapPayOrderResult,
  mapSettings,
  mapSubmitOrderChangesResult,
  type Row,
} from "./mappers";
import { markBlankSeeded, seedDemoData } from "./seedBundle";
import { formatStoreKey, generateStoreSecret, parseStoreKey, storeEmailForNo } from "./storeKey";

type SupabaseAnyClient = SupabaseClient;
type TableRow = Record<string, unknown>;

const selectStoreSessionFields = "id,store_no";
const orderFields =
  "id,table_id,order_type,order_no,business_date,status,total,lock_version,paid_at";
const orderItemFields = "id,menu_item_id,item_name,quantity,unit_price,note,status,sort_order";
const orderItemOptionFields = "id,order_item_id,option_value_id,option_name,price_delta";

const stripUndefined = (row: TableRow): TableRow =>
  Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));

const requireStoreId = async (client: SupabaseAnyClient): Promise<string> => {
  const { data, error } = await client.auth.getSession();
  throwIfError(error, "AUTH_REQUIRED");

  const storeId = data.session?.user.id;

  if (!storeId) {
    throw new AppError("AUTH_REQUIRED", "Phiên cửa hàng không hợp lệ.");
  }

  return storeId;
};

const hashPin = async (client: SupabaseAnyClient, pin: string): Promise<string> => {
  const { data, error } = await client.rpc("hash_employee_pin", { p_pin: pin });
  return requireData<string>(data as string | null, error);
};

const insertRows = async (client: SupabaseAnyClient, table: string, rows: TableRow[]): Promise<void> => {
  if (rows.length === 0) {
    return;
  }

  const { error } = await client.from(table).insert(rows);
  throwIfError(error);
};

const upsertRows = async (client: SupabaseAnyClient, table: string, rows: TableRow[]): Promise<void> => {
  if (rows.length === 0) {
    return;
  }

  const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
  throwIfError(error);
};

const updateRow = async (client: SupabaseAnyClient, table: string, id: string, row: TableRow): Promise<void> => {
  const update = stripUndefined(row);

  if (Object.keys(update).length === 0) {
    return;
  }

  const { error } = await client.from(table).update(update).eq("id", id);
  throwIfError(error);
};

const tombstoneRow = async (
  client: SupabaseAnyClient,
  table: string,
  id: string,
  deletedByEmployeeId?: string | null,
): Promise<void> => {
  const { error } = await client
    .from(table)
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by_employee_id: deletedByEmployeeId ?? null,
    })
    .eq("id", id);
  throwIfError(error);
};

class SupabaseSeedRepo implements ISeedRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async seedDemo(storeId: string): Promise<void> {
    await seedDemoData(this.client, storeId);
  }

  async retrySeedDemo(storeId: string): Promise<void> {
    await seedDemoData(this.client, storeId);
  }

  async seedBlank(storeId: string): Promise<void> {
    await markBlankSeeded(this.client, storeId);
  }
}

class SupabaseAuthRepo implements IAuthRepo {
  constructor(
    private readonly client: SupabaseAnyClient,
    private readonly seed: ISeedRepo,
  ) {}

  async pairStore(storeKey: string): Promise<void> {
    const parsed = parseStoreKey(storeKey);
    const { error } = await this.client.auth.signInWithPassword({
      email: storeEmailForNo(parsed.storeNo),
      password: parsed.secret,
    });
    throwIfError(error, "AUTH_REQUIRED");

    const session = await this.getStoreSession();

    if (!session || session.storeNo !== parsed.storeNo) {
      await this.client.auth.signOut();
      throw new AppError("AUTH_REQUIRED", "Store Key không đúng.");
    }
  }

  async createStore(input: CreateStoreInput): Promise<CreateStoreResult> {
    const { data: nextStoreNo, error: nextStoreNoError } = await this.client.rpc("get_next_store_no");
    const storeNo = requireData<number>(nextStoreNo as number | null, nextStoreNoError);
    const secret = generateStoreSecret();
    const storeKey = formatStoreKey(storeNo, secret);
    const email = storeEmailForNo(storeNo);
    const { data: signUpData, error: signUpError } = await this.client.auth.signUp({
      email,
      password: secret,
    });
    throwIfError(signUpError, "AUTH_REQUIRED");

    const storeId = signUpData.user?.id;

    if (!storeId || !signUpData.session) {
      throw new AppError("AUTH_REQUIRED", "Supabase Auth phải tắt email confirmation cho Store Key.");
    }

    const displayName = input.displayName?.trim() || "POS Demo";
    const adminPin = "123456";
    const adminId = await deterministicUuid(storeId, "admin.primary");
    const adminHash = await hashPin(this.client, adminPin);

    await insertRows(this.client, "stores", [
      {
        id: storeId,
        store_no: storeNo,
        name: displayName,
        email: null,
        seed_status: "pending",
      },
    ]);
    await insertRows(this.client, "store_settings", [
      {
        store_id: storeId,
        display_name: displayName,
        address: "",
        currency: "VND",
        timezone: "Asia/Saigon",
        bill_footer: "",
      },
    ]);
    await upsertRows(this.client, "employees", [
      {
        id: adminId,
        store_id: storeId,
        name: "Quản lý",
        role: "admin",
        passcode_hash: adminHash,
        is_active: true,
        seed_key: null,
      },
    ]);

    let seedStatus: CreateStoreResult["seedStatus"] = "seeded";
    let canRetrySeed = false;

    try {
      await this.seed.seedDemo(storeId);
    } catch {
      seedStatus = "failed";
      canRetrySeed = true;
    }

    return {
      storeId,
      storeNo,
      storeKey,
      adminPin,
      seedStatus,
      canRetrySeed,
    };
  }

  async unpairStore(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    throwIfError(error, "AUTH_REQUIRED");
  }

  async getStoreSession(): Promise<StoreSession | null> {
    const { data: sessionData, error: sessionError } = await this.client.auth.getSession();
    throwIfError(sessionError, "AUTH_REQUIRED");

    const storeId = sessionData.session?.user.id;

    if (!storeId) {
      return null;
    }

    const { data, error } = await this.client
      .from("stores")
      .select(selectStoreSessionFields)
      .eq("id", storeId)
      .maybeSingle();
    throwIfError(error, "AUTH_REQUIRED");

    if (!data) {
      return null;
    }

    const row = data as Row;
    return {
      storeId: String(row.id),
      storeNo: Number(row.store_no),
    };
  }
}

class SupabaseEmployeeRepo implements IEmployeeRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async listActiveEmployees(): Promise<Employee[]> {
    const { data, error } = await this.client
      .from("employees")
      .select("id,name,role,is_active")
      .eq("is_active", true)
      .order("name");
    throwIfError(error);
    return ((data ?? []) as Row[]).map(mapEmployee);
  }

  async verifyPin(employeeId: string, pin: string): Promise<Employee> {
    const { data, error } = await this.client.rpc("verify_employee_pin", {
      p_employee_id: employeeId,
      p_pin: pin,
    });
    throwIfError(error, "INVALID_PIN");

    const row = Array.isArray(data) ? data[0] : data;
    return { ...mapEmployee(requireData<Row>(row as Row | null, null)), isActive: true };
  }

  async createEmployee(input: EmployeeInput): Promise<Employee> {
    const storeId = await requireStoreId(this.client);
    const passcodeHash = await hashPin(this.client, input.pin);
    const { data, error } = await this.client
      .from("employees")
      .insert({
        id: input.id,
        store_id: storeId,
        name: input.name,
        role: input.role,
        passcode_hash: passcodeHash,
        is_active: true,
      })
      .select("id,name,role,is_active")
      .single();
    return mapEmployee(requireData<Row>(data as Row | null, error));
  }

  async updateEmployee(input: EmployeeUpdate): Promise<Employee> {
    const { data, error } = await this.client
      .from("employees")
      .update(
        stripUndefined({
          name: input.name,
          role: input.role,
          is_active: input.isActive,
        }),
      )
      .eq("id", input.id)
      .select("id,name,role,is_active")
      .single();
    return mapEmployee(requireData<Row>(data as Row | null, error, "NOT_FOUND"));
  }

  async resetPin(employeeId: string, newPin: string): Promise<void> {
    const passcodeHash = await hashPin(this.client, newPin);
    const { error } = await this.client.from("employees").update({ passcode_hash: passcodeHash }).eq("id", employeeId);
    throwIfError(error, "NOT_FOUND");
  }
}

class SupabaseMenuRepo implements IMenuRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async getMenu(): Promise<MenuCatalog> {
    const [categories, menuItems, optionGroups, optionValues] = await Promise.all([
      this.client.from("categories").select("id,name,sort_order").is("deleted_at", null).order("sort_order"),
      this.client
        .from("menu_items")
        .select("id,category_id,name,price,image_asset_key,sort_order,is_available")
        .is("deleted_at", null)
        .order("sort_order"),
      this.client
        .from("option_groups")
        .select("id,menu_item_id,name,select_type,is_required,min_select,max_select,sort_order")
        .is("deleted_at", null)
        .order("sort_order"),
      this.client
        .from("option_values")
        .select("id,option_group_id,name,price_delta,sort_order")
        .is("deleted_at", null)
        .order("sort_order"),
    ]);

    throwIfError(categories.error);
    throwIfError(menuItems.error);
    throwIfError(optionGroups.error);
    throwIfError(optionValues.error);

    return mapMenuCatalog(
      (categories.data ?? []) as Row[],
      (menuItems.data ?? []) as Row[],
      (optionGroups.data ?? []) as Row[],
      (optionValues.data ?? []) as Row[],
    );
  }

  async saveMenuChanges(changes: MenuChanges): Promise<void> {
    const storeId = await requireStoreId(this.client);

    await insertRows(
      this.client,
      "categories",
      changes.categories.created.map((category) => ({
        id: category.id,
        store_id: storeId,
        name: category.name,
        sort_order: category.sortOrder,
      })),
    );
    await insertRows(
      this.client,
      "menu_items",
      changes.menuItems.created.map((item) => ({
        id: item.id,
        store_id: storeId,
        category_id: item.categoryId,
        name: item.name,
        price: item.price,
        image_asset_key: item.imageAssetKey ?? null,
        sort_order: item.sortOrder,
        is_available: item.isAvailable,
      })),
    );
    await insertRows(
      this.client,
      "option_groups",
      changes.optionGroups.created.map((group) => ({
        id: group.id,
        store_id: storeId,
        menu_item_id: group.menuItemId,
        name: group.name,
        select_type: group.selectType,
        is_required: group.isRequired,
        min_select: group.minSelect,
        max_select: group.maxSelect,
        sort_order: group.sortOrder,
      })),
    );
    await insertRows(
      this.client,
      "option_values",
      changes.optionValues.created.map((value) => ({
        id: value.id,
        store_id: storeId,
        option_group_id: value.optionGroupId,
        name: value.name,
        price_delta: value.priceDelta,
        sort_order: value.sortOrder,
      })),
    );

    for (const category of changes.categories.updated) {
      await updateRow(this.client, "categories", category.id, {
        name: category.name,
        sort_order: category.sortOrder,
      });
    }
    for (const item of changes.menuItems.updated) {
      await updateRow(this.client, "menu_items", item.id, {
        category_id: item.categoryId,
        name: item.name,
        price: item.price,
        image_asset_key: item.imageAssetKey,
        sort_order: item.sortOrder,
        is_available: item.isAvailable,
      });
    }
    for (const group of changes.optionGroups.updated) {
      await updateRow(this.client, "option_groups", group.id, {
        menu_item_id: group.menuItemId,
        name: group.name,
        select_type: group.selectType,
        is_required: group.isRequired,
        min_select: group.minSelect,
        max_select: group.maxSelect,
        sort_order: group.sortOrder,
      });
    }
    for (const value of changes.optionValues.updated) {
      await updateRow(this.client, "option_values", value.id, {
        option_group_id: value.optionGroupId,
        name: value.name,
        price_delta: value.priceDelta,
        sort_order: value.sortOrder,
      });
    }

    for (const value of changes.optionValues.deleted) {
      await tombstoneRow(this.client, "option_values", value.id, value.deletedByEmployeeId);
    }
    for (const group of changes.optionGroups.deleted) {
      await tombstoneRow(this.client, "option_groups", group.id, group.deletedByEmployeeId);
    }
    for (const item of changes.menuItems.deleted) {
      await tombstoneRow(this.client, "menu_items", item.id, item.deletedByEmployeeId);
    }
    for (const category of changes.categories.deleted) {
      await tombstoneRow(this.client, "categories", category.id, category.deletedByEmployeeId);
    }
  }
}

class SupabaseFloorPlanRepo implements IFloorPlanRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async getFloorPlan(): Promise<FloorPlan> {
    const [areas, tables, decorItems] = await Promise.all([
      this.client.from("floor_areas").select("id,name,sort_order").is("deleted_at", null).order("sort_order"),
      this.client
        .from("tables")
        .select("id,area_id,name,pos_x,pos_y,width,height,shape,rotation,seats,sort_order,status")
        .is("deleted_at", null)
        .order("sort_order"),
      this.client
        .from("floor_decor_items")
        .select("id,area_id,kind,label,asset_key,pos_x,pos_y,width,height,rotation,z_index,is_locked")
        .is("deleted_at", null)
        .order("z_index"),
    ]);

    throwIfError(areas.error);
    throwIfError(tables.error);
    throwIfError(decorItems.error);

    return mapFloorPlan((areas.data ?? []) as Row[], (tables.data ?? []) as Row[], (decorItems.data ?? []) as Row[]);
  }

  async saveFloorPlan(changes: FloorPlanChanges): Promise<void> {
    const storeId = await requireStoreId(this.client);

    await insertRows(
      this.client,
      "floor_areas",
      changes.areas.created.map((area) => ({
        id: area.id,
        store_id: storeId,
        name: area.name,
        sort_order: area.sortOrder,
      })),
    );
    await insertRows(
      this.client,
      "tables",
      changes.tables.created.map((table) => ({
        id: table.id,
        store_id: storeId,
        area_id: table.areaId,
        name: table.name,
        pos_x: table.posX,
        pos_y: table.posY,
        width: table.width,
        height: table.height,
        shape: table.shape,
        rotation: table.rotation,
        seats: table.seats,
        sort_order: table.sortOrder,
      })),
    );
    await insertRows(
      this.client,
      "floor_decor_items",
      changes.decorItems.created.map((decor) => ({
        id: decor.id,
        store_id: storeId,
        area_id: decor.areaId,
        kind: decor.kind,
        label: decor.label ?? null,
        asset_key: decor.assetKey,
        pos_x: decor.posX,
        pos_y: decor.posY,
        width: decor.width,
        height: decor.height,
        rotation: decor.rotation,
        z_index: decor.zIndex,
        is_locked: decor.isLocked,
      })),
    );

    for (const area of changes.areas.updated) {
      await updateRow(this.client, "floor_areas", area.id, {
        name: area.name,
        sort_order: area.sortOrder,
      });
    }
    for (const table of changes.tables.updated) {
      await updateRow(this.client, "tables", table.id, {
        area_id: table.areaId,
        name: table.name,
        pos_x: table.posX,
        pos_y: table.posY,
        width: table.width,
        height: table.height,
        shape: table.shape,
        rotation: table.rotation,
        seats: table.seats,
        sort_order: table.sortOrder,
      });
    }
    for (const decor of changes.decorItems.updated) {
      await updateRow(this.client, "floor_decor_items", decor.id, {
        area_id: decor.areaId,
        kind: decor.kind,
        label: decor.label,
        asset_key: decor.assetKey,
        pos_x: decor.posX,
        pos_y: decor.posY,
        width: decor.width,
        height: decor.height,
        rotation: decor.rotation,
        z_index: decor.zIndex,
        is_locked: decor.isLocked,
      });
    }

    for (const decor of changes.decorItems.deleted) {
      await tombstoneRow(this.client, "floor_decor_items", decor.id, decor.deletedByEmployeeId);
    }
    for (const table of changes.tables.deleted) {
      await tombstoneRow(this.client, "tables", table.id, table.deletedByEmployeeId);
    }
    for (const area of changes.areas.deleted) {
      await tombstoneRow(this.client, "floor_areas", area.id, area.deletedByEmployeeId);
    }
  }
}

class SupabaseOrderRepo implements IOrderRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async listOpenOrders(): Promise<OrderSummary[]> {
    const { data, error } = await this.client
      .from("orders")
      .select(orderFields)
      .eq("status", "open")
      .order("order_no");
    throwIfError(error);
    return ((data ?? []) as Row[]).map(mapOrderSummary);
  }

  async getOrder(orderId: string): Promise<OrderDetail> {
    const { data: orderRow, error: orderError } = await this.client
      .from("orders")
      .select(orderFields)
      .eq("id", orderId)
      .single();
    const order = requireData<Row>(orderRow as Row | null, orderError, "NOT_FOUND");
    const { data: itemRows, error: itemError } = await this.client
      .from("order_items")
      .select(orderItemFields)
      .eq("order_id", orderId)
      .neq("status", "removed")
      .order("sort_order");
    throwIfError(itemError);

    const items = (itemRows ?? []) as Row[];
    const itemIds = items.map((item) => String(item.id));
    let optionRows: Row[] = [];

    if (itemIds.length > 0) {
      const { data: options, error: optionError } = await this.client
        .from("order_item_options")
        .select(orderItemOptionFields)
        .in("order_item_id", itemIds)
        .order("created_at");
      throwIfError(optionError);
      optionRows = (options ?? []) as Row[];
    }

    return mapOrderDetail(order, items, optionRows);
  }

  async submitOrderChanges(input: SubmitOrderChangesInput): Promise<SubmitOrderChangesResult> {
    const activeItemCount = input.items.filter((item) => item.quantity > 0).length;
    const orderId = input.orderId ?? (activeItemCount > 0 ? crypto.randomUUID() : null);
    const { data, error } = await this.client.rpc("submit_order_changes", {
      p_order_id: orderId,
      p_table_id: input.tableId,
      p_order_type: input.orderType,
      p_employee_id: input.employeeId,
      p_expected_lock_version: input.expectedVersion,
      p_items: input.items,
    });
    return mapSubmitOrderChangesResult(requireData<Row>(data as Row | null, error));
  }

  async listTakeawayOpenOrders(): Promise<OrderSummary[]> {
    const { data, error } = await this.client
      .from("orders")
      .select(orderFields)
      .eq("status", "open")
      .eq("order_type", "takeaway")
      .order("order_no");
    throwIfError(error);
    return ((data ?? []) as Row[]).map(mapOrderSummary);
  }

  async listOrderHistory(filter: OrderHistoryFilter): Promise<OrderSummaryPage> {
    const from = Math.max(0, (filter.page - 1) * filter.pageSize);
    const to = from + filter.pageSize - 1;
    const { data, error, count } = await this.client
      .from("orders")
      .select(orderFields, { count: "exact" })
      .gte("business_date", filter.fromDate)
      .lte("business_date", filter.toDate)
      .order("business_date", { ascending: false })
      .order("order_no", { ascending: false })
      .range(from, to);
    throwIfError(error);

    return {
      items: ((data ?? []) as Row[]).map(mapOrderSummary),
      total: count ?? 0,
    };
  }
}

class SupabasePaymentRepo implements IPaymentRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async payOrder(input: PayOrderInput): Promise<PayOrderResult> {
    const { data, error } = await this.client.rpc("pay_order", {
      p_payment_id: input.paymentId || crypto.randomUUID(),
      p_order_id: input.orderId,
      p_employee_id: input.employeeId,
      p_method: input.method,
      p_expected_lock_version: input.expectedVersion,
      p_received_amount: input.receivedAmount,
    });
    return mapPayOrderResult(requireData<Row>(data as Row | null, error));
  }
}

class SupabaseReportRepo implements IReportRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async getCoreReport(filter: ReportFilter): Promise<CoreReport> {
    const { data: orderRows, error } = await this.client
      .from("orders")
      .select("id,total,business_date,paid_at,created_at")
      .eq("status", "paid")
      .eq("business_date", filter.businessDate);
    throwIfError(error);

    const orders = (orderRows ?? []) as Row[];

    if (orders.length === 0) {
      return emptyCoreReport(filter.businessDate);
    }

    const orderIds = orders.map((order) => String(order.id));
    const revenue = orders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
    const hourlyRevenue = new Map<string, number>();

    for (const order of orders) {
      const paidAt = order.paid_at ?? order.created_at;
      const date = paidAt ? new Date(String(paidAt)) : null;
      const label = date && !Number.isNaN(date.getTime()) ? date.getHours().toString().padStart(2, "0") : "--";
      hourlyRevenue.set(label, (hourlyRevenue.get(label) ?? 0) + Number(order.total ?? 0));
    }

    const { data: itemRows, error: itemError } = await this.client
      .from("order_items")
      .select("order_id,item_name,quantity,status")
      .in("order_id", orderIds)
      .neq("status", "removed");
    throwIfError(itemError);

    const topItems = new Map<string, number>();
    for (const item of (itemRows ?? []) as Row[]) {
      const name = String(item.item_name ?? "-");
      topItems.set(name, (topItems.get(name) ?? 0) + Number(item.quantity ?? 0));
    }

    const topItemName =
      [...topItems.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

    return {
      businessDate: filter.businessDate,
      revenue,
      paidOrders: orders.length,
      averageTicket: Math.round(revenue / orders.length),
      topItemName,
      hourlyRevenue: [...hourlyRevenue.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, value]) => ({ label, revenue: value })),
    };
  }
}

class SupabaseSettingsRepo implements ISettingsRepo {
  constructor(private readonly client: SupabaseAnyClient) {}

  async getSettings(): Promise<StoreSettings> {
    const storeId = await requireStoreId(this.client);
    const { data, error } = await this.client
      .from("store_settings")
      .select("store_id,display_name,address,currency,timezone,bill_footer")
      .eq("store_id", storeId)
      .single();
    return mapSettings(requireData<Row>(data as Row | null, error, "NOT_FOUND"));
  }

  async updateSettings(input: StoreSettingsUpdate): Promise<StoreSettings> {
    const storeId = await requireStoreId(this.client);
    const { data, error } = await this.client
      .from("store_settings")
      .update(
        stripUndefined({
          display_name: input.displayName,
          address: input.address,
          bill_footer: input.billFooter,
          timezone: input.timezone,
        }),
      )
      .eq("store_id", storeId)
      .select("store_id,display_name,address,currency,timezone,bill_footer")
      .single();
    return mapSettings(requireData<Row>(data as Row | null, error, "NOT_FOUND"));
  }

  async clearDemoData(employeeId: string): Promise<void> {
    const { error } = await this.client.rpc("clear_demo_data", { p_employee_id: employeeId });
    throwIfError(error);
  }
}

class SupabasePrintPort implements IPrintPort {
  async renderOrderTicket(ticket: PrintTicket): Promise<void> {
    this.renderWindow("Phiếu tạm", this.ticketHtml(ticket));
  }

  async renderReceipt(receipt: PrintReceipt): Promise<void> {
    this.renderWindow("Hóa đơn", this.receiptHtml(receipt));
  }

  private renderWindow(title: string, body: string): void {
    const popup = globalThis.window?.open?.("", "_blank", "width=420,height=640");

    if (!popup) {
      return;
    }

    popup.document.write(`<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`);
    popup.document.close();
  }

  private ticketHtml(ticket: PrintTicket): string {
    return `
      <main style="font-family: sans-serif; padding: 16px;">
        <h1>${ticket.orderType === "takeaway" ? "Mang đi" : `Bàn ${ticket.tableName ?? ""}`}</h1>
        <h2>Đơn #${ticket.orderNo}</h2>
        ${ticket.lines
          .map(
            (line) =>
              `<p><strong>${line.quantity}x ${line.name}</strong><br/>${line.options.join(", ")}</p>`,
          )
          .join("")}
        <hr/>
        <strong>Tổng: ${ticket.total.toLocaleString("vi-VN")}đ</strong>
      </main>
    `;
  }

  private receiptHtml(receipt: PrintReceipt): string {
    return `
      ${this.ticketHtml(receipt)}
      <main style="font-family: sans-serif; padding: 0 16px 16px;">
        <p>Khách đưa: ${receipt.receivedAmount.toLocaleString("vi-VN")}đ</p>
        <p>Tiền thối: ${receipt.changeAmount.toLocaleString("vi-VN")}đ</p>
        <p>${receipt.paidAt}</p>
      </main>
    `;
  }
}

class SupabaseRealtimePort implements IRealtimePort {
  constructor(private readonly client: SupabaseAnyClient) {}

  startStoreInvalidation(input: RealtimeInvalidationInput): () => void {
    const channel = this.client.channel(`store-${input.storeId}-invalidation`);
    const filter = `store_id=eq.${input.storeId}`;

    for (const table of ["orders", "payments", "tables"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, () => {
        input.invalidateOpenOrders();
        input.invalidateFloorPlan();
        input.invalidateReport();
      });
    }

    for (const table of ["categories", "menu_items", "option_groups", "option_values"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, () => {
        input.invalidateMenu();
      });
    }

    for (const table of ["floor_areas", "floor_decor_items"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, () => {
        input.invalidateFloorPlan();
      });
    }

    channel.subscribe();

    return () => {
      void this.client.removeChannel(channel);
    };
  }
}

export const createSupabasePorts = (client: SupabaseAnyClient): AppPorts => {
  const seed = new SupabaseSeedRepo(client);

  return {
    auth: new SupabaseAuthRepo(client, seed),
    employee: new SupabaseEmployeeRepo(client),
    menu: new SupabaseMenuRepo(client),
    floorPlan: new SupabaseFloorPlanRepo(client),
    order: new SupabaseOrderRepo(client),
    payment: new SupabasePaymentRepo(client),
    report: new SupabaseReportRepo(client),
    settings: new SupabaseSettingsRepo(client),
    seed,
    print: new SupabasePrintPort(),
    realtime: new SupabaseRealtimePort(client),
  };
};
