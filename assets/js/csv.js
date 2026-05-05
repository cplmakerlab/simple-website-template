// Shared CSV parsing — ES module.
// Used by calc-engine.js (parseCSV, parseDate, parsVolume)
// and directly by HTML pages (extractCsvForStorage).

export function parseCSV(text) {
  const lines = text.trim().split('\n');
  const header = lines[0].split(';').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length < 9) continue;
    const obj = {};
    header.forEach((h, idx) => { obj[h] = (cols[idx] || '').trim(); });
    rows.push(obj);
  }
  return rows;
}

export function parseDate(str) {
  // dd-mm-yyyy
  const [d, m, y] = str.split('-');
  return new Date(+y, +m - 1, +d);
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
// Throws Error('Geen data gevonden in het CSV bestand.') if the CSV has no usable rows.
export function extractCsvForStorage(csvText) {
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
    const parts = dateStr.split('-');
    if (parts.length !== 3) continue;
    const key = `${parts[2]}-${parts[1]}-${parts[0]}`;
    if (!dayMap[key]) dayMap[key] = { date: parseDate(dateStr), afname: 0, injectie: 0, afnamedag: 0, afnamenacht: 0, injectiedag: 0, injectienacht: 0 };
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
  if (!allDays.length) throw new Error('Geen data gevonden in het CSV bestand.');

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
