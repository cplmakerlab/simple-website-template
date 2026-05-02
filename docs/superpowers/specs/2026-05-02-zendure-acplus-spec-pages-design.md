# Zendure SolarFlow 2400 AC+ Spec Pages

**Date:** 2026-05-02

## Summary

Add spec page rendering for the new Zendure SolarFlow 2400 AC+ product line in `producten.html`. The AC+ differs from the older SolarFlow 2400 AC by having a built-in 2.4 kWh battery in the hub, using AB3000L expansion modules (instead of AB3000X), and different physical dimensions.

## What changes

### `producten.html`

1. **New constants** after the existing `ZENDURE_PER_BATTERY`:
   - `ZENDURE_ACPLUS_HUB` — hub specs (2.4 kWh built-in, 2400 W AC, 3600 W peak, 2400 W charge, 2600 W discharge, 10.12 kg, 448 × 303.6 × 88 mm)
   - `ZENDURE_ACPLUS_BATTERY` — AB3000L module specs (2.88 kWh, 26.3 kg, 394 × 257 × 283 mm)
   - `ZENDURE_ACPLUS_PHOTOS` — 7 photos from `assets/products/zendure-ac-plus/`

2. **New function `renderZendureAcPlus(numInverters, numBatteriesPerInverter)`**:
   - Total capacity: `numInverters × (2.4 + numBatteriesPerInverter × 2.88)` kWh
   - Total AC power: `numInverters × 2.4` kW
   - Same visual structure as existing `renderZendure()` (alert + row with specs card + carousel)
   - Mentions "SolarFlow 2400 AC+" and "AB3000L" in copy

3. **New regex in entry point** to match `ZSF2400AC+_<n>X<m>` (escaped `\+`), routing to `renderZendureAcPlus(n, m)`.

### `assets/products/zendure-ac-plus/`

7 product photos downloaded from zendure.com CDN:
- `zendure-acplus-1.png` (main product, Red Dot award)
- `zendure-acplus-2.jpg` through `zendure-acplus-6.jpg` (configurations with 1-5 AB3000L modules)
- `zendure-acplus-ab3000l.jpg` (standalone AB3000L module)

### What stays unchanged

- `renderZendure()` (old ZSF2400AC) remains for backward compatibility
- `renderMarstek()` unchanged
- `index.html` unchanged (config data comes from Google Sheet CSV)

## Specs sourced from

- Zendure EU product page (zendure.com)
- Off Grid Power Station (offgridpowerstation.eu)
- Solar Power Supply (solarpowersupply.eu)
- Shop Rebor (shop-rebor.com)

### SolarFlow 2400 AC+ Hub

| Spec | Value |
|------|-------|
| Built-in battery | 2.4 kWh (LiFePO4) |
| AC power | 2400 W |
| Peak power | 3600 W (10 s) |
| Charge power | 2400 W |
| Discharge power | 2600 W |
| Efficiency | 93% |
| Dimensions | 448 × 303.6 × 88 mm |
| Weight | 10.12 kg |
| IP rating | IP65 |
| Operating temp | −20 °C to +60 °C |
| Communication | WiFi, Bluetooth |
| Cycle life | > 6000 (70% residual) |
| Warranty | 10 years |

### AB3000L Module

| Spec | Value |
|------|-------|
| Capacity | 2.88 kWh (2880 Wh) |
| Chemistry | LiFePO4 |
| Voltage | 48 V |
| Dimensions | 394 × 257 × 283 mm |
| Weight | 26.3 kg |
| IP rating | IP65 |
| Charging temp | 0 °C to 55 °C |
| Discharging temp | −20 °C to +55 °C |
| Cycle life | > 6000 |
| Warranty | 10 years |
| Cooling | Passive (silent) |
| Housing | Aluminium |
