import { normalizeExportSettings } from './exportSettings';
import { isLocationFeatureActive } from './locationPreview';

export const INSTITUTIONAL_LINES = Object.freeze([
  'Mapa criado através do ReatCarto ®',
  'Bases Cartográficas: @OpenStreetMaps - ArcGIS Satellite - Leaflet',
  'Núcleo de Ensino, Pesquisa e Extensão (R)Existências Ambientais e Territoriais - (R)EAT',
  'Universidade Federal do Rio Grande - FURG',
]);

export const LOGO_PATH = '/logo.png';

/**
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 */
export function shouldShowIbgeCredit(settings) {
  const normalized = normalizeExportSettings(settings);
  if (isLocationFeatureActive(normalized)) return true;
  if (
    normalized.locatorCount > 0 &&
    (normalized.showStateInLegend || normalized.showMunicipalityInLegend || normalized.showMunicipalMesh) &&
    normalized.stateCode &&
    normalized.municipalityCode
  ) {
    return true;
  }
  return false;
}

/**
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 * @param {{ usedFallback?: boolean, boundaryError?: boolean }} [boundaryMeta]
 */
export function buildInstitutionalFooterContent(settings, boundaryMeta = {}) {
  const normalized = normalizeExportSettings(settings);
  const author = typeof normalized.author === 'string' ? normalized.author.trim() : '';
  const responsible = typeof normalized.technicalResponsible === 'string' ? normalized.technicalResponsible.trim() : '';

  return {
    institutionalLines: [...INSTITUTIONAL_LINES],
    authorLine: author ? `Autoria: ${author}` : null,
    responsibleLine: responsible ? `Resp. Técnico: ${responsible}` : null,
    ibgeCreditLine: shouldShowIbgeCredit(normalized)
      ? 'Limites administrativos: IBGE — Malhas Digitais / Localidades'
      : null,
    fallbackWarningLine:
      boundaryMeta.usedFallback && shouldShowIbgeCredit(normalized)
        ? 'Malha de referência local (fallback) — detalhe pode diferir do IBGE online.'
        : null,
    boundaryErrorLine: boundaryMeta.boundaryError
      ? 'Limites administrativos indisponíveis para a seleção atual.'
      : null,
    logoPath: LOGO_PATH,
    showLogo: true,
  };
}

/**
 * Stable snapshot for idempotent footer rendering (UT-143).
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 */
export function snapshotInstitutionalFooter(settings) {
  return JSON.stringify(buildInstitutionalFooterContent(settings));
}
