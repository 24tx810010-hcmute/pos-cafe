# Bằng chứng kiểm tra bộ spec ngày09/09/2026

**Chỉ kiểm tra tài liệu — không chạy ứng dụng/DB/test tính năng mới.** Cả hai lệnh dưới đây kết thúc exit0. Mốc code đối chiếu main@7183b31; đây không phải hash của implementation mới.

## OpenSpec strict

Lệnh tại D:/Workspace/pos-cafe-docs:

```powershell
& 'D:/tools/nodejs/openspec.ps1' validate add-idempotent-write-operations --type change --strict --json --no-interactive
```

Kết quả:

```json
{
  "items": [
    {
      "id": "add-idempotent-write-operations",
      "type": "change",
      "valid": true,
      "issues": [],
      "durationMs": 20
    }
  ],
  "summary": {
    "totals": {
      "items": 1,
      "passed": 1,
      "failed": 0
    },
    "byType": {
      "change": {
        "items": 1,
        "passed": 1,
        "failed": 0
      }
    }
  },
  "version": "1.0",
  "root": {
    "path": "D:\\Workspace\\pos-cafe-docs",
    "source": "nearest"
  }
}
```

## Cấu trúc, truy vết và liên kết

Kiểm kê7loại artifact/13file/7capability;33IDrequirement,12UC,93TCgốc duy nhất;43task chưa check; mọi UC/TC có trường bắt buộc; tất cả24mã lỗi có tham chiếu testplan; không IDdangling, không thiếu row truy vết,97liên kết local trong bộ spec+index+report có đích. Các phép này không đánh giá được SQL/runtime hoặc chứng minh đủ mọi ca sản phẩm.

Hash SHA-256 bên dưới là bản artifact cuối sau sửa finding và trình bày, để phân biệt với hash tại các mốc đọc của reviewer. Không sửa hash cũ trong reviewer report để giả rằng họ đọc toàn bộ bản cuối.

```json
{
  "kind": "DOCUMENT_VALIDATION_ONLY",
  "date": "2026-09-09",
  "counts": {
    "artifactTypes": 7,
    "markdownFiles": 13,
    "capabilities": 7,
    "requirements": 33,
    "usecases": 12,
    "testcases": 93,
    "errorCodes": 24,
    "localLinksChecked": 97,
    "tasks": 43
  },
  "uncovered": {
    "requirements": [],
    "usecases": [],
    "testcases": []
  },
  "issues": [],
  "snapshots": [
    {
      "file": "design.md",
      "sha256": "59cc2e4afdfa35f5ab5670a10d0312b78725a096432f95306de360e6309efa3f",
      "lines": 295
    },
    {
      "file": "proposal.md",
      "sha256": "19f8c3479bf49ca6af95d542b3028e056985376bc0754c7844566829120f6374",
      "lines": 86
    },
    {
      "file": "specs/access-control/spec.md",
      "sha256": "794c44a94d3c5bd980c7ab1e4f37cfd6ff3472672cc21a74e9846362b44a1d4d",
      "lines": 34
    },
    {
      "file": "specs/employee-session/spec.md",
      "sha256": "efbfb6efd722a951aebd9dc2ba6427ccb7134892c02f05e656226a965f6aa065",
      "lines": 30
    },
    {
      "file": "specs/order-management/spec.md",
      "sha256": "010b9734d03cf98f7b2bdb2db1950ffc1c3276a1890fc42ea547483a78de4730",
      "lines": 46
    },
    {
      "file": "specs/order-void/spec.md",
      "sha256": "2483b9677184193d1464771969ae85d84cc4880daccb970cbb8817f4adaeda2e",
      "lines": 18
    },
    {
      "file": "specs/payment/spec.md",
      "sha256": "99e595af24daf93abd1406399894e4d7925ebce3de3a2862a03ac0c880e39db2",
      "lines": 80
    },
    {
      "file": "specs/receipt-printing/spec.md",
      "sha256": "b472b72848f6dfd94d67288f5d2f59a3b08fc0b785194cd7fb03bfce6bf970f5",
      "lines": 40
    },
    {
      "file": "specs/write-idempotency/spec.md",
      "sha256": "f00de7a25b74aaa0923b10ac452a4caa2cd10d416781ed647e8434d8a1fcc53c",
      "lines": 244
    },
    {
      "file": "tasks.md",
      "sha256": "d88a8789a5189bd18c504d2a59d82d71937c7dfdfa26c28f352ab61a3221eb21",
      "lines": 77
    },
    {
      "file": "testplan.md",
      "sha256": "753cfdde0a9973bd24c141e0074f1887d6864a16ae3ebf5ebe538ecf3eaa8bf1",
      "lines": 1124
    },
    {
      "file": "traceability.md",
      "sha256": "3bce1ff4eb693db72b9393348b94147b117146cc7e34fe1ad9c0342fc7b07131",
      "lines": 48
    },
    {
      "file": "usecases.md",
      "sha256": "40339e01de98c04830f66b0c058c23be62ad4d1b4b0a0ae920ea646b6b763d13",
      "lines": 637
    }
  ]
}
```

## Checker có thể chạy lại

Checker read-only dưới đây dùng Node, không là code ứng dụng và không được đưa sang main. Khi chạy lại ở máy khác đổi biến base; ghi lại output/exitcode mới thay vì tái dùng log này cho nội dung đã thay đổi.

```javascript

const fs=require('fs'),path=require('path'),crypto=require('crypto');
const base='D:/Workspace/pos-cafe-docs', root=base+'/openspec/changes/add-idempotent-write-operations';
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):e.name.endsWith('.md')?[path.join(p,e.name)]:[])}
const files=walk(root),text=Object.fromEntries(files.map(p=>[path.relative(root,p).replaceAll('\\','/'),fs.readFileSync(p,'utf8')]));
const specFiles=Object.keys(text).filter(k=>k.startsWith('specs/'));
const allSpec=specFiles.map(k=>text[k]).join('\n');
const reqs=[...allSpec.matchAll(/Mã: \*\*(IDEM-\d{2})\*\*/g)].map(m=>m[1]);
const ucs=[...text['usecases.md'].matchAll(/^## (UC-IDEM-\d{2}) /gm)].map(m=>m[1]);
const tcs=[...text['testplan.md'].matchAll(/^### (TC-IDEM-\d{3}) /gm)].map(m=>m[1]);
const reqSet=new Set(reqs),ucSet=new Set(ucs),tcSet=new Set(tcs),issues=[];
function check(ok,msg){if(!ok)issues.push(msg)}
for(const name of ['proposal.md','design.md','usecases.md','testplan.md','traceability.md','tasks.md'])check(!!text[name], 'Missing '+name);
check(files.length===13,'Expected13mdfiles');check(specFiles.length===7,'Expected7capabilities');
check(reqs.length===33&&reqSet.size===33,'Expected33uniqueRequirements');
check(ucs.length===12&&ucSet.size===12,'Expected12uniqueUCs');
check(tcs.length===93&&tcSet.size===93,'Expected93uniqueTCs');
for(const [p,s]of Object.entries(text)){
 for(const m of s.matchAll(/\b(?:UC-IDEM-\d{2}|TC-IDEM-\d{3})\b/g))check((m[0].startsWith('UC')?ucSet:tcSet).has(m[0]),p+': unknown '+m[0]);
 for(const m of s.matchAll(/(?<![A-Z-])IDEM-\d{2}(?!\d)/g))check(reqSet.has(m[0]),p+': unknown '+m[0]);
}
const matrixLines=text['traceability.md'].split('\n').filter(l=>l.startsWith('| [IDEM-'));
check(matrixLines.length===33,'Matrix33rows');
const matrixReq=new Set(),matrixUC=new Set(),matrixTC=new Set();
for(const row of matrixLines){const id=row.match(/IDEM-\d{2}/)[0];matrixReq.add(id);const us=row.match(/UC-IDEM-\d{2}/g)||[],ts=row.match(/TC-IDEM-\d{3}/g)||[];check(us.length>0,'NoUC '+id);check(ts.length>0,'NoTC '+id);us.forEach(x=>matrixUC.add(x));ts.forEach(x=>matrixTC.add(x));}
for(const id of reqs)check(matrixReq.has(id),'Matrixmissing '+id);
for(const id of ucs)check(matrixUC.has(id),'Matrixmissing '+id);
for(const id of tcs)check(matrixTC.has(id),'Matrixmissing '+id);
const ucBlocks=text['usecases.md'].split(/^## UC-IDEM-/m).slice(1);
for(const b of ucBlocks)for(const h of ['Tác nhân','Mục tiêu','Tiền điều kiện','### Đầu vào','### Luồng chính','### Luồng thay thế','### Luồng ngoại lệ','### Đầu ra','### Tiêu chí chấp nhận','Truy vết'])check(b.includes(h),'UC'+b.slice(0,2)+' missing '+h);
for(const b of text['testplan.md'].split(/^### TC-IDEM-/m).slice(1))for(const h of ['Truy vết','Mức / nhóm','Tiền điều kiện','Dữ liệu thử','Bước 1','Bước 2','Bước 3','Kết quả mong đợi','Nơi hiện thực'])check(b.includes(h),'TC'+b.slice(0,3)+' missing '+h);
const catalog=text['design.md'].slice(text['design.md'].indexOf('## 7. Error catalog'),text['design.md'].indexOf('## 8. Migration'));
const errors=[...catalog.matchAll(/^\| ([A-Z][A-Z_]+) \|/gm)].map(m=>m[1]);
for(const e of errors)check(text['testplan.md'].includes(e),'ErrorNotTested '+e);
const snapshots=files.map(p=>({file:path.relative(root,p).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),lines:fs.readFileSync(p,'utf8').split('\n').length}));
const linkDocs=[...files,base+'/docs/reviews/2026-09-07-idempotency/14-bo-spec-hoan-chinh-va-ra-cuoi.md',base+'/docs/reviews/2026-09-07-idempotency/README.md',base+'/openspec/README.md'];
let links=0;
for(const p of linkDocs)for(const m of fs.readFileSync(p,'utf8').matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){let url=m[1].replace(/^<|>$/g,'').split('#')[0];if(!url||/^(https?:|app:|codex:)/i.test(url))continue;url=url.replace(/:\d+(-\d+)?$/,'');const dst=path.resolve(path.dirname(p),url);links++;check(fs.existsSync(dst),'Brokenlink '+p+' -> '+url);}
const result={kind:'DOCUMENT_VALIDATION_ONLY',date:'2026-09-09',counts:{artifactTypes:7,markdownFiles:files.length,capabilities:specFiles.length,requirements:reqs.length,usecases:ucs.length,testcases:tcs.length,errorCodes:errors.length,localLinksChecked:links,tasks:(text['tasks.md'].match(/^- \[ \] /gm)||[]).length},uncovered:{requirements:reqs.filter(x=>!matrixReq.has(x)),usecases:ucs.filter(x=>!matrixUC.has(x)),testcases:tcs.filter(x=>!matrixTC.has(x))},issues:[...new Set(issues)],snapshots};
console.log(JSON.stringify(result,null,2));process.exitCode=result.issues.length?1:0;

```

## Trạng thái test sản phẩm

- 93TCgốc và các parameter suffix: **planned / chưa hiện thực / chưa chạy**.
- Baseline63test cũ chỉ chứng minh baseline, không phải tính năng chống trùng.
- Các reviewer xác nhận đóng finding trong contract/testplan; không chạy DB/ứng dụng trong vòng rà này.
- Môi trường DB thật/fault/observer còn phải preflight khi bắt đầu implementation. Thiếu môi trường phải ghi BLOCKED/NOTRUN, không bỏ test hoặc chuyển sang mock để nhận pass.
