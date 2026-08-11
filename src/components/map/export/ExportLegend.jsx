import React, { useCallback, useMemo, useRef, useState } from 'react';
import { getIconSvg } from '@/components/map/iconSvgs';

/** Resolve CSS stroke-dasharray from style dash fields. */
function dashArrayFromStyle(dash) {
  const key = String(dash ?? 'solid').toLowerCase();
  if (key === 'dashed' || key === 'dash') return '6 4';
  if (key === 'dash-dot' || key === 'dashdot') return '8 3 2 3';
  if (key === 'dotted' || key === 'dot') return '2 3';
  return null;
}

const SYMBOL_BOX = 24;

function LegendSymbol({ item }) {
  const style = item.style ?? {};

  if (item.symbolKind === 'topic') return null;

  if (item.symbolKind === 'line') {
    const color = style.color || '#F97316';
    const weight = Math.max(1, Math.min(6, Number(style.weight) || 3));
    const opacity = Math.max(0.15, Math.min(1, (Number(style.opacity) || 100) / 100));
    const dash = dashArrayFromStyle(style.dash_style);
    return (
      <span className="export-legend__symbol export-legend__symbol--line-wrap" aria-hidden>
        <svg width={SYMBOL_BOX} height={SYMBOL_BOX} viewBox={`0 0 ${SYMBOL_BOX} ${SYMBOL_BOX}`}>
          <line
            x1="2"
            y1={SYMBOL_BOX / 2}
            x2={SYMBOL_BOX - 2}
            y2={SYMBOL_BOX / 2}
            stroke={color}
            strokeWidth={weight}
            strokeOpacity={opacity}
            strokeDasharray={dash || undefined}
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }

  if (item.symbolKind === 'polygon' || item.symbolKind === 'region') {
    const fill = style.fill_color || '#D9E6A4';
    const border = style.border_color || '#666';
    const borderW = Math.max(0.5, Math.min(3, Number(style.border_weight) || 1));
    const fillOpacity = Math.max(0.05, Math.min(1, (Number.isFinite(Number(style.fill_opacity)) ? Number(style.fill_opacity) : 70) / 100));
    const borderOpacity = Math.max(0.15, Math.min(1, (Number.isFinite(Number(style.border_opacity)) ? Number(style.border_opacity) : 100) / 100));
    const dash = dashArrayFromStyle(style.border_dash);
    return (
      <span className="export-legend__symbol export-legend__symbol--polygon-wrap" aria-hidden>
        <svg width={SYMBOL_BOX} height={SYMBOL_BOX} viewBox={`0 0 ${SYMBOL_BOX} ${SYMBOL_BOX}`}>
          <rect
            x="2"
            y="2"
            width={SYMBOL_BOX - 4}
            height={SYMBOL_BOX - 4}
            rx="1"
            fill={fill}
            fillOpacity={fillOpacity}
            stroke={border}
            strokeOpacity={borderOpacity}
            strokeWidth={borderW}
            strokeDasharray={dash || undefined}
          />
        </svg>
      </span>
    );
  }

  // point: named icon / custom url / colored circle
  const color = style.icon_color || '#F97316';
  const iconUrl = style.custom_icon_url
    || (style.icon_name && (String(style.icon_name).startsWith('/')
      || String(style.icon_name).startsWith('http')
      || String(style.icon_name).endsWith('.svg'))
      ? style.icon_name
      : null);

  if (iconUrl) {
    return (
      <span
        className="export-legend__symbol export-legend__symbol--point-icon"
        style={{
          backgroundColor: color,
          WebkitMaskImage: `url(${iconUrl})`,
          maskImage: `url(${iconUrl})`,
        }}
        aria-hidden
      />
    );
  }

  const iconName = style.icon_name || 'pin';
  const svg = getIconSvg(iconName, color);
  if (svg) {
    return (
      <span
        className="export-legend__symbol export-legend__symbol--point-svg"
        aria-hidden
        // SVG from trusted local icon set
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  return (
    <span
      className="export-legend__symbol export-legend__symbol--point"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

const RESIZE_HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

/**
 * Interactive legend: title "Legenda", orange border, drag via header, resize handles.
 * Move/resize use live DOM + local state so the box follows the pointer fluidly.
 */
export default function ExportLegend({
  items = [],
  legendPosition = 'inside',
  legendColumns = 1,
  legendFontPx = 12,
  legendSpacing = 'normal',
  legendInside = { xPct: 5, yPct: 5, wPct: 30, hPct: 40 },
  legendRightWidthPct = 25,
  onLegendInsideChange,
  onLegendRightWidthChange,
  // onLegendItemOrderChange mantido na API da legenda (reordenação por handle removida da UI)
  onLegendItemOrderChange: _onLegendItemOrderChange,
  showMetricControls = false,
}) {
  void _onLegendItemOrderChange;
  const rootRef = useRef(null);
  const dragState = useRef(null);
  const [liveInside, setLiveInside] = useState(null);
  const [liveRightWidth, setLiveRightWidth] = useState(null);

  const effectiveInside = liveInside || legendInside;
  const effectiveRightWidth = liveRightWidth ?? legendRightWidthPct;

  const interactive = legendPosition === 'inside' || legendPosition === 'right';
  const canMove = legendPosition === 'inside' && Boolean(onLegendInsideChange);
  const canResizeInside = legendPosition === 'inside' && Boolean(onLegendInsideChange);
  const canResizeRight = legendPosition === 'right' && Boolean(onLegendRightWidthChange);
  const positionClass = `export-legend--${legendPosition}`;

  /** Each chosen column keeps enough room for its symbol and wrapped label. */
  const rightMinPx = Math.max(160, legendColumns * 120);

  const layoutStyle = useMemo(() => {
    if (legendPosition === 'inside') {
      return {
        left: `${effectiveInside.xPct}%`,
        top: `${effectiveInside.yPct}%`,
        width: `${effectiveInside.wPct}%`,
        minHeight: `${effectiveInside.hPct}%`,
        height: 'auto',
        maxHeight: '92%',
        fontSize: `${legendFontPx}px`,
      };
    }
    if (legendPosition === 'right') {
      return {
        width: `${effectiveRightWidth}%`,
        minWidth: `${rightMinPx}px`,
        fontSize: `${legendFontPx}px`,
      };
    }
    return { fontSize: `${legendFontPx}px` };
  }, [
    effectiveInside,
    effectiveRightWidth,
    legendFontPx,
    legendPosition,
    rightMinPx,
  ]);

  const hostMetrics = useCallback(() => {
    const host = rootRef.current?.closest('.export-composition__main-map-region')
      || rootRef.current?.closest('.export-composition__body');
    const rect = host?.getBoundingClientRect();
    return {
      width: rect?.width || 1000,
      height: rect?.height || 800,
    };
  }, []);

  const clampInside = useCallback((next) => {
    const w = Math.max(12, Math.min(90, next.wPct));
    const h = Math.max(12, Math.min(90, next.hPct));
    return {
      xPct: Math.max(0, Math.min(100 - w, next.xPct)),
      yPct: Math.max(0, Math.min(100 - h, next.yPct)),
      wPct: w,
      hPct: h,
    };
  }, []);

  const applyInsideLive = useCallback((next) => {
    const clamped = clampInside(next);
    setLiveInside(clamped);
    const el = rootRef.current;
    if (el) {
      el.style.left = `${clamped.xPct}%`;
      el.style.top = `${clamped.yPct}%`;
      el.style.width = `${clamped.wPct}%`;
      el.style.minHeight = `${clamped.hPct}%`;
      el.style.height = 'auto';
      el.style.maxHeight = '92%';
    }
    return clamped;
  }, [clampInside]);

  const applyRightLive = useCallback((widthPct) => {
    const w = Math.max(10, Math.min(50, widthPct));
    setLiveRightWidth(w);
    const el = rootRef.current;
    if (el) el.style.width = `${w}%`;
    return w;
  }, []);

  const endInteraction = useCallback(() => {
    const st = dragState.current;
    dragState.current = null;

    if (!st) return;

    if ((st.mode === 'move' || st.mode === 'resize') && st.last && onLegendInsideChange) {
      onLegendInsideChange(st.last);
      setLiveInside(null);
    }
    if (st.mode === 'right-resize' && st.last != null && onLegendRightWidthChange) {
      onLegendRightWidthChange(st.last);
      setLiveRightWidth(null);
    }
  }, [onLegendInsideChange, onLegendRightWidthChange]);

  const onDragStart = useCallback((event) => {
    if (!canMove) return;
    event.preventDefault();
    event.stopPropagation();
    dragState.current = {
      mode: 'move',
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...effectiveInside },
      last: { ...effectiveInside },
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [canMove, effectiveInside]);

  const onResizeStart = useCallback((handle, event) => {
    if (canResizeInside) {
      event.preventDefault();
      event.stopPropagation();
      dragState.current = {
        mode: 'resize',
        handle,
        startX: event.clientX,
        startY: event.clientY,
        origin: { ...effectiveInside },
        last: { ...effectiveInside },
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    if (canResizeRight) {
      event.preventDefault();
      event.stopPropagation();
      dragState.current = {
        mode: 'right-resize',
        startX: event.clientX,
        originWidth: effectiveRightWidth,
        last: effectiveRightWidth,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
  }, [canResizeInside, canResizeRight, effectiveInside, effectiveRightWidth]);

  const onPointerMove = useCallback((event) => {
    const st = dragState.current;
    if (!st) return;

    const { width, height } = hostMetrics();

    if (st.mode === 'move') {
      const dxPct = ((event.clientX - st.startX) / width) * 100;
      const dyPct = ((event.clientY - st.startY) / height) * 100;
      st.last = applyInsideLive({
        ...st.origin,
        xPct: st.origin.xPct + dxPct,
        yPct: st.origin.yPct + dyPct,
      });
      return;
    }

    if (st.mode === 'resize') {
      const dxPct = ((event.clientX - st.startX) / width) * 100;
      const dyPct = ((event.clientY - st.startY) / height) * 100;
      let { xPct, yPct, wPct, hPct } = st.origin;
      const h = st.handle;

      if (h.includes('e')) wPct = st.origin.wPct + dxPct;
      if (h.includes('s')) hPct = st.origin.hPct + dyPct;
      if (h.includes('w')) {
        wPct = st.origin.wPct - dxPct;
        xPct = st.origin.xPct + dxPct;
      }
      if (h.includes('n')) {
        hPct = st.origin.hPct - dyPct;
        yPct = st.origin.yPct + dyPct;
      }

      st.last = applyInsideLive({ xPct, yPct, wPct, hPct });
      return;
    }

    if (st.mode === 'right-resize') {
      const deltaPct = ((st.startX - event.clientX) / width) * 100;
      st.last = applyRightLive(st.originWidth + deltaPct);
    }
  }, [applyInsideLive, applyRightLive, hostMetrics]);

  const displayItems = items;

  return (
    <div
      ref={rootRef}
      className={[
        'export-legend',
        positionClass,
        `export-legend--spacing-${legendSpacing}`,
        interactive ? 'export-legend--interactive' : 'export-legend--static',
        liveInside || liveRightWidth != null ? 'export-legend--live' : '',
      ].filter(Boolean).join(' ')}
      data-testid="export-legend"
      data-legend-position={legendPosition}
      style={layoutStyle}
      onPointerMove={onPointerMove}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
    >
      <div
        className={`export-legend__header${canMove ? ' export-legend__header--draggable' : ''}`}
        data-testid="export-legend-drag-handle"
        onPointerDown={canMove ? onDragStart : undefined}
      >
        <span className="export-legend__title">Legenda</span>
        {canMove ? (
          <span
            className="export-legend__drag-hint"
            data-export-exclude="true"
            aria-hidden
            title="Arrastar"
          >
            ⠿
          </span>
        ) : null}
      </div>
      <div className="export-legend__rule" aria-hidden />

      {canResizeRight ? (
        <button
          type="button"
          className="export-legend__resize-handle export-legend__resize-handle--edge-w"
          data-testid="export-legend-resize-handle"
          data-export-exclude="true"
          aria-label="Redimensionar legenda"
          onPointerDown={(event) => onResizeStart('w', event)}
        />
      ) : null}

      {showMetricControls && legendPosition === 'right' ? (
        <label className="export-legend__metric-control" hidden>
          Largura (%)
          <input
            type="number"
            min={10}
            max={50}
            value={effectiveRightWidth}
            data-testid="export-legend-width-input"
            onChange={(event) => onLegendRightWidthChange?.(Number(event.target.value))}
          />
        </label>
      ) : null}

      <div
        className="export-legend__items"
        style={{ gridTemplateColumns: `repeat(${legendColumns}, minmax(0, 1fr))` }}
      >
        {displayItems.map((item) => {
          if (item.symbolKind === 'topic') {
            return (
              <div
                key={item.id}
                className="export-legend__topic"
                data-testid="export-legend-topic"
                style={{ gridColumn: `1 / span ${legendColumns}` }}
              >
                {item.label}
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className="export-legend__item"
              data-testid="export-legend-item"
            >
              <LegendSymbol item={item} />
              <span className="export-legend__label">{item.label}</span>
            </div>
          );
        })}
      </div>

      {canResizeInside
        ? RESIZE_HANDLES.map((handle) => (
          <button
            key={handle}
            type="button"
            className={`export-legend__rh export-legend__rh--${handle}`}
            data-testid={`export-legend-rh-${handle}`}
            data-export-exclude="true"
            aria-label={`Redimensionar ${handle}`}
            onPointerDown={(event) => onResizeStart(handle, event)}
          />
        ))
        : null}
    </div>
  );
}
