import { describe, expect, it } from "vitest";
import { AppError } from "@/core/appError";
import { mapSupabaseError } from "./errors";

describe("mapSupabaseError", () => {
  it("maps RPC business errors by message", () => {
    const error = mapSupabaseError({ message: "ORDER_VERSION_CONFLICT" });

    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("ORDER_VERSION_CONFLICT");
  });

  it("maps PostgREST no-row errors to NOT_FOUND", () => {
    expect(mapSupabaseError({ code: "PGRST116", message: "No rows" }).code).toBe("NOT_FOUND");
  });
});
