import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export type RecoveryRequest = { requestId: string; storeId: string; targetId: string;
  operatorRef: string; caseRef: string; proofRef: string; newPin: string };
export declare function createPgRecoveryExecutor(dsn: string, expectedHost: string):
  (payload: RecoveryRequest) => Promise<unknown>;
export declare function verifyPgRecoveryRole(dsn: string): Promise<void>;
export declare function createOwnerRecoveryServer(options: { launchCode: string;
  recover: (payload: RecoveryRequest) => Promise<unknown>; port?: number }):
  { server: Server; listen: () => Promise<AddressInfo> };
