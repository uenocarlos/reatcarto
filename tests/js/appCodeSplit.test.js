import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/App.jsx'),
  'utf8'
);

describe('App route code-splitting', () => {
  it('lazy-loads MapEditor instead of importing it into the initial bundle', () => {
    expect(appSource).toMatch(/lazy\(\s*\(\)\s*=>\s*import\(['"]\.\/page\/MapEditor['"]\)/);
    expect(appSource).not.toMatch(/import\s+MapEditor\s+from/);
  });

  it('keeps login on the critical path and lazy-loads the dashboard', () => {
    expect(appSource).toMatch(/LoginRoute/);
    expect(appSource).toMatch(/lazy\(\s*\(\)\s*=>\s*import\(['"]\.\/page\/DashBoard['"]\)/);
    expect(appSource).not.toMatch(/import\s+Dashboard\s+from/);
  });
});

const dashboardSource = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/page/DashBoard.jsx'),
  'utf8'
);

describe('Dashboard leaflet deferral', () => {
  it('does not statically import LeafletMap on the maps list', () => {
    expect(dashboardSource).toMatch(/lazy\(\s*\(\)\s*=>\s*import\(['"]@\/components\/map\/LeafletMap['"]\)/);
    expect(dashboardSource).not.toMatch(/import LeafletMap from/);
  });
});
