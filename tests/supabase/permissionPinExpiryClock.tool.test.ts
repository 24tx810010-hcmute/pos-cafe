import { describe, expect, it } from "vitest";
import { assertFixtureClockDelta, assertRestoredClockCatalog, classifyExpiry }
  from "./permissionPinExpiryClock.ts";

const issued = "2026-10-09T10:00:00.000Z";
const expiry = "2026-10-09T10:05:00.000Z";
const cell = "private.pin_expiry_test_clock_cell";
const baseline = { metadata: { oid: 51, prosrc: "select clock_timestamp()", proowner: 1,
  proacl: ["postgres=X/postgres"], prosecdef: false, provolatile: "v" },
  source: "select clock_timestamp()" };
const fixture = { metadata: { ...baseline.metadata, prosrc: `select instant from ${cell}` },
  source: `select instant from ${cell}` };
const others = [{ oid: 52, prosrc: "owner completion body", proacl: ["postgres=X/postgres"] }];

describe("G2c controlled clock failure controls", () => {
  it("classifies equality as expired while retaining unrevoked status", () => {
    expect(classifyExpiry(issued, expiry, expiry, null)).toEqual({
      expired: true, valid: false, revoked: false, ttlMs: 300_000,
    });
    expect(classifyExpiry(issued, expiry, issued, null)).toMatchObject({
      expired: false, valid: true, revoked: false,
    });
    expect(classifyExpiry(issued, expiry, issued, issued)).toMatchObject({
      expired: false, valid: false, revoked: true,
    });
    expect(() => classifyExpiry(issued, issued, issued, null)).toThrow("PIN_EXPIRY_TIME_INPUT_REFUSED");
  });

  it("rejects unrelated function drift and changes to clock authority attributes", () => {
    expect(() => assertFixtureClockDelta(baseline, fixture, others, others)).not.toThrow();
    expect(() => assertFixtureClockDelta(baseline, fixture, others,
      [{ ...others[0], proacl: ["anon=X/postgres"] }])).toThrow("PIN_EXPIRY_CLOCK_ALLOWLIST_REFUSED");
    expect(() => assertFixtureClockDelta(baseline,
      { ...fixture, metadata: { ...fixture.metadata, prosecdef: true } }, others, others))
      .toThrow("PIN_EXPIRY_CLOCK_ALLOWLIST_REFUSED");
    expect(() => assertFixtureClockDelta(baseline,
      { ...fixture, metadata: { ...fixture.metadata, proacl: ["anon=X/postgres"] } }, others, others))
      .toThrow("PIN_EXPIRY_CLOCK_ALLOWLIST_REFUSED");
  });

  it("refuses restoration with a fixture cell or altered catalog", () => {
    expect(() => assertRestoredClockCatalog(baseline, baseline, others, others, false)).not.toThrow();
    expect(() => assertRestoredClockCatalog(baseline, baseline, others, others, true))
      .toThrow("PIN_EXPIRY_CLOCK_RESTORE_MISMATCH");
    expect(() => assertRestoredClockCatalog(baseline,
      { ...baseline, metadata: { ...baseline.metadata, proowner: 2 } }, others, others, false))
      .toThrow("PIN_EXPIRY_CLOCK_RESTORE_MISMATCH");
    expect(() => assertRestoredClockCatalog(baseline, baseline, others,
      [{ ...others[0], prosrc: "changed" }], false)).toThrow("PIN_EXPIRY_CLOCK_RESTORE_MISMATCH");
  });
});
