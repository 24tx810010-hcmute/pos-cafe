import { afterAll, beforeAll, expect, test } from "vitest";
import { observeCandidateStage } from "./permissionStageObservation";
import { readFileSync } from "node:fs";
import { db, EMPLOYEE_IDS as E, env, rpc, STORE_IDS as S } from "./permissionReadFixture";
import { emptyMenuChanges } from "./permissionChangesFixture";
import { cleanupImagesRuntimeFixture, setupImagesRuntimeFixture, trackImageUpload } from "./permissionImagesFixture";
import {
  prepareCompatibilityHook,
  verifyCompatibilityRestRouting,
} from "../../scripts/permission-compatibility-prepare.mjs";

let token = "", itemId = "";
let compatibilityReceipt: { installedByCaller: boolean } | undefined;
const headers = () => ({ apikey: env.anonKey, Authorization: `Bearer ${env.storeJwt}`, "x-pos-employee-token": token });
const markedRpc = async (name: string, body: object = {}) => {
  const response = await fetch(`${env.api}/rest/v1/rpc/${name}`, { method: "POST", headers: {
    apikey: env.anonKey,
    Authorization: `Bearer ${env.storeJwt}`,
    "Content-Type": "application/json",
    "x-pos-employee-token": token,
    "x-pos-permission-contract": "2",
  }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  return response.json();
};
beforeAll(async () => {
  try {
    await setupImagesRuntimeFixture();
    await db.query(readFileSync("supabase/candidate/permission-changes.sql", "utf8"));
    await db.query(readFileSync("supabase/candidate/permission-images.sql", "utf8"));
    await db.query("notify pgrst,'reload schema'");
    await new Promise(resolve => setTimeout(resolve, 1200));
    token = (await rpc("permission_start_session", { p_employee_id: E[0], p_pin: "384729" })).token;
    itemId = (await db.query("select id from public.menu_items where store_id=$1 order by id limit 1", [S[0]])).rows[0].id;
    compatibilityReceipt = await prepareCompatibilityHook(db);
    await verifyCompatibilityRestRouting({ restUrl: `${env.api}/rest/v1`, anonKey: env.anonKey });
    await db.query(readFileSync("supabase/candidate/permission-compatibility-activate.sql", "utf8"));
    await observeCandidateStage(db);
  } catch (error) {
    await cleanupImagesRuntimeFixture(compatibilityReceipt);
    throw error;
  }
});
afterAll(async () => {
  await cleanupImagesRuntimeFixture(compatibilityReceipt);
});

test("T09 real Storage and Edge lifecycle closes direct storage and checks authority before 304", async () => {
  expect((await db.query("select strict from private.permission_contract_gate where singleton")).rows[0].strict).toBe(true);
  const unmarked = await fetch(`${env.api}/rest/v1/rpc/permission_menu_image_read_staging`, { method: "POST", headers: {
    apikey: env.anonKey, Authorization: `Bearer ${env.storeJwt}`, "Content-Type": "application/json", "x-pos-employee-token": token,
  }, body: JSON.stringify({ p_upload_handle: crypto.randomUUID() }) });
  expect(unmarked.status).toBe(426);
  const direct = await fetch(`${env.api}/storage/v1/object/menu-item-image-staging/forged.png`, {
    method: "POST", headers: { apikey: env.anonKey, Authorization: `Bearer ${env.storeJwt}`, "Content-Type": "image/png" }, body: new Uint8Array([1,2,3]),
  });
  expect(direct.ok).toBe(false);

  const form = new FormData(); form.set("itemId", itemId); form.set("file", new File([new Uint8Array([137,80,78,71,13,10,26,10])], "tiny.png", { type: "image/png" }));
  const uploaded = await fetch(`${env.api}/functions/v1/menu-image-gateway`, { method: "POST", headers: headers(), body: form });
  expect(uploaded.status).toBe(201); expect(uploaded.headers.get("cache-control")).toBe("no-store");
  const uploadBody = await uploaded.json(); const uploadHandle = uploadBody.data.uploadHandle as string; await trackImageUpload(uploadHandle);

  const staged = await fetch(`${env.api}/functions/v1/menu-image-gateway/staging/${uploadHandle}`, { headers: headers() });
  expect(staged.status).toBe(200); expect(staged.headers.get("cache-control")).toBe("no-store"); expect(new Uint8Array(await staged.arrayBuffer()).length).toBe(8);
  const method = await fetch(`${env.api}/functions/v1/menu-image-gateway/staging/${uploadHandle}`, { method: "PUT", headers: headers() });
  expect(method.status).toBe(405); expect(method.headers.get("cache-control")).toBe("no-store");
  const unauth = await fetch(`${env.api}/functions/v1/menu-image-gateway/staging/${uploadHandle}`, {
    headers: { apikey: env.anonKey, Authorization: `Bearer ${env.storeJwt}` },
  });
  expect(unauth.status).toBe(401); expect(unauth.headers.get("cache-control")).toBe("no-store");

  const proposedItemId = crypto.randomUUID(), proposed = new FormData(); proposed.set("itemId", proposedItemId);
  proposed.set("file", new File([new Uint8Array([137,80,78,71,13,10,26,10])], "new.png", { type: "image/png" }));
  const proposedUpload = await fetch(`${env.api}/functions/v1/menu-image-gateway`, { method: "POST", headers: headers(), body: proposed });
  expect(proposedUpload.status).toBe(201); const proposedHandle = (await proposedUpload.json()).data.uploadHandle as string; await trackImageUpload(proposedHandle);
  expect((await db.query("select state from private.menu_image_uploads where upload_handle=$1", [proposedHandle])).rows[0].state).toBe("ready");
  expect(await markedRpc("apply_menu_changes", { p_changes: { ...emptyMenuChanges, imageChanges: [{ itemId: proposedItemId, uploadHandle: proposedHandle }] } })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  expect(Number((await db.query("select count(*) n from private.menu_image_assets where item_id=$1", [proposedItemId])).rows[0].n)).toBe(0);
  expect(await markedRpc("apply_menu_changes", { p_changes: { ...emptyMenuChanges, imageChanges: [{ itemId: proposedItemId, uploadHandle: crypto.randomUUID() }] } })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  const categoryId = (await db.query("select id from public.categories where store_id=$1 and deleted_at is null order by id limit 1", [S[0]])).rows[0].id;
  expect(await markedRpc("apply_menu_changes", { p_changes: { ...emptyMenuChanges,
    menuItems: { created: [{ id: proposedItemId, categoryId, name: "New staged image", price: 19000, imageAssetKey: null, sortOrder: 99, isAvailable: true }], updated: [], deleted: [] },
    imageChanges: [{ itemId: proposedItemId, uploadHandle: proposedHandle }],
  } })).toEqual({ ok: true, data: null });
  const proposedAsset = (await db.query("select image_asset_key from public.menu_items where id=$1", [proposedItemId])).rows[0].image_asset_key;
  expect((await fetch(`${env.api}/functions/v1/menu-image-public/${proposedAsset}`)).status).toBe(200);

  const deniedId = crypto.randomUUID(), deniedForm = new FormData(); deniedForm.set("itemId", deniedId);
  deniedForm.set("file", new File([new Uint8Array([137,80,78,71,13,10,26,10])], "denied.png", { type: "image/png" }));
  const deniedUpload = await fetch(`${env.api}/functions/v1/menu-image-gateway`, { method: "POST", headers: headers(), body: deniedForm });
  const deniedHandle = (await deniedUpload.json()).data.uploadHandle as string; await trackImageUpload(deniedHandle);
  await db.query("update public.employees set permission_overrides=jsonb_build_object('grants','[]'::jsonb,'denies','[\"menu.manage\"]'::jsonb),permission_revision=permission_revision+1 where id=$1", [E[0]]);
  expect(await markedRpc("apply_menu_changes", { p_changes: { ...emptyMenuChanges,
    menuItems: { created: [{ id: deniedId, categoryId, name: "Denied staged image", price: 19000, imageAssetKey: null, sortOrder: 100, isAvailable: true }], updated: [], deleted: [] },
    imageChanges: [{ itemId: deniedId, uploadHandle: deniedHandle }],
  } })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  expect((await db.query("select state from private.menu_image_uploads where upload_handle=$1", [deniedHandle])).rows[0].state).toBe("ready");
  await db.query("update public.employees set permission_overrides=null,permission_revision=permission_revision+1 where id=$1", [E[0]]);

  expect(await markedRpc("apply_menu_changes", { p_changes: { ...emptyMenuChanges, imageChanges: [{ itemId, uploadHandle }] } })).toEqual({ ok: true, data: null });
  const assetKey = (await db.query("select image_asset_key from public.menu_items where store_id=$1 and id=$2", [S[0], itemId])).rows[0].image_asset_key;
  const publicUrl = `${env.api}/functions/v1/menu-image-public/${assetKey}`;
  const published = await fetch(publicUrl); expect(published.status).toBe(200); expect(published.headers.get("cache-control")).toBe("private, max-age=60, must-revalidate");
  const etag = published.headers.get("etag"); expect(etag).toBe(`"${assetKey}"`);
  const unchanged = await fetch(publicUrl, { headers: { "If-None-Match": etag! } }); expect(unchanged.status).toBe(304);

  const originalObjectKey = (await db.query("select object_key from private.menu_image_assets where asset_key=$1", [assetKey])).rows[0].object_key as string;
  const missingObjectKey = `${S[0]}/menu-items/${itemId}/missing-${crypto.randomUUID()}.png`;
  await db.query("update private.menu_image_assets set object_key=$1 where asset_key=$2 and object_key=$3",
    [missingObjectKey, assetKey, originalObjectKey]);
  try {
    for (const headers of [{}, { "If-None-Match": etag! }]) {
      const fault = await fetch(publicUrl, { headers });
      expect(fault.status).toBe(503);
      expect(fault.headers.get("cache-control")).toBe("no-store");
      expect((await fault.json()).error.code).toBe("IMAGE_STORAGE_UNAVAILABLE");
    }
  } finally {
    await db.query("update private.menu_image_assets set object_key=$1 where asset_key=$2 and object_key=$3",
      [originalObjectKey, assetKey, missingObjectKey]);
  }

  expect(await markedRpc("apply_menu_changes", { p_changes: { ...emptyMenuChanges, imageChanges: [{ itemId, uploadHandle: null }] } })).toEqual({ ok: true, data: null });
  const withdrawn = await fetch(publicUrl, { headers: { "If-None-Match": etag! } });
  expect(withdrawn.status).toBe(404); expect(withdrawn.headers.get("cache-control")).toBe("no-store");
  const publicMethod = await fetch(publicUrl, { method: "POST" }); expect(publicMethod.status).toBe(405); expect(publicMethod.headers.get("cache-control")).toBe("no-store");

  expect(await markedRpc("apply_menu_changes", { p_changes: { ...emptyMenuChanges,
    menuItems: { created: [], updated: [], deleted: [{ id: proposedItemId }] }, imageChanges: [{ itemId: proposedItemId, uploadHandle: null }],
  } })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  expect((await fetch(`${env.api}/functions/v1/menu-image-public/${proposedAsset}`)).status).toBe(200);
  expect(await markedRpc("apply_menu_changes", { p_changes: { ...emptyMenuChanges,
    menuItems: { created: [], updated: [], deleted: [{ id: proposedItemId }] },
  } })).toEqual({ ok: true, data: null });
  const deleted = await fetch(`${env.api}/functions/v1/menu-image-public/${proposedAsset}`, { headers: { "If-None-Match": `"${proposedAsset}"` } });
  expect(deleted.status).toBe(404); expect(deleted.headers.get("cache-control")).toBe("no-store");
  const tombstoneForm = new FormData(); tombstoneForm.set("itemId", proposedItemId);
  tombstoneForm.set("file", new File([new Uint8Array([137,80,78,71,13,10,26,10])], "tombstone.png", { type: "image/png" }));
  const tombstoneUpload = await fetch(`${env.api}/functions/v1/menu-image-gateway`, { method: "POST", headers: headers(), body: tombstoneForm });
  expect(tombstoneUpload.status).toBe(201); const tombstoneHandle = (await tombstoneUpload.json()).data.uploadHandle as string; await trackImageUpload(tombstoneHandle);
  expect(await markedRpc("apply_menu_changes", { p_changes: { ...emptyMenuChanges, imageChanges: [{ itemId: proposedItemId, uploadHandle: tombstoneHandle }] } })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  expect((await db.query("select state from private.menu_image_uploads where upload_handle=$1", [tombstoneHandle])).rows[0].state).toBe("ready");
});
