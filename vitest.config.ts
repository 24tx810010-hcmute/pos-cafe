import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    allowOnly: false,
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      // Phạm vi đo là logic nghiệp vụ thuần: core, và các module trong features
      // không phải hook. Cả 20 module không phải hook của features đều không
      // import react và nhận port qua tham số, nên kiểm thử được bằng adapter mock.
      // Lý do đầy đủ: openspec/changes/define-test-strategy/proposal.md, quyết định 2.
      include: ["src/core/**/*.ts", "src/features/**/*.ts"],
      exclude: [
        "src/features/**/use*.ts", // hook gắn với vòng đời component
        "src/domain/**", // tầng chỉ khai kiểu, gần như không có dòng chạy được
        "**/index.ts", // barrel chỉ re-export, không có logic
        "**/*.tsx", // thành phần React, thuộc tầng giao diện
        "**/*.test.ts",
        "**/*.test.tsx",
      ],
      // Ngưỡng áp cho toàn phạm vi gộp, không áp cho từng file: áp từng file sẽ
      // chặn cả những file nhỏ có một nhánh phòng thủ không bao giờ chạy tới.
      // Chỉ đặt ngưỡng cho dòng; statements và branches theo dõi nhưng không chặn.
      thresholds: { lines: 90 },
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
