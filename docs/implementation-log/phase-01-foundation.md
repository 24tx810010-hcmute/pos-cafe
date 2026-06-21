# Phase 01 - Foundation

## Mục Tiêu Phase

Xây nền kỹ thuật cho POS Cafe: schema/RLS/RPC cơ bản, domain types, ports/adapters, session store, seed data và test nền để app có thể chạy bằng mock hoặc Supabase.

## Branch/Commit Liên Quan

- Current app truth gần nhất: `origin/main` commit `5bc17db`.
- Docs branch là nhánh tài liệu độc lập, không merge vào `main`.
- Tài liệu gốc: `docs/archive/superpowers/specs/2026-06-09-pos-cafe-design.md`, `2026-06-10-pos-cafe-schema-rls-decisions.md`, `2026-06-11-pos-cafe-coding-decisions.md`.

## Feature Đã Implement

- Schema Postgres cho store, employees, settings, menu, floor, orders, payments.
- Enum nghiệp vụ chính: role, order type/status, payment method, table status, decor kind.
- Domain models/inputs/changesets trong `src/domain/`.
- Ports boundary trong `src/ports/index.ts`.
- Mock adapter và Supabase adapter.
- Store creation, Store Key, seed bundle, passcode verification.
- Guard role/module cơ bản.
- RPC chính: `submit_order_changes`, `pay_order`, `clear_demo_data`.

## Test/Build/Smoke Đã Chạy

- Theo archive log: migration/RPC local smoke đã pass trong giai đoạn 2026-06-11.
- Unit tests cho guards, mock repos, Supabase mapper/errors/store key/deterministic ID được thêm trong codebase.

## Quyết Định Kỹ Thuật Phát Sinh

- Dùng Supabase/Postgres thay vì tự viết backend.
- Dùng RPC cho mutation nghiệp vụ cần transaction.
- Dữ liệu editor dùng changeset và xóa mềm để chừa đường sync/offline.
- Store-scoped multi-tenant bằng `store_id`.

## Gap Còn Lại

- DB-level employee permission không phải trọng tâm phase này; role guard chủ yếu ở app/core.
- Offline-first chưa làm, chỉ chừa seam.
- Native printer chưa làm, chỉ chừa `IPrintPort`.

## Link Liên Quan

- [../data-model.md](../data-model.md)
- [../architecture.md](../architecture.md)
- [../tech-stack.md](../tech-stack.md)
