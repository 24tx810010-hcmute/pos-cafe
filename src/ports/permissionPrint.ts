import type { ReceiptSnapshot } from "@/domain";

export type InitialReceiptPrintGrant = { grantId: string; orderId: string };
export type InitialReceiptPrintAuthorization = { authorized: true; grantId: string; printRequestId: string };
export type PreparedReceiptReprint = { receipt: ReceiptSnapshot; legacyMetadata: boolean };

export interface IPermissionPrintRepo {
  authorizeInitialReceiptPrint(grantId: string, printRequestId: string): Promise<InitialReceiptPrintAuthorization>;
  prepareReceiptReprint(orderId: string): Promise<PreparedReceiptReprint>;
}

