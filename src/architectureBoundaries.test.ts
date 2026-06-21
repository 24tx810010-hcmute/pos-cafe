import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const listSourceFiles = (relativeDir: string): string[] => {
  const root = path.join(repoRoot, relativeDir);
  const files: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry)) {
        files.push(fullPath);
      }
    }
  };

  walk(root);
  return files;
};

const read = (relativePath: string): string => readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("architecture boundaries", () => {
  it("keeps feature modules independent from the app shell", () => {
    const violations = listSourceFiles("src/features")
      .filter((file) => /from\s+["'](?:@\/app|(?:\.\.\/)+app\/)/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(repoRoot, file));

    expect(violations).toEqual([]);
  });

  it("keeps browser-only print code out of the Supabase adapter", () => {
    const violations = listSourceFiles("src/adapters/supabase")
      .filter((file) => /globalThis\.window|window\?\.open|document\.write/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(repoRoot, file));

    expect(violations).toEqual([]);
  });

  it("keeps the Supabase ports factory separate from concrete repo classes", () => {
    expect(read("src/adapters/supabase/repos.ts")).not.toMatch(/class Supabase\w+/);
  });
});
