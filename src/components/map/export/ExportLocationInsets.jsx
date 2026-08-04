import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, GeoJSON, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { filterPolygonFeatures } from './geoPolygonUtils';
import { GraticuleOverlay, MapChromeOverlay } from './MapChrome';

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

function FitBoundsAndResize({ bounds, fallbackCenter = [-14.235, -51.9253], fallbackZoom = 4 }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return undefined;

    const refresh = () => {
      try {
        map.invalidateSize?.({ animate: false });
        if (bounds?.isValid?.()) {
          map.fitBounds(bounds, { padding: [16, 16], animate: false });
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
  }, [map, bounds, fallbackCenter, fallbackZoom]);

  return null;
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
  stateColor,
  municipioColor,
}) {
  const stateFeature = useMemo(() => filterStateFeature(statesGeoJson, inset.uf), [statesGeoJson, inset.uf]);
  const municipioFeature = useMemo(
    () => filterMunicipioFeature(municipiosGeoJson, inset.municipioCode),
    [municipiosGeoJson, inset.municipioCode],
  );

  const contextData = inset.kind === 'overview'
    ? filterPolygonFeatures(brasilGeoJson)
    : filterPolygonFeatures(statesGeoJson);
  const bounds = useMemo(() => {
    if (inset.kind === 'detail' && municipioFeature.features.length) return buildBounds(municipioFeature);
    if (stateFeature.features.length) return buildBounds(stateFeature);
    return buildBounds(contextData);
  }, [contextData, municipioFeature, stateFeature, inset.kind]);

  const label = inset.kind === 'overview'
    ? `Brasil · ${inset.stateName || resolveStateName(stateFeature?.features?.[0], inset.uf || 'UF')}`
    : resolveMunicipioName(municipioFeature?.features?.[0], inset.municipioName || inset.municipioCode || 'Municipio');

  return (
    <div className="export-location-inset" data-testid={`export-location-inset-${inset.id}`}>
      <div className="export-location-inset__label">{label}</div>
      <div className="export-location-inset__frame">
        <MapContainer
          center={[-14.235, -51.9253]}
          zoom={4}
          scrollWheelZoom={false}
          dragging={false}
          zoomControl={false}
          attributionControl={false}
          className="export-location-inset__map"
          data-testid={`export-location-inset-map-${inset.id}`}
        >
          <FitBoundsAndResize bounds={bounds} />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            crossOrigin="anonymous"
          />
          <GraticuleOverlay />

          {contextData?.features?.length ? (
            <GeoJSON
              data={contextData}
              filter={polygonFilter}
              style={() => ({
                // Mantem o enquadramento geografico sem desenhar o contorno do Brasil.
                color: 'transparent',
                weight: 0,
                fillColor: '#f8fafc',
                fillOpacity: inset.kind === 'overview' ? 0.22 : 0.14,
              })}
            />
          ) : null}

          {stateFeature?.features?.length ? (
            <GeoJSON
              data={stateFeature}
              filter={polygonFilter}
              style={() => ({
                color: 'transparent',
                weight: 0,
                fillColor: stateColor,
                fillOpacity: inset.kind === 'overview' ? 0.5 : 0.2,
              })}
            />
          ) : null}

          {inset.kind === 'detail' && municipioFeature?.features?.length ? (
            <GeoJSON
              data={municipioFeature}
              filter={polygonFilter}
              style={() => ({
                color: 'transparent',
                weight: 0,
                fillColor: municipioColor,
                fillOpacity: 0.62,
              })}
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
  stateColor = '#D9E6A4',
  municipioColor = '#E6A4A4',
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
          stateColor={stateColor}
          municipioColor={municipioColor}
        />
      ))}
    </div>
  );
}
