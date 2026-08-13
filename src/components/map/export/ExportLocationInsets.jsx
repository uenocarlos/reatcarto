import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, GeoJSON, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { filterPolygonFeatures, computeBrazilOverviewBbox } from './geoPolygonUtils';
import { GraticuleOverlay, MapChromeOverlay, MapInvalidateSize } from './MapChrome';
import { DEFAULT_BRASIL_COLOR, DEFAULT_MUNICIPIO_COLOR, DEFAULT_STATE_COLOR } from '@/lib/export/constants';

const OVERVIEW_INSET_PADDING = [2, 2];
const DETAIL_INSET_PADDING = [16, 16];
const INSET_POLYGON_BORDER = '#1e2937';

function solidFillStyle(fillColor, borderColor = INSET_POLYGON_BORDER) {
  return {
    color: borderColor,
    weight: 1.25,
    opacity: 1,
    fillColor,
    fillOpacity: 1,
  };
}

const MUNICIPIOS_FILE_BY_UF = Object.freeze({
  AC: 'ac',
  AL: 'al',
  AM: 'am',
  AP: 'ap',
  BA: 'ba',
  CE: 'ce',
  DF: 'df',
  ES: 'es',
  GO: 'go',
  MA: 'ma',
  MG: 'mg',
  MS: 'ms',
  MT: 'mt',
  PA: 'pa',
  PB: 'pb',
  PE: 'pe',
  PI: 'pi',
  PR: 'pr',
  RJ: 'rj',
  RN: 'rn',
  RO: 'ro',
  RR: 'rr',
  RS: 'rs',
  SC: 'sc',
  SE: 'se',
  SP: 'sp',
  TO: 'to',
});

async function fetchFeatureCollection(path, fetchFn = fetch) {
  const response = await fetchFn(path);
  if (!response.ok) throw new Error(`Falha ao carregar ${path}`);
  return response.json();
}

function polygonFilter(feature) {
  const type = feature?.geometry?.type;
  return type === 'Polygon' || type === 'MultiPolygon';
}

function featureProp(feature, keys) {
  for (const key of keys) {
    const value = feature?.properties?.[key];
    if (value != null && value !== '') return value;
  }
  return null;
}

function resolveStateName(feature, fallback) {
  return String(featureProp(feature, ['NM_UF', 'nome', 'name', 'SIGLA_UF', 'sigla', 'uf']) ?? fallback ?? '');
}

function resolveMunicipioName(feature, fallback) {
  return String(featureProp(feature, ['NM_MUN', 'nome', 'name', 'CD_MUN', 'id', 'code']) ?? fallback ?? '');
}

function filterStateFeature(collection, ufSigla) {
  const uf = String(ufSigla ?? '').trim().toUpperCase();
  const features = (collection?.features ?? []).filter((feature) => {
    const sigla = String(featureProp(feature, ['SIGLA_UF', 'sigla', 'uf']) ?? '').toUpperCase();
    return sigla === uf;
  });
  return filterPolygonFeatures({ type: 'FeatureCollection', features });
}

function filterMunicipioFeature(collection, municipioCode) {
  const code = String(municipioCode ?? '').trim();
  if (!code) return { type: 'FeatureCollection', features: [] };
  const features = (collection?.features ?? []).filter((feature) => {
    const values = [
      featureProp(feature, ['CD_MUN', 'cod_ibge', 'id', 'code']),
    ].filter(Boolean).map((value) => String(value).trim());
    return values.some((value) => value === code || value.endsWith(code) || code.endsWith(value));
  });
  return filterPolygonFeatures({ type: 'FeatureCollection', features });
}

function FitBoundsAndResize({
  bounds,
  padding = [16, 16],
  fallbackCenter = [-14.235, -51.9253],
  fallbackZoom = 4,
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return undefined;

    const refresh = () => {
      try {
        map.invalidateSize?.({ animate: false });
        if (bounds?.isValid?.()) {
          map.fitBounds(bounds, { padding, animate: false });
        } else {
          map.setView(fallbackCenter, fallbackZoom, { animate: false });
        }
      } catch {
        // noop
      }
    };

    refresh();
    const t1 = window.setTimeout(refresh, 80);
    const t2 = window.setTimeout(refresh, 260);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [map, bounds, padding, fallbackCenter, fallbackZoom]);

  return null;
}

function bboxToLeafletBounds(bbox) {
  if (!bbox) return null;
  try {
    const bounds = L.latLngBounds(
      [bbox.minLat, bbox.minLng],
      [bbox.maxLat, bbox.maxLng],
    );
    return bounds.isValid() ? bounds : null;
  } catch {
    return null;
  }
}

function buildBounds(data) {
  if (!data?.features?.length) return null;
  try {
    return L.geoJSON(data).getBounds();
  } catch {
    return null;
  }
}

function InsetMap({
  inset,
  brasilGeoJson,
  statesGeoJson,
  municipiosGeoJson,
  brasilColor,
  stateColor,
  municipioColor,
}) {
  const stateFeature = useMemo(() => filterStateFeature(statesGeoJson, inset.uf), [statesGeoJson, inset.uf]);
  const municipioFeature = useMemo(
    () => filterMunicipioFeature(municipiosGeoJson, inset.municipioCode),
    [municipiosGeoJson, inset.municipioCode],
  );

  const brasilData = useMemo(() => filterPolygonFeatures(brasilGeoJson), [brasilGeoJson]);
  const statesContext = useMemo(() => filterPolygonFeatures(statesGeoJson), [statesGeoJson]);
  const contextData = inset.kind === 'overview' ? brasilData : statesContext;
  const bounds = useMemo(() => {
    if (inset.kind === 'overview') return bboxToLeafletBounds(computeBrazilOverviewBbox(brasilData));
    if (inset.kind === 'detail' && municipioFeature.features.length) return buildBounds(municipioFeature);
    if (stateFeature.features.length) return buildBounds(stateFeature);
    return buildBounds(contextData);
  }, [brasilData, contextData, municipioFeature, stateFeature, inset.kind]);

  const label = inset.kind === 'overview'
    ? `Brasil · ${inset.stateName || resolveStateName(stateFeature?.features?.[0], inset.uf || 'UF')}`
    : resolveMunicipioName(municipioFeature?.features?.[0], inset.municipioName || inset.municipioCode || 'Municipio');

  return (
    <div className="export-location-inset" data-testid={`export-location-inset-${inset.id}`}>
      <div className="export-location-inset__label">{label}</div>
      <div className="export-location-inset__frame">
        <MapContainer
          center={[-14.235, -51.9253]}
          zoom={7}
          scrollWheelZoom={false}
          dragging={false}
          doubleClickZoom={false}
          touchZoom={false}
          boxZoom={false}
          keyboard={false}
          zoomControl={false}
          attributionControl={false}
          className="export-location-inset__map"
          data-testid={`export-location-inset-map-${inset.id}`}
        >
          <FitBoundsAndResize
            bounds={bounds}
            padding={inset.kind === 'overview' ? OVERVIEW_INSET_PADDING : DETAIL_INSET_PADDING}
            fallbackZoom={inset.kind === 'overview' ? 4 : 6}
          />
          <MapInvalidateSize />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            crossOrigin="anonymous"
          />
          <GraticuleOverlay />

          {inset.kind === 'overview' && brasilData?.features?.length ? (
            <GeoJSON
              key={`brasil-${brasilColor}`}
              data={brasilData}
              filter={polygonFilter}
              interactive={false}
              style={() => solidFillStyle(brasilColor)}
            />
          ) : null}

          {stateFeature?.features?.length ? (
            <GeoJSON
              key={`state-${inset.kind}-${stateColor}`}
              data={stateFeature}
              filter={polygonFilter}
              interactive={false}
              style={() => solidFillStyle(stateColor)}
            />
          ) : null}

          {inset.kind === 'detail' && municipioFeature?.features?.length ? (
            <GeoJSON
              key={`municipio-${municipioColor}`}
              data={municipioFeature}
              filter={polygonFilter}
              interactive={false}
              style={() => solidFillStyle(municipioColor)}
            />
          ) : null}
          <MapChromeOverlay compact />
        </MapContainer>
      </div>
    </div>
  );
}

export default function ExportLocationInsets({
  locationCount = 0,
  locations = [],
  brasilColor = DEFAULT_BRASIL_COLOR,
  stateColor = DEFAULT_STATE_COLOR,
  municipioColor = DEFAULT_MUNICIPIO_COLOR,
  placement = 'side',
  onGeoLoadError,
  onGeoLoadSuccess,
  geoFeaturesOverride = null,
  fetchFn,
}) {
  const [brasilGeoJson, setBrasilGeoJson] = useState(null);
  const [statesGeoJson, setStatesGeoJson] = useState(null);
  const [municipiosGeoJsonByUf, setMunicipiosGeoJsonByUf] = useState({});
  const onGeoLoadErrorRef = useRef(onGeoLoadError);
  const onGeoLoadSuccessRef = useRef(onGeoLoadSuccess);
  const geoFeaturesOverrideRef = useRef(geoFeaturesOverride);
  const fetchFnRef = useRef(fetchFn);
  const requestedUfs = useMemo(
    () => Array.from(new Set(
      (locations ?? [])
        .map((location) => String(location?.uf ?? '').trim().toUpperCase())
        .filter(Boolean),
    )),
    [locations],
  );

  useEffect(() => {
    onGeoLoadErrorRef.current = onGeoLoadError;
    onGeoLoadSuccessRef.current = onGeoLoadSuccess;
    geoFeaturesOverrideRef.current = geoFeaturesOverride;
    fetchFnRef.current = fetchFn;
  }, [onGeoLoadError, onGeoLoadSuccess, geoFeaturesOverride, fetchFn]);

  useEffect(() => {
    if (locationCount === 0) {
      setBrasilGeoJson(null);
      setStatesGeoJson(null);
      setMunicipiosGeoJsonByUf({});
      return undefined;
    }

    if (geoFeaturesOverrideRef.current) {
      const override = geoFeaturesOverrideRef.current;
      setBrasilGeoJson(override.brasil ?? null);
      setStatesGeoJson(override.states ?? null);
      if (override.municipios && typeof override.municipios === 'object' && override.municipios.type !== 'FeatureCollection' && !Array.isArray(override.municipios)) {
        setMunicipiosGeoJsonByUf(override.municipios);
      } else {
        setMunicipiosGeoJsonByUf(Object.fromEntries(
          requestedUfs.map((uf) => [uf, override.municipios ?? null]),
        ));
      }
      onGeoLoadSuccessRef.current?.();
      return undefined;
    }

    let cancelled = false;
    const doFetch = fetchFnRef.current || fetch;

    (async () => {
      try {
        const [brasilData, statesData, ...municipiosEntries] = await Promise.all([
          fetchFeatureCollection('/geo/brasil.geojson', doFetch),
          fetchFeatureCollection('/geo/ufs.geojson', doFetch),
          ...requestedUfs.map(async (uf) => {
            const fileId = MUNICIPIOS_FILE_BY_UF[uf] || uf.toLowerCase();
            const data = await fetchFeatureCollection(`/geo/municipios/${fileId}.geojson`, doFetch);
            return [uf, data];
          }),
        ]);
        if (cancelled) return;
        setBrasilGeoJson(brasilData);
        setStatesGeoJson(statesData);
        setMunicipiosGeoJsonByUf(Object.fromEntries(municipiosEntries));
        onGeoLoadSuccessRef.current?.();
      } catch (error) {
        if (!cancelled) onGeoLoadErrorRef.current?.(String(error?.message ?? error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locationCount, requestedUfs]);

  if (locationCount === 0) return null;

  const primary = locations[0] ?? {
    uf: null,
    stateName: null,
    municipioCode: null,
    municipioName: null,
  };
  const insets = locationCount === 2
    ? [
        {
          id: 0,
          kind: 'overview',
          uf: primary.uf,
          stateName: primary.stateName,
          municipioCode: primary.municipioCode,
          municipioName: primary.municipioName,
        },
        {
          id: 1,
          kind: 'detail',
          uf: primary.uf,
          stateName: primary.stateName,
          municipioCode: primary.municipioCode,
          municipioName: primary.municipioName,
        },
      ]
    : [
        {
          id: 0,
          kind: 'overview',
          uf: primary.uf,
          stateName: primary.stateName,
          municipioCode: primary.municipioCode,
          municipioName: primary.municipioName,
        },
      ];

  return (
    <div
      className={`export-location-insets export-location-insets--${placement}`}
      data-testid="export-location-insets"
      data-placement={placement}
    >
      {insets.map((inset) => (
        <InsetMap
          key={`${inset.kind}-${inset.uf || 'none'}-${inset.municipioCode || ''}`}
          inset={inset}
          brasilGeoJson={brasilGeoJson}
          statesGeoJson={statesGeoJson}
          municipiosGeoJson={municipiosGeoJsonByUf?.[String(inset.uf ?? '').trim().toUpperCase()] ?? null}
          brasilColor={brasilColor}
          stateColor={stateColor}
          municipioColor={municipioColor}
        />
      ))}
    </div>
  );
}
