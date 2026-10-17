import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/supabase/permissionPinExpiryClock.tool.test.ts"],
    environment: "node",
  },
});
