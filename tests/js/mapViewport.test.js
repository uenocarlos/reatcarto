import { describe, it, expect, beforeEach } from 'vitest';
import {
  readMapSession,
  writeMapSession,
  writeWorkingViewport,
  writeMunicipioLabel,
  readMunicipioLabel,
  resolveInitialMapView,
  viewsAlmostEqual,
  DEFAULT_MAP_VIEW,
} from '@/lib/mapViewport';

describe('mapViewport', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persiste e lê posição e zoom por mapa', () => {
    writeMapSession('map-1', { lat: -32.1, lng: -52.2, zoom: 15 });
    const session = readMapSession('map-1');
    expect(session).toMatchObject({ lat: -32.1, lng: -52.2, zoom: 15 });
    expect(session.updatedAt).toBeTruthy();
  });

  it('preserva municipioLabel ao atualizar viewport de trabalho', () => {
    writeMunicipioLabel('map-1', 'Rio Grande - RS');
    writeWorkingViewport('map-1', { lat: -32.05, lng: -52.08, zoom: 17 });
    expect(readMapSession('map-1')).toMatchObject({
      lat: -32.05,
      lng: -52.08,
      zoom: 17,
      municipioLabel: 'Rio Grande - RS',
      hasWorkingViewport: true,
    });
  });

  it('resolveInitialMapView prioriza área de trabalho manual sobre servidor', () => {
    writeWorkingViewport('map-1', { lat: -32.05, lng: -52.08, zoom: 17 });
    const view = resolveInitialMapView('map-1', {
      center_lat: -32,
      center_lng: -52,
      zoom: 12,
      updated_at: '2026-08-12T12:00:00.000Z',
    });
    expect(view).toMatchObject({ lat: -32.05, lng: -52.08, zoom: 17, hasWorkingViewport: true });
  });

  it('writeMunicipioLabel funciona antes da área de trabalho existir', () => {
    writeMunicipioLabel('map-1', 'Rio Grande - RS');
    expect(readMunicipioLabel('map-1')).toBe('Rio Grande - RS');
  });

  it('resolveInitialMapView usa servidor quando não há sessão local', () => {
    const view = resolveInitialMapView('map-1', {
      center_lat: -30,
      center_lng: -51,
      zoom: 14,
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    expect(view).toMatchObject({ lat: -30, lng: -51, zoom: 14 });
  });

  it('resolveInitialMapView prefere sessão local mais recente', () => {
    writeMapSession('map-1', { lat: -32.05, lng: -52.08, zoom: 17 });
    const view = resolveInitialMapView('map-1', {
      center_lat: -32,
      center_lng: -52,
      zoom: 12,
      updated_at: '2020-01-01T00:00:00.000Z',
    });
    expect(view).toMatchObject({ lat: -32.05, lng: -52.08, zoom: 17 });
  });

  it('resolveInitialMapView usa default quando não há dados', () => {
    const view = resolveInitialMapView('map-1', null);
    expect(view).toMatchObject(DEFAULT_MAP_VIEW);
  });

  it('viewsAlmostEqual compara com tolerância', () => {
    expect(viewsAlmostEqual({ lat: 1, lng: 2, zoom: 13 }, { lat: 1, lng: 2, zoom: 13 })).toBe(true);
    expect(viewsAlmostEqual({ lat: 1, lng: 2, zoom: 13 }, { lat: 1, lng: 2, zoom: 14 })).toBe(false);
  });
});
