import { afterAll, beforeAll, test } from 'vitest';
import { setupRollbackFixture, cleanupRollbackFixture, verifyAdditiveRevert } from './permissionRollbackFixture';

beforeAll(setupRollbackFixture);
afterAll(cleanupRollbackFixture);
test('TC-PERM-53 additive B revert preserves baseline business data and phase-27 grants', verifyAdditiveRevert);
