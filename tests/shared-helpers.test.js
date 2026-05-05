import { describe, it, expect } from 'vitest';
import { escapeHtml, shortEmail } from '../assets/js/shared-helpers.js';

describe('escapeHtml', () => {
  it('escapes & < > " \'', () => {
    expect(escapeHtml('a & b < c > d " e \' f')).toBe('a &amp; b &lt; c &gt; d &quot; e &#39; f');
  });

  it('returns empty string for null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('converts number to string without escaping', () => {
    expect(escapeHtml(42)).toBe('42');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('passes through safe strings unchanged', () => {
    expect(escapeHtml('Hello world')).toBe('Hello world');
  });
});

describe('shortEmail', () => {
  it('extracts prefix before @', () => {
    expect(shortEmail('kevin@example.com')).toBe('kevin');
  });

  it('returns em-dash for null', () => {
    expect(shortEmail(null)).toBe('\u2014');
  });

  it('returns em-dash for empty string', () => {
    expect(shortEmail('')).toBe('\u2014');
  });

  it('handles email without @', () => {
    expect(shortEmail('noemail')).toBe('noemail');
  });
});
