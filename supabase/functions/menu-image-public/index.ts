import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { cors, failure, NO_STORE, PUBLIC_CACHE, UUID } from "../_shared/menuImageHttp.ts";

const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = "menu-item-image-staging";

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, ...NO_STORE } });
  if (request.method !== "GET") return failure(405, "METHOD_NOT_ALLOWED");
  const match = new URL(request.url).pathname.match(/\/menu-image-public\/([0-9a-f-]+)$/i);
  if (!match || !UUID.test(match[1])) return failure(404, "NOT_FOUND");
  const assetKey = match[1].toLowerCase();
  try {
    // This lookup always happens before conditional 304, so an unlinked asset is
    // never served/revalidated from origin after publication is withdrawn.
    const lookup = await service.rpc("permission_menu_image_public_lookup", { p_asset_key: assetKey });
    if (lookup.error) return failure(503, "IMAGE_GATEWAY_UNAVAILABLE");
    const row = lookup.data as Record<string, unknown> | null;
    if (!row || typeof row.objectKey !== "string" || typeof row.mimeType !== "string") return failure(404, "NOT_FOUND");
    const etag = `"${assetKey}"`;
    const headers = { "Cache-Control": PUBLIC_CACHE, ETag: etag, ...cors };
    const downloaded = await service.storage.from(bucket).download(row.objectKey);
    if (downloaded.error) return failure(503, "IMAGE_STORAGE_UNAVAILABLE");
    // A stale client must not renew cached bytes when Storage cannot serve this asset.
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(downloaded.data, { status: 200, headers: { ...headers, "Content-Type": row.mimeType } });
  } catch { return failure(503, "IMAGE_GATEWAY_UNAVAILABLE"); }
});

