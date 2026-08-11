import { buildCategoryIndex } from '../elementCategories.js';
import {
  buildTypeGroups,
  categoryBucket,
} from './layerGrouping.js';

/**
 * @typedef {'point'|'line'|'polygon'|'region'|'topic'} SymbolKind
 */

/** @type {ReadonlyArray<{ id: string, label: string }>} */
export const LEGEND_TOPIC_DEFS = Object.freeze([
  { id: 'terra', label: 'Terra' },
  { id: 'agua', label: 'Agua' },
  { id: 'conflito', label: 'Conflito' },
  { id: 'outros', label: 'Outros' },
]);

/**
 * Apply optional explicit order of item ids (unknown ids keep relative order at end).
 * @template {{ id: string }} T
 * @param {T[]} items
 * @param {string[]|null|undefined} order
 * @returns {T[]}
 */
export function applyLegendItemOrder(items, order) {
  if (!Array.isArray(order) || order.length === 0) return items;
  const byId = new Map(items.map((item) => [item.id, item]));
  const used = new Set();
  const ordered = [];
  for (const id of order) {
    const item = byId.get(String(id));
    if (item) {
      ordered.push(item);
      used.add(item.id);
    }
  }
  for (const item of items) {
    if (!used.has(item.id)) ordered.push(item);
  }
  return ordered;
}

/**
 * Insert topic headers by element_category when groupByTopic is on.
 * @param {Array<Record<string, unknown>>} items
 * @param {boolean} groupByTopic
 */
export function withLegendTopics(items, groupByTopic, elementCategories = []) {
  if (!groupByTopic) return items;
  const index = buildCategoryIndex(elementCategories);
  const labels = Object.fromEntries(LEGEND_TOPIC_DEFS.map((topic) => [topic.id, topic.label]));
  const result = [];
  const seenTopic = new Set();

  for (const item of items) {
    if (item.source === 'location' || item.symbolKind === 'topic') {
      result.push(item);
      continue;
    }
    const topicId = categoryBucket(item.category);
    if (!seenTopic.has(topicId)) {
      seenTopic.add(topicId);
      result.push({
        id: `topic-${topicId}`,
        label: index.labelFor(topicId) || labels[topicId] || topicId,
        symbolKind: 'topic',
        style: {},
        source: 'topic',
        category: topicId,
      });
    }
    result.push(item);
  }
  return result;
}

/**
 * Build legend rows from visible thematic elements and optional location source.
 * @param {{
 *   elements?: Array<Record<string, unknown>>,
 *   hiddenIds?: Set<string>|string[],
 *   location?: {
 *     stateLabel?: string,
 *     municipioLabel?: string,
 *     stateColor?: string,
 *     municipioColor?: string,
 *     topicLabel?: string,
 *   }|null,
 *   order?: string[]|null,
 *   groupByTopic?: boolean,
 * }} input
 */
export function buildLegendItems(input = {}) {
  const elements = Array.isArray(input.elements) ? input.elements : [];
  const elementCategories = Array.isArray(input.elementCategories) ? input.elementCategories : [];
  const hiddenIds = input.hiddenIds instanceof Set
    ? input.hiddenIds
    : new Set(Array.isArray(input.hiddenIds) ? input.hiddenIds : []);

  const visibleElements = elements.filter((element) => !hiddenIds.has(String(element.id ?? '')));
  const grouped = buildTypeGroups(visibleElements);
  const categoryIndex = buildCategoryIndex(elementCategories);
  const categoryOrder = [...categoryIndex.order];
  for (const element of visibleElements) {
    const category = categoryBucket(element?.element_category);
    if (!categoryOrder.includes(category)) categoryOrder.push(category);
  }
  const items = [];

  for (const category of categoryOrder) {
    for (const group of Object.values(grouped).filter(Array.isArray).flat()) {
      if (group.category !== category) continue;
      const hintSuffix = group.hasNameCollision && group.hints?.length
        ? ` · ${group.hints.join(' · ')}`
        : '';

      items.push({
        id: group.key,
        label: hintSuffix ? group.label : group.label,
        symbolKind: group.type,
        style: group.style,
        source: 'element',
        category: group.category,
      });
    }
  }

  const location = input.location;
  if (location?.stateLabel) {
    items.push({
      id: 'location-state',
      label: location.stateLabel,
      symbolKind: 'region',
      style: {
        fill_color: location.stateColor || '#D9E6A4',
        border_color: '#334155',
        border_weight: 2,
        fill_opacity: 70,
      },
      source: 'location',
      category: null,
    });
  }

  if (location?.municipioLabel) {
    items.push({
      id: 'location-municipio',
      label: location.municipioLabel,
      symbolKind: 'region',
      style: {
        fill_color: location.municipioColor || '#E6A4A4',
        border_color: '#1f2937',
        border_weight: 2,
        fill_opacity: 75,
      },
      source: 'location',
      category: null,
    });
  }

  let working = items;
  if (input.groupByTopic && !(Array.isArray(input.order) && input.order.length)) {
    const topicRank = Object.fromEntries(categoryOrder.map((category, index) => [category, index]));
    const elementItems = working.filter((item) => item.source === 'element');
    const locationItems = working.filter((item) => item.source === 'location');
    elementItems.sort((a, b) => {
      const rankA = topicRank[categoryBucket(a.category)] ?? 99;
      const rankB = topicRank[categoryBucket(b.category)] ?? 99;
      return rankA - rankB;
    });
    if (locationItems.length && location?.topicLabel) {
      working = [
        ...elementItems,
        {
          id: 'topic-cartographic-conventions',
          label: location.topicLabel,
          symbolKind: 'topic',
          style: {},
          source: 'topic',
          category: null,
        },
        ...locationItems,
      ];
    } else {
      working = [...elementItems, ...locationItems];
    }
  }

  const ordered = applyLegendItemOrder(working, input.order);
  return withLegendTopics(ordered, Boolean(input.groupByTopic), elementCategories);
}

export { categoryBucket };
