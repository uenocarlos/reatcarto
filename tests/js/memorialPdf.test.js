import { describe, expect, it } from 'vitest';
import { buildMemorial } from '@/lib/memorial/geometry';
import { createMemorialPdf } from '@/lib/memorial/generateMemorialPdf';

function polygonWithVertices(count) {
  const center = [-52.1, -32];
  const ring = Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count;
    return [center[0] + Math.cos(angle) * 0.01, center[1] + Math.sin(angle) * 0.01];
  });
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

describe('memorial PDF', () => {
  it('creates a valid PDF with a stable file name', () => {
    const memorial = buildMemorial(polygonWithVertices(4));
    const { doc, fileName } = createMemorialPdf({
      memorial,
      title: 'Memorial da Área Norte',
      mapName: 'Mapa Costeiro',
      polygonName: 'Área Norte',
      generatedAt: new Date('2026-08-05T12:00:00-03:00'),
    });
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toContain('%PDF-');
    expect(bytes.length).toBeGreaterThan(3000);
    expect(fileName).toBe('memorial-da-area-norte.pdf');
  });

  it('paginates polygons with many vertices', () => {
    const memorial = buildMemorial(polygonWithVertices(75));
    const { doc } = createMemorialPdf({ memorial, title: 'Memorial extenso' });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});
