// ─── CALC ENGINE ───────────────────────────────────────────────────────────────
// Pure calculation functions extracted from index.html.
// All functions are DOM-free and testable.

import { parseCSV, parseDate, parsVolume } from './csv.js';

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────

export const CALC_CONSTANTS = {
  CAP_SWEEP_STEP: 2.5,
  CAP_SWEEP_MAX: 200,
  CAP_SWEEP_QUALIFYING_DAYS_THRESHOLD: 100,
  CAP_SWEEP_STOP_AFTER_STEPS: 3,
};

export const MONTH_NL_FULL = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
];

// ─── FORMATTERS ────────────────────────────────────────────────────────────────

export function formatDate(d) {
  return d.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmt2(n) {
  return n.toFixed(2);
}

export function fmtEur(n) {
  return '€\u00a0' + n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Render a value with an optional "· gem. N j: <avg>" companion.
// formatter: function (number) -> string. numYears: integer. avgValue: number | null | undefined.
// When numYears < 2 or avgValue is null/undefined/NaN, returns just formatter(currentValue).
export function renderWithAvg(currentValue, avgValue, formatter, numYears) {
  const cur = formatter(currentValue);
  if (!numYears || numYears < 2 || avgValue == null || (typeof avgValue === 'number' && isNaN(avgValue))) return cur;
  return cur + `<span class="muted-inline">· gem. ${numYears} j: ${formatter(avgValue)}</span>`;
}

// ─── CONFIG PARSING ────────────────────────────────────────────────────────────

export function parseCSVLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

export function parseEurAmount(str) {
  return parseFloat((str || '').replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
}

export function parseSheetConfigs(csvText) {
  const lines = csvText.trim().split('\n');
  const header = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const cols = parseCSVLine(line);
    const o = {};
    header.forEach((h, i) => { o[h] = (cols[i] || '').replace(/^"|"$/g, '').trim(); });
    return {
      type:        o['type'],
      omschrijving:o['omschrijving'],
      batCap:      parseFloat(o['nuttig opslag'].replace(',', '.')),
      batInv:      parseFloat(o['omvorm vermogen'].replace(',', '.')),
      eff:         parseFloat(o['efficientie']) / 100,
      prices: {
        '6_no':   parseEurAmount(o['prijs install 6%']),
        '6_yes':  parseEurAmount(o['prijs install en keuring 6%']),
        '21_no':  parseEurAmount(o['prijs install 21%']),
        '21_yes': parseEurAmount(o['prijs install en keuring 21%']),
      }
    };
  }).filter(c => c.type && !isNaN(c.batCap));
}

// ─── CSV → allDays ─────────────────────────────────────────────────────────────

// Extract allDays + meter metadata from raw Fluvius CSV text.
// Returns { allDays, eanCode, meterNr, meterType }.
export function csvToAllDaysAndMeta(csvText) {
  const rows = parseCSV(csvText);

  let eanCode = '', meterNr = '', meterType = '';
  for (const row of rows) {
    if (row['EAN-code'] && !eanCode) {
      eanCode   = row['EAN-code'].replace(/^="?|"?=$/g, '').replace(/"/g, '').replace(/=/g, '');
      meterNr   = row['Meter']     || '';
      meterType = row['Metertype'] || '';
      break;
    }
  }

  const dayMap = {};
  for (const row of rows) {
    const dateStr = row['Van (datum)'];
    if (!dateStr) continue;
    const date = parseDate(dateStr);
    if (!date) continue; // skip rows with unparseable dates
    const key = date.toISOString().slice(0, 10);
    if (!dayMap[key]) dayMap[key] = { date, afname: 0, injectie: 0, afnamedag: 0, afnamenacht: 0, injectiedag: 0, injectienacht: 0 };
    const register = (row['Register'] || '').toLowerCase();
    const vol = parsVolume(row['Volume']);
    if (register.includes('afname'))   dayMap[key].afname   += vol;
    if (register.includes('injectie')) dayMap[key].injectie += vol;
    if (register === 'afname dag')      dayMap[key].afnamedag    += vol;
    if (register === 'afname nacht')    dayMap[key].afnamenacht  += vol;
    if (register === 'injectie dag')    dayMap[key].injectiedag  += vol;
    if (register === 'injectie nacht')  dayMap[key].injectienacht += vol;
  }

  const allDays = Object.values(dayMap).sort((a, b) => a.date - b.date);
  return { allDays, eanCode, meterNr, meterType };
}

// Rebuild allDays array from a project's dailyCompact (Firestore-stored per-day data).
// Mirrors the restore-path in _restoreState.
export function buildAllDaysFromDailyCompact(dc) {
  const start = new Date(dc.startDate + 'T00:00:00');
  return dc.afname.map((af, i) => {
    const date = new Date(start); date.setDate(date.getDate() + i);
    return {
      date,
      afname: af,
      injectie: dc.injectie[i],
      afnamedag: dc.afnamedag[i],
      afnamenacht: dc.afnamenacht[i],
      injectiedag: dc.injectiedag[i],
      injectienacht: dc.injectienacht[i],
    };
  });
}

// ─── CORE CALCULATION ──────────────────────────────────────────────────────────

// Calculate a single scenario for one config + threshold.
// windowDays: array of per-day objects with { date, afname, injectie, ... }.
// opts: { threshold, installPrice, batCap, eff, useCap, scaleFactor, effectivePrice, totalAfname, totalInjectie, pvInverter, batteryInverter }.
export function calcScenario(windowDays, opts) {
  const { threshold, installPrice, batCap, eff, useCap, scaleFactor, effectivePrice, totalAfname, totalInjectie } = opts;

  let qualifyingDays = 0, partialDays = 0, chargedFull = 0, chargedPartial = 0;
  for (const d of windowDays) {
    let dayCharged = 0, isFull = false;
    if (d.injectie >= threshold) {
      isFull = true;
      dayCharged = batCap * eff;
    } else if (d.injectie > 0) {
      dayCharged = (d.injectie / threshold) * batCap * eff;
    } else {
      continue;
    }
    const dayUsable = useCap ? Math.min(dayCharged, d.afname) : dayCharged;
    if (isFull) { qualifyingDays++; chargedFull    += dayUsable; }
    else        { partialDays++;    chargedPartial += dayUsable; }
  }
  const annualChargedFull    = chargedFull    * scaleFactor;
  const annualChargedPartial = chargedPartial * scaleFactor;
  const annualCharged        = (chargedFull + chargedPartial) * scaleFactor;
  const annualSaving         = annualCharged  * effectivePrice;
  const annualSavingFull     = annualChargedFull    * effectivePrice;
  const annualSavingPartial  = annualChargedPartial * effectivePrice;
  const payback              = installPrice > 0 ? installPrice / annualSaving : Infinity;
  const recoveryPctFull    = (chargedFull    / (totalAfname    || 1)) * 100 * scaleFactor;
  const recoveryPctPartial = (chargedPartial / (totalAfname    || 1)) * 100 * scaleFactor;
  const injPctFull         = (chargedFull    / eff / (totalInjectie || 1)) * 100 * scaleFactor;
  const injPctPartial      = (chargedPartial / eff / (totalInjectie || 1)) * 100 * scaleFactor;
  return {
    qualifyingDays, partialDays, chargedFull, chargedPartial,
    annualChargedFull, annualChargedPartial, annualCharged,
    annualSavingFull, annualSavingPartial, annualSaving,
    payback, recoveryPctFull, recoveryPctPartial,
    injPctFull, injPctPartial, threshold
  };
}

// ─── MULTI-YEAR ────────────────────────────────────────────────────────────────

// Slice allDays into N complete 365-day blocks counting backward from lastDate.
// Returns { numYears, yearsStart, perYear } where perYear[0] is the most recent year.
// numYears = floor((lastDate - firstDate + 1) / 365). When numYears < 1, returns
// { numYears: 0, yearsStart: null, perYear: [] } and callers should fall back to
// existing single-window behavior.
export function computePerYearStats(allDays, pvInv, selectedConfigs, lastDate, priceDay, priceNight) {
  if (!allDays.length) return { numYears: 0, yearsStart: null, perYear: [] };
  const firstDate = allDays[0].date;
  const spanDays  = Math.floor((lastDate - firstDate) / 86400000) + 1;
  const numYears  = Math.floor(spanDays / 365);
  if (numYears < 1) return { numYears: 0, yearsStart: null, perYear: [] };

  const dualTariff = !isNaN(priceNight) && priceNight > 0;
  const perYear = [];
  for (let k = 1; k <= numYears; k++) {
    const winEnd   = new Date(lastDate); winEnd.setDate(winEnd.getDate() - 365 * (k - 1));
    const winStart = new Date(lastDate); winStart.setDate(winStart.getDate() - 365 * k + 1);
    const days = allDays.filter(d => d.date >= winStart && d.date <= winEnd);

    const sums = days.reduce((s, d) => ({
      afname:        s.afname        + d.afname,
      injectie:      s.injectie      + d.injectie,
      afnamedag:     s.afnamedag     + d.afnamedag,
      afnamenacht:   s.afnamenacht   + d.afnamenacht,
      injectiedag:   s.injectiedag   + d.injectiedag,
      injectienacht: s.injectienacht + d.injectienacht,
    }), { afname:0, injectie:0, afnamedag:0, afnamenacht:0, injectiedag:0, injectienacht:0 });

    const effectivePrice = (dualTariff && sums.afname > 0)
      ? (sums.afnamedag / sums.afname) * priceDay + (sums.afnamenacht / sums.afname) * priceNight
      : priceDay;

    const scenarios = selectedConfigs.map(cfg => {
      const pvGtBat     = pvInv > cfg.batInv;
      const thresholdWC = pvGtBat ? cfg.batCap * (pvInv / cfg.batInv) : cfg.batCap;
      const thresholdOpt= cfg.batCap;
      function calc(threshold, useCap) {
        let qualifyingDays = 0, partialDays = 0, chargedFull = 0, chargedPartial = 0;
        for (const d of days) {
          let dayCharged = 0, isFull = false;
          if (d.injectie >= threshold) { isFull = true; dayCharged = cfg.batCap * cfg.eff; }
          else if (d.injectie > 0)     { dayCharged = (d.injectie / threshold) * cfg.batCap * cfg.eff; }
          else { continue; }
          const dayUsable = useCap ? Math.min(dayCharged, d.afname) : dayCharged;
          if (isFull) { qualifyingDays++; chargedFull    += dayUsable; }
          else        { partialDays++;    chargedPartial += dayUsable; }
        }
        const annualSavingFull    = chargedFull    * effectivePrice;
        const annualSavingPartial = chargedPartial * effectivePrice;
        const annualSaving        = annualSavingFull + annualSavingPartial;
        const payback             = cfg.price > 0 ? cfg.price / annualSaving : Infinity;
        const recoveryPctFull     = (chargedFull    / (sums.afname    || 1)) * 100;
        const recoveryPctPartial  = (chargedPartial / (sums.afname    || 1)) * 100;
        const injPctFull          = (chargedFull    / cfg.eff / (sums.injectie || 1)) * 100;
        const injPctPartial       = (chargedPartial / cfg.eff / (sums.injectie || 1)) * 100;
        return {
          qualifyingDays, partialDays, chargedFull, chargedPartial,
          annualSavingFull, annualSavingPartial, annualSaving, payback,
          recoveryPctFull, recoveryPctPartial, injPctFull, injPctPartial,
          threshold,
        };
      }
      return { scenWC: calc(thresholdWC, true), scenOpt: calc(thresholdOpt, false) };
    });

    perYear.push({ windowStart: winStart, windowEnd: winEnd, ...sums, effectivePrice, scenarios });
  }

  const yearsStart = perYear[perYear.length - 1].windowStart;
  return { numYears, yearsStart, perYear };
}

// Average across all per-year stats. For derived metrics (payback, recovery%),
// compute FROM averages (avgPayback = installPrice / avgAnnualSaving), not
// the mean of yearly derivatives. Returns null when perYear.length < 1.
export function averageStats(perYear, selectedConfigs) {
  if (!perYear.length) return null;
  const N = perYear.length;
  const mean = key => perYear.reduce((s, y) => s + y[key], 0) / N;
  const totalAfname        = mean('afname');
  const totalInjectie      = mean('injectie');
  const totalAfnamedag     = mean('afnamedag');
  const totalAfnamenacht   = mean('afnamenacht');
  const totalInjectiedag   = mean('injectiedag');
  const totalInjectienacht = mean('injectienacht');
  const effectivePrice     = mean('effectivePrice');

  const scenarios = selectedConfigs.map((cfg, i) => {
    function avgScen(scenKey) {
      const arr = perYear.map(y => y.scenarios[i][scenKey]).filter(sc => sc !== null);
      if (!arr.length) return null;
      const m = key => arr.reduce((s, sc) => s + sc[key], 0) / arr.length;
      const avgChargedFull    = m('chargedFull');
      const avgChargedPartial = m('chargedPartial');
      const avgAnnualSavingFull    = m('annualSavingFull');
      const avgAnnualSavingPartial = m('annualSavingPartial');
      const avgAnnualSaving        = m('annualSaving');
      return {
        qualifyingDays: m('qualifyingDays'),
        partialDays:    m('partialDays'),
        chargedFull:    avgChargedFull,
        chargedPartial: avgChargedPartial,
        annualSavingFull:    avgAnnualSavingFull,
        annualSavingPartial: avgAnnualSavingPartial,
        annualSaving:        avgAnnualSaving,
        payback:             cfg.price > 0 && avgAnnualSaving > 0 ? cfg.price / avgAnnualSaving : Infinity,
        recoveryPctFull:     (avgChargedFull    / (totalAfname    || 1)) * 100,
        recoveryPctPartial:  (avgChargedPartial / (totalAfname    || 1)) * 100,
        injPctFull:          (avgChargedFull    / cfg.eff / (totalInjectie || 1)) * 100,
        injPctPartial:       (avgChargedPartial / cfg.eff / (totalInjectie || 1)) * 100,
        threshold:           arr[0].threshold,
      };
    }
    return { scenWCAvg: avgScen('scenWC'), scenOptAvg: avgScen('scenOpt') };
  });

  return {
    totalAfname, totalInjectie,
    totalAfnamedag, totalAfnamenacht, totalInjectiedag, totalInjectienacht,
    effectivePrice,
    avgAfnamePerDay:   totalAfname   / 365,
    avgInjectiePerDay: totalInjectie / 365,
    scenarios,
  };
}

// ─── MAIN ORCHESTRATOR ─────────────────────────────────────────────────────────

// Pure version of processData — returns the data object instead of rendering.
// Accepts either a raw CSV string OR a pre-built { allDays, eanCode, meterNr, meterType } object
// (used by project-mode which loads data from Firestore instead of a file upload).
// Returns null when no data is found.
export function processDataPure(input, pvInv, selectedConfigs, priceDay, priceNight) {
  const { allDays, eanCode, meterNr, meterType } =
    (typeof input === 'string') ? csvToAllDaysAndMeta(input) : input;

  if (!allDays.length) return null;

  // ── Rolling year window ────────────────────────────────────────────────────
  const lastDate    = allDays[allDays.length - 1].date;
  const firstDate   = allDays[0].date;
  const oneYearBack = new Date(lastDate);
  oneYearBack.setFullYear(oneYearBack.getFullYear() - 1);
  const windowStart = oneYearBack < firstDate ? firstDate : oneYearBack;
  const isFullYear  = oneYearBack >= firstDate;
  const windowDays  = allDays.filter(d => d.date >= windowStart && d.date <= lastDate);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalAfname       = windowDays.reduce((s, d) => s + d.afname,       0);
  const totalInjectie     = windowDays.reduce((s, d) => s + d.injectie,     0);
  const totalAfnamedag    = windowDays.reduce((s, d) => s + d.afnamedag,    0);
  const totalAfnamenacht  = windowDays.reduce((s, d) => s + d.afnamenacht,  0);
  const totalInjectiedag  = windowDays.reduce((s, d) => s + d.injectiedag,  0);
  const totalInjectienacht= windowDays.reduce((s, d) => s + d.injectienacht,0);
  const daysInWindow      = windowDays.length;

  // ── Effective price (dual tariff) ──────────────────────────────────────────
  const dualTariff = !isNaN(priceNight) && priceNight > 0;
  const effectivePrice = (dualTariff && totalAfname > 0)
    ? (totalAfnamedag / totalAfname) * priceDay + (totalAfnamenacht / totalAfname) * priceNight
    : priceDay;

  // ── Per-config scenario calculation ───────────────────────────────────────
  const scaleFactor = isFullYear ? 1 : (365 / daysInWindow);

  const configResults = selectedConfigs.map(cfg => {
    const pvGtBat    = pvInv > cfg.batInv;
    const thresholdWC  = pvGtBat ? cfg.batCap * (pvInv / cfg.batInv) : cfg.batCap;
    const thresholdOpt = cfg.batCap;
    const scenWC  = calcScenario(windowDays, {
      threshold: thresholdWC,
      installPrice: cfg.price,
      batCap: cfg.batCap,
      eff: cfg.eff,
      useCap: true,
      scaleFactor,
      effectivePrice,
      totalAfname,
      totalInjectie,
      pvInverter: pvInv,
      batteryInverter: cfg.batInv,
    });
    const scenOpt = calcScenario(windowDays, {
      threshold: thresholdOpt,
      installPrice: cfg.price,
      batCap: cfg.batCap,
      eff: cfg.eff,
      useCap: false,
      scaleFactor,
      effectivePrice,
      totalAfname,
      totalInjectie,
      pvInverter: pvInv,
      batteryInverter: cfg.batInv,
    });
    return { cfg, pvGtBat, thresholdWC, thresholdOpt, scenWC, scenOpt };
  });

  // ── Monthly map (simplified — no threshold columns) ────────────────────────
  const monthMap = {};
  for (const d of windowDays) {
    const mk = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,'0')}`;
    if (!monthMap[mk]) monthMap[mk] = { injectie:0, afname:0, injectiedag:0, injectienacht:0, afnamedag:0, afnamenacht:0, avgInjectie: null };
    monthMap[mk].injectie      += d.injectie;
    monthMap[mk].afname        += d.afname;
    monthMap[mk].injectiedag   += d.injectiedag;
    monthMap[mk].injectienacht += d.injectienacht;
    monthMap[mk].afnamedag     += d.afnamedag;
    monthMap[mk].afnamenacht   += d.afnamenacht;
  }

  // ── Multi-year per-year stats + averages (gated on N >= 2 in renderer) ─────
  const py = computePerYearStats(allDays, pvInv, selectedConfigs, lastDate, priceDay, priceNight);
  const numYears  = py.numYears;
  const yearsStart= py.yearsStart;
  const avgTotals = numYears >= 2 ? averageStats(py.perYear, selectedConfigs) : null;

  // Pre-filter allDays into per-year blocks once, so the loops below don't
  // re-scan the full allDays array per cap-step / per month.
  const yearDays = py.perYear.map(yr =>
    allDays.filter(d => d.date >= yr.windowStart && d.date <= yr.windowEnd)
  );

  // Per-month avg injection across the same calendar month over all N years.
  if (numYears >= 2) {
    for (const mk of Object.keys(monthMap)) {
      const [, mo] = mk.split('-');
      const moNum = +mo;
      let total = 0;
      for (const days of yearDays) {
        for (const day of days) {
          if ((day.date.getMonth() + 1) === moNum) total += day.injectie;
        }
      }
      monthMap[mk].avgInjectie = total / numYears;
    }
  }

  // ── Capacity analysis — qualDays per capacity step (current year + multi-year avg) ──
  const capRows = [];
  let capMaxDays = null;
  for (let cap = CALC_CONSTANTS.CAP_SWEEP_STEP; cap <= CALC_CONSTANTS.CAP_SWEEP_MAX; cap = Math.round((cap + CALC_CONSTANTS.CAP_SWEEP_STEP) * 10) / 10) {
    let qualDays = 0;
    for (const day of windowDays) { if (day.injectie >= cap) qualDays++; }
    let avgQualDays = null;
    if (numYears >= 2) {
      let totalQual = 0;
      for (const days of yearDays) {
        let yrQual = 0;
        for (const day of days) { if (day.injectie >= cap) yrQual++; }
        totalQual += yrQual;
      }
      avgQualDays = totalQual / numYears;
    }
    capRows.push({ cap, qualDays, avgQualDays });
    if (qualDays >= CALC_CONSTANTS.CAP_SWEEP_QUALIFYING_DAYS_THRESHOLD) capMaxDays = cap;
    if (capMaxDays !== null && cap >= capMaxDays + CALC_CONSTANTS.CAP_SWEEP_STOP_AFTER_STEPS * CALC_CONSTANTS.CAP_SWEEP_STEP) break;
  }
  const capAnalysis = { rows: capRows, maxCap: capMaxDays };

  // Attach avg scenarios to each configResult (parallel to scenWC / scenOpt).
  // Always present as null when there's no multi-year data, mirroring the
  // monthMap[mk].avgInjectie and capAnalysis.rows[i].avgQualDays pattern.
  configResults.forEach((cr, i) => {
    cr.scenWCAvg  = avgTotals ? avgTotals.scenarios[i].scenWCAvg  : null;
    cr.scenOptAvg = avgTotals ? avgTotals.scenarios[i].scenOptAvg : null;
  });

  // ── Return data object ─────────────────────────────────────────────────────
  return {
    isFullYear, windowStart, lastDate, daysInWindow,
    totalAfname, totalInjectie,
    totalAfnamedag, totalAfnamenacht, totalInjectiedag, totalInjectienacht,
    dualTariff, priceDay, priceNight, effectivePrice,
    pvInv, configResults,
    monthMap, eanCode, meterNr, meterType,
    firstDate, allDays, windowDays, capAnalysis,
    numYears, yearsStart, avgTotals,
  };
}

// ─── CHART BUCKET HELPERS ──────────────────────────────────────────────────────

export function buildYearBuckets(allDays) {
  // Group per calendar year; keep only years with a complete count of days (365, or 366 for leap years).
  const byYear = {};
  for (const d of allDays) {
    const y = d.date.getFullYear();
    if (!byYear[y]) byYear[y] = { afname: 0, injectie: 0, afnamedag: 0, afnamenacht: 0, injectiedag: 0, injectienacht: 0, dayCount: 0 };
    byYear[y].afname        += d.afname;
    byYear[y].injectie      += d.injectie;
    byYear[y].afnamedag     += d.afnamedag;
    byYear[y].afnamenacht   += d.afnamenacht;
    byYear[y].injectiedag   += d.injectiedag;
    byYear[y].injectienacht += d.injectienacht;
    byYear[y].dayCount      += 1;
  }
  function isComplete(y, count) {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
    return count === (isLeap ? 366 : 365);
  }
  return Object.entries(byYear)
    .filter(([y, v]) => isComplete(parseInt(y, 10), v.dayCount))
    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
    .map(([y, v]) => ({ label: y, afname: v.afname, injectie: v.injectie, afnamedag: v.afnamedag, afnamenacht: v.afnamenacht, injectiedag: v.injectiedag, injectienacht: v.injectienacht }));
}

export function buildMonthBuckets(windowDays) {
  // Aggregate the rolling-window days into per-month buckets. Keys are YYYY-MM.
  const byMonth = {};
  for (const d of windowDays) {
    const mk = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[mk]) byMonth[mk] = { afname: 0, injectie: 0, afnamedag: 0, afnamenacht: 0, injectiedag: 0, injectienacht: 0 };
    byMonth[mk].afname        += d.afname;
    byMonth[mk].injectie      += d.injectie;
    byMonth[mk].afnamedag     += d.afnamedag;
    byMonth[mk].afnamenacht   += d.afnamenacht;
    byMonth[mk].injectiedag   += d.injectiedag;
    byMonth[mk].injectienacht += d.injectienacht;
  }
  const MONTH_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return Object.keys(byMonth).sort().map(mk => {
    const [y, m] = mk.split('-');
    return { label: `${MONTH_NL[parseInt(m, 10) - 1]} '${y.slice(2)}`, monthKey: mk, ...byMonth[mk] };
  });
}

export function buildDayBuckets(allDays, monthKey) {
  return allDays
    .filter(d => {
      const mk = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`;
      return mk === monthKey;
    })
    .map(d => ({
      label: String(d.date.getDate()),
      afname: d.afname,
      injectie: d.injectie,
      afnamedag: d.afnamedag,
      afnamenacht: d.afnamenacht,
      injectiedag: d.injectiedag,
      injectienacht: d.injectienacht,
    }));
}

export function availableMonthKeys(allDays) {
  const set = new Set();
  for (const d of allDays) {
    set.add(`${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`);
  }
  return [...set].sort();
}

// monthMap-based fallbacks for restored v1-v4 saves (no per-day data available).
export function buildYearBucketsFromMonthMap(monthMap) {
  if (!monthMap) return [];
  const byYear = {};
  for (const mk of Object.keys(monthMap)) {
    const y = mk.slice(0, 4);
    const m = monthMap[mk];
    if (!byYear[y]) byYear[y] = { afname: 0, injectie: 0, afnamedag: 0, afnamenacht: 0, injectiedag: 0, injectienacht: 0, monthCount: 0 };
    byYear[y].afname        += (m.afname || 0);
    byYear[y].injectie      += (m.injectie || 0);
    byYear[y].afnamedag     += (m.afnamedag || 0);
    byYear[y].afnamenacht   += (m.afnamenacht || 0);
    byYear[y].injectiedag   += (m.injectiedag || 0);
    byYear[y].injectienacht += (m.injectienacht || 0);
    byYear[y].monthCount    += 1;
  }
  // Only return years with all 12 months represented (matches spec's "complete year" semantics).
  return Object.entries(byYear)
    .filter(([y, v]) => v.monthCount === 12)
    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
    .map(([y, v]) => ({ label: y, afname: v.afname, injectie: v.injectie, afnamedag: v.afnamedag, afnamenacht: v.afnamenacht, injectiedag: v.injectiedag, injectienacht: v.injectienacht }));
}

export function buildMonthBucketsFromMonthMap(monthMap) {
  if (!monthMap) return [];
  const MONTH_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  return Object.keys(monthMap).sort().map(mk => {
    const [y, m] = mk.split('-');
    const v = monthMap[mk];
    return {
      label: `${MONTH_NL[parseInt(m, 10) - 1]} '${y.slice(2)}`,
      monthKey: mk,
      afname:        v.afname        || 0,
      injectie:      v.injectie      || 0,
      afnamedag:     v.afnamedag     || 0,
      afnamenacht:   v.afnamenacht   || 0,
      injectiedag:   v.injectiedag   || 0,
      injectienacht: v.injectienacht || 0,
    };
  });
}
