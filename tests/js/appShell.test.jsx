import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({
    user: { full_name: 'Admin Teste', role: 'admin' },
    logout: vi.fn(),
    confirmLogoutDiscard: vi.fn(),
  }),
}));

describe('AppShell visual identity', () => {
  it('renders greeting, page title and primary navigation', () => {
    render(
      <MemoryRouter>
        <AppShell title="Meus Mapas">
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByText('Bem vindo,')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Admin Teste!' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Meus Mapas' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Meus Mapas' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Perfil' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('keeps the orange header at a fixed width and height', () => {
    const { container } = render(
      <MemoryRouter>
        <AppShell title="Perfil" maxWidth="max-w-2xl">
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>
    );

    const headerInner = container.querySelector('header > div');
    expect(headerInner.className).toContain('max-w-6xl');
    expect(headerInner.className).toContain('min-h-[7.5rem]');
    expect(headerInner).toHaveClass('py-6');
  });

  it('renders guest gallery chrome without account navigation', () => {
    render(
      <MemoryRouter>
        <AppShell guest guestTitle="Galeria Pública" guestSubtitle="Mapas publicados pela comunidade">
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Galeria Pública' })).toBeInTheDocument();
    expect(screen.getByText('Mapas publicados pela comunidade')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryByText('Bem vindo,')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Perfil' })).not.toBeInTheDocument();
  });
});
