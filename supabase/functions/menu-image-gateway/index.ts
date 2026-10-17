import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import {
  bearer, cors, failure, IMAGE_TYPES, json, MAX_IMAGE_BYTES, NO_STORE,
  PERMISSION_CONTRACT_HEADER, PERMISSION_CONTRACT_VERSION, rpcData, UUID,
} from "../_shared/menuImageHttp.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const bucket = "menu-item-image-staging";

const clients = (request: Request, token: string, employeeToken: string) => ({
  caller: createClient(url, anonKey, { global: { headers: {
    Authorization: `Bearer ${token}`,
    "x-pos-employee-token": employeeToken,
    [PERMISSION_CONTRACT_HEADER]: PERMISSION_CONTRACT_VERSION,
  } }, auth: { persistSession: false, autoRefreshToken: false } }),
  service: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
});
const authorize = async (request: Request) => {
  const token = bearer(request); const employeeToken = request.headers.get("x-pos-employee-token");
  if (!token) return { response: failure(401, "AUTH_REQUIRED") };
  if (!employeeToken) return { response: failure(401, "EMPLOYEE_SESSION_REQUIRED") };
  const pair = clients(request, token, employeeToken);
  const { data, error } = await pair.caller.auth.getUser(token);
  if (error || !data.user) return { response: failure(401, "AUTH_REQUIRED") };
  return pair;
};
const rpc = async (caller: ReturnType<typeof createClient>, name: string, args: Record<string, unknown>) => {
  const result = await caller.rpc(name, args);
  if (result.error) return { response: failure(503, "IMAGE_GATEWAY_UNAVAILABLE") };
  const data = rpcData(result.data);
  if (!data) {
    const code = (result.data as { error?: { code?: string } } | null)?.error?.code ?? "IMAGE_GATEWAY_UNAVAILABLE";
    const status = code === "AUTH_REQUIRED" || code === "EMPLOYEE_SESSION_REQUIRED" ? 401 : code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : 400;
    return { response: failure(status, code) };
  }
  return { data };
};

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, ...NO_STORE } });
  const auth = await authorize(request); if ("response" in auth) return auth.response;
  const pathname = new URL(request.url).pathname;
  const staging = pathname.match(/\/staging\/([0-9a-f-]+)$/i);
  try {
    if (request.method === "POST" && !staging) {
      const form = await request.formData();
      if ([...form.keys()].some(key => key !== "itemId" && key !== "file")) return failure(400, "INVALID_WRITE_REQUEST");
      const itemId = form.get("itemId"), file = form.get("file");
      if (typeof itemId !== "string" || !UUID.test(itemId) || !(file instanceof File) || !IMAGE_TYPES.has(file.type) || file.size < 1 || file.size > MAX_IMAGE_BYTES) return failure(400, "INVALID_WRITE_REQUEST");
      const uploadHandle = crypto.randomUUID();
      const begun = await rpc(auth.caller, "permission_menu_image_begin_upload", { p_item_id: itemId, p_upload_handle: uploadHandle, p_mime_type: file.type, p_byte_size: file.size });
      if ("response" in begun) return begun.response;
      const objectKey = begun.data.objectKey;
      if (typeof objectKey !== "string") return failure(503, "IMAGE_GATEWAY_UNAVAILABLE");
      const uploaded = await auth.service.storage.from(bucket).upload(objectKey, file, { contentType: file.type, cacheControl: "0", upsert: false });
      if (uploaded.error) return failure(503, "IMAGE_STORAGE_UNAVAILABLE");
      const ready = await rpc(auth.caller, "permission_menu_image_mark_ready", { p_upload_handle: uploadHandle });
      if ("response" in ready) return ready.response;
      return json(201, { ok: true, data: { uploadHandle } });
    }
    if (!staging || !UUID.test(staging[1])) return failure(404, "NOT_FOUND");
    const uploadHandle = staging[1].toLowerCase();
    if (request.method === "GET") {
      const allowed = await rpc(auth.caller, "permission_menu_image_read_staging", { p_upload_handle: uploadHandle });
      if ("response" in allowed) return allowed.response;
      if (typeof allowed.data.objectKey !== "string" || typeof allowed.data.mimeType !== "string") return failure(503, "IMAGE_GATEWAY_UNAVAILABLE");
      const downloaded = await auth.service.storage.from(bucket).download(allowed.data.objectKey);
      if (downloaded.error) return failure(503, "IMAGE_STORAGE_UNAVAILABLE");
      return new Response(downloaded.data, { status: 200, headers: { "Content-Type": "application/octet-stream", "X-Image-Content-Type": allowed.data.mimeType, ...cors, ...NO_STORE } });
    }
    if (request.method === "DELETE") {
      const discarded = await rpc(auth.caller, "permission_menu_image_discard_upload", { p_upload_handle: uploadHandle });
      if ("response" in discarded) return discarded.response;
      if (typeof discarded.data.objectKey !== "string") return failure(503, "IMAGE_GATEWAY_UNAVAILABLE");
      const removed = await auth.service.storage.from(bucket).remove([discarded.data.objectKey]);
      if (removed.error) return failure(503, "IMAGE_STORAGE_UNAVAILABLE");
      return json(200, { ok: true, data: null });
    }
    return failure(405, "METHOD_NOT_ALLOWED");
  } catch { return failure(503, "IMAGE_GATEWAY_UNAVAILABLE"); }
});
