# Report UI automation — issue list

Last run: **2026-11-17** · `pnpm test:reports:ui` · Result: **PASS (5/5)**  
Suite: `project/frontend/e2e/reports.spec.ts` (R-UI-01…05)  
Report: [reports/latest.md](./reports/latest.md)

---

## Open product bugs

Tidak ada. Suite hijau pada run ini.

| ID | Severity | Area | Summary | Repro | Status |
| --- | --- | --- | --- | --- | --- |
| — | — | — | — | — | — |

---

## Watch items (bukan fail saat ini)

Hal yang pernah bikin test/selector rapuh; product OK, jaga saat ubah UI.

| ID | Area | Note |
| --- | --- | --- |
| W-01 | Widget Send | Tombol `Send report` disabled sampai message + auto-screenshot siap. Headless biasanya OK; kalau capture gagal, R-UI-01 timeout. |
| W-02 | Inbox select | `aria-label` `Select` vs `Deselect` — pakai `exact: true` di Playwright. |
| W-03 | Detail title | Title muncul di heading + paragraph; assert via `getByRole('heading')`. |
| W-04 | Demo copy | Teks “send feedback” di lede demo bentrok substring dengan judul panel; assert `exact: true`. |

---

## How to refresh

```bash
cd project && pnpm test:reports:ui
# Jika FAIL → isi tabel Open product bugs, attach path screenshot di frontend/test-results/
```

*Update file ini setiap kali UI suite dijalankan dan ada fail, atau watch item baru muncul.*
