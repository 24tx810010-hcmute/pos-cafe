# Matrix bằng chứng diễn tập local — 13/10/2026

Index đầy đủ35 nghĩa vụ; coverageComplete=false, eligibility=false. OBSERVED là kỳ vọng thực nghiệm đạt, gồm expected rejection; không có nghĩa hypothesis/release PASS. OBSERVED_LIMITED chỉ phần đã mô tả. BLOCKED giữ cổng đóng; NOT_EXERCISED không được đếm PASS. Proposal D là coverage baseline trước khi chạy; index này tổng hợp sau kết quả.

| ID | Actor / kỳ vọng | Trạng thái | Cases / reports |
| --- | --- | --- | --- |
| SNAP | operator/writer — full same-token rows + concurrent Q/default/aborted/nextval | OBSERVED | H1-SNAPSHOT, H1-DUMP, H1-CONCURRENT, H1-TOC63; h1-run-1791906919936.json |
| STABLE | operator/restorer — quiet branch actual full restore | OBSERVED | H1-STABLE-FULLRESTORE; additional-1791908046036.json |
| FULL | restorer — 63 tables + catalogs/roles/ACL/extensions/LO inventory | OBSERVED | H1-FULLRESTORE, H1-ARCHIVESEQ; h1-run-1791906919936.json |
| ALLOC | postgres known consumers — three archive sequences allocatable; proof clone unconsumed | OBSERVED_LIMITED | H1-ALLOCATION, H1-PROOFUNCONSUMED; h1-run-1791906919936.json |
| ALLOC-COMPLETE | unknown future consumer — discover all casts/functions/shared consumers and cached sessions | BLOCKED | ;  |
| SNAP-FAULT | exporter/importer — EOF/deadline/no importer fail | OBSERVED | N-EXPORTER-EOF, N-EXPORTER-TIMEOUT, N-MISSING-IMPORT, N-DUMP-EXPORTER-EOF; additional-1791908046036.json, negatives-1791907036863.json, negatives-1791907120805.json |
| TOC-FAULT | fault injector — provider omission/truncated/extra identities rejected | OBSERVED | N-PROVIDER-OMITTED-TOC, N-TRUNCATED-REPORT, N-EXTRA-REPORT; negatives-1791907120805.json |
| ARCHIVE-FAULT | restorer — corrupt/truncated/mismatched source/archive rejected | OBSERVED | N-CORRUPT-ARCHIVE, N-TRUNCATED-ARCHIVE, N-WRONG-SOURCE, N-WRONG-ARCHIVE-BINDING; additional-1791908046036.json, negatives-1791907120805.json |
| SEQ-FAULT | parser/fixture owner — duplicates/missing/invalid boolean/extra SQL/wrong identity rejected | OBSERVED | N-SEQ-PARSE-DUPLICATE, N-SEQ-PARSE-MISSING, N-SEQ-PARSE-INVALIDBOOL, N-SEQ-PARSE-EXTRASQL, N-SEQ-PARSE-WRONGIDENTITY; negatives-1791907120805.json |
| ALLOC-FAULT | oracle/PG fixture — collision/reset/overflow/CYCLE/cache/unknown/shared/cast/explicit ID; decreasing and BigInt | OBSERVED | N-CLONE-VALUE-ISCALLED, N-ALLOC-COLLISION, N-ALLOC-RESET, N-ALLOC-OVERFLOW, N-ALLOC-CYCLE, N-ALLOC-CACHE, N-ALLOC-CACHEDSESSION, N-ALLOC-SHARED, N-ALLOC-UNKNOWN, N-ALLOC-INTCAST, N-ALLOC-EXPLICITID, N-ALLOC-DECREASING, N-BIGINT-EXACT, N-PG-CYCLE-COLLISION, N-PG-OVERFLOW, N-PG-DECREASING, N-PG-CACHE; additional-1791908046036.json, negatives-1791907120805.json |
| PROBE | fixture owner — ABA endpoints never imply quiescence | OBSERVED | N-ABA-ENDPOINTS; negatives-1791907120805.json |
| CATALOG | DDL fixture owner — add table/FK/partition detach/ACL/extension incompatibility detected | OBSERVED | N-DDL-ADDTABLE, C-FK-DRIFT, C-PARTITION-DRIFT, N-ACL-DRIFT, N-INCOMPATIBLE-EXTENSION; additional-1791908046036.json, h2-1791907476316.json, negatives-1791907120805.json |
| CATALOG-EXTRA | DDL/role owner — attach/role drift; old snapshot vs current catalog after concurrent DDL | OBSERVED | N-PARTITION-ATTACH, N-ROLE-CATALOG-DRIFT, N-CATALOG-BOUNDARY; boundary-faults.json |
| PROOF | shadow harness — exact mandatory set/source/archive/receipt rejects skip/fake JSON | OBSERVED_LIMITED | N-SHADOW-MANDATORY-SET; additional-1791908046036.json |
| CANONICAL-ADAPTER | live controller — accept proposed version and eligibility | NOT_AUTHORIZED | ;  |
| QK | synthetic SQL writer — post-snapshot payment/payload/R1/receipt preserved at source, clone excludes | OBSERVED | H1-Q-EXCLUDED, H1-L-STALE-BLOCK, N-SAMECOUNT-K-R1-RECEIPT; h1-run-1791906919936.json, negatives-1791907120805.json |
| LIVE-ASSESSOR | exact frozen canonical functions — stale/quiescence false/forged serialized/hidden R1 blocked; equal only review | OBSERVED | L-STALE, L-NOQUIESCENCE, L-FORGED-SERIALIZED, L-EQUAL-NOT-AUTHORIZATION, L-HIDDEN-R1-SAMECOUNTS; assessor-results.json |
| LIVE-RECONCILE | recovery operator — actual full forward reconciliation then live restore | NOT_AUTHORIZED | ;  |
| CUT-LOCK | postgres/Auth writer — scoped reader works; outside Auth waits; after wait latest row recheck aborts | OBSERVED | C-READER-WHILE-SCOPED, C-OUTSIDE66-BLOCKED, C-INFLIGHT-LATEST-COMMITTED, C-OUTSIDE-FULLROW-RECHECK; h2-1791907476316.json |
| CUT-K | canonical delete statements — nonempty K must preserve transaction; actual delete blocked by FK | BLOCKED_WITH_WITNESS | C-NONEMPTY-K-CLEANUP-BLOCK; h2-1791907476316.json |
| CUT-POSITIVE | release controller — exact79 cleanup + actual activation same transaction; outside66/payloads preserved | BLOCKED | ;  |
| CUT-SHADOW | shadow SQL coordinator — fragment/EOF/deadline rollback and commit ACK reconciliation | OBSERVED_LIMITED | C-FAULT-fragment, C-FAULT-eof, C-FAULT-timeout, C-COMMIT-ACK-RECONCILE, C-ABSOLUTE-DEADLINE-REOPEN; additional-1791908046036.json, h2-1791907476316.json |
| CUT-LEGACY | authenticated pre-admitted bootstrap — revocation does not drain inflight bootstrap | OBSERVED | C-LEGACY-INFLIGHT-AFTER-REVOKE; h2-1791907476316.json |
| CUT-PUBLIC-SEQ | postgres caller — standalone nextval persists past rollback | OBSERVED | C-NONTRANSACTIONAL-SEQUENCE; h2-1791907476316.json |
| CONTROL | postgres/provider owners — 64 privilege profile, 5 denials, no owner/SET ROLE escape, readonly bypass | OBSERVED | H1-PRIV64, H1-ACTOR, C-PROVIDER-5-DENIALS, N-PROVIDER-OWNER-DENIAL, C-READONLY-SETTING-NO-FENCE, N-ACCESS-EXCLUSIVE-DUMP; additional-1791908046036.json, h1-run-1791906919936.json, h2-1791907476316.json, negatives-1791907120805.json |
| STORAGE | HTTP local clients — 3 payload upload/restore SHA,size,MIME; original vs API metadata separate | OBSERVED | S-UPLOAD-READBACK-1, S-UPLOAD-READBACK-2, S-UPLOAD-READBACK-3, S-RESTORE-object-1, S-RESTORE-object-2, S-RESTORE-object-3; h3-1791907674203.json, h3-1791907716845.json, h3-1791907779406.json |
| STORAGE-RACES | HTTP/DB fixture owner — same size/cache/ABA/bucket drift/object3/hash truncation detected | OBSERVED | S-SAMESIZE-REPLACEMENT, S-CONDITIONAL-CACHE, S-OLD-BYTES-NEW-METADATA-REJECT, S-METADATA-ABA, S-BUCKET-CONFIG-DRIFT, S-OBJECT3-RACE, S-PARTIAL-DOWNLOAD-REJECT; h3-1791907779406.json |
| STORAGE-INFLIGHT | streamed HTTP + metadata locker — actual bytes before metadata commit, worker removes old version | OBSERVED | S-PAYLOAD-BEFORE-METACOMMIT, S-INFLIGHT-REOPENS, S-BACKGROUND-OLDVERSION-DELETION; h3-deep-1791907926463.json |
| STORAGE-PROTOCOL | TUS/S3 HTTP clients — real upload/readback per protocol | OBSERVED | S-TUS-ACTUAL, S-S3-ACTUAL; h3-deep-1791907926463.json |
| STORAGE-JOURNAL | delete client/local DB — exact2 after commit/ACK unknown reconciliation; object3 untouched | OBSERVED_LIMITED | S-DELETE-ACK-JOURNAL; h3-deep-1791907926463.json |
| STORAGE-VERSION | provider API — immutable bytes/version retention through capture-to-delete | BLOCKED | S-OLD-VERSION-QUERY-NOT-PROOF; h3-1791907779406.json |
| STORAGE-CONTROL | provider owner — supported ingress fence+inflight/background drain+conditional delete | BLOCKED | ;  |
| STORAGE-PROTOCOL-RACES | TUS/S3 concurrent upload clients — same inflight/background race matrix via every supported protocol | NOT_EXERCISED | ;  |
| STORAGE-FAULT-CONTROL | network/controller owner — mid-network stream disconnect and expired metadata lock reopens writer | OBSERVED_LIMITED | S-NETWORK-DISCONNECT, S-CONTROLLER-EOF-REOPEN; boundary-faults.json |
| HOSTED | provider owner — binary parity/control/window and actual app runtime | NOT_AUTHORIZED | ;  |

CUT-K: assertion ban đầu FAIL vì kỳ vọng P0001; follow-up xác minh FK23503 và rollback đầy đủ. Không đổi lịch sử. Restore truncated-data actual failure có report bổ sung restore-data-fault.json; initial restore-fault.json dừng tại TOC. Chi tiết và giới hạn nằm trong [biên bản](permission-backup-lab-2026-10-13.md).
