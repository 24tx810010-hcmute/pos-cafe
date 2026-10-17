import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { rpcContracts } from "./permissionChangesFixture";

const sql = readFileSync("supabase/candidate/permission-changes.sql", "utf8");

describe("PERM-T08 non-financial server candidate", () => {
  test("publishes the agreed RPC names, argument names, and strict envelopes", () => {
    expect(Object.values(rpcContracts).map((rpc) => rpc.name)).toEqual([
      "apply_menu_changes", "apply_floor_changes", "update_store_settings", "clear_demo_data",
    ]);
    expect(sql).toMatch(/function public\.apply_menu_changes\(p_changes jsonb\) returns jsonb/);
    expect(sql).toMatch(/function public\.apply_floor_changes\(p_changes jsonb\) returns jsonb/);
    expect(sql).toMatch(/function public\.update_store_settings\(p_input jsonb\) returns jsonb/);
    expect(sql).toMatch(/function public\.clear_demo_data\(p_request_id uuid,p_confirmation boolean\) returns jsonb/);
    expect(sql.match(/jsonb_build_object\('ok',true,'data',null\)/g)).toHaveLength(2);
    expect(sql).toContain("jsonb_build_object('ok',true,'outcome',outcome,'data',null)");
    expect(sql).toContain("'storeId',after_row.store_id");
    expect(sql).toContain("'currency',after_row.currency");
  });

  test("takes business locks before the final current authority checkpoint", () => {
    const bodies = [
      sql.slice(sql.indexOf("function public.apply_menu_changes"), sql.indexOf("function private.permission_floor_valid")),
      sql.slice(sql.indexOf("function public.apply_floor_changes"), sql.indexOf("function public.update_store_settings")),
      sql.slice(sql.indexOf("function public.update_store_settings"), sql.indexOf("function public.clear_demo_data")),
      sql.slice(sql.indexOf("create or replace function public.clear_demo_data"), sql.indexOf("-- Close every direct write path")),
    ];
    for (const body of bodies) {
      const lock = Math.max(body.indexOf("permission_store_mutex"), body.indexOf("permission_lock_changes"));
      expect(lock).toBeGreaterThan(-1);
      expect(body.indexOf("permission_changes_checkpoint")).toBeGreaterThan(lock);
    }
    expect(sql).toContain("actor:=private.permission_changes_checkpoint('menu.manage')");
    expect(sql).toContain("actor:=private.permission_changes_checkpoint('floor.manage')");
    expect(sql).toContain("actor:=private.permission_changes_checkpoint('settings.manage')");
    expect(sql).toContain("actor:=private.permission_changes_checkpoint('floor.view')");
    expect(sql).toContain("not 'data.clearDemo'=any(actor_rights)");
  });

  test("uses tenant-qualified mutation and rejects caller-supplied tombstone actors", () => {
    const mutations = sql.split(/\r?\n/).filter((line) => /^\s*(update|delete from) public\./i.test(line));
    expect(mutations.length).toBeGreaterThan(8);
    expect(mutations.every((line) => /store_id\s*=\s*sid|store_id=sid/.test(line))).toBe(true);
    expect(sql).toContain("x->'deletedByEmployeeId'<>'null'::jsonb");
    expect(sql).toContain("deleted_by_employee_id=actor.id");
    expect(sql).not.toMatch(/deleted_by_employee_id\s*=\s*\(x->>/);
  });

  test("whitelists JSON fields, UUIDs, references, numeric bounds, and legacy assets", () => {
    expect(sql).toContain("p-array['categories','menuItems','optionGroups','optionValues','menuItemOptionGroups','imageChanges']<>'{}'");
    expect(sql).toContain("p-array['areas','tables','decorItems']<>'{}'");
    expect(sql).toContain("p_input-array['displayName','address','billFooter','timezone']<>'{}'");
    expect(sql).toContain("private.valid_uuid");
    expect(sql).toContain("private.permission_changes_int");
    expect(sql).toContain("for share");
    expect(sql).toContain("j->>'imageAssetKey' is distinct from m.image_asset_key");
    expect(sql).toContain("permission_lock_menu_image_changes($1,$2)");
    expect(sql).toContain("permission_finalize_menu_image($1,$2,$3)");
    expect(sql).toContain("permission_unpublish_menu_image($1,$2,$3)");
    expect(sql).toContain("private.permission_floor_asset(x->'backgroundAssetKey',true)");
    expect(sql).toContain("private.permission_floor_asset(x->'assetKey',false)");
    expect(sql).toContain("table-bg-[0-9]{2}");
    expect(sql).toContain("deco-(tree|seat|fixtures|other)-[0-9]{2}");
  });

  test("makes timezone owner-only and clear-demo seed-only with open-order blocker", () => {
    expect(sql).toContain("actor.role<>'owner'");
    expect(sql).toContain("p_input->>'timezone' is distinct from before_row.timezone");
    expect(sql).toContain("OPEN_ORDERS_BLOCK_CLEAR_DEMO");
    expect(sql).toContain("seed_key is not null");
    expect(sql).toContain("role<>'owner'");
    expect(sql).not.toMatch(/(delete from|update) public\.(orders|payments|write_operations|order_events)/);
  });

  test("makes clear-demo request identity immutable, exact-replayable, audited, and atomic", () => {
    expect(sql).toContain("private.employee_admin_requests");
    expect(sql).toContain("private.permission_request_mac_keys");
    expect(sql).toContain("extensions.hmac");
    expect(sql).toContain("prior.payload_mac<>payload_mac");
    expect(sql).toContain("ADMIN_REQUEST_REUSED");
    expect(sql).toContain("return prior.terminal_outcome");
    expect(sql).toContain("p_request_id is null");
    expect(sql).toContain("p_confirmation is distinct from true");
    expect(sql.indexOf("prior.payload_mac<>payload_mac")).toBeLessThan(sql.indexOf("p_confirmation is distinct from true"));
    expect(sql).toContain("insert into public.employee_admin_audit");
    expect(sql).toContain("update private.employee_sessions");
    expect(sql).toContain("permission_revision=permission_revision+1");
    expect(sql).toContain("when others then return private.permission_changes_failure('PERMISSION_UPDATE_UNAVAILABLE')");
  });

  test("closes table and column DML ACLs and every legacy seed/clear overload", () => {
    expect(sql).toContain("revoke insert,update,delete,truncate");
    expect(sql).toContain("revoke insert(%I),update(%I)");
    expect(sql).toContain("'clear_demo_data','seed_employee'");
    expect(sql).toContain("grant execute on function %s to anon,authenticated");
    expect(sql).toContain("f.signature::text='clear_demo_data(uuid,boolean)'");
  });
});
