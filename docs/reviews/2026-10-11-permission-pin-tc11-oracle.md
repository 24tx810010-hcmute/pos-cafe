# Review oracle/quyền TC-PIN-11 — 11/10/2026

- **Reviewer:** subagent độc lập `tc11_oracle_review`, không sửa candidate, không deploy.
- **Candidate:** main manifest SHA-256 `626b59308251a089db44f111d3b34982b97f28ff78c3012dda7dda0c673debc3`; docs-slice sau rà độ tin cậy SHA-256 `11654a91aa145b0e58e338495b39b15a42c9bfa6e24d8ba8a72b92424966c9db`.
- **Phạm vi đã đọc:** TC-PIN-11 testplan/design, browser test, `authRepo`, `CreateStoreScreen`, SQL reservation/bootstrap, safe summary, biên bản; hash file liên quan đối chiếu manifest. Không đọc raw report hoặc secret.
- **Đánh giá:** 9 ca browser kiểm trước execute và sau commit của reserve/signup/bootstrap, pending reserve duplicate click, bootstrap owner/storeNo sai; request ID/canonical request, credential equality trong memory, thông báo UI và DB graph counts tương ứng. Production context được tạo trước network, coalescing promise, signup sign-in reconciliation và SQL replay idempotent.
- **Finding chặn:** không có. Browser giữ pending ở reserve; cùng đường UI/promise được dùng cho bước khác và unit kiểm signup. Giới hạn này không chặn TC11 local.
- **Verdict:** **APPROVE** exact main candidate và docs-slice sau rà độ tin cậy. Reviewer xác nhận lại rằng browser assert thông báo signup thất bại, không assert trực tiếp mã `AUTH_REQUIRED`; expected context message vẫn được phủ, không có blocker mới. Full PIN19/PERM60 và hosted/release nằm ngoài verdict.
