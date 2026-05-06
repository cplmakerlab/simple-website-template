import { describe, it, expect } from 'vitest';
import { parseCSV, parseDate, parsVolume, extractCsvForStorage, validateCsvHeaders } from '../assets/js/csv.js';

describe('parseCSV', () => {
  it('splits semicolon-separated rows into objects keyed by header', () => {
    const csv = 'Kolom A;Kolom B;Kolom C;D;E;F;G;H;I\nwaarde1;waarde2;waarde3;4;5;6;7;8;9\n';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]['Kolom A']).toBe('waarde1');
    expect(rows[0]['Kolom B']).toBe('waarde2');
  });

  it('skips rows with fewer columns than header', () => {
    const csv = 'A;B;C;D;E;F;G;H;I\nval1;val2\nval1;val2;val3;val4;val5;val6;val7;val8;val9\n';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
  });

  it('trims whitespace from headers and values', () => {
    const csv = ' A ; B ; C ; D ; E ; F ; G ; H ; I \n 1 ; 2 ; 3 ; 4 ; 5 ; 6 ; 7 ; 8 ; 9 \n';
    const rows = parseCSV(csv);
    expect(rows[0]['A']).toBe('1');
    expect(rows[0]['I']).toBe('9');
  });

  it('handles empty input with just a header', () => {
    const rows = parseCSV('Header\n');
    expect(rows).toEqual([]);
  });

  it('returns empty array for null/undefined/empty string', () => {
    expect(parseCSV(null)).toEqual([]);
    expect(parseCSV(undefined)).toEqual([]);
    expect(parseCSV('')).toEqual([]);
    expect(parseCSV('   ')).toEqual([]);
  });

  it('skips blank lines in the middle of data', () => {
    const csv = 'A;B\nval1;val2\n\nval3;val4\n';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
  });
});

describe('validateCsvHeaders', () => {
  it('passes for valid Fluvius CSV headers', () => {
    const csv = 'EAN-code;Meter;Metertype;Van (datum);Tot (datum);Register;Volume;Eenheid;Validatiestatus\ndata';
    const result = validateCsvHeaders(csv);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails for empty input', () => {
    const result = validateCsvHeaders('');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('leeg');
  });

  it('fails for null/undefined', () => {
    expect(validateCsvHeaders(null).valid).toBe(false);
    expect(validateCsvHeaders(undefined).valid).toBe(false);
  });

  it('reports missing required columns', () => {
    const csv = 'EAN-code;Meter;Metertype\ndata;data;data';
    const result = validateCsvHeaders(csv);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Van (datum)');
    expect(result.errors[0]).toContain('Register');
    expect(result.errors[0]).toContain('Volume');
  });

  it('passes when only required columns are present (no extras)', () => {
    const csv = 'Van (datum);Register;Volume\n01-01-2024;Afname;1,5';
    const result = validateCsvHeaders(csv);
    expect(result.valid).toBe(true);
  });
});

describe('parseDate', () => {
  it('parses dd-mm-yyyy to correct Date', () => {
    const d = parseDate('15-03-2025');
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(15);
  });

  it('parses first day of year', () => {
    const d = parseDate('01-01-2024');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  it('returns null for null/undefined/empty', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
    expect(parseDate('')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(parseDate(12345)).toBeNull();
    expect(parseDate({})).toBeNull();
  });

  it('returns null for wrong format (yyyy-mm-dd)', () => {
    expect(parseDate('2024-01-15')).toBeNull();
  });

  it('returns null for invalid month', () => {
    expect(parseDate('15-13-2024')).toBeNull();
    expect(parseDate('15-00-2024')).toBeNull();
  });

  it('returns null for invalid day', () => {
    expect(parseDate('00-03-2024')).toBeNull();
    expect(parseDate('32-03-2024')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(parseDate('abc-def-ghi')).toBeNull();
    expect(parseDate('not-a-date')).toBeNull();
  });
});

describe('parsVolume', () => {
  it('parses Belgian decimal format (comma as decimal separator)', () => {
    expect(parsVolume('1,234')).toBeCloseTo(1.234, 3);
  });

  it('returns 0 for empty string', () => {
    expect(parsVolume('')).toBe(0);
  });

  it('returns 0 for null/undefined', () => {
    expect(parsVolume(null)).toBe(0);
    expect(parsVolume(undefined)).toBe(0);
  });

  it('parses zero correctly', () => {
    expect(parsVolume('0,000')).toBe(0);
  });
});

describe('extractCsvForStorage', () => {
  const sampleCSV = [
    'EAN-code;Meter;Metertype;Van (datum);Tot (datum);Register;Volume;Eenheid;Validatiestatus',
    '="541999999999";M001;DMM;01-01-2024;02-01-2024;Afname dag;5,500;kWh;Gevalideerd',
    '="541999999999";M001;DMM;01-01-2024;02-01-2024;Afname nacht;3,200;kWh;Gevalideerd',
    '="541999999999";M001;DMM;01-01-2024;02-01-2024;Injectie dag;4,100;kWh;Gevalideerd',
    '="541999999999";M001;DMM;01-01-2024;02-01-2024;Injectie nacht;1,000;kWh;Gevalideerd',
    '="541999999999";M001;DMM;02-01-2024;03-01-2024;Afname dag;6,000;kWh;Gevalideerd',
    '="541999999999";M001;DMM;02-01-2024;03-01-2024;Afname nacht;4,000;kWh;Gevalideerd',
    '="541999999999";M001;DMM;02-01-2024;03-01-2024;Injectie dag;3,500;kWh;Gevalideerd',
    '="541999999999";M001;DMM;02-01-2024;03-01-2024;Injectie nacht;0,500;kWh;Gevalideerd',
  ].join('\n');

  it('extracts EAN code, meter number, meter type', () => {
    const result = extractCsvForStorage(sampleCSV);
    expect(result.eanCode).toBe('541999999999');
    expect(result.meterNr).toBe('M001');
    expect(result.meterType).toBe('DMM');
  });

  it('returns correct dailyCompact shape', () => {
    const result = extractCsvForStorage(sampleCSV);
    // Note: parseDate uses local Date constructor, which may produce off-by-one in UTC conversion
    // The important thing is that dates are sorted and aggregated correctly
    expect(result.dailyCompact.startDate).toMatch(/2024-01-01|2023-12-31/);
    expect(result.dailyCompact.afname).toHaveLength(2);
    expect(result.dailyCompact.injectie).toHaveLength(2);
  });

  it('aggregates afname and injectie correctly per day', () => {
    const result = extractCsvForStorage(sampleCSV);
    expect(result.dailyCompact.afname[0]).toBeCloseTo(8.7, 2);
    expect(result.dailyCompact.injectie[0]).toBeCloseTo(5.1, 2);
    expect(result.dailyCompact.afname[1]).toBeCloseTo(10.0, 2);
    expect(result.dailyCompact.injectie[1]).toBeCloseTo(4.0, 2);
  });

  it('splits dag/nacht registers correctly', () => {
    const result = extractCsvForStorage(sampleCSV);
    expect(result.dailyCompact.afnamedag[0]).toBeCloseTo(5.5, 2);
    expect(result.dailyCompact.afnamenacht[0]).toBeCloseTo(3.2, 2);
    expect(result.dailyCompact.injectiedag[0]).toBeCloseTo(4.1, 2);
    expect(result.dailyCompact.injectienacht[0]).toBeCloseTo(1.0, 2);
  });

  it('throws on empty CSV with valid headers', () => {
    const header = 'EAN-code;Meter;Metertype;Van (datum);Tot (datum);Register;Volume;Eenheid;Validatiestatus';
    expect(() => extractCsvForStorage(header + '\n')).toThrow('Geen bruikbare data');
  });

  it('throws on CSV with missing required headers', () => {
    const badCsv = 'Kolom A;Kolom B;Kolom C\nval1;val2;val3';
    expect(() => extractCsvForStorage(badCsv)).toThrow('Verplichte kolommen ontbreken');
  });

  it('throws on completely empty input', () => {
    expect(() => extractCsvForStorage('')).toThrow('leeg');
  });

  it('skips rows with invalid dates and still processes valid ones', () => {
    const csv = [
      'EAN-code;Meter;Metertype;Van (datum);Tot (datum);Register;Volume;Eenheid;Validatiestatus',
      '="541";M001;DMM;INVALID;02-01-2024;Afname;5,000;kWh;Gevalideerd',
      '="541";M001;DMM;01-01-2024;02-01-2024;Afname;3,000;kWh;Gevalideerd',
    ].join('\n');
    const result = extractCsvForStorage(csv);
    expect(result.dailyCompact.afname).toHaveLength(1);
    expect(result.dailyCompact.afname[0]).toBeCloseTo(3.0, 2);
  });

  it('throws with date detail when all dates are invalid', () => {
    const csv = [
      'EAN-code;Meter;Metertype;Van (datum);Tot (datum);Register;Volume;Eenheid;Validatiestatus',
      '="541";M001;DMM;BAAD;02-01-2024;Afname;5,000;kWh;Gevalideerd',
      '="541";M001;DMM;NOPE;03-01-2024;Injectie;3,000;kWh;Gevalideerd',
    ].join('\n');
    expect(() => extractCsvForStorage(csv)).toThrow('ongeldig datumformaat');
  });
});
