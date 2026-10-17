import { AppError } from "@/core/appError";

const storeKeyPattern = /^([0-9]{1,10})-([A-Za-z0-9]{4,64})$/;
const secretAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type ParsedStoreKey = {
  storeNo: number;
  secret: string;
};

export const parseStoreKey = (storeKey: string): ParsedStoreKey => {
  const normalized = storeKey.trim().toUpperCase();
  const match = storeKeyPattern.exec(normalized);

  if (!match) {
    throw new AppError("AUTH_REQUIRED", "Store Key không đúng định dạng.");
  }

  const storeNo = Number.parseInt(match[1], 10);

  if (!Number.isInteger(storeNo) || storeNo < 1 || storeNo > 2147483647) {
    throw new AppError("AUTH_REQUIRED", "Store Key không đúng định dạng.");
  }

  return { storeNo, secret: match[2] };
};

export const formatStoreKey = (storeNo: number, secret: string): string => {
  if (!Number.isInteger(storeNo) || storeNo < 1 || storeNo > 2147483647)
    throw new AppError("AUTH_REQUIRED", "Store Key không đúng định dạng.");
  return `${storeNo.toString().padStart(4, "0")}-${secret.toUpperCase()}`;
};

export const storeEmailForNo = (storeNo: number): string => `store${storeNo}@store.pos.local`;

export const generateStoreSecret = (length = 8): string => {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => secretAlphabet[byte % secretAlphabet.length]).join("");
};
