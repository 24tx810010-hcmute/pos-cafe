import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const identity = readFileSync(resolve("supabase/candidate/permission-identity.sql"), "utf8");
const seed = readFileSync(resolve("supabase/candidate/permission-seed.sql"), "utf8");

function functionBody(sql: string, name: string) {
  const start = sql.indexOf(`create function ${name}`);
  expect(start, `${name} must exist`).toBeGreaterThanOrEqual(0);
  const next = sql.indexOf("\ncreate function ", start + 1);
  return sql.slice(start, next < 0 ? sql.length : next);
}

describe("forced owner PIN server SQL contract", () => {
  it("declares owner-only forced state and purpose-bound session TTLs", () => {
    expect(identity).toContain("pin_change_required boolean not null default false");
    expect(identity).toContain("check(not pin_change_required or role='owner')");
    expect(identity).toContain("purpose in ('normal','required_pin_change')");
    expect(identity).toContain("employee_revision bigint not null default 0");
    expect(identity).toContain("purpose='required_pin_change' and expires_at=issued_at+interval '5 minutes'");
    const start = functionBody(identity, "public.permission_start_session");
    expect(start).toContain("interval '5 minutes'");
    expect(start).toContain("interval '12 hours'");
    expect(start).toContain("'kind','required_pin_change'");
    expect(start).toContain("'kind','normal'");
    expect(start).not.toContain("private.permission_authority_json(e)));\n  end if");
  });

  it("fails every normal employee guard closed after its locked reread", () => {
    const current = functionBody(identity, "private.permission_current_employee");
    expect(current.indexOf("for share")).toBeLessThan(current.indexOf("s.purpose<>'normal'"));
    expect(current).toContain("s.purpose<>'normal' or e.pin_change_required");
    expect(current).toContain("raise exception 'PIN_CHANGE_REQUIRED'");
  });

  it("keeps proof minimal and validates complete session before receipt lookup", () => {
    const proof = functionBody(identity, "public.permission_check_required_pin_session");
    expect(proof).toContain("'valid',true,'purpose','required_pin_change'");
    expect(proof).toContain("s.employee_revision<>e.permission_revision");
    for (const forbidden of ["permission_authority_json", "configured_employee_permissions", "'role'", "'storeId'"]) expect(proof).not.toContain(forbidden);

    const complete = functionBody(identity, "public.permission_complete_required_pin_change");
    expect(complete.indexOf("s.expires_at<=private.write_clock()"))
      .toBeLessThan(complete.indexOf("select * into prior from private.employee_admin_requests"));
    expect(complete).toContain("p_request-array['requestId','expectedRevision','newPin']<>'{}'");
    expect(complete).toContain("s.employee_revision<>e.permission_revision");
    expect(complete).toContain("'PIN_REUSE_NOT_ALLOWED'");
    expect(complete).toContain("pin_change_required=false,permission_revision=permission_revision+1");
    expect(complete).toContain("update private.employee_sessions set revoked_at=coalesce");
    expect(complete).not.toContain("'outcome','replayed'");
    expect(complete).not.toContain("currentPin");
  });

  it("forces every new owner recovery event while preserving historical replay", () => {
    const change = functionBody(identity, "private.permission_pin_change");
    expect(change).toContain("if old_request.request_id is not null");
    expect(change).toContain("old_request.terminal_outcome||jsonb_build_object('outcome','replayed')");
    expect(change).toContain("if kind='owner_recovery' then");
    expect(change).toContain("pin_change_required=true,permission_revision=permission_revision+1");
    expect(change).toContain("passcode_hash=case when changed then");
    expect(change).toContain("update private.employee_sessions set revoked_at=coalesce");
    expect(change).toContain("outcome:=case when kind='owner_recovery' or changed then 'applied' else 'noop' end");
  });

  it("uses contract 2, idempotent reservation, and canonical bootstrap seed choice", () => {
    expect(identity).toContain("'permissionContractVersion',2,'writeProtocolVersion',1");
    const reserve = functionBody(identity, "public.permission_reserve_store_no");
    expect(reserve).toContain("private.store_no_reservations where request_id=p_create_attempt_id");
    expect(reserve).toContain("'data',jsonb_build_object('storeNo',reserved)");
    const bootstrap = functionBody(identity, "public.permission_bootstrap_store");
    expect(bootstrap).toContain("'seedDemo'");
    expect(bootstrap).toContain("pin_change_required) values");
    expect(bootstrap).toContain("private.initial_seed_workflows");
    expect(bootstrap).toContain("private.initial_seed_stages");
    expect(bootstrap).toContain("'seedRequested',seed_demo,'seedWorkflowId',workflow_id");
  });
});

describe("durable initial seed server SQL contract", () => {
  it("exposes status, claim, and stage routes with a full stable status projection", () => {
    for (const route of ["permission_get_initial_seed_status", "permission_begin_initial_seed", "permission_run_initial_seed_stage"]) {
      expect(seed).toContain(`public.${route}`);
    }
    const projection = functionBody(seed, "private.permission_initial_seed_status_json");
    for (const field of ["workflowId", "status", "workflowRevision", "autoEligible", "runGeneration", "lastErrorCode", "stages", "stageId", "committedAt"]) {
      expect(projection).toContain(`'${field}'`);
    }
    expect(seed).toContain("grant execute on function public.permission_get_initial_seed_status(),public.permission_begin_initial_seed(jsonb),public.permission_run_initial_seed_stage(jsonb) to authenticated");
  });

  it("serializes claims by revision and rejects stale generations/order", () => {
    const begin = functionBody(seed, "public.permission_begin_initial_seed");
    expect(begin).toContain("for update");
    expect(begin).toContain("expected<>workflow.workflow_revision");
    expect(begin).toContain("run_generation=run_generation+1,workflow_revision=workflow_revision+1");
    const run = functionBody(seed, "public.permission_run_initial_seed_stage");
    expect(run).toContain("generation<>workflow.run_generation");
    expect(run).toContain("committed_before<>stage_order-1");
    expect(run).toContain("'INITIAL_SEED_ATTEMPT_STALE'");
    expect(run.indexOf("pg_advisory_xact_lock(hashtext(sid::text||':catalog-write'))"))
      .toBeLessThan(run.lastIndexOf("actor:=private.permission_current_employee(false)"));
  });

  it("returns committed receipts without invoking insert helpers again", () => {
    const run = functionBody(seed, "public.permission_run_initial_seed_stage");
    expect(run.indexOf("if stage_row.status='committed'"))
      .toBeLessThan(run.indexOf("permission_seed_employee_insert"));
    expect(run).toContain("receipt=jsonb_build_object('stage',stage_name");
    expect(run).toContain("status='needs_retry'");
    expect(run).toContain("last_error_code=failure_code");
  });

  it("uses insert-only deterministic entities and closes standalone seed bypasses", () => {
    expect(seed).toContain("private.permission_seed_uuid");
    expect(seed).not.toMatch(/on conflict\s*\(\s*id\s*\)\s*do update/i);
    expect(seed).toContain("raise exception 'ENTITY_ID_CONFLICT'");
    expect(seed).toContain("drop function if exists public.seed_demo_employee(uuid)");
    expect(seed).toContain("drop function if exists public.seed_demo_menu()");
    expect(seed).toContain("drop function if exists public.seed_demo_floor()");
    expect(seed).not.toMatch(/grant execute on function public\.seed_demo_/i);
  });
});
