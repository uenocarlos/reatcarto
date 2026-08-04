import { describe, expect, it } from 'vitest';
import { assertExportTitle, buildExportFileName } from '@/lib/export/session';
import { buildBrandingComposition, INSTITUTIONAL_FOOTER_LINES, EXPORT_LOGO_PATH } from '@/lib/export/branding';

describe('title validation & filename', () => {
  it('UT-003: title and authorship flow without stripping institutional lines', () => {
    const branding = buildBrandingComposition({
      title: 'Mapa Costeiro',
      authorship: 'Maria Silva',
      technicalResponsible: 'João Eng.',
    });
    expect(branding.title).toBe('Mapa Costeiro');
    expect(branding.authorship).toBe('Maria Silva');
    expect(branding.institutionalLines).toEqual([...INSTITUTIONAL_FOOTER_LINES]);
    expect(branding.footerLines.length).toBeGreaterThan(INSTITUTIONAL_FOOTER_LINES.length);
  });

  it('UT-004: empty title gate', () => {
    expect(assertExportTitle('   ')).toEqual({ ok: false, code: 'empty_title' });
    expect(assertExportTitle('Mapa A')).toEqual({ ok: true, title: 'Mapa A' });
  });

  it('UT-005: special chars preserved; path separators sanitized', () => {
    const title = 'Mapa "Norte" & <Sul>';
    expect(assertExportTitle(title).ok).toBe(true);
    const fileName = buildExportFileName(title, 'png');
    expect(fileName).toMatch(/\.png$/);
    expect(fileName).not.toMatch(/[/\\]/);
    expect(fileName).toContain('Norte');
  });

  it('UT-045: pdf extension from title', () => {
    const fileName = buildExportFileName('My Map', 'pdf');
    expect(fileName).toMatch(/\.pdf$/);
    expect(fileName.startsWith('My Map')).toBe(true);
  });
});

describe('branding', () => {
  it('UT-030: institutional footer lines and logo path', () => {
    expect(INSTITUTIONAL_FOOTER_LINES.some((l) => l.includes('ReatCarto'))).toBe(true);
    expect(INSTITUTIONAL_FOOTER_LINES.some((l) => l.includes('Bases Cartográficas'))).toBe(true);
    expect(INSTITUTIONAL_FOOTER_LINES.some((l) => l.includes('(R)EAT'))).toBe(true);
    expect(INSTITUTIONAL_FOOTER_LINES.some((l) => l.includes('FURG'))).toBe(true);
    expect(EXPORT_LOGO_PATH).toBe('/export/logoreat.png');
  });

  it('UT-031: empty credits keep institutional lines', () => {
    const branding = buildBrandingComposition({ authorship: '', technicalResponsible: '' });
    expect(branding.institutionalLines).toEqual([...INSTITUTIONAL_FOOTER_LINES]);
    expect(branding.footerLines).toEqual([...INSTITUTIONAL_FOOTER_LINES]);
  });
});
