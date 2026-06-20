import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const sourceFile = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const appSourceRoot = join(process.cwd(), "src/app");
const appFiles = (dir = appSourceRoot): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const relativePath = fullPath.replace(`${process.cwd()}\\`, "").replace(/\\/g, "/");

    if (statSync(fullPath).isDirectory()) {
      return appFiles(fullPath);
    }

    return relativePath;
  });
const withoutTestIds = (source: string) =>
  source
    .replace(/data-testid=\{`[^`]*`\}/g, "")
    .replace(/data-testid="[^"]*"/g, "");

describe("Tailwind UI migration", () => {
  test("production UI writes Tailwind classes inline instead of class constant modules", () => {
    const files = appFiles();
    const classIdentifierSuffix = "_" + "CLASS";
    const classModuleSuffix = "Classes" + ".ts";
    const classIdentifierPattern = new RegExp(`\\b[A-Z][A-Z0-9_]*${classIdentifierSuffix}\\b`, "g");
    const classConstantFiles = files.filter((path) => path.endsWith(classModuleSuffix));
    const productionFiles = files.filter(
      (path) =>
        /\.[jt]sx?$/.test(path) &&
        !path.endsWith(".test.ts") &&
        !path.endsWith(".test.tsx") &&
        !path.endsWith(classModuleSuffix),
    );

    const offenders = productionFiles.flatMap((path) => {
      const source = sourceFile(path);
      const checks = [
        [classIdentifierPattern, "class constant identifier"],
        [/from\s+["'][^"']*uiClasses["']/g, "uiClasses import"],
        [/from\s+["'][^"']*Classes["']/g, "class module import"],
        [/\bcx\s*\(/g, "cx helper"],
      ] as const;

      return checks.flatMap(([pattern, label]) =>
        Array.from(source.matchAll(pattern), (match) => `${path}: ${label}: ${match[0]}`),
      );
    });

    expect(classConstantFiles).toEqual([]);
    expect(offenders).toEqual([]);
  });

  test("OrderDrawer does not use legacy semantic CSS class names", () => {
    const source = sourceFile("src/app/drawers/pos/OrderDrawer.tsx");
    const legacyClasses = [
      "order-type-chip",
      "menu-toolbar",
      "menu-cat-tabs",
      "category-button",
      "cat-dot",
      "menu-grid",
      "menu-card",
      "menu-card-swatch",
      "menu-card-body",
      "menu-card-name",
      "unavailable-badge",
      "cart-list",
      "cart-item",
      "cart-line",
      "cart-item-name",
      "quantity-actions",
      "icon-button",
      "qty-badge",
      "note-toggle",
      "cart-note-preview",
      "cart-empty-hint",
      "cart-footer",
      "cart-pay-hint",
      "total-row",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("OrderDrawer stays small enough to keep flow logic readable", () => {
    const source = sourceFile("src/app/drawers/pos/OrderDrawer.tsx");
    const lineCount = source.split(/\r?\n/).length;

    expect(lineCount).toBeLessThanOrEqual(320);
  });

  test("MenuEditorDrawer category and item lists do not use legacy semantic CSS class names", () => {
    const source = withoutTestIds(sourceFile("src/app/drawers/admin/MenuEditorDrawer.tsx"));
    const legacyClasses = [
      "menu-cat-tabs",
      "menu-cat-tab",
      "menu-preview-card",
      "menu-edit-card",
      "menu-edit-card-body",
      "menu-card-tags",
      "menu-card-actions",
      "menu-add-card",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("MenuEditorDrawer stays small enough to keep draft flow readable", () => {
    const source = sourceFile("src/app/drawers/admin/MenuEditorDrawer.tsx");
    const lineCount = source.split(/\r?\n/).length;

    expect(lineCount).toBeLessThanOrEqual(460);
  });

  test("MenuEditorDrawer form and option editor do not use legacy semantic CSS class names", () => {
    const source = withoutTestIds(sourceFile("src/app/drawers/admin/MenuEditorDrawer.tsx"));
    const legacyClasses = [
      "menu-field",
      "menu-advanced-toggle",
      "menu-advanced-caret",
      "menu-group-card",
      "menu-chip-toggle",
      "menu-value-row",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("MenuEditorDrawer catalog grid does not use legacy semantic CSS class names", () => {
    const source = withoutTestIds(sourceFile("src/app/drawers/admin/MenuEditorDrawer.tsx"));
    const legacyClasses = [
      "menu-catalog-head",
      "menu-grid",
      "menu-item-grid",
      "menu-item-thumb",
      "menu-pending-del",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test.each([
    ["FloorEditorDrawer", "src/app/drawers/admin/FloorEditorDrawer.tsx"],
    ["PaymentSettingsDrawer", "src/app/drawers/admin/PaymentSettingsDrawer.tsx"],
  ])("%s shared admin controls do not use legacy semantic CSS class names", (_name, path) => {
    const source = withoutTestIds(sourceFile(path));
    const legacyClasses = [
      "menu-field",
      "menu-advanced-toggle",
      "menu-advanced-caret",
      "menu-chip-toggle",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("FloorEditorDrawer stays small enough to keep floor editing flow readable", () => {
    const source = sourceFile("src/app/drawers/admin/FloorEditorDrawer.tsx");
    const lineCount = source.split(/\r?\n/).length;

    expect(lineCount).toBeLessThanOrEqual(460);
  });

  test("EmployeesDrawer stays small enough to keep employee admin flow readable", () => {
    const source = sourceFile("src/app/drawers/admin/EmployeesDrawer.tsx");
    const lineCount = source.split(/\r?\n/).length;

    expect(lineCount).toBeLessThanOrEqual(460);
  });

  test("EmployeesDrawer list does not use legacy employee card CSS class names", () => {
    const source = withoutTestIds(sourceFile("src/app/drawers/admin/EmployeesDrawer.tsx"));
    const legacyClasses = [
      "emp-list",
      "emp-card",
      "emp-avatar",
      "emp-card-main",
      "emp-last-unlock",
      "emp-card-actions",
      "emp-action-btn",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("EmployeeDetailPane does not use legacy cart footer CSS class names", () => {
    const source = withoutTestIds(sourceFile("src/app/drawers/admin/EmployeeDetailPane.tsx"));
    const legacyClasses = ["cart-footer"];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("Admin shared form controls do not use legacy emp CSS class names", () => {
    const source = [
      "src/app/drawers/admin/EmployeeDetailPane.tsx",
      "src/app/drawers/admin/FloorEditorInspectorPane.tsx",
      "src/app/drawers/admin/GeneralSettingsDrawer.tsx",
      "src/app/drawers/admin/MenuEditorDetailPane.tsx",
      "src/app/drawers/admin/PaymentSettingsDrawer.tsx",
    ].map((path) => withoutTestIds(sourceFile(path))).join("\n");
    const legacyClasses = [
      "emp-form",
      "emp-field",
      "emp-field-label",
      "emp-field-hint",
      "emp-pin-section",
      "emp-segment",
      "emp-segment-btn",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("Admin forbidden states do not use legacy emp forbidden CSS class names", () => {
    const source = [
      "src/app/drawers/admin/EmployeesDrawer.tsx",
      "src/app/drawers/admin/GeneralSettingsDrawer.tsx",
      "src/app/drawers/admin/PaymentSettingsDrawer.tsx",
      "src/app/drawers/admin/ReportSettingsDrawer.tsx",
    ].map((path) => withoutTestIds(sourceFile(path))).join("\n");
    const legacyClasses = ["emp-forbidden"];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("Admin detail panes do not use legacy menu and floor layout helper CSS class names", () => {
    const source = [
      "src/app/drawers/admin/FloorEditorInspectorPane.tsx",
      "src/app/drawers/admin/GeneralSettingsDrawer.tsx",
      "src/app/drawers/admin/MenuEditorDetailPane.tsx",
      "src/app/drawers/admin/PaymentSettingsDrawer.tsx",
    ].map((path) => withoutTestIds(sourceFile(path))).join("\n");
    const legacyClasses = [
      "menu-props",
      "menu-advanced-body",
      "menu-tombstone",
      "menu-section",
      "menu-section-head",
      "menu-group-top",
      "menu-group-row",
      "menu-minmax",
      "menu-values",
      "fe-tool-row",
      "fe-status-row",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("Settings receipt previews do not use legacy set CSS class names", () => {
    const source = [
      "src/app/drawers/admin/GeneralSettingsDrawer.tsx",
      "src/app/drawers/admin/PaymentSettingsDrawer.tsx",
    ].map((path) => withoutTestIds(sourceFile(path))).join("\n");
    const legacyClasses = [
      "set-preview-block",
      "set-demo-box",
      "set-receipt",
      "set-receipt-name",
      "set-receipt-addr",
      "set-receipt-divider",
      "set-receipt-line",
      "set-receipt-footer",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("GeneralSettingsDrawer clear demo dialog does not use legacy clear demo CSS class names", () => {
    const source = withoutTestIds(sourceFile("src/app/drawers/admin/GeneralSettingsDrawer.tsx"));
    const legacyClasses = [
      "clear-demo-head",
      "clear-demo-checklist",
      "clear-demo-blocked",
      "clear-demo-blocked-actions",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("PaymentSettingsDrawer does not use legacy pay CSS class names", () => {
    const source = withoutTestIds(sourceFile("src/app/drawers/admin/PaymentSettingsDrawer.tsx"));
    const legacyClasses = [
      "pay-method-tab",
      "pay-dot",
      "pay-state",
      "pay-pre-methods",
      "pay-bank-box",
      "pay-qr-preview",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("Kitchen station tags do not use legacy kitchen station CSS class names", () => {
    const source = [
      "src/app/drawers/admin/KitchenQueueDrawer.tsx",
      "src/app/drawers/admin/PaymentSettingsDrawer.tsx",
    ].map((path) => withoutTestIds(sourceFile(path))).join("\n");
    const legacyClasses = ["kq-station-tag"];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("KitchenQueueDrawer does not use legacy kitchen queue CSS class names", () => {
    const source = withoutTestIds(sourceFile("src/app/drawers/admin/KitchenQueueDrawer.tsx"));
    const legacyClasses = [
      "kq-list",
      "kq-card",
      "kq-card-top",
      "kq-elapsed",
      "kq-item-list",
      "kq-item",
      "kq-item-qty",
      "kq-item-main",
      "kq-item-opts",
      "kq-item-note",
      "kq-actions",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("Admin filter counters do not use legacy history filter count CSS class names", () => {
    const source = [
      "src/app/drawers/admin/EmployeesDrawer.tsx",
      "src/app/drawers/admin/KitchenQueueDrawer.tsx",
      "src/app/drawers/admin/MenuEditorDrawer.tsx",
      "src/app/drawers/admin/OrderHistoryDrawer.tsx",
    ].map((path) => withoutTestIds(sourceFile(path))).join("\n");
    const legacyClasses = ["hx-filter-count"];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("History date filters do not use legacy history filter layout CSS class names", () => {
    const source = [
      "src/app/drawers/admin/OrderHistoryDrawer.tsx",
      "src/app/drawers/admin/ReportSettingsDrawer.tsx",
    ].map((path) => withoutTestIds(sourceFile(path))).join("\n");
    const legacyClasses = [
      "hx-date-chips",
      "hx-filter-bar",
      "hx-filter-divider",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("Order history views do not use legacy history table and card CSS class names", () => {
    const source = [
      "src/app/drawers/admin/OrderHistoryDrawer.tsx",
      "src/app/drawers/admin/KitchenQueueDrawer.tsx",
    ].map((path) => withoutTestIds(sourceFile(path))).join("\n");
    const legacyClasses = [
      "hx-table-pane",
      "hx-summary-strip",
      "hx-table",
      "hx-row",
      "hx-badge",
      "hx-type-pill",
      "hx-card-list",
      "hx-history-card",
      "hx-hcard-top",
      "hx-hcard-meta",
      "hx-pagination",
      "hx-page-btn",
      "hx-page-info",
      "hx-filter-label",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("Admin tab rows do not use legacy floor editor area tab CSS class names", () => {
    const source = [
      "src/app/drawers/admin/FloorEditorDrawer.tsx",
      "src/app/drawers/admin/KitchenQueueDrawer.tsx",
      "src/app/drawers/admin/ReportSettingsDrawer.tsx",
    ].map((path) => withoutTestIds(sourceFile(path))).join("\n");
    const legacyClasses = ["fe-area-tabs"];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("FloorEditorDrawer toolbar does not use legacy floor toolbar CSS class names", () => {
    const source = withoutTestIds(sourceFile("src/app/drawers/admin/FloorEditorDrawer.tsx"));
    const legacyClasses = [
      "fe-toolbar",
      "fe-tb-group",
      "fe-tb-label",
      "fe-tb-sep",
      "fe-zoom-label",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("FloorEditorDrawer canvas does not use legacy floor editor canvas CSS class names", () => {
    const source = withoutTestIds(sourceFile("src/app/drawers/admin/FloorEditorDrawer.tsx"));
    const legacyClasses = [
      "fe-canvas-scroll",
      "fe-stage",
      "decor-node",
      "table-node",
      "fe-lock-badge",
      "fe-empty-cta",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("FloorWorkspace does not use legacy floor workspace CSS class names", () => {
    const source = withoutTestIds(sourceFile("src/app/shell/FloorWorkspace.tsx"));
    const legacyClasses = [
      "floor-shell",
      "floor-filter-bar",
      "area-tabs",
      "area-tab",
      "floor-empty-state",
      "stage-scroll",
      "floor-stage",
      "decor-node",
      "table-node",
      "table-name",
      "table-seats",
      "table-amount",
      "table-empty-label",
      "floor-side-title",
      "floor-orders-list",
      "floor-orders-empty",
      "floor-order-card",
      "floor-order-card-top",
      "floor-order-no",
      "floor-order-card-foot",
      "floor-order-card-status",
      "floor-order-card-amount",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });

  test("Report and kitchen detail views do not use legacy report CSS class names", () => {
    const source = [
      "src/app/drawers/admin/ReportSettingsDrawer.tsx",
      "src/app/drawers/admin/KitchenQueueDrawer.tsx",
    ].map((path) => withoutTestIds(sourceFile(path))).join("\n");
    const legacyClasses = [
      "report-metrics",
      "rp-main",
      "rp-detail",
      "rp-detail-card",
      "rp-selected-detail",
      "rp-skel-wrap",
      "rp-card",
      "rp-card-head",
      "rp-top-list",
      "rp-top-full",
      "rp-top-row",
      "rp-top-rank",
      "rp-top-name",
      "rp-bar",
      "rp-bar-fill",
      "rp-top-rev",
      "rp-table-wrap",
      "rp-table",
    ];

    const stillUsed = legacyClasses.filter((className) => source.includes(className));

    expect(stillUsed).toEqual([]);
  });
});
