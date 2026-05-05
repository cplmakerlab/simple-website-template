// Synthetic test data with hand-calculable expected outcomes.
// Each dataset has a description of what it tests and why.

/**
 * Helper: generate N identical days starting from a given date.
 */
export function generateUniformDays(n, startDate, { afname, injectie, afnamedag = 0, afnamenacht = 0, injectiedag = 0, injectienacht = 0 } = {}) {
  const days = [];
  for (let i = 0; i < n; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    days.push({ date, afname, injectie, afnamedag, afnamenacht, injectiedag, injectienacht });
  }
  return days;
}

/**
 * Dataset 1: "Perfecte dag"
 * 365 identical days. Single tariff.
 * afname=10, injectie=8 per dag.
 *
 * With a 5 kWh battery (eff=0.90, price=3000):
 * - threshold (optimistic) = batCap = 5 kWh
 * - Every day: injectie(8) >= threshold(5) -> full charge
 * - dayCharged = batCap * eff = 5 * 0.90 = 4.5 kWh
 * - useCap=false (optimistic): dayUsable = 4.5 (no cap since 4.5 < afname 10)
 * - useCap=true (worst-case, threshold=5): dayUsable = min(4.5, 10) = 4.5
 * - qualifyingDays = 365, partialDays = 0
 * - annualCharged = 365 * 4.5 = 1642.5 kWh
 * - annualSaving = 1642.5 * 0.30 = 492.75 EUR
 * - payback = 3000 / 492.75 = ~6.09 years
 */
export const DATASET_PERFECT_DAY = {
  days: generateUniformDays(365, new Date(2024, 0, 1), { afname: 10, injectie: 8 }),
  config: { type: 'Test 5kWh', omschrijving: 'test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 },
  pvInv: 3,
  priceDay: 0.30,
  priceNight: NaN,
  expected: {
    optimistic: {
      qualifyingDays: 365,
      partialDays: 0,
      annualCharged: 1642.5,
      annualSaving: 492.75,
      payback: 3000 / 492.75,
    },
    worstCase: {
      qualifyingDays: 365,
      partialDays: 0,
      annualCharged: 1642.5,
      annualSaving: 492.75,
      payback: 3000 / 492.75,
    },
  },
};

/**
 * Dataset 2: "Worst-case cap bites"
 * 365 days. afname=3, injectie=8 per dag. Single tariff 0.30.
 * Battery: 5 kWh, eff=0.90, price=3000, batInv=3, pvInv=3.
 *
 * Optimistic (useCap=false, threshold=5):
 * - injectie(8) >= threshold(5) -> full day
 * - dayCharged = 5 * 0.90 = 4.5
 * - dayUsable = 4.5 (no cap)
 * - annualCharged = 365 * 4.5 = 1642.5
 * - annualSaving = 1642.5 * 0.30 = 492.75
 *
 * Worst-case (useCap=true, threshold=5):
 * - dayCharged = 4.5, but afname=3
 * - dayUsable = min(4.5, 3) = 3
 * - annualCharged = 365 * 3 = 1095
 * - annualSaving = 1095 * 0.30 = 328.50
 * - payback = 3000 / 328.50 = ~9.13
 */
export const DATASET_CAP_BITES = {
  days: generateUniformDays(365, new Date(2024, 0, 1), { afname: 3, injectie: 8 }),
  config: { type: 'Test 5kWh', omschrijving: 'test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 },
  pvInv: 3,
  priceDay: 0.30,
  priceNight: NaN,
  expected: {
    optimistic: {
      qualifyingDays: 365,
      partialDays: 0,
      annualCharged: 1642.5,
      annualSaving: 492.75,
      payback: 3000 / 492.75,
    },
    worstCase: {
      qualifyingDays: 365,
      partialDays: 0,
      annualCharged: 1095,
      annualSaving: 328.50,
      payback: 3000 / 328.50,
    },
  },
};

/**
 * Dataset 3: "Partial days"
 * 365 days. afname=10, injectie=3 per dag. Single tariff 0.30.
 * Battery: 5 kWh, eff=0.90, price=3000, batInv=3, pvInv=3.
 *
 * Optimistic (useCap=false, threshold=5):
 * - injectie(3) < threshold(5) -> partial day
 * - dayCharged = (3/5) * 5 * 0.90 = 2.7
 * - dayUsable = 2.7 (no cap, 2.7 < afname 10)
 * - qualifyingDays = 0, partialDays = 365
 * - annualCharged = 365 * 2.7 = 985.5
 * - annualSaving = 985.5 * 0.30 = 295.65
 */
export const DATASET_PARTIAL = {
  days: generateUniformDays(365, new Date(2024, 0, 1), { afname: 10, injectie: 3 }),
  config: { type: 'Test 5kWh', omschrijving: 'test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 },
  pvInv: 3,
  priceDay: 0.30,
  priceNight: NaN,
  expected: {
    optimistic: {
      qualifyingDays: 0,
      partialDays: 365,
      annualCharged: 985.5,
      annualSaving: 295.65,
      payback: 3000 / 295.65,
    },
  },
};

/**
 * Dataset 4: "Under a year - extrapolation"
 * 200 days of data. afname=10, injectie=8. Single tariff 0.30.
 * Battery: 5 kWh, eff=0.90, price=3000.
 *
 * scaleFactor = 365 / 200 = 1.825
 * isFullYear = false
 * Per-window: chargedFull = 200 * 4.5 = 900
 * annualChargedFull = 900 * 1.825 = 1642.5
 * annualSaving = 1642.5 * 0.30 = 492.75
 */
export const DATASET_UNDER_YEAR = {
  days: generateUniformDays(200, new Date(2024, 5, 1), { afname: 10, injectie: 8 }),
  config: { type: 'Test 5kWh', omschrijving: 'test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 },
  pvInv: 3,
  priceDay: 0.30,
  priceNight: NaN,
  expected: {
    isFullYear: false,
    scaleFactor: 365 / 200,
    optimistic: {
      annualCharged: 1642.5,
      annualSaving: 492.75,
    },
  },
};

/**
 * Dataset 5: "pvInverter > batteryInverter - threshold scaling"
 * 365 days. afname=10, injectie=6 per dag. Single tariff 0.30.
 * Battery: 5 kWh, batInv=3 kW, pvInv=6 kW, eff=0.90, price=3000.
 *
 * pvInv(6) > batInv(3) -> thresholdWC = batCap * (pvInv/batInv) = 5 * 2 = 10
 * thresholdOpt = batCap = 5
 *
 * Optimistic (threshold=5):
 * - injectie(6) >= 5 -> full: dayCharged = 5*0.9 = 4.5, dayUsable = 4.5
 * - annualCharged = 365 * 4.5 = 1642.5
 *
 * Worst-case (threshold=10, useCap=true):
 * - injectie(6) < 10 -> partial: dayCharged = (6/10)*5*0.9 = 2.7
 * - dayUsable = min(2.7, 10) = 2.7
 * - annualCharged = 365 * 2.7 = 985.5
 * - annualSaving = 985.5 * 0.30 = 295.65
 */
export const DATASET_PV_GT_BAT = {
  days: generateUniformDays(365, new Date(2024, 0, 1), { afname: 10, injectie: 6 }),
  config: { type: 'Test 5kWh', omschrijving: 'test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 },
  pvInv: 6,
  priceDay: 0.30,
  priceNight: NaN,
  expected: {
    optimistic: {
      qualifyingDays: 365,
      partialDays: 0,
      annualCharged: 1642.5,
      annualSaving: 492.75,
    },
    worstCase: {
      qualifyingDays: 0,
      partialDays: 365,
      annualCharged: 985.5,
      annualSaving: 295.65,
    },
  },
};

/**
 * Dataset 6: "Dual tariff"
 * 365 days. afnamedag=6, afnamenacht=4 (total afname=10).
 * injectiedag=5, injectienacht=3 (total injectie=8).
 * priceDay=0.35, priceNight=0.25.
 * Battery: 5 kWh, eff=0.90, price=3000, batInv=3, pvInv=3.
 *
 * effectivePrice = (afnamedag/afname)*priceDay + (afnamenacht/afname)*priceNight
 *                = (6/10)*0.35 + (4/10)*0.25
 *                = 0.21 + 0.10 = 0.31
 *
 * Optimistic (threshold=5, useCap=false):
 * - injectie(8) >= 5 -> full: dayCharged = 4.5
 * - annualCharged = 365 * 4.5 = 1642.5
 * - annualSaving = 1642.5 * 0.31 = 509.175
 */
export const DATASET_DUAL_TARIFF = {
  days: generateUniformDays(365, new Date(2024, 0, 1), {
    afname: 10, injectie: 8,
    afnamedag: 6, afnamenacht: 4,
    injectiedag: 5, injectienacht: 3,
  }),
  config: { type: 'Test 5kWh', omschrijving: 'test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 },
  pvInv: 3,
  priceDay: 0.35,
  priceNight: 0.25,
  expected: {
    effectivePrice: 0.31,
    optimistic: {
      annualCharged: 1642.5,
      annualSaving: 509.175,
      payback: 3000 / 509.175,
    },
  },
};
