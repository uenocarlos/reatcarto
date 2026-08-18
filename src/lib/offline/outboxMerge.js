/** Visual style keys stored in JSON or copied to the element for offline fallback. */
export const ELEMENT_STYLE_FALLBACK_KEYS = [
  'icon_name',
  'icon_color',
  'custom_icon_url',
  'color',
  'opacity',
  'weight',
  'dash_style',
  'border_color',
  'border_opacity',
  'border_weight',
  'border_dash',
  'fill_color',
  'fill_opacity',
];

export function pickStyleFallbackFields(source = {}) {
  const fallback = {};
  for (const key of ELEMENT_STYLE_FALLBACK_KEYS) {
    const value = source[key];
    if (value == null || value === '') continue;
    fallback[key] = value;
  }
  return fallback;
}

function asStyleObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

/** Parse element style stored as object or JSON string (unwraps one extra encoded layer). */
export function parseStyleValue(value) {
  if (value == null) return null;
  let current = value;
  if (typeof current === 'string') {
    try {
      current = JSON.parse(current);
    } catch {
      return null;
    }
    if (typeof current === 'string') {
      try {
        current = JSON.parse(current);
      } catch {
        return null;
      }
    }
  }
  return asStyleObject(current);
}

function parseGeojsonValue(value) {
  if (value == null) return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Merge successive outbox payloads for the same element.
 * Style objects are deep-merged so a later name-only patch does not drop icon/color.
 */
export function mergeOutboxPayloads(base = {}, next = {}) {
  const merged = { ...base, ...next };
  const baseStyle = parseStyleValue(base?.style);
  const nextStyle = parseStyleValue(next?.style);
  if (baseStyle || nextStyle) {
    merged.style = { ...(baseStyle ?? {}), ...(nextStyle ?? {}) };
  }
  return merged;
}

export function sameResourceId(a, b) {
  if (a == null || b == null) return a == b;
  return String(a) === String(b);
}

/** Prefer stored style JSON; fill missing keys from top-level editor fields. */
export function styleFromElement(element = {}) {
  const parsed = parseStyleValue(element.style) ?? {};
  return { ...pickStyleFallbackFields(element), ...parsed };
}

/**
 * Latest local element wins for style so a queued create-with-defaults
 * cannot wipe a later offline edit on flush.
 */
export function mergeElementForSync(local = {}, payload = {}) {
  const merged = mergeOutboxPayloads(payload, local);
  const combined = {
    ...payload,
    ...local,
    ...merged,
  };
  return buildElementSyncPayload({
    ...combined,
    style: {
      ...styleFromElement(combined),
      ...pickStyleFallbackFields(local),
    },
  });
}

/**
 * Full element fields the sync API understands — never a partial patch.
 * @param {Record<string, unknown>} element
 */
export function buildElementSyncPayload(element = {}) {
  return {
    map_id: element.map_id,
    element_type: element.element_type,
    geojson: parseGeojsonValue(element.geojson),
    name: element.name,
    description: element.description ?? '',
    element_category: element.element_category ?? 'terra',
    style: styleFromElement(element),
    is_publicly_visible: element.is_publicly_visible !== false && element.is_publicly_visible !== 0,
  };
}

/**
 * Collapse pending mutations for one resource into a single row.
 * @param {Array<Record<string, unknown>>} pending
 */
export function collapsePendingMutations(pending = []) {
  if (!pending.length) {
    return { kept: null, removedIds: [] };
  }
  if (pending.length === 1) {
    return { kept: pending[0], removedIds: [] };
  }

  const sorted = [...pending].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
  const removedIdsOf = (keptId) => sorted.filter((row) => row.id !== keptId).map((row) => row.id);

  if (sorted.some((row) => row.op === 'delete')) {
    const finalRow = sorted.find((row) => row.op === 'delete') ?? sorted[sorted.length - 1];
    return {
      kept: { ...finalRow, payload: {} },
      removedIds: removedIdsOf(finalRow.id),
    };
  }

  const createIdx = sorted.findIndex((row) => row.op === 'create');
  if (createIdx !== -1) {
    const createRow = { ...sorted[createIdx], payload: { ...(sorted[createIdx].payload ?? {}) } };
    for (let i = createIdx + 1; i < sorted.length; i += 1) {
      const later = sorted[i];
      if (later.op === 'update') {
        createRow.payload = mergeOutboxPayloads(createRow.payload, later.payload);
      }
    }
    return {
      kept: createRow,
      removedIds: removedIdsOf(createRow.id),
    };
  }

  let mergedPayload = {};
  for (const row of sorted) {
    mergedPayload = mergeOutboxPayloads(mergedPayload, row.payload);
  }
  const finalRow = sorted[sorted.length - 1];
  return {
    kept: {
      ...finalRow,
      payload: mergedPayload,
      base_version: sorted[0].base_version ?? finalRow.base_version,
    },
    removedIds: removedIdsOf(finalRow.id),
  };
}
