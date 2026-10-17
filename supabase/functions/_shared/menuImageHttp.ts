export const NO_STORE = { "Cache-Control": "no-store" } as const;
export const PUBLIC_CACHE = "private, max-age=60, must-revalidate";
export const PERMISSION_CONTRACT_HEADER = "x-pos-permission-contract";
export const PERMISSION_CONTRACT_VERSION = "2";
export const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS", "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-pos-employee-token,if-none-match" };

export const json = (status: number, body: unknown, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors, ...NO_STORE, ...extra } });
export const failure = (status: number, code: string): Response => json(status, { ok: false, error: { code } });
export const rpcData = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const envelope = value as Record<string, unknown>;
  if (envelope.ok !== true || !envelope.data || typeof envelope.data !== "object" || Array.isArray(envelope.data)) return null;
  return envelope.data as Record<string, unknown>;
};
export const bearer = (request: Request): string | null => {
  const match = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/);
  return match?.[1] ?? null;
};

