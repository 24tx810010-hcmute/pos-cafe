import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve("supabase/candidate/permission-seed.sql"), "utf8");

describe("permission initial seed API surface (static contract only)", () => {
  it("exposes status and workflow commands without caller store or fixture data", () => {
    expect(sql).toContain("public.permission_get_initial_seed_status()");
    expect(sql).toContain("public.permission_begin_initial_seed(p_request jsonb)");
    expect(sql).toContain("public.permission_run_initial_seed_stage(p_request jsonb)");
    expect(sql).not.toMatch(/create (?:or replace )?function public.seed_demo_/i);
    expect(sql).not.toContain("p_manifest");
  });

  it("keeps stable template keys without rewriting or reviving existing business rows", () => {
    expect(sql).toContain("private.permission_stable_uuid");
    for (const key of ["demo.employee.demo-emp-cashier", "cat-coffee", "mi-ca-phe-sua", "demo.area.area-ground", "tbl-b01", "decor-wall-ground"]) {
      expect(sql).toContain(key);
    }
    expect(sql).not.toContain("on conflict(id) do update");
    expect(sql).not.toContain("deleted_at=null,deleted_by_employee_id=null");
    expect(sql).toContain("ENTITY_ID_CONFLICT");
  });

  it("requires a current normal owner and records creation without resetting existing employee credentials", () => {
    expect(sql).toContain("private.permission_current_employee()");
    expect(sql).toContain("actor.role<>'owner'");
    expect(sql).not.toMatch(/update public.employees set/i);
    expect(sql).toContain("insert into public.employee_admin_audit");
    expect(sql).toContain("credential_changed");
    expect(sql).toContain("insert into public.store_change_signals");
  });

  it("closes standalone seed and private execution surfaces", () => {
    for (const signature of ["seed_demo_employee(uuid)", "seed_demo_menu()", "seed_demo_floor()"])
      expect(sql).toContain(`drop function if exists public.${signature}`);
    expect(sql).toContain("from public,anon,authenticated,service_role");
    expect(sql).toContain("grant execute on function public.permission_get_initial_seed_status(),public.permission_begin_initial_seed(jsonb),public.permission_run_initial_seed_stage(jsonb) to authenticated");
  });
});
