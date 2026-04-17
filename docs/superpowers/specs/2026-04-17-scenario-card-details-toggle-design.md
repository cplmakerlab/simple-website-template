# Scenario card: Details toggle and Totale opgeslagen energie row

**Date:** 2026-04-17
**Scope:** `index.html` only — `makeScenCard` inside `renderResults`, plus a small CSS block.

## Problem

A scenario card currently shows ten stat-rows plus two progress bars. When showing the result to a customer, the salesperson scrolls past breakdown rows (full / partial split, days, etc.) to land on the only numbers the customer cares about: how much do I save, how much do I store, what does it cost, how fast is it back. The breakdown is useful when explaining the calculation but distracting in the headline.

## Goal

Collapse the seven breakdown rows behind a `<details>` disclosure (closed by default), and add one new "Totale opgeslagen energie" row that aggregates the existing full + partial storage values into a single number. Customer sees four numbers and two progress bars on first view; clicking *Details ▾* reveals the full breakdown.

## Non-goals

- Saving/restoring the open/closed state across share links or page reloads. The toggle is purely UI; a restored page always opens with Details closed.
- Animating the disclosure beyond the chevron rotation (native `<details>` does not animate height; that is acceptable).
- Changing any calculation. Only the rendering of `makeScenCard` is touched.

## Card layout after change

**Visible by default**, in order:

1. **Totale opgeslagen energie** (NEW). Single value `chargedFull + chargedPartial` in kWh. Big-and-prominent treatment matching the existing *Totale jaarlijkse besparing* row: large value on the right edge, with a `gem. N j: …` second line beneath when `numYears >= 2`. Color: `green` (same as the storage rows in the breakdown).
2. **Totale jaarlijkse besparing** (existing big-green row, untouched).
3. **Installatieprijs** (existing row, untouched).
4. **Terugverdientijd** (existing big-orange row, untouched).
5. **Details disclosure** — `<details class="scen-details">` block, closed by default. See "Details block" below.
6. **Recuperatie t.o.v. afname** progress bar (untouched).
7. **Recuperatie t.o.v. injectie** progress bar (untouched).

**Inside the Details block**, in order (these are the existing rows, currently always visible, now hidden behind the disclosure):

- Min. dagelijkse injectie nodig
- Dagen drempel volledig bereikt
- Dagen gedeeltelijk geladen
- Opgeslagen volle cycli (periode)
- Opgeslagen gedeeltelijk (periode)
- Jaarl. besparing volle cycli
- Jaarl. besparing gedeeltelijk

Each row keeps its existing markup and `renderWithAvg(...)` companion exactly as today; the only change is that they live inside `<details>` now.

## Details block

Native HTML `<details>` element — no JavaScript, accessible by default, keyboard-friendly.

```html
<details class="scen-details">
  <summary>Details <span class="chev">▾</span></summary>
  <div class="stat-row">…</div>  <!-- 7 detail rows here -->
  …
</details>
```

The summary shows the word *Details* on the left and a `▾` chevron on the right; the whole row is the click target. When open, the chevron rotates 180° via CSS transition.

## New row data

The new "Totale opgeslagen energie" row reads from the same `scen` and `scenAvg` objects that `makeScenCard` already receives:

- Current value: `scen.chargedFull + scen.chargedPartial` (kWh).
- Average (when `showAvg`): `scenAvg.chargedFull + scenAvg.chargedPartial` (kWh).

Both are pre-computed inside `makeScenCard` as `const totalCharged = scen.chargedFull + scen.chargedPartial;` and `const avgTotalCharged = showAvg ? scenAvg.chargedFull + scenAvg.chargedPartial : null;`. The avg companion uses the existing prominent-row pattern (second line below the headline, identical to *Totale jaarlijkse besparing*).

## CSS

One new block, placed near the other `.scenario-card` rules in the embedded `<style>`:

```css
details.scen-details {
  margin: 8px 0 4px 0;
}
details.scen-details summary {
  cursor: pointer;
  list-style: none;
  padding: 10px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
}
details.scen-details summary::-webkit-details-marker { display: none; }
details.scen-details summary .chev {
  transition: transform 0.2s;
  font-size: 1rem;
  line-height: 1;
}
details.scen-details[open] summary .chev { transform: rotate(180deg); }
details.scen-details[open] summary { border-bottom-color: transparent; }
details.scen-details > .stat-row:first-of-type { padding-top: 10px; }
```

Notes:
- `list-style: none` plus the `::-webkit-details-marker` rule remove the default disclosure triangle on Chrome / Safari / Firefox respectively (the explicit Webkit rule is still needed for older Safari).
- The chevron is a single `<span class="chev">▾</span>` so the rotation is trivial.
- When the disclosure is open, the bottom border of the summary becomes transparent to avoid a double line above the first `.stat-row`.

## State persistence

None. `_serializeState` is unchanged; the open/closed state is not part of the saved data. A page restored from a share link or JSON file shows all Details blocks closed.

## Edge cases

- **Multiple cards on the page.** Each `<details>` is independent (no `name=` attribute, so the browser does not enforce single-open behavior). Three configs × up to two scenarios = up to six independent toggles.
- **Print stylesheet.** None exists today; not adding one. If the user prints the page, browser defaults apply (typically Details renders as closed). Out of scope.
- **Saved v3 share link generated before this feature.** The renderer still produces the same DOM regardless of save-state shape; no backwards-compatibility work required.

## Verification (manual, in a browser)

1. Load a CSV, run *Bereken ROI*. Each scenario card shows the four headline rows + Details ▾ + two progress bars. Details is closed.
2. Click *Details* — the chevron rotates and the seven breakdown rows fade in.
3. Click again — closes.
4. Verify each card's toggle is independent.
5. With a < 2 year CSV: the new "Totale opgeslagen energie" row shows just the value (no `gem. N j:` line). Today's existing rows look identical to before this change (just relocated).
6. With a ≥ 2 year CSV: the new row shows `<value> kWh` headline + `gem. N j: <avg> kWh` second line, matching the *Totale jaarlijkse besparing* row's styling.
7. Old v2 share link: loads, renders, Details closed, no console errors, no avg UI.
8. New v3 share link: round-trips, page restores with Details closed.
