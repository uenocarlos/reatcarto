import { describe, expect, it } from 'vitest';
import {
  buildElementSyncPayload,
  collapsePendingMutations,
  mergeElementForSync,
  mergeOutboxPayloads,
} from '@/lib/offline/outboxMerge';

describe('offline outbox payload merge', () => {
  it('keeps earlier style when a later patch omits style', () => {
    const merged = mergeOutboxPayloads(
      { style: { icon_name: 'barraca', icon_color: '#111' }, name: 'A' },
      { name: 'B' },
    );
    expect(merged.name).toBe('B');
    expect(merged.style).toMatchObject({ icon_name: 'barraca', icon_color: '#111' });
  });

  it('deep-merges style even when stored as JSON strings', () => {
    const merged = mergeOutboxPayloads(
      { style: JSON.stringify({ icon_name: 'barraca', icon_color: '#111' }) },
      { style: JSON.stringify({ icon_color: '#222' }), name: 'X' },
    );
    expect(merged.name).toBe('X');
    expect(merged.style).toEqual({ icon_name: 'barraca', icon_color: '#222' });
  });

  it('collapses successive updates into one payload that keeps style', () => {
    const { kept, removedIds } = collapsePendingMutations([
      {
        id: '1',
        op: 'update',
        created_at: '2026-01-01T00:00:00.000Z',
        base_version: 3,
        payload: { style: { icon_name: 'barraca', icon_color: '#abc' } },
      },
      {
        id: '2',
        op: 'update',
        created_at: '2026-01-01T00:01:00.000Z',
        base_version: 3,
        payload: { name: 'Ponto 2' },
      },
    ]);

    expect(removedIds).toEqual(['1']);
    expect(kept.id).toBe('2');
    expect(kept.base_version).toBe(3);
    expect(kept.payload.name).toBe('Ponto 2');
    expect(kept.payload.style).toMatchObject({ icon_name: 'barraca', icon_color: '#abc' });
  });

  it('merges later updates into an offline create instead of dropping style', () => {
    const { kept, removedIds } = collapsePendingMutations([
      {
        id: 'c',
        op: 'create',
        created_at: '2026-01-01T00:00:00.000Z',
        payload: {
          name: 'Novo',
          style: { icon_name: 'pin', icon_color: '#F97316' },
        },
      },
      {
        id: 'u',
        op: 'update',
        created_at: '2026-01-01T00:02:00.000Z',
        payload: { style: { icon_name: 'barraca' }, name: 'Acampamento' },
      },
    ]);

    expect(removedIds).toEqual(['u']);
    expect(kept.op).toBe('create');
    expect(kept.payload.name).toBe('Acampamento');
    expect(kept.payload.style).toMatchObject({ icon_name: 'barraca', icon_color: '#F97316' });
  });

  it('queues the full current element so sync does not fall back to defaults', () => {
    const payload = buildElementSyncPayload({
      map_id: 'map-1',
      element_type: 'point',
      geojson: { type: 'Point', coordinates: [-52, -32] },
      name: 'Barraca',
      description: 'campo',
      element_category: 'terra',
      style: JSON.stringify({ icon_name: 'barraca', icon_color: '#123456' }),
      is_publicly_visible: true,
      icon_name: 'ignored-top-level',
    });

    expect(payload.style).toEqual({ icon_name: 'barraca', icon_color: '#123456' });
    expect(payload.name).toBe('Barraca');
    expect(payload).not.toHaveProperty('icon_name');
  });

  it('recovers style from top-level editor fields when style JSON is empty', () => {
    const payload = buildElementSyncPayload({
      map_id: 'map-1',
      element_type: 'point',
      geojson: { type: 'Point', coordinates: [-52, -32] },
      name: 'Ponto',
      style: '{}',
      icon_name: 'barraca',
      icon_color: '#abcdef',
    });
    expect(payload.style).toEqual({ icon_name: 'barraca', icon_color: '#abcdef' });
  });

  it('flush payload keeps the edited style over a default create', () => {
    const payload = mergeElementForSync(
      {
        map_id: 'map-1',
        element_type: 'point',
        geojson: { type: 'Point', coordinates: [-52, -32] },
        name: 'Acampamento',
        style: { icon_name: '/icons/casa.svg', icon_color: '#123456' },
      },
      {
        name: 'Acampamento',
        style: { icon_name: 'pin', icon_color: '#F97316' },
      },
    );
    expect(payload.style.icon_name).toBe('/icons/casa.svg');
    expect(payload.style.icon_color).toBe('#123456');
  });

  it('recovers line style from top-level fields when style JSON is empty', () => {
    const payload = buildElementSyncPayload({
      map_id: 'map-1',
      element_type: 'line',
      geojson: { type: 'LineString', coordinates: [[-52, -32], [-51, -31]] },
      name: 'Trilha',
      style: '{}',
      color: '#123456',
      opacity: 80,
      weight: 6,
      dash_style: 'dashed',
    });
    expect(payload.style).toEqual({
      color: '#123456',
      opacity: 80,
      weight: 6,
      dash_style: 'dashed',
    });
  });

  it('recovers polygon style from top-level fields when style JSON is empty', () => {
    const payload = buildElementSyncPayload({
      map_id: 'map-1',
      element_type: 'polygon',
      geojson: {
        type: 'Polygon',
        coordinates: [[[-52, -32], [-51, -32], [-51, -31], [-52, -32]]],
      },
      name: 'Area',
      style: '{}',
      border_color: '#00aa00',
      border_opacity: 90,
      border_weight: 4,
      border_dash: 'dash-dot',
      fill_color: '#88ff88',
      fill_opacity: 25,
    });
    expect(payload.style).toEqual({
      border_color: '#00aa00',
      border_opacity: 90,
      border_weight: 4,
      border_dash: 'dash-dot',
      fill_color: '#88ff88',
      fill_opacity: 25,
    });
  });

  it('flush payload keeps edited line style over a default create', () => {
    const payload = mergeElementForSync(
      {
        map_id: 'map-1',
        element_type: 'line',
        geojson: { type: 'LineString', coordinates: [[-52, -32], [-51, -31]] },
        name: 'Trilha',
        style: { color: '#123456', opacity: 80, weight: 6, dash_style: 'dashed' },
      },
      {
        name: 'Trilha',
        style: { color: '#F97316', opacity: 100, weight: 3, dash_style: 'solid' },
      },
    );
    expect(payload.style).toMatchObject({
      color: '#123456',
      opacity: 80,
      weight: 6,
      dash_style: 'dashed',
    });
  });

  it('flush payload keeps edited polygon style over a default create', () => {
    const payload = mergeElementForSync(
      {
        map_id: 'map-1',
        element_type: 'polygon',
        geojson: {
          type: 'Polygon',
          coordinates: [[[-52, -32], [-51, -32], [-51, -31], [-52, -32]]],
        },
        name: 'Area',
        style: {
          border_color: '#00aa00',
          fill_color: '#88ff88',
          fill_opacity: 25,
        },
      },
      {
        name: 'Area',
        style: {
          border_color: '#F97316',
          border_opacity: 100,
          border_weight: 2,
          border_dash: 'solid',
          fill_color: '#FED7AA',
          fill_opacity: 40,
        },
      },
    );
    expect(payload.style.border_color).toBe('#00aa00');
    expect(payload.style.fill_color).toBe('#88ff88');
    expect(payload.style.fill_opacity).toBe(25);
  });

  it('flush prefers top-level line fields over a queued default style', () => {
    const payload = mergeElementForSync(
      {
        map_id: 'map-1',
        element_type: 'line',
        geojson: { type: 'LineString', coordinates: [[-52, -32], [-51, -31]] },
        name: 'Trilha',
        style: { color: '#F97316', opacity: 100, weight: 3, dash_style: 'solid' },
        color: '#123456',
        opacity: 80,
        weight: 6,
        dash_style: 'dashed',
      },
      {
        name: 'Trilha',
        style: { color: '#F97316', opacity: 100, weight: 3, dash_style: 'solid' },
      },
    );
    expect(payload.style).toMatchObject({
      color: '#123456',
      opacity: 80,
      weight: 6,
      dash_style: 'dashed',
    });
  });
});
