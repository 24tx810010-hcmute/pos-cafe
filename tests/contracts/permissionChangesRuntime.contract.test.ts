import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, test } from "vitest";
import { EMPLOYEE_IDS as E, rpc } from "./permissionIdentityFixture";
import {
  cleanupPermissionSignalsFixture,
  db,
  setupPermissionSignalsFixture,
  STORE_IDS as S,
} from "./permissionSignalsFixture";
import { emptyFloorChanges } from "./permissionChangesFixture";

const PIN = "384729";
const areaId = "81000000-0000-4000-8000-000000000001";
const emptyTableId = "81000000-0000-4000-8000-000000000002";
const occupiedTableId = "81000000-0000-4000-8000-000000000003";
let token = "";

async function snapshotFloorAndSignals() {
  const row = (await db.query(`select
    (select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from public.floor_areas a where a.store_id=$1) areas,
    (select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from public.tables t where t.store_id=$1) tables,
    (select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from public.floor_decor_items d where d.store_id=$1) decor,
    (select coalesce(jsonb_agg(to_jsonb(s) order by s.topic),'[]') from public.store_change_signals s where s.store_id=$1) signals`, [S[0]])).rows[0];
  return row;
}

async function applyFloor(changes: unknown) {
  const result = (await db.query("select public.apply_floor_changes($1) result", [changes])).rows[0].result;
  expect(result).toMatchObject({ ok: false, error: { code: "INVALID_WRITE_REQUEST" } });
}

beforeAll(async () => {
  await setupPermissionSignalsFixture();
  token = (await rpc("permission_start_session", { p_employee_id: E[0], p_pin: PIN })).token;
  await db.query("begin");
  await db.query(readFileSync("supabase/candidate/permission-changes.sql", "utf8"));
  await db.query("select set_config('request.jwt.claims',$1,true),set_config('request.headers',$2,true)", [
    JSON.stringify({ sub: S[0], role: "authenticated" }),
    JSON.stringify({ "x-pos-employee-token": token }),
  ]);
  await db.query("insert into public.floor_areas(id,store_id,name,sort_order) values($1,$2,'Atomic floor',9000)", [areaId, S[0]]);
  await db.query(`insert into public.tables(id,store_id,area_id,name,pos_x,pos_y,width,height,shape,status,sort_order)
    values($1,$3,$4,'Empty first',0,0,100,100,'square','empty',9001),
          ($2,$3,$4,'Occupied blocker',100,0,100,100,'square','occupied',9002)`,
  [emptyTableId, occupiedTableId, S[0], areaId]);
});

afterAll(async () => {
  try { await db.query("rollback"); } finally { await cleanupPermissionSignalsFixture(); }
});

test("T08 occupied table delete rejects a mixed rename with zero row or signal effect", async () => {
  const before = await snapshotFloorAndSignals();
  await applyFloor({
    ...emptyFloorChanges,
    areas: { ...emptyFloorChanges.areas, updated: [{ id: areaId, name: "Must not persist" }] },
    tables: { ...emptyFloorChanges.tables, deleted: [{ id: occupiedTableId }] },
  });
  expect(await snapshotFloorAndSignals()).toEqual(before);
});

test("T08 occupied table prevalidation rejects before an earlier empty delete", async () => {
  const before = await snapshotFloorAndSignals();
  await applyFloor({
    ...emptyFloorChanges,
    tables: { ...emptyFloorChanges.tables, deleted: [{ id: emptyTableId }, { id: occupiedTableId }] },
  });
  expect(await snapshotFloorAndSignals()).toEqual(before);
});
