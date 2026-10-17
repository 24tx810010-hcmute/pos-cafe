import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: false,
  test: {
    environment: 'node',
    include: ['tests/contracts/permissionPinIdentityGuard.tool.test.ts'],
    allowOnly: false,
    retry: 0,
    passWithNoTests: false,
  },
});
