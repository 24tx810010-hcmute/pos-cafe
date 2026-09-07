import { expect, test } from "@playwright/test";
import { loginAsAdmin, waitForStageFit, waitForTransientOverlays } from "./helpers";

test("kịch bản demo chính chạy liền mạch qua 14 bước", async ({ page }) => {
  const startedAt = Date.now();
  let splitBillNo = 0;
  let remainderBillNo = 0;

  await test.step("Bước 1 — mở ứng dụng ở chế độ ngang", async () => {
    await page.goto("/");
    await expect(page.getByTestId("landing-screen").or(page.getByTestId("passcode-screen")).first()).toBeVisible();
  });

  await test.step("Bước 2 — ghép cửa hàng nếu thiết bị chưa được ghép", async () => {
    if (await page.getByTestId("landing-screen").isVisible()) {
      await page.getByTestId("go-store-pairing").click();
      await expect(page.getByTestId("store-pairing-screen")).toBeVisible();
      await page.getByTestId("store-key-input").fill("0001-X8F3QA");
      await page.getByTestId("go-passcode").click();
    }
    await expect(page.getByTestId("passcode-screen")).toBeVisible();
  });

  await test.step("Bước 3 — đăng nhập quản lý bằng PIN", async () => {
    await loginAsAdmin(page);
    await expect(page.getByTestId("left-nav-session")).toHaveAttribute("data-employee-id", "emp-admin");
  });

  await test.step("Bước 4 — mở bàn B01 đang trống", async () => {
    await waitForStageFit(page, "floor-stage");
    const table = page.getByTestId("table-tbl-b01");
    await expect(table).toHaveAttribute("data-table-status", "empty");
    await table.click();
    await expect(page.getByTestId("order-drawer")).toBeVisible();
  });

  await test.step("Bước 5 — tạo đơn ba Cà phê sữa Size L, tổng 108.000đ", async () => {
    await page.getByTestId("menu-item-mi-ca-phe-sua").click();
    await page.getByTestId("modifier-value-ov-size-l").click();
    await page.getByTestId("modifier-confirm").click();

    const cartLine = page.getByTestId("order-cart-line");
    await expect(cartLine).toHaveCount(1);
    await expect(cartLine).toHaveAttribute("data-unit-price", "36000");
    await page.getByTestId("order-cart-increase").click();
    await page.getByTestId("order-cart-increase").click();
    await expect(cartLine).toHaveAttribute("data-quantity", "3");
    await expect(cartLine).toHaveAttribute("data-line-total", "108000");
    await expect(page.getByTestId("order-total-amount")).toHaveAttribute("data-amount", "108000");

    const submitOrder = page.getByTestId("submit-order-button-footer");
    await expect(submitOrder).toBeVisible();
    await submitOrder.click();
    const kitchenTicket = page.getByTestId("receipt-document");
    await expect(kitchenTicket).toHaveAttribute("data-variant", "kitchen");
    await expect(kitchenTicket).toHaveAttribute("data-total", "108000");
  });

  await test.step("Bước 6 — quay lại sơ đồ và thấy B01 đang phục vụ", async () => {
    await page.getByTestId("receipt-close-header").click();
    await waitForTransientOverlays(page);
    const table = page.getByTestId("table-tbl-b01");
    await expect(table).toHaveAttribute("data-table-status", "occupied");
    await expect(table).toHaveAttribute("data-order-total", "108000");
  });

  await test.step("Bước 7 — mở lại đơn và chuyển sang thanh toán", async () => {
    await page.getByTestId("table-tbl-b01").click();
    await expect(page.getByTestId("order-drawer")).toBeVisible();
    await expect(page.getByTestId("order-total-amount")).toHaveAttribute("data-amount", "108000");
    await page.getByTestId("submit-order-button-footer").click();
    await expect(page.getByTestId("payment-drawer")).toBeVisible();
    await expect(page.getByTestId("payment-order-summary")).toHaveAttribute("data-amount-due", "108000");
  });

  await test.step("Bước 8 — tách trả hai ly 72.000đ và ghi nhận doanh thu ngay", async () => {
    await page.getByTestId("pay-select-all").uncheck();
    await page.getByTestId("pay-item-checkbox").check();
    await page.getByTestId("pay-item-plus").click();

    const payLine = page.getByTestId("pay-item-line");
    await expect(payLine).toHaveAttribute("data-unit-total", "36000");
    await expect(payLine).toHaveAttribute("data-line-quantity", "3");
    await expect(payLine).toHaveAttribute("data-selected-quantity", "2");
    await expect(page.getByTestId("payment-order-summary")).toHaveAttribute("data-amount-due", "72000");
    await page.getByTestId("pay-button-footer").click();

    const splitReceipt = page.getByTestId("receipt-document");
    await expect(splitReceipt).toHaveAttribute("data-variant", "receipt");
    await expect(splitReceipt).toHaveAttribute("data-total", "72000");
    splitBillNo = Number(await splitReceipt.getAttribute("data-order-no"));
    expect(splitBillNo).toBeGreaterThan(0);
    await page.getByTestId("receipt-close-header").click();

    await page.getByTestId("payment-close-button").click();
    await page.getByTestId("nav-report").click();
    const reportSummary = page.getByTestId("report-summary");
    await expect(reportSummary).toHaveAttribute("data-revenue", "72000");
    await expect(reportSummary).toHaveAttribute("data-paid-orders", "1");
  });

  await test.step("Bước 9 — kiểm tra tiền thiếu rồi thanh toán 36.000đ còn lại", async () => {
    await page.getByTestId("report-close-button").click();
    const table = page.getByTestId("table-tbl-b01");
    await expect(table).toHaveAttribute("data-table-status", "occupied");
    await expect(table).toHaveAttribute("data-order-total", "36000");
    await table.click();
    await expect(page.getByTestId("order-total-amount")).toHaveAttribute("data-amount", "36000");
    await page.getByTestId("submit-order-button-footer").click();
    await expect(page.getByTestId("payment-order-summary")).toHaveAttribute("data-amount-due", "36000");

    await page.getByTestId("payment-key-delete").click();
    await page.getByTestId("payment-key-delete").click();
    await expect(page.getByTestId("payment-received-amount")).toHaveAttribute("data-amount", "360");
    await expect(page.getByTestId("payment-insufficient-warning")).toHaveAttribute("data-shortfall", "35640");
    await expect(page.getByTestId("pay-button-footer")).toBeDisabled();

    await page.getByTestId("payment-key-0").click();
    await page.getByTestId("payment-key-0").click();
    await expect(page.getByTestId("payment-received-amount")).toHaveAttribute("data-amount", "36000");
    await expect(page.getByTestId("payment-insufficient-warning")).toBeHidden();
    await expect(page.getByTestId("pay-button-footer")).toBeEnabled();
    await page.getByTestId("pay-button-footer").click();

    const remainderReceipt = page.getByTestId("receipt-document");
    await expect(remainderReceipt).toHaveAttribute("data-variant", "receipt");
    await expect(remainderReceipt).toHaveAttribute("data-total", "36000");
    remainderBillNo = Number(await remainderReceipt.getAttribute("data-order-no"));
    expect(remainderBillNo).toBe(splitBillNo + 1);
  });

  await test.step("Bước 10 — đóng hóa đơn và xác nhận B01 trở về trống", async () => {
    await page.getByTestId("receipt-close-header").click();
    await expect(page.getByTestId("receipt-preview")).toBeHidden();
    await expect(page.getByTestId("payment-drawer")).toBeHidden();
    const table = page.getByTestId("table-tbl-b01");
    await expect(table).toHaveAttribute("data-table-status", "empty");
    await expect(table).toHaveAttribute("data-order-total", "0");
  });

  await test.step("Bước 11 — đối chiếu hai đơn độc lập trong Lịch sử và số bill thật trong Báo cáo", async () => {
    await page.getByTestId("nav-order-history").click();
    await expect(page.getByTestId("order-history-drawer")).toBeVisible();
    const b01Orders = page.locator('[data-testid^="history-row-"][data-table-label="B01"]');
    await expect(b01Orders).toHaveCount(2);
    await expect(page.locator('[data-testid^="history-row-"][data-table-label="B01"][data-total="72000"]')).toHaveAttribute("data-status", "paid");
    await expect(page.locator('[data-testid^="history-row-"][data-table-label="B01"][data-total="36000"]')).toHaveAttribute("data-status", "paid");

    await page.getByTestId("history-close-button").click();
    await page.getByTestId("nav-report").click();
    const reportSummary = page.getByTestId("report-summary");
    await expect(reportSummary).toHaveAttribute("data-revenue", "108000");
    await expect(reportSummary).toHaveAttribute("data-paid-orders", "2");
    await page.getByTestId("report-section-orders").click();
    await expect(page.getByTestId(`report-order-${splitBillNo}`)).toHaveAttribute("data-total", "72000");
    await expect(page.getByTestId(`report-order-${splitBillNo}`)).toHaveAttribute("data-table", "B01");
    await expect(page.getByTestId(`report-order-${remainderBillNo}`)).toHaveAttribute("data-total", "36000");
    await expect(page.getByTestId(`report-order-${remainderBillNo}`)).toHaveAttribute("data-table", "B01");
  });

  await test.step("Bước 12 — hủy đơn 72.000đ với lý do khác", async () => {
    await page.getByTestId("report-close-button").click();
    await page.getByTestId("nav-order-history").click();
    const splitOrder = page.locator('[data-testid^="history-row-"][data-table-label="B01"][data-total="72000"]');
    await splitOrder.click();
    await expect(page.getByTestId("history-void-order")).toBeEnabled();
    await page.getByTestId("history-void-order").click();
    await page.getByTestId("history-void-reason").selectOption("other");
    await expect(page.getByTestId("history-void-confirm")).toBeDisabled();
    await page.getByTestId("history-void-note").fill("Khách đổi yêu cầu sau thanh toán");
    await expect(page.getByTestId("history-void-confirm")).toBeEnabled();
    await page.getByTestId("history-void-confirm").click();

    await expect(page.getByTestId("history-void-popup")).toBeHidden();
    await expect(page.getByTestId("history-status-badge")).toHaveAttribute("data-status", "void");
    await expect(page.getByTestId("history-void-info")).toHaveAttribute("data-voided-by", /.+/);
    await expect(page.getByTestId("history-void-info")).toHaveAttribute("data-voided-at", /^\d{4}-\d{2}-\d{2}T/);
    await expect(page.getByTestId("history-reprint-button")).toBeDisabled();
  });

  await test.step("Bước 13 — báo cáo loại đơn hủy khỏi doanh thu và ghi nhận tiền hủy", async () => {
    await page.getByTestId("history-close-button").click();
    await page.getByTestId("nav-report").click();
    const reportSummary = page.getByTestId("report-summary");
    await expect(reportSummary).toHaveAttribute("data-revenue", "36000");
    await expect(reportSummary).toHaveAttribute("data-paid-orders", "1");
    await expect(reportSummary).toHaveAttribute("data-void-count", "1");
    await expect(reportSummary).toHaveAttribute("data-void-amount", "72000");
  });

  await test.step("Bước 14 — bỏ quyền thanh toán, kiểm tạo/sửa đơn, rồi khôi phục quyền", async () => {
    await page.getByTestId("report-close-button").click();
    await page.getByTestId("nav-employees").click();
    await page.getByTestId("employee-row-emp-cashier-1").click();
    const paymentPermission = page.getByTestId("employee-permission-payment.take");
    await expect(paymentPermission).toBeChecked();
    await paymentPermission.uncheck();
    await page.getByTestId("save-employee-button").click();
    await waitForTransientOverlays(page);

    await page.getByTestId("employees-close-button").click();
    await page.getByTestId("nav-lock").click();
    await page.getByTestId("employee-emp-cashier-1").click();
    for (const digit of ["1", "1", "1", "1", "1", "1"]) {
      await page.getByTestId(`pin-${digit}`).click();
    }
    await page.getByTestId("unlock-button").click();
    await expect(page.getByTestId("left-nav-session")).toHaveAttribute("data-employee-id", "emp-cashier-1");

    await page.getByTestId("table-tbl-b01").click();
    await page.getByTestId("menu-item-mi-americano").click();
    await expect(page.getByTestId("order-cart-line")).toHaveAttribute("data-line-total", "35000");
    await page.getByTestId("submit-order-button-footer").click();
    await expect(page.getByTestId("receipt-document")).toHaveAttribute("data-total", "35000");
    await page.getByTestId("receipt-close-header").click();

    await page.getByTestId("table-tbl-b01").click();
    await page.getByTestId("order-cart-increase").click();
    await expect(page.getByTestId("order-total-amount")).toHaveAttribute("data-amount", "70000");
    await page.getByTestId("submit-order-button-footer").click();
    await expect(page.getByTestId("receipt-preview")).toBeVisible();
    await page.getByTestId("receipt-close-header").click();

    await page.getByTestId("table-tbl-b01").click();
    const paymentAction = page.getByTestId("submit-order-button-footer");
    await expect(paymentAction).toBeDisabled();
    await expect(paymentAction).toHaveAttribute("title", /.+/);

    await page.getByTestId("order-close-button").click();
    await page.getByTestId("nav-lock").click();
    await loginAsAdmin(page);
    await page.getByTestId("nav-employees").click();
    await page.getByTestId("employee-row-emp-cashier-1").click();
    await expect(paymentPermission).not.toBeChecked();
    await paymentPermission.check();
    await page.getByTestId("save-employee-button").click();
    await waitForTransientOverlays(page);
    await expect(paymentPermission).toBeChecked();
  });

  expect(Date.now() - startedAt, "kịch bản demo phải hoàn tất dưới 90 giây").toBeLessThan(90_000);
});
