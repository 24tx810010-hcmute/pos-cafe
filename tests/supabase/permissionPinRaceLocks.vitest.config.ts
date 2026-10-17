import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/supabase/permissionPinRaceLocks.tool.test.ts"],
    environment: "node",
  },
});
