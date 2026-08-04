/** Fixed institutional footer copy (ADR-004; parity with printJs). */
export const INSTITUTIONAL_FOOTER_LINES = Object.freeze([
  'Mapa criado através do ReatCarto ®',
  'Bases Cartográficas: @OpenStreetMaps - Google Satélite - Leaflet',
  'Núcleo de Ensino, Pesquisa e Extensão (R)Existências Ambientais e Territoriais - (R)EAT',
  'Universidade Federal do Rio Grande - FURG',
]);

export const EXPORT_LOGO_PATH = '/export/logoreat.png';
export const EXPORT_NORTH_PATH = '/export/north.png';

/**
 * Build footer line list including user credits without removing institutional lines.
 * @param {{ authorship?: string, technicalResponsible?: string }} params
 */
export function buildFooterLines({ authorship = '', technicalResponsible = '' } = {}) {
  const lines = [...INSTITUTIONAL_FOOTER_LINES];
  const author = String(authorship ?? '').trim();
  const responsible = String(technicalResponsible ?? '').trim();
  if (author) lines.unshift(`Autoria: ${author}`);
  if (responsible) lines.splice(author ? 1 : 0, 0, `Responsavel tecnico: ${responsible}`);
  return lines;
}

/**
 * Composition metadata for title + credits while preserving institutional branding.
 * @param {{ title?: string, authorship?: string, technicalResponsible?: string }} session
 */
export function buildBrandingComposition(session = {}) {
  return {
    title: String(session.title ?? ''),
    authorship: String(session.authorship ?? ''),
    technicalResponsible: String(session.technicalResponsible ?? ''),
    institutionalLines: [...INSTITUTIONAL_FOOTER_LINES],
    footerLines: buildFooterLines(session),
    logoPath: EXPORT_LOGO_PATH,
  };
}
