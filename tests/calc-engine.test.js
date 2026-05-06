// ─── CALC ENGINE TESTS ─────────────────────────────────────────────────────────
// Logic-first tests that validate EXPECTED LOGICAL OUTPUT (hand-calculated),
// not current code behavior.

import { describe, it, expect } from 'vitest';
import {
  calcScenario,
  processDataPure,
  computePerYearStats,
  averageStats,
  validateCalcInputs,
  VALIDATION_BOUNDS,
} from '../assets/js/calc-engine.js';
import {
  DATASET_PERFECT_DAY,
  DATASET_CAP_BITES,
  DATASET_PARTIAL,
  DATASET_UNDER_YEAR,
  DATASET_PV_GT_BAT,
  DATASET_DUAL_TARIFF,
  generateUniformDays,
} from './fixtures/synthetic-data.js';

// ─── CALC SCENARIO TESTS ───────────────────────────────────────────────────────

describe('calcScenario', () => {
  it('computes annual saving correctly for uniform full-charge days', () => {
    const { days, config, priceDay, expected } = DATASET_PERFECT_DAY;
    const totalAfname = days.reduce((s, d) => s + d.afname, 0);
    const totalInjectie = days.reduce((s, d) => s + d.injectie, 0);

    const result = calcScenario(days, {
      threshold: config.batCap,
      installPrice: config.price,
      batCap: config.batCap,
      eff: config.eff,
      useCap: false,
      scaleFactor: 1,
      effectivePrice: priceDay,
      totalAfname,
      totalInjectie,
      pvInverter: DATASET_PERFECT_DAY.pvInv,
      batteryInverter: config.batInv,
    });

    expect(result.qualifyingDays).toBe(expected.optimistic.qualifyingDays);
    expect(result.partialDays).toBe(expected.optimistic.partialDays);
    expect(result.annualCharged).toBeCloseTo(expected.optimistic.annualCharged, 2);
    expect(result.annualSaving).toBeCloseTo(expected.optimistic.annualSaving, 2);
    expect(result.payback).toBeCloseTo(expected.optimistic.payback, 2);
  });

  it('worst-case caps daily savings at daily consumption', () => {
    const { days, config, priceDay, expected } = DATASET_CAP_BITES;
    const totalAfname = days.reduce((s, d) => s + d.afname, 0);
    const totalInjectie = days.reduce((s, d) => s + d.injectie, 0);

    const result = calcScenario(days, {
      threshold: config.batCap,
      installPrice: config.price,
      batCap: config.batCap,
      eff: config.eff,
      useCap: true,
      scaleFactor: 1,
      effectivePrice: priceDay,
      totalAfname,
      totalInjectie,
      pvInverter: DATASET_CAP_BITES.pvInv,
      batteryInverter: config.batInv,
    });

    expect(result.qualifyingDays).toBe(expected.worstCase.qualifyingDays);
    expect(result.partialDays).toBe(expected.worstCase.partialDays);
    expect(result.annualCharged).toBeCloseTo(expected.worstCase.annualCharged, 2);
    expect(result.annualSaving).toBeCloseTo(expected.worstCase.annualSaving, 2);
    expect(result.payback).toBeCloseTo(expected.worstCase.payback, 2);
  });

  it('handles partial days correctly', () => {
    const { days, config, priceDay, expected } = DATASET_PARTIAL;
    const totalAfname = days.reduce((s, d) => s + d.afname, 0);
    const totalInjectie = days.reduce((s, d) => s + d.injectie, 0);

    const result = calcScenario(days, {
      threshold: config.batCap,
      installPrice: config.price,
      batCap: config.batCap,
      eff: config.eff,
      useCap: false,
      scaleFactor: 1,
      effectivePrice: priceDay,
      totalAfname,
      totalInjectie,
      pvInverter: DATASET_PARTIAL.pvInv,
      batteryInverter: config.batInv,
    });

    expect(result.qualifyingDays).toBe(expected.optimistic.qualifyingDays);
    expect(result.partialDays).toBe(expected.optimistic.partialDays);
    expect(result.annualCharged).toBeCloseTo(expected.optimistic.annualCharged, 2);
    expect(result.annualSaving).toBeCloseTo(expected.optimistic.annualSaving, 2);
    expect(result.payback).toBeCloseTo(expected.optimistic.payback, 2);
  });

  it('applies scaleFactor for extrapolation < 365 days', () => {
    const { days, config, priceDay, expected } = DATASET_UNDER_YEAR;
    const totalAfname = days.reduce((s, d) => s + d.afname, 0);
    const totalInjectie = days.reduce((s, d) => s + d.injectie, 0);
    const scaleFactor = expected.scaleFactor;

    const result = calcScenario(days, {
      threshold: config.batCap,
      installPrice: config.price,
      batCap: config.batCap,
      eff: config.eff,
      useCap: false,
      scaleFactor,
      effectivePrice: priceDay,
      totalAfname,
      totalInjectie,
      pvInverter: DATASET_UNDER_YEAR.pvInv,
      batteryInverter: config.batInv,
    });

    expect(result.annualCharged).toBeCloseTo(expected.optimistic.annualCharged, 2);
    expect(result.annualSaving).toBeCloseTo(expected.optimistic.annualSaving, 2);
  });

  it('scales threshold when pvInverter > batteryInverter', () => {
    const { days, config, pvInv, priceDay, expected } = DATASET_PV_GT_BAT;
    const totalAfname = days.reduce((s, d) => s + d.afname, 0);
    const totalInjectie = days.reduce((s, d) => s + d.injectie, 0);

    // Worst-case: scaled threshold
    const thresholdWC = config.batCap * (pvInv / config.batInv);
    const resultWC = calcScenario(days, {
      threshold: thresholdWC,
      installPrice: config.price,
      batCap: config.batCap,
      eff: config.eff,
      useCap: true,
      scaleFactor: 1,
      effectivePrice: priceDay,
      totalAfname,
      totalInjectie,
      pvInverter: pvInv,
      batteryInverter: config.batInv,
    });

    expect(resultWC.qualifyingDays).toBe(expected.worstCase.qualifyingDays);
    expect(resultWC.partialDays).toBe(expected.worstCase.partialDays);
    expect(resultWC.annualCharged).toBeCloseTo(expected.worstCase.annualCharged, 2);
    expect(resultWC.annualSaving).toBeCloseTo(expected.worstCase.annualSaving, 2);

    // Optimistic: unscaled threshold
    const resultOpt = calcScenario(days, {
      threshold: config.batCap,
      installPrice: config.price,
      batCap: config.batCap,
      eff: config.eff,
      useCap: false,
      scaleFactor: 1,
      effectivePrice: priceDay,
      totalAfname,
      totalInjectie,
      pvInverter: pvInv,
      batteryInverter: config.batInv,
    });

    expect(resultOpt.qualifyingDays).toBe(expected.optimistic.qualifyingDays);
    expect(resultOpt.annualCharged).toBeCloseTo(expected.optimistic.annualCharged, 2);
  });

  it('computes effective price for dual tariff', () => {
    const { days, config, priceDay, priceNight, expected } = DATASET_DUAL_TARIFF;
    const totalAfname = days.reduce((s, d) => s + d.afname, 0);
    const totalAfnamedag = days.reduce((s, d) => s + d.afnamedag, 0);
    const totalAfnamenacht = days.reduce((s, d) => s + d.afnamenacht, 0);
    const totalInjectie = days.reduce((s, d) => s + d.injectie, 0);

    const effectivePrice = (totalAfnamedag / totalAfname) * priceDay + (totalAfnamenacht / totalAfname) * priceNight;
    expect(effectivePrice).toBeCloseTo(expected.effectivePrice, 2);

    const result = calcScenario(days, {
      threshold: config.batCap,
      installPrice: config.price,
      batCap: config.batCap,
      eff: config.eff,
      useCap: false,
      scaleFactor: 1,
      effectivePrice,
      totalAfname,
      totalInjectie,
      pvInverter: DATASET_DUAL_TARIFF.pvInv,
      batteryInverter: config.batInv,
    });

    expect(result.annualCharged).toBeCloseTo(expected.optimistic.annualCharged, 2);
    expect(result.annualSaving).toBeCloseTo(expected.optimistic.annualSaving, 2);
    expect(result.payback).toBeCloseTo(expected.optimistic.payback, 2);
  });

  it('efficiency: annualSaving = annualCharged * effectivePrice', () => {
    const { days, config, priceDay } = DATASET_PERFECT_DAY;
    const totalAfname = days.reduce((s, d) => s + d.afname, 0);
    const totalInjectie = days.reduce((s, d) => s + d.injectie, 0);

    const result = calcScenario(days, {
      threshold: config.batCap,
      installPrice: config.price,
      batCap: config.batCap,
      eff: config.eff,
      useCap: false,
      scaleFactor: 1,
      effectivePrice: priceDay,
      totalAfname,
      totalInjectie,
      pvInverter: DATASET_PERFECT_DAY.pvInv,
      batteryInverter: config.batInv,
    });

    expect(result.annualSaving).toBeCloseTo(result.annualCharged * priceDay, 2);
  });
});

// ─── PROCESS DATA PURE TESTS ───────────────────────────────────────────────────

describe('processDataPure', () => {
  it('returns null for empty input', () => {
    const result = processDataPure({ allDays: [], eanCode: '', meterNr: '', meterType: '' }, 3, [], 0.30, NaN);
    expect(result).toBeNull();
  });

  it('returns correct shape (has isFullYear, configResults, capAnalysis)', () => {
    const { days, config, pvInv, priceDay, priceNight } = DATASET_PERFECT_DAY;
    const input = { allDays: days, eanCode: 'TEST123', meterNr: 'M1', meterType: 'DIGITAL' };
    const result = processDataPure(input, pvInv, [config], priceDay, priceNight);

    expect(result).not.toBeNull();
    expect(result).toHaveProperty('isFullYear');
    expect(result).toHaveProperty('configResults');
    expect(result).toHaveProperty('capAnalysis');
    expect(result.configResults).toBeInstanceOf(Array);
    expect(result.capAnalysis).toHaveProperty('rows');
    expect(result.capAnalysis).toHaveProperty('maxCap');
  });

  it('marks isFullYear=false for < 365 days', () => {
    const { days, config, pvInv, priceDay, priceNight } = DATASET_UNDER_YEAR;
    const input = { allDays: days, eanCode: 'TEST123', meterNr: 'M1', meterType: 'DIGITAL' };
    const result = processDataPure(input, pvInv, [config], priceDay, priceNight);

    expect(result).not.toBeNull();
    expect(result.isFullYear).toBe(false);
    expect(result.daysInWindow).toBe(200);
  });

  it('totalAfname equals sum of windowDays', () => {
    const { days, config, pvInv, priceDay, priceNight } = DATASET_PERFECT_DAY;
    const input = { allDays: days, eanCode: 'TEST123', meterNr: 'M1', meterType: 'DIGITAL' };
    const result = processDataPure(input, pvInv, [config], priceDay, priceNight);

    const expectedTotalAfname = days.reduce((s, d) => s + d.afname, 0);
    expect(result.totalAfname).toBeCloseTo(expectedTotalAfname, 2);
  });

  it('configResults contain scenWC and scenOpt', () => {
    const { days, config, pvInv, priceDay, priceNight } = DATASET_PERFECT_DAY;
    const input = { allDays: days, eanCode: 'TEST123', meterNr: 'M1', meterType: 'DIGITAL' };
    const result = processDataPure(input, pvInv, [config], priceDay, priceNight);

    expect(result.configResults).toHaveLength(1);
    const cr = result.configResults[0];
    expect(cr).toHaveProperty('scenWC');
    expect(cr).toHaveProperty('scenOpt');
    expect(cr.scenWC).toHaveProperty('annualSaving');
    expect(cr.scenOpt).toHaveProperty('annualSaving');
  });

  it('computes effective price correctly for dual tariff', () => {
    const { days, config, pvInv, priceDay, priceNight, expected } = DATASET_DUAL_TARIFF;
    const input = { allDays: days, eanCode: 'TEST123', meterNr: 'M1', meterType: 'DIGITAL' };
    const result = processDataPure(input, pvInv, [config], priceDay, priceNight);

    expect(result.dualTariff).toBe(true);
    expect(result.effectivePrice).toBeCloseTo(expected.effectivePrice, 2);
  });
});

// ─── COMPUTE PER YEAR STATS TESTS ──────────────────────────────────────────────

describe('computePerYearStats', () => {
  it('returns numYears=0 for < 365 days', () => {
    const { days, pvInv, config, priceDay, priceNight } = DATASET_UNDER_YEAR;
    const lastDate = days[days.length - 1].date;
    const result = computePerYearStats(days, pvInv, [config], lastDate, priceDay, priceNight);

    expect(result.numYears).toBe(0);
    expect(result.perYear).toEqual([]);
    expect(result.yearsStart).toBeNull();
  });

  it('splits 730 days into 2 year-blocks', () => {
    const days = generateUniformDays(730, new Date(2023, 0, 1), { afname: 10, injectie: 8 });
    const config = { type: 'Test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 };
    const lastDate = days[days.length - 1].date;
    const result = computePerYearStats(days, 3, [config], lastDate, 0.30, NaN);

    expect(result.numYears).toBe(2);
    expect(result.perYear).toHaveLength(2);
    expect(result.perYear[0].afname).toBeCloseTo(3650, 1); // 365 days * 10 kWh
    expect(result.perYear[1].afname).toBeCloseTo(3650, 1);
  });

  it('each year has scenarios array matching selectedConfigs length', () => {
    const days = generateUniformDays(730, new Date(2023, 0, 1), { afname: 10, injectie: 8 });
    const configs = [
      { type: 'A', batCap: 5, batInv: 3, eff: 0.90, price: 3000 },
      { type: 'B', batCap: 10, batInv: 5, eff: 0.92, price: 5000 },
    ];
    const lastDate = days[days.length - 1].date;
    const result = computePerYearStats(days, 3, configs, lastDate, 0.30, NaN);

    expect(result.perYear).toHaveLength(2);
    expect(result.perYear[0].scenarios).toHaveLength(2);
    expect(result.perYear[1].scenarios).toHaveLength(2);
    expect(result.perYear[0].scenarios[0]).toHaveProperty('scenWC');
    expect(result.perYear[0].scenarios[0]).toHaveProperty('scenOpt');
  });

  it('perYear[0] is the most recent year', () => {
    const days = generateUniformDays(730, new Date(2023, 0, 1), { afname: 10, injectie: 8 });
    const config = { type: 'Test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 };
    const lastDate = days[days.length - 1].date;
    const result = computePerYearStats(days, 3, [config], lastDate, 0.30, NaN);

    const mostRecentYear = result.perYear[0];
    // Most recent year ends at lastDate
    expect(mostRecentYear.windowEnd.getTime()).toBe(lastDate.getTime());
  });
});

// ─── AVERAGE STATS TESTS ───────────────────────────────────────────────────────

describe('averageStats', () => {
  it('returns null for empty perYear', () => {
    const result = averageStats([], []);
    expect(result).toBeNull();
  });

  it('averages totalAfname over N years', () => {
    const days = generateUniformDays(730, new Date(2023, 0, 1), { afname: 10, injectie: 8 });
    const config = { type: 'Test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 };
    const lastDate = days[days.length - 1].date;
    const py = computePerYearStats(days, 3, [config], lastDate, 0.30, NaN);

    const result = averageStats(py.perYear, [config]);
    expect(result).not.toBeNull();
    expect(result.totalAfname).toBeCloseTo(3650, 1); // (3650 + 3650) / 2
  });

  it('computes avgPayback from avgAnnualSaving', () => {
    const days = generateUniformDays(730, new Date(2023, 0, 1), { afname: 10, injectie: 8 });
    const config = { type: 'Test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 };
    const lastDate = days[days.length - 1].date;
    const py = computePerYearStats(days, 3, [config], lastDate, 0.30, NaN);

    const result = averageStats(py.perYear, [config]);
    const scenWCAvg = result.scenarios[0].scenWCAvg;

    expect(scenWCAvg.payback).toBeCloseTo(config.price / scenWCAvg.annualSaving, 2);
  });

  it('scenarios array length matches selectedConfigs', () => {
    const days = generateUniformDays(730, new Date(2023, 0, 1), { afname: 10, injectie: 8 });
    const configs = [
      { type: 'A', batCap: 5, batInv: 3, eff: 0.90, price: 3000 },
      { type: 'B', batCap: 10, batInv: 5, eff: 0.92, price: 5000 },
    ];
    const lastDate = days[days.length - 1].date;
    const py = computePerYearStats(days, 3, configs, lastDate, 0.30, NaN);

    const result = averageStats(py.perYear, configs);
    expect(result.scenarios).toHaveLength(2);
    expect(result.scenarios[0]).toHaveProperty('scenWCAvg');
    expect(result.scenarios[0]).toHaveProperty('scenOptAvg');
  });

  it('recoveryPct computed FROM averages, not mean of yearly values', () => {
    const days = generateUniformDays(730, new Date(2023, 0, 1), { afname: 10, injectie: 8 });
    const config = { type: 'Test', batCap: 5, batInv: 3, eff: 0.90, price: 3000 };
    const lastDate = days[days.length - 1].date;
    const py = computePerYearStats(days, 3, [config], lastDate, 0.30, NaN);

    const result = averageStats(py.perYear, [config]);
    const scenWCAvg = result.scenarios[0].scenWCAvg;

    // Recovery% = (avgChargedFull / totalAfname) * 100
    const expectedRecoveryFull = (scenWCAvg.chargedFull / result.totalAfname) * 100;
    expect(scenWCAvg.recoveryPctFull).toBeCloseTo(expectedRecoveryFull, 2);
  });
});

// ─── VALIDATION TESTS ─────────────────────────────────────────────────────────

const VALID_CONFIGS = [
  { type: 'TestBat', batCap: 10, batInv: 5, eff: 0.9, price: 5000 },
];

describe('validateCalcInputs', () => {
  it('returns empty array for valid inputs', () => {
    const errors = validateCalcInputs(5, 0.30, NaN, VALID_CONFIGS);
    expect(errors).toEqual([]);
  });

  it('returns empty array with valid dual tariff', () => {
    const errors = validateCalcInputs(5, 0.30, 0.18, VALID_CONFIGS);
    expect(errors).toEqual([]);
  });

  it('rejects NaN pvInverter', () => {
    const errors = validateCalcInputs(NaN, 0.30, NaN, VALID_CONFIGS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Omvormer vermogen');
  });

  it('rejects pvInverter below minimum', () => {
    const errors = validateCalcInputs(0.01, 0.30, NaN, VALID_CONFIGS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('0.1');
  });

  it('rejects pvInverter above maximum', () => {
    const errors = validateCalcInputs(150, 0.30, NaN, VALID_CONFIGS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('100');
  });

  it('rejects NaN priceDay', () => {
    const errors = validateCalcInputs(5, NaN, NaN, VALID_CONFIGS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Dagtarief');
  });

  it('rejects priceDay above maximum', () => {
    const errors = validateCalcInputs(5, 5.00, NaN, VALID_CONFIGS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('2');
  });

  it('rejects priceDay below minimum', () => {
    const errors = validateCalcInputs(5, 0.001, NaN, VALID_CONFIGS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('0.01');
  });

  it('rejects priceNight above maximum when specified', () => {
    const errors = validateCalcInputs(5, 0.30, 3.00, VALID_CONFIGS);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Nachttarief');
  });

  it('accepts priceNight = NaN (single tariff)', () => {
    const errors = validateCalcInputs(5, 0.30, NaN, VALID_CONFIGS);
    expect(errors).toEqual([]);
  });

  it('accepts priceNight = 0 (single tariff)', () => {
    const errors = validateCalcInputs(5, 0.30, 0, VALID_CONFIGS);
    expect(errors).toEqual([]);
  });

  it('rejects config with zero batInv (division by zero risk)', () => {
    const badConfigs = [{ type: 'Bad', batCap: 10, batInv: 0, eff: 0.9, price: 5000 }];
    const errors = validateCalcInputs(5, 0.30, NaN, badConfigs);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('batterij omvormer');
  });

  it('rejects config with zero batCap', () => {
    const badConfigs = [{ type: 'Bad', batCap: 0, batInv: 5, eff: 0.9, price: 5000 }];
    const errors = validateCalcInputs(5, 0.30, NaN, badConfigs);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('capaciteit');
  });

  it('rejects config with efficiency > 1', () => {
    const badConfigs = [{ type: 'Bad', batCap: 10, batInv: 5, eff: 1.5, price: 5000 }];
    const errors = validateCalcInputs(5, 0.30, NaN, badConfigs);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('rendement');
  });

  it('rejects config with zero efficiency', () => {
    const badConfigs = [{ type: 'Bad', batCap: 10, batInv: 5, eff: 0, price: 5000 }];
    const errors = validateCalcInputs(5, 0.30, NaN, badConfigs);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('rendement');
  });

  it('accumulates multiple errors', () => {
    const badConfigs = [{ type: 'Bad', batCap: 0, batInv: 0, eff: 0, price: 5000 }];
    const errors = validateCalcInputs(NaN, NaN, 5.0, badConfigs);
    // NaN pvInv + NaN priceDay + bad priceNight + 3 config errors = 6
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });

  it('handles empty config array', () => {
    const errors = validateCalcInputs(5, 0.30, NaN, []);
    expect(errors).toEqual([]);
  });

  it('handles null config array', () => {
    const errors = validateCalcInputs(5, 0.30, NaN, null);
    expect(errors).toEqual([]);
  });
});

describe('VALIDATION_BOUNDS', () => {
  it('has expected keys', () => {
    expect(VALIDATION_BOUNDS).toHaveProperty('pvInverterKw');
    expect(VALIDATION_BOUNDS).toHaveProperty('priceDay');
    expect(VALIDATION_BOUNDS).toHaveProperty('priceNight');
    expect(VALIDATION_BOUNDS).toHaveProperty('batteryCapKwh');
    expect(VALIDATION_BOUNDS).toHaveProperty('batteryInvKw');
    expect(VALIDATION_BOUNDS).toHaveProperty('efficiency');
  });

  it('each bound has min, max, and label', () => {
    for (const [key, bound] of Object.entries(VALIDATION_BOUNDS)) {
      expect(bound).toHaveProperty('min');
      expect(bound).toHaveProperty('max');
      expect(bound).toHaveProperty('label');
      expect(bound.min).toBeLessThan(bound.max);
    }
  });
});

describe('processDataPure defensive guard', () => {
  it('filters out configs with zero batInv instead of crashing', () => {
    const { days, priceDay } = DATASET_PERFECT_DAY;
    const badConfig = { type: 'ZeroBatInv', batCap: 10, batInv: 0, eff: 0.9, price: 5000 };
    const goodConfig = { type: 'Good', batCap: 10, batInv: 5, eff: 0.9, price: 5000 };

    const result = processDataPure(
      { allDays: days, eanCode: '', meterNr: '', meterType: '' },
      5, [badConfig, goodConfig], priceDay, NaN
    );

    // Should not crash, and should have only the valid config in results
    expect(result).not.toBeNull();
    expect(result.configResults).toHaveLength(1);
    expect(result.configResults[0].cfg.type).toBe('Good');
  });

  it('returns empty configResults when all configs are invalid', () => {
    const { days, priceDay } = DATASET_PERFECT_DAY;
    const badConfig = { type: 'ZeroBatInv', batCap: 10, batInv: 0, eff: 0.9, price: 5000 };

    const result = processDataPure(
      { allDays: days, eanCode: '', meterNr: '', meterType: '' },
      5, [badConfig], priceDay, NaN
    );

    expect(result).not.toBeNull();
    expect(result.configResults).toHaveLength(0);
  });
});
