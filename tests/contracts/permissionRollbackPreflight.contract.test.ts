import { afterAll, beforeAll, test } from 'vitest';
import { setupRollbackFixture, cleanupRollbackFixture, verifyReadOnlyLauncher } from './permissionRollbackFixture';

beforeAll(setupRollbackFixture);
afterAll(cleanupRollbackFixture);
test('TC-PERM-53 release launcher rejects wrong binding before business reads and valid discovery is read-only', verifyReadOnlyLauncher);
