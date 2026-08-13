import { buildCategoryIndex } from '../elementCategories.js';
import {
  buildTypeGroups,
  categoryBucket,
  TYPE_ORDER,
} from './layerGrouping.js';
import {
  DEFAULT_LEGEND_COLUMNS,
  LEGEND_COLUMNS_MAX,
  LEGEND_COLUMNS_MIN,
} from './constants.js';

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

const SYMBOL_RANK = Object.freeze({
  point: 0,
  line: 1,
  polygon: 2,
  region: 3,
});

export function symbolRank(kind) {
  return SYMBOL_RANK[kind] ?? 9;
}

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
 * Keep legend rows as icons → lines → polygons. With topics, that order holds inside each group.
 * @param {Array<Record<string, unknown>>} items
 * @param {{ groupByTopic?: boolean, categoryOrder?: string[] }} [options]
 */
export function prioritizeLegendSymbols(items = [], options = {}) {
  const groupByTopic = Boolean(options.groupByTopic);
  const categoryOrder = Array.isArray(options.categoryOrder) ? options.categoryOrder : [];
  const topicRank = Object.fromEntries(categoryOrder.map((category, index) => [category, index]));
  const topics = [];
  const elements = [];
  const locations = [];

  for (const item of items) {
    if (item?.source === 'location') locations.push(item);
    else if (item?.symbolKind === 'topic') topics.push(item);
    else elements.push(item);
  }

  elements.sort((a, b) => {
    if (groupByTopic) {
      const rankA = topicRank[categoryBucket(a.category)] ?? 99;
      const rankB = topicRank[categoryBucket(b.category)] ?? 99;
      if (rankA !== rankB) return rankA - rankB;
    }
    return symbolRank(a.symbolKind) - symbolRank(b.symbolKind);
  });

  return [...topics, ...elements, ...locations];
}

export function countLegendSymbolItems(items = []) {
  return items.filter((item) => item?.symbolKind && item.symbolKind !== 'topic').length;
}

export function suggestLegendColumns(itemCount) {
  const count = Math.max(0, Number(itemCount) || 0);
  if (count <= 6) return 1;
  if (count <= 14) return 2;
  if (count <= 27) return 3;
  return Math.min(LEGEND_COLUMNS_MAX, Math.max(4, Math.ceil(count / 10)));
}

export function legendColumnRangeForItemCount(itemCount) {
  const count = Math.max(0, Number(itemCount) || 0);
  const max = Math.max(
    LEGEND_COLUMNS_MIN,
    Math.min(LEGEND_COLUMNS_MAX, Math.max(1, count)),
  );
  return {
    min: LEGEND_COLUMNS_MIN,
    max,
    options: Array.from(
      { length: max - LEGEND_COLUMNS_MIN + 1 },
      (_, index) => LEGEND_COLUMNS_MIN + index,
    ),
    suggested: Math.min(max, suggestLegendColumns(count) || DEFAULT_LEGEND_COLUMNS),
  };
}

export function buildLocationLegendInput({
  locations,
  locationCount,
  stateOnLegend,
  showMunicipalMesh,
  stateColor,
  municipioColor,
} = {}) {
  if (!locationCount) return null;
  const first = locations?.[0];
  if (!first?.uf) return null;

  const result = {
    stateColor,
    municipioColor,
  };

  if (stateOnLegend) result.stateLabel = first.stateName || first.uf;
  if (showMunicipalMesh) {
    result.municipioLabel = first.municipioName || 'Malha municipal';
  }

  if (stateOnLegend || showMunicipalMesh) {
    result.topicLabel = 'Convencoes cartograficas';
  }

  if (!result.stateLabel && !result.municipioLabel) return null;
  return result;
}

export function legendItemsFromSession(session = {}) {
  return buildLegendItems({
    elements: session.elements,
    hiddenIds: session.hiddenIds,
    location: buildLocationLegendInput(session),
    order: session.legendItemOrder,
    groupByTopic: session.legendGroupByTopic,
    elementCategories: session.elementCategories,
  });
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
  let elementItems = [];

  for (const type of TYPE_ORDER) {
    for (const group of grouped[type] || []) {
      elementItems.push({
        id: group.key,
        label: group.label,
        symbolKind: group.type,
        style: group.style,
        source: 'element',
        category: group.category,
      });
    }
  }

  elementItems = prioritizeLegendSymbols(
    applyLegendItemOrder(elementItems, input.order),
    {
      groupByTopic: Boolean(input.groupByTopic),
      categoryOrder,
    },
  ).filter((item) => item.source === 'element');

  const location = input.location;
  const locationItems = [];
  if (location?.stateLabel) {
    locationItems.push({
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
    locationItems.push({
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

  let working = [...elementItems, ...locationItems];
  if (input.groupByTopic && locationItems.length && location?.topicLabel) {
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
  }

  return withLegendTopics(working, Boolean(input.groupByTopic), elementCategories);
}

export { categoryBucket };
