import { emptyFloorChanges, emptyMenuChanges } from "./permissionChangesFixture";

export type OwnerPinProtectedRoute = { signature: string; args: unknown[] };

// Candidate business RPC inventory. Callers compare this list with actual
// authenticated EXECUTE grants before probing each route.
export function ownerPinProtectedRoutes(employeeId: string): OwnerPinProtectedRoute[] {
  const id = "80000000-0000-4000-8000-000000000091";
  return [
    { signature: "permission_get_authority()", args: [] },
    { signature: "permission_get_revision()", args: [] },
    { signature: "permission_change_own_pin(jsonb)", args: [{ requestId: id, expectedRevision: 0, currentPin: "384729", newPin: "927416" }] },
    { signature: "permission_admin_create(jsonb)", args: [{ requestId: id, id, name: "Nhân viên thử", role: "cashier", pin: "927416" }] },
    { signature: "permission_admin_update(jsonb)", args: [{ requestId: id, targetId: employeeId, expectedRevision: 0, patch: { name: "Tên mới" } }] },
    { signature: "permission_admin_reset_pin(jsonb)", args: [{ requestId: id, targetId: employeeId, expectedRevision: 0, newPin: "927416" }] },
    { signature: "permission_admin_list()", args: [] },
    { signature: "permission_admin_get(uuid)", args: [employeeId] },
    { signature: "permission_admin_audit(jsonb)", args: [{}] },
    { signature: "get_write_capabilities()", args: [] },
    { signature: "register_write_operation(uuid,jsonb)", args: [id, {}] },
    { signature: "execute_write_operation(uuid,jsonb)", args: [id, {}] },
    { signature: "execute_write_operation(uuid,jsonb,uuid)", args: [id, {}, id] },
    { signature: "get_write_operation(uuid)", args: [id] },
    { signature: "cancel_write_operation(uuid)", args: [id] },
    { signature: "list_write_operations(uuid,text[],text[],timestamp with time zone,timestamp with time zone,text,integer)", args: [null, null, null, null, null, null, 20] },
    { signature: "permission_get_sales_report(jsonb)", args: [{ fromDate: "2026-09-01", toDate: "2026-09-22" }] },
    { signature: "permission_list_report_orders(jsonb)", args: [{ fromDate: "2026-09-01", toDate: "2026-09-22" }] },
    { signature: "permission_get_floor_operational()", args: [] },
    { signature: "permission_get_floor_admin()", args: [] },
    { signature: "permission_get_pos_menu()", args: [] },
    { signature: "permission_get_menu_admin()", args: [] },
    { signature: "permission_get_open_order_detail(uuid)", args: [id] },
    { signature: "permission_get_paid_order_for_void(uuid)", args: [id] },
    { signature: "permission_get_order_history_detail(uuid)", args: [id] },
    { signature: "permission_list_order_history(jsonb)", args: [{}] },
    { signature: "permission_get_store_display()", args: [] },
    { signature: "permission_get_settings_admin()", args: [] },
    { signature: "get_payment_receipt(uuid)", args: [id] },
    { signature: "apply_menu_changes(jsonb)", args: [emptyMenuChanges] },
    { signature: "apply_floor_changes(jsonb)", args: [emptyFloorChanges] },
    { signature: "update_store_settings(jsonb)", args: [{ displayName: "Quán thử" }] },
    { signature: "clear_demo_data(uuid,boolean)", args: [id, true] },
    { signature: "permission_menu_image_begin_upload(uuid,uuid,text,bigint)", args: [id, id, "image/png", 10] },
    { signature: "permission_menu_image_mark_ready(uuid)", args: [id] },
    { signature: "permission_menu_image_read_staging(uuid)", args: [id] },
    { signature: "permission_menu_image_discard_upload(uuid)", args: [id] },
    { signature: "authorize_initial_receipt_print(uuid,uuid)", args: [id, id] },
    { signature: "prepare_receipt_reprint(uuid)", args: [id] },
    { signature: "permission_get_initial_seed_status()", args: [] },
    { signature: "permission_begin_initial_seed(jsonb)", args: [{ mode: "initial", expectedWorkflowRevision: 0 }] },
    { signature: "permission_run_initial_seed_stage(jsonb)", args: [{ runGeneration: 1, stage: "employee" }] },
  ];
}
