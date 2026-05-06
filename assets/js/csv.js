// Shared CSV parsing — ES module.
// Used by calc-engine.js (parseCSV, parseDate, parsVolume)
// and directly by HTML pages (extractCsvForStorage).
//
// Also exposed on window for non-module scripts that depend on globals.

// Required column headers for a valid Fluvius CSV export.
const REQUIRED_HEADERS = ['Van (datum)', 'Register', 'Volume'];

/**
 * Parse a semicolon-separated Fluvius CSV into an array of row objects.
 * Skips data rows with fewer columns than the header.
 *
 * @param {string} text — raw CSV text
 * @returns {{ rows: object[], headers: string[] } | object[]}
 *   Returns plain array of row objects (backward-compatible).
 */
export function parseCSV(text) {
  if (!text || !text.trim()) return [];
  const lines = text.trim().split('\n');
  if (lines.length === 0) return [];
  const header = lines[0].split(';').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // skip empty lines
    const cols = line.split(';');
    if (cols.length < header.length) continue; // skip truncated rows
    const obj = {};
    header.forEach((h, idx) => { obj[h] = (cols[idx] || '').trim(); });
    rows.push(obj);
  }
  return rows;
}

/**
 * Validate that CSV text contains the required Fluvius headers.
 * Returns an object with `{ valid, errors, headers }`.
 *
 * @param {string} csvText — raw CSV text
 * @returns {{ valid: boolean, errors: string[], headers: string[] }}
 */
export function validateCsvHeaders(csvText) {
  const errors = [];
  if (!csvText || !csvText.trim()) {
    return { valid: false, errors: ['Het CSV bestand is leeg.'], headers: [] };
  }
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(';').map(h => h.trim());

  const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
  if (missing.length > 0) {
    errors.push(
      `Verplichte kolommen ontbreken: ${missing.join(', ')}. ` +
      'Controleer of dit een geldig Fluvius CSV-export is.'
    );
  }
  return { valid: errors.length === 0, errors, headers };
}

/**
 * Parse a dd-mm-yyyy date string. Returns null for unparseable input.
 */
export function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split('-');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  const day = +d, month = +m, year = +y;
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  // Guard against NaN dates (e.g. from overflow or bad input)
  if (isNaN(date.getTime())) return null;
  return date;
}

export function parsVolume(str) {
  if (!str || str === '') return 0;
  return parseFloat(str.replace(',', '.')) || 0;
}

// Build the dailyCompact + meta object that the dashboard's "new project" flow stores in
// Firestore (and that index.html's project-mode reads back). Same per-day shape as v:5
// share-link saves, so the existing restore-path in index.html can decode it.
//
// Returns: { eanCode, meterNr, meterType, dailyCompact: { startDate, afname[], injectie[],
//            afnamedag[], afnamenacht[], injectiedag[], injectienacht[] } }
//
// Throws descriptive Error if the CSV is invalid or has no usable data rows.
export function extractCsvForStorage(csvText) {
  // Validate headers first
  const validation = validateCsvHeaders(csvText);
  if (!validation.valid) {
    throw new Error(validation.errors[0]);
  }

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
  let skippedDates = 0;
  for (const row of rows) {
    const dateStr = row['Van (datum)'];
    if (!dateStr) continue;
    const date = parseDate(dateStr);
    if (!date) { skippedDates++; continue; }
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

  if (!allDays.length) {
    const detail = skippedDates > 0
      ? ` ${skippedDates} rij(en) hadden een ongeldig datumformaat (verwacht: dd-mm-jjjj).`
      : '';
    throw new Error('Geen bruikbare data gevonden in het CSV bestand.' + detail);
  }

  const startDate = allDays[0].date.toISOString().slice(0, 10);
  return {
    eanCode, meterNr, meterType,
    dailyCompact: {
      startDate,
      afname:        allDays.map(d => d.afname),
      injectie:      allDays.map(d => d.injectie),
      afnamedag:     allDays.map(d => d.afnamedag),
      afnamenacht:   allDays.map(d => d.afnamenacht),
      injectiedag:   allDays.map(d => d.injectiedag),
      injectienacht: allDays.map(d => d.injectienacht),
    },
  };
}

// Expose on window so non-module scripts (firebase-init.js, offertes-ui.js) can access them
if (typeof window !== 'undefined') {
  window.parseCSV = parseCSV;
  window.parseDate = parseDate;
  window.parsVolume = parsVolume;
  window.extractCsvForStorage = extractCsvForStorage;
  window.validateCsvHeaders = validateCsvHeaders;
}
