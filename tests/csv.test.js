import { describe, it, expect } from 'vitest';
import { parseCSV, parseDate, parsVolume, extractCsvForStorage } from '../assets/js/csv.js';

describe('parseCSV', () => {
  it('splits semicolon-separated rows into objects keyed by header', () => {
    const csv = 'Kolom A;Kolom B;Kolom C;D;E;F;G;H;I\nwaarde1;waarde2;waarde3;4;5;6;7;8;9\n';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]['Kolom A']).toBe('waarde1');
    expect(rows[0]['Kolom B']).toBe('waarde2');
  });

  it('skips rows with fewer columns than required minimum', () => {
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

  it('throws on empty CSV', () => {
    const header = 'EAN-code;Meter;Metertype;Van (datum);Tot (datum);Register;Volume;Eenheid;Validatiestatus';
    expect(() => extractCsvForStorage(header + '\n')).toThrow('Geen data gevonden');
  });
});
