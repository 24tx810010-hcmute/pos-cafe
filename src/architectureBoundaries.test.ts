import { describe, expect, it } from "vitest";
import ts from "typescript";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(repoRoot, "src");

type Layer = "adapters" | "app" | "core" | "domain" | "features" | "ports" | "seed" | "test" | "tests";

interface SourceFile {
  absolutePath: string;
  relativePath: string;
  layer: Layer;
  isTest: boolean;
}

interface ImportRecord {
  sourceFile: SourceFile;
  specifier: string;
  resolvedPath: string | null;
  targetLayer: Layer | null;
}

const toPosix = (value: string): string => value.replace(/\\/g, "/");

const sourceFiles = (): SourceFile[] => {
  const files: SourceFile[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry) || /\.d\.ts$/.test(entry)) continue;

      const relativePath = toPosix(path.relative(repoRoot, fullPath));
      const pathParts = relativePath.split("/");
      const layer = (pathParts[0] === "tests" ? "tests" : pathParts[1]) as Layer;
      files.push({
        absolutePath: fullPath,
        relativePath,
        layer,
        isTest: relativePath.startsWith("tests/") || /\.(test|spec)\.(ts|tsx)$/.test(entry),
      });
    }
  };

  walk(srcRoot);
  walk(path.join(repoRoot, "tests"));
  return files;
};

const resolveInternalImport = (fromFile: SourceFile, specifier: string): string | null => {
  if (specifier.startsWith("@/")) {
    return toPosix(path.normalize(path.join("src", specifier.slice(2))));
  }
  if (!specifier.startsWith(".")) {
    return null;
  }

  return toPosix(path.relative(repoRoot, path.resolve(path.dirname(fromFile.absolutePath), specifier)));
};

const collectImportSpecifiers = (source: string, fileName: string): string[] => {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];

  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }

    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      specifiers.push(node.argument.literal.text);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return specifiers;
};

const importRecords = (): ImportRecord[] =>
  sourceFiles().flatMap((sourceFile) =>
    collectImportSpecifiers(readFileSync(sourceFile.absolutePath, "utf8"), sourceFile.absolutePath).map((specifier) => {
      const resolvedPath = resolveInternalImport(sourceFile, specifier);
      return {
        sourceFile,
        specifier,
        resolvedPath,
        targetLayer: resolvedPath?.startsWith("src/") ? (resolvedPath.split("/")[1] as Layer) : null,
      };
    }),
  );

const productionImports = (): ImportRecord[] => importRecords().filter((record) => !record.sourceFile.isTest);

const formatViolation = (record: ImportRecord, reason: string): string =>
  `${record.sourceFile.relativePath} imports ${record.specifier} (${reason})`;

describe("architecture boundaries", () => {
  it("keeps foundation layers pure and dependency-light", () => {
    const violations = productionImports().flatMap((record) => {
      const fromLayer = record.sourceFile.layer;
      const toLayer = record.targetLayer;

      if (fromLayer === "domain" && toLayer && toLayer !== "domain") {
        return formatViolation(record, "domain can only import domain");
      }
      if (fromLayer === "core" && toLayer && !["core", "domain"].includes(toLayer)) {
        return formatViolation(record, "core can only import core/domain");
      }
      if (fromLayer === "ports" && toLayer && !["ports", "domain"].includes(toLayer)) {
        return formatViolation(record, "ports can only import ports/domain");
      }
      if (["domain", "core", "ports"].includes(fromLayer) && record.specifier === "react") {
        return formatViolation(record, `${fromLayer} must stay framework-free`);
      }

      return [];
    });

    expect(violations).toEqual([]);
  });

  it("keeps feature, adapter, and app layers pointed in the right direction", () => {
    const violations = productionImports().flatMap((record) => {
      const fromLayer = record.sourceFile.layer;
      const toLayer = record.targetLayer;

      if (fromLayer === "features" && toLayer && ["app", "adapters"].includes(toLayer)) {
        return formatViolation(record, "features must not import app/adapters");
      }
      if (fromLayer === "adapters" && toLayer && ["app", "features"].includes(toLayer)) {
        return formatViolation(record, "adapters must not import app/features");
      }
      if (
        fromLayer === "app" &&
        toLayer === "adapters" &&
        record.sourceFile.relativePath !== "src/app/runtimePorts.ts"
      ) {
        return formatViolation(record, "only app/runtimePorts.ts may compose concrete adapters");
      }

      return [];
    });

    expect(violations).toEqual([]);
  });

  it("keeps seed fixtures imported only by adapter seed paths", () => {
    const allowedSeedConsumers = (sourcePath: string): boolean =>
      sourcePath.startsWith("src/adapters/mock/") || sourcePath === "src/adapters/supabase/seedBundle.ts";

    const violations = productionImports()
      .filter((record) => record.targetLayer === "seed")
      .filter((record) => !allowedSeedConsumers(record.sourceFile.relativePath))
      .map((record) => formatViolation(record, "seed is shared adapter fixture data"));

    expect(violations).toEqual([]);
  });

  it("keeps retired helper and adapter boundaries from regressing", () => {
    const appHelpers = sourceFiles()
      .map((file) => file.relativePath)
      .filter((filePath) => filePath.startsWith("src/app/helpers/"));

    const browserInSupabase = sourceFiles()
      .filter((file) => file.relativePath.startsWith("src/adapters/supabase/"))
      .filter((file) => /globalThis\.window|window\?\.open|document\.write/.test(readFileSync(file.absolutePath, "utf8")))
      .map((file) => file.relativePath);

    expect({ appHelpers, browserInSupabase }).toEqual({
      appHelpers: [],
      browserInSupabase: [],
    });
  });
});
