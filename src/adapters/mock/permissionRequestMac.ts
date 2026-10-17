import type { MockPermissionState } from "./permissionState";

const keys = new WeakMap<MockPermissionState, Promise<CryptoKey>>();

function privateKey(state: MockPermissionState): Promise<CryptoKey> {
  let key = keys.get(state);
  if (!key) {
    const material = crypto.getRandomValues(new Uint8Array(32));
    key = (async () => {
      try {
        return await crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      } finally {
        material.fill(0);
      }
    })();
    keys.set(state, key);
  }
  return key;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Returns a keyed, non-reversible request fingerprint. The per-state key is non-extractable and never exported. */
export async function mockPermissionRequestMac(state: MockPermissionState, canonicalPayload: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await privateKey(state), new TextEncoder().encode(canonicalPayload));
  return `hmac-sha256:${base64Url(new Uint8Array(signature))}`;
}
