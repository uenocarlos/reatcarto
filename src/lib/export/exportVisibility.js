import { normalizeExportSettings, pruneExportSettings } from './exportSettings';

/**
 * @param {Array<{ id?: string, element_category?: string, category?: string, name?: string }>} elements
 */
export function groupElementsByCategory(elements) {
  /** @type {Map<string, Array<Record<string, unknown>>>} */
  const groups = new Map();
  for (const el of elements ?? []) {
    const cat = el.element_category ?? el.category ?? 'sem-categoria';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(el);
  }
  return groups;
}

/**
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 * @param {string} categoryId
 * @param {boolean} visible
 */
export function setCategoryVisibility(settings, categoryId, visible) {
  const normalized = normalizeExportSettings(settings);
  const hidden = new Set(normalized.hiddenCategoryIds);
  if (visible) hidden.delete(categoryId);
  else hidden.add(categoryId);
  return { ...normalized, hiddenCategoryIds: [...hidden] };
}

/**
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 * @param {string} elementId
 * @param {boolean} visible
 */
export function setElementVisibility(settings, elementId, visible) {
  const normalized = normalizeExportSettings(settings);
  const hidden = new Set(normalized.hiddenElementIds);
  if (visible) hidden.delete(elementId);
  else hidden.add(elementId);
  return { ...normalized, hiddenElementIds: [...hidden] };
}

/**
 * Toggle category visibility — returns partial settings patch.
 */
export function toggleCategoryVisibility(settings, categoryId) {
  const normalized = normalizeExportSettings(settings);
  const hidden = new Set(normalized.hiddenCategoryIds);
  const nextVisible = hidden.has(categoryId);
  if (nextVisible) hidden.delete(categoryId);
  else hidden.add(categoryId);
  return { hiddenCategoryIds: [...hidden] };
}

/**
 * Toggle element visibility — returns partial settings patch.
 */
export function toggleElementVisibility(settings, elementId) {
  const normalized = normalizeExportSettings(settings);
  const hidden = new Set(normalized.hiddenElementIds);
  const nextVisible = hidden.has(elementId);
  if (nextVisible) hidden.delete(elementId);
  else hidden.add(elementId);
  return { hiddenElementIds: [...hidden] };
}

/**
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 * @param {Array<Record<string, unknown>>} elements
 */
export function isCategoryVisible(settings, categoryId, elements) {
  const pruned = pruneExportSettings(settings, elements);
  return !pruned.hiddenCategoryIds.includes(categoryId);
}

/**
 * @param {import('./exportSettings').ExportSettings|Record<string, unknown>} settings
 * @param {string} elementId
 * @param {Array<Record<string, unknown>>} elements
 */
export function isElementVisible(settings, elementId, elements) {
  const pruned = pruneExportSettings(settings, elements);
  const el = elements.find((e) => e.id === elementId);
  const category = el?.element_category ?? el?.category;
  if (typeof category === 'string' && pruned.hiddenCategoryIds.includes(category)) return false;
  return !pruned.hiddenElementIds.includes(elementId);
}
