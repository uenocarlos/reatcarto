import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function GraticuleOverlay() {
  const map = useMap();

  useEffect(() => {
    const lines = [];
    const drawGrid = () => {
      lines.forEach((l) => l.remove());
      lines.length = 0;
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      let step = 0.25;
      if (zoom > 13) step = 0.02;
      else if (zoom > 11) step = 0.05;
      else if (zoom > 9) step = 0.1;

      const minLat = Math.floor(bounds.getSouth() / step) * step;
      const maxLat = Math.ceil(bounds.getNorth() / step) * step;
      const minLng = Math.floor(bounds.getWest() / step) * step;
      const maxLng = Math.ceil(bounds.getEast() / step) * step;

      for (let lat = minLat; lat <= maxLat; lat = Math.round((lat + step) * 1000) / 1000) {
        lines.push(
          L.polyline(
            [
              [lat, minLng - 1],
              [lat, maxLng + 1],
            ],
            { color: '#333', weight: 0.3, opacity: 0.3, interactive: false }
          ).addTo(map)
        );
        lines.push(
          L.marker([lat, bounds.getWest()], {
            icon: L.divIcon({
              html: `<span style="font-size:8px;color:#333;background:rgba(255,255,255,0.6);padding:0 2px;border-radius:2px;">${lat.toFixed(2)}°</span>`,
              className: '',
              iconAnchor: [0, 5],
            }),
            interactive: false,
          }).addTo(map)
        );
      }

      for (let lng = minLng; lng <= maxLng; lng = Math.round((lng + step) * 1000) / 1000) {
        lines.push(
          L.polyline(
            [
              [minLat - 1, lng],
              [maxLat + 1, lng],
            ],
            { color: '#333', weight: 0.3, opacity: 0.3, interactive: false }
          ).addTo(map)
        );
      }
    };

    drawGrid();
    map.on('moveend zoomend', drawGrid);
    return () => {
      map.off('moveend zoomend', drawGrid);
      lines.forEach((l) => l.remove());
    };
  }, [map]);

  return null;
}
