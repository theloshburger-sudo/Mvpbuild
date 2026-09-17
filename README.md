# QuoteClean

Stop re-keying PlanSwift takeoff into Excel. Stop transposing qty and price.

Offices take off in **PlanSwift**, then write quantities by hand or into an **Excel template**. QuoteClean turns that dump into estimate line items you can export — descriptions, qty, and UOM already filled. Not a PlanSwift plugin.

Student demo (Cal Poly Vibe Coding Club).

## Demo (60 seconds)

1. Open the app (defaults to a PlanSwift-style takeoff export).
2. Confirm the column map — Qty vs Unit Price must not swap. Try **Preview a Qty/Price transpose** to see the warnings.
3. **Lock columns & build estimate**.
4. **Export to Excel** (or CSV) — Item, Description, Qty, UOM, Unit Price, Total, Notes. Drop into the office template without retyping lines.

Also try **Hand notes** and **Excel template** (Unit Price sits before Qty on purpose).

## Local

```bash
npm install
npm run dev
```

## GitHub Pages

Live after Actions deploy: https://theloshburger-sudo.github.io/Mvpbuild/
