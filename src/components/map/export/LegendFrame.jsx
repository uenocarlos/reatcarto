import React, { useCallback, useRef } from 'react';
import { buildLegendGridStyle, isInsideDragEnabled, applyLegendDrag, applyLegendResize } from '@/lib/export/legendLayout';

export default function LegendFrame({
  layoutMode = 'inside',
  legendRect,
  legendItems = [],
  columns = 2,
  fontSizePx = 12,
  spacing = 'normal',
  onLegendRectChange,
  containerRef,
}) {
  const dragState = useRef(null);
  const gridStyle = buildLegendGridStyle(columns, fontSizePx, spacing);
  const insideEnabled = isInsideDragEnabled(layoutMode);

  const legendContent = (
    <>
      <div style={{ marginBottom: '6px' }}>
        <span style={{ fontSize: `${Math.max(10, fontSizePx - 1)}px`, fontWeight: 'bold', color: '#333' }}>Legenda</span>
        <div style={{ width: '100%', height: '1.5px', background: '#F59E0B', marginTop: '2px' }} />
      </div>
      {legendItems.length === 0 ? (
        <span style={{ fontSize: `${fontSizePx}px`, color: '#888' }} data-testid="legend-empty">Sem itens</span>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: gridStyle.gap,
            gridTemplateColumns: gridStyle.gridTemplateColumns,
          }}
          data-testid="legend-grid"
        >
          {legendItems.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <div
                style={{
                  width: `${item.swatchSizePx}px`,
                  height: `${item.swatchSizePx}px`,
                  flexShrink: 0,
                  background: item.elementType === 'polygon' ? item.fillColor : item.color,
                  border: `1px solid ${item.color}`,
                  borderRadius: item.elementType === 'point' ? '50%' : '2px',
                }}
                data-testid="legend-swatch"
              />
              <span
                style={{
                  fontSize: gridStyle.fontSize,
                  color: '#444',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const handlePointerDown = useCallback(
    (event, mode) => {
      if (!insideEnabled || !legendRect) return;
      event.preventDefault();
      dragState.current = {
        mode,
        startX: event.clientX,
        startY: event.clientY,
        rect: { ...legendRect },
      };
    },
    [insideEnabled, legendRect]
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (!dragState.current || !containerRef?.current || !legendRect) return;
      const bounds = containerRef.current.getBoundingClientRect();
      const dx = (event.clientX - dragState.current.startX) / bounds.width;
      const dy = (event.clientY - dragState.current.startY) / bounds.height;
      const next =
        dragState.current.mode === 'resize'
          ? applyLegendResize(dragState.current.rect, dx, dy)
          : applyLegendDrag(dragState.current.rect, dx, dy);
      onLegendRectChange?.(next);
    },
    [containerRef, legendRect, onLegendRectChange]
  );

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
  }, []);

  if (layoutMode === 'inside') {
    const rect = legendRect ?? { x: 0.55, y: 0.55, w: 0.4, h: 0.35 };
    if (legendItems.length === 0) return null;
    return (
      <div
        data-testid="legend-frame-inside"
        style={{
          position: 'absolute',
          left: `${rect.x * 100}%`,
          top: `${rect.y * 100}%`,
          width: `${rect.w * 100}%`,
          height: `${rect.h * 100}%`,
          zIndex: 500,
          background: 'white',
          border: '2px solid #F59E0B',
          borderRadius: '4px',
          padding: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          overflow: 'auto',
          touchAction: 'none',
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div
          style={{ position: 'absolute', top: 2, right: 2, width: 12, height: 12, cursor: insideEnabled ? 'nwse-resize' : 'default', background: '#F59E0B' }}
          onPointerDown={(e) => handlePointerDown(e, 'resize')}
        />
        <div style={{ cursor: insideEnabled ? 'move' : 'default' }} onPointerDown={(e) => handlePointerDown(e, 'drag')}>
          {legendContent}
        </div>
      </div>
    );
  }

  if (layoutMode === 'beside' || layoutMode === 'below') {
    if (legendItems.length === 0) return null;
    return (
      <div
        data-testid={`legend-frame-${layoutMode}`}
        style={{
          flexShrink: 0,
          background: 'white',
          border: '2px solid #F59E0B',
          borderRadius: '4px',
          padding: '8px',
          minWidth: layoutMode === 'beside' ? 140 : undefined,
          minHeight: layoutMode === 'below' ? 80 : undefined,
          overflow: 'auto',
        }}
      >
        {legendContent}
      </div>
    );
  }

  return null;
}
