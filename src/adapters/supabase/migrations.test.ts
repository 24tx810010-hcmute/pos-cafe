import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const migrationsRoot = path.join(repoRoot, "supabase", "migrations");

describe("Supabase migrations", () => {
  it("adds the menu item image asset key column for existing databases", () => {
    const postInitialMigrations = readdirSync(migrationsRoot)
      .filter((fileName) => fileName.endsWith(".sql") && !fileName.startsWith("001_"))
      .map((fileName) => readFileSync(path.join(migrationsRoot, fileName), "utf8"))
      .join("\n");

    expect(postInitialMigrations).toMatch(
      /alter\s+table\s+public\.menu_items\s+add\s+column\s+if\s+not\s+exists\s+image_asset_key\s+text/i,
    );
  });
});
