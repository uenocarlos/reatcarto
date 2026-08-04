import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Gallery from '@/page/Gallery';
import PublicMapView from '@/page/PublicMapView';
import { Routes, Route } from 'react-router-dom';

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoadingAuth: false,
    user: null,
  }),
}));

vi.mock('@/api/apiClient', () => ({
  api: {
    public: {
      listMaps: vi.fn().mockResolvedValue({ maps: [], total: 0, page: 1 }),
      getMap: vi.fn().mockResolvedValue({
        id: 1,
        name: 'Public Map',
        center_lat: -30,
        center_lng: -51,
        zoom: 10,
      }),
      listElements: vi.fn().mockResolvedValue({ elements: [] }),
    },
  },
  ApiError: class ApiError extends Error {
    constructor(message, { status, code } = {}) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

function renderWithProviders(ui, { route = '/' } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Export access boundaries', () => {
  it('IT-020: gallery and public views have no export control', async () => {
    renderWithProviders(<Gallery />, { route: '/gallery' });
    expect(screen.queryByRole('button', { name: /exportar/i })).not.toBeInTheDocument();

    renderWithProviders(
      <Routes>
        <Route path="/gallery/:publicId" element={<PublicMapView />} />
      </Routes>,
      { route: '/gallery/demo-public-id' },
    );
    expect(screen.queryByRole('button', { name: /exportar/i })).not.toBeInTheDocument();
  });

  it('IT-021: no standalone private export route registers export shell', async () => {
    const appSource = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8');
    expect(appSource).not.toMatch(/path=["']\/export/);

    renderWithProviders(
      <Routes>
        <Route path="/export/:mapId" element={<div data-testid="fake-export-route">nope</div>} />
        <Route path="*" element={<div data-testid="fallback-route">other</div>} />
      </Routes>,
      { route: '/export/123' },
    );

    expect(screen.queryByTestId('export-map-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('export-entry-button')).not.toBeInTheDocument();
  });
});
