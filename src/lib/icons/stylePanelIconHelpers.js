import { ICON_NAME_FALLBACK } from '@/lib/icons/constants';
import { normalizeIconName } from '@/lib/icons/iconExport';

/** @param {unknown[]} icons */
export function isIconLibraryEmpty(icons) {
  return !Array.isArray(icons) || icons.length === 0;
}

/** @param {string} iconName */
export function builtInIconStyleUpdate(iconName) {
  return { icon_name: iconName, custom_icon_url: '' };
}

/** @param {Record<string, unknown>} style */
export function clearCustomIconStyle(style) {
  if (!style || typeof style !== 'object') {
    return { custom_icon_url: '' };
  }
  return { ...style, custom_icon_url: '' };
}

/**
 * Prefill name for the drawing editor: selected library icon, else built-in label.
 * @param {{
 *   customIconUrl?: unknown;
 *   iconName?: unknown;
 *   libraryIcons?: Array<{ name?: string; url?: string }>;
 *   builtInIcons?: Array<{ name?: string; label?: string }>;
 * }} params
 */
export function resolveSuggestedIconEditorName({
  customIconUrl = '',
  iconName = '',
  libraryIcons = [],
  builtInIcons = [],
} = {}) {
  const custom = String(customIconUrl ?? '').trim();
  if (custom) {
    const match = (libraryIcons ?? []).find((icon) => String(icon?.url ?? '') === custom);
    const libraryName = normalizeIconName(match?.name);
    if (libraryName) return libraryName;
  }

  const fromIcon = resolveElementNameFromIcon({
    iconName,
    builtInIcons,
  });
  if (fromIcon) return fromIcon;

  return ICON_NAME_FALLBACK;
}

/** @param {unknown} label */
export function cleanIconLabelForElementName(label) {
  return String(label ?? '')
    .replace(/\s*\((?:SVG|PNG)\)\s*$/i, '')
    .trim();
}

/** @param {unknown} iconName */
export function elementNameFromIconKey(iconName) {
  const key = String(iconName ?? '').trim();
  if (!key) return '';
  const base = key.split('/').pop()?.replace(/\.[^.]+$/, '') || '';
  if (!base || base === key) return '';
  const spaced = base.replace(/[-_]+/g, ' ').trim();
  if (!spaced) return '';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * @param {{
 *   iconName?: unknown;
 *   libraryIcon?: { name?: string } | null;
 *   builtInIcons?: Array<{ name?: string; label?: string }>;
 * }} params
 */
export function resolveElementNameFromIcon({
  iconName = '',
  libraryIcon = null,
  builtInIcons = [],
} = {}) {
  const libraryName = normalizeIconName(libraryIcon?.name);
  if (libraryName) return libraryName;

  const key = String(iconName ?? '');
  const builtIn = (builtInIcons ?? []).find((icon) => String(icon?.name ?? '') === key);
  const cleaned = cleanIconLabelForElementName(builtIn?.label);
  if (cleaned) return cleaned;

  return elementNameFromIconKey(key);
}

/** @param {unknown} name */
export function isPlaceholderElementName(name) {
  const current = String(name ?? '').trim().toLowerCase();
  return !current || current === 'element' || current === 'ícone' || current === 'icone';
}

/**
 * Auto-fill element name from icon only when it is still a placeholder
 * or still equal to the previous icon label.
 * @param {unknown} currentName
 * @param {unknown} previousSuggestedName
 */
export function shouldSyncElementNameFromIcon(currentName, previousSuggestedName) {
  if (isPlaceholderElementName(currentName)) return true;
  const current = String(currentName ?? '').trim().toLowerCase();
  const previous = String(previousSuggestedName ?? '').trim().toLowerCase();
  return Boolean(previous) && current === previous;
}
