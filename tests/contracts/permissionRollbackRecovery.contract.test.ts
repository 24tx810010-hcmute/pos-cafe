import { afterAll, beforeAll, test } from 'vitest';
import { setupRollbackFixture, cleanupRollbackFixture, verifyPostBackupRecovery } from './permissionRollbackFixture';

beforeAll(setupRollbackFixture);
afterAll(cleanupRollbackFixture);
test('TC-PERM-53 post-backup payment blocks restore and forward fix preserves Q, K and R1', verifyPostBackupRecovery);
