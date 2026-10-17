import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/supabase/permissionPinExpiryReporter.tool.test.ts"],
    environment: "node",
  },
});
