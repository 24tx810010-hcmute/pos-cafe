import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/supabase/permissionPinRaceReporter.tool.test.ts"],
    environment: "node",
  },
});
