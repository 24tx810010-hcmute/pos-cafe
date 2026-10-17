import { describe, expect, it, vi } from "vitest";
import { createPermissionContractFetch, PERMISSION_CONTRACT_HEADER } from "./client";

describe("permission contract fetch marker", () => {
  it("adds version 2 only to the configured origin's PostgREST requests", async () => {
    const transport = vi.fn(async () => new Response(null, { status: 204 }));
    const markedFetch = createPermissionContractFetch("https://project.supabase.co", transport);

    await markedFetch("https://project.supabase.co/rest/v1/rpc/get_write_capabilities");
    await markedFetch("https://project.supabase.co/auth/v1/token");
    await markedFetch("https://other.example/rest/v1/orders");

    const calls = transport.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    expect(new Headers(calls[0][1]?.headers).get(PERMISSION_CONTRACT_HEADER)).toBe("2");
    expect(new Headers(calls[1][1]?.headers).has(PERMISSION_CONTRACT_HEADER)).toBe(false);
    expect(new Headers(calls[2][1]?.headers).has(PERMISSION_CONTRACT_HEADER)).toBe(false);
  });

  it("blocks every later configured-origin request after the compatibility latch", async () => {
    let blocked = false;
    const transport = vi.fn(async () => new Response(null, { status: 204 }));
    const guardedFetch = createPermissionContractFetch("https://project.supabase.co", transport, () => blocked);
    await guardedFetch("https://project.supabase.co/auth/v1/user");
    blocked = true;
    await expect(guardedFetch("https://project.supabase.co/rest/v1/orders")).rejects.toMatchObject({ code: "WRITE_PROTOCOL_UNSUPPORTED" });
    await expect(guardedFetch("https://project.supabase.co/storage/v1/object/menu/a")).rejects.toMatchObject({ code: "WRITE_PROTOCOL_UNSUPPORTED" });
    await guardedFetch("https://other.example/rest/v1/orders");
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("follows Request/init header replacement and strips the marker cross-origin", async () => {
    const transport = vi.fn(async () => new Response(null, { status: 204 }));
    const markedFetch = createPermissionContractFetch("https://project.supabase.co", transport);
    const request = new Request("https://project.supabase.co/rest/v1/orders", {
      headers: { authorization: "Bearer request", "x-request-only": "kept" },
    });

    await markedFetch(request, { headers: { authorization: "Bearer init", "x-init-only": "kept" } });
    const calls = transport.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    const sameOrigin = new Headers(calls[0][1]?.headers);
    expect(Object.fromEntries(sameOrigin)).toMatchObject({
      authorization: "Bearer init", "x-init-only": "kept",
      [PERMISSION_CONTRACT_HEADER]: "2",
    });
    expect(sameOrigin.has("x-request-only")).toBe(false);

    await markedFetch(request);
    const requestOnly = new Headers(calls[1][1]?.headers);
    expect(requestOnly.get("authorization")).toBe("Bearer request");
    expect(requestOnly.get("x-request-only")).toBe("kept");

    await markedFetch(new Request("https://other.example/rest/v1/orders", {
      headers: { [PERMISSION_CONTRACT_HEADER]: "2", authorization: "Bearer external" },
    }));
    const crossOrigin = new Headers(calls[2][1]?.headers);
    expect(crossOrigin.has(PERMISSION_CONTRACT_HEADER)).toBe(false);
    expect(crossOrigin.get("authorization")).toBe("Bearer external");
  });
});
