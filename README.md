# QuoteClean

Stop re-keying PlanSwift takeoff into Excel. Stop transposing qty and price.

Offices take off in **PlanSwift**, then write quantities by hand or into an **Excel template**. QuoteClean turns that dump into estimate line items you can export — descriptions, qty, and UOM already filled. Not a PlanSwift plugin.

Student demo (Cal Poly Vibe Coding Club).

## Demo (60 seconds)

1. Open the app (defaults to a PlanSwift-style takeoff export).
2. Confirm the column map — Qty vs Unit Price must not swap. Try **Preview a Qty/Price transpose** to see the warnings.
3. **Lock columns & build estimate**.
4. **Export to Excel** (or CSV) — Item, Description, Qty, UOM, Unit Price, Total, Notes. Drop into the office template without retyping lines. The workbook has a frozen header, number formats, totals, and a **Paste guide** sheet.

Also try **Hand notes**, **Excel template** (Unit Price before Qty), and the labeled example formats:
- **Export by Page** — Page / Digitizer Item / Item Number / Value / Units / Color ([ConstructConnect help](https://help.constructconnect.com/plugins-adding-functionality-to-planswift-54/planswift-export-by-page-plugin-1687))
- **Estimating layout** — Item Name / Folder Path / Cost Each / Qty / Price Total, as used in PlanSwift→Excel handoffs ([UDA troubleshooting notes](https://constructconnect-help.atlassian.net/wiki/spaces/PSUPPORT/pages/48693673/Trouble+Shooting+UDA+Construction+Suite+Integration+with+PlanSwift+9.x))

Those samples are example formats from public docs, not official plugin dumps. Estimating/Report exports follow whatever columns the office made visible.

## Local

```bash
npm install
npm run dev
```

## GitHub Pages

Live after Actions deploy: https://theloshburger-sudo.github.io/Mvpbuild/
