import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { api, ApiError } from '@/api/apiClient';
import Register from '@/page/Register';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

vi.mock('@/api/apiClient', async () => {
  class ApiError extends Error {
    constructor(code, message, status = 400, fields = {}) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.status = status;
      this.fields = fields;
    }
  }
  return {
    ApiError,
    api: {
      auth: {
        register: vi.fn(),
      },
    },
  };
});

async function submitEmpty() {
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );
  await userEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));
}

describe('Register feedback', () => {
  it('shows field errors instead of failing silently when the form is incomplete', async () => {
    await submitEmpty();
    expect(api.auth.register).not.toHaveBeenCalled();
    expect(screen.getByText('Aceite os Termos de Uso e a Política de Privacidade')).toBeInTheDocument();
  });

  it('toasts connection errors when the API returns no field details', async () => {
    api.auth.register.mockRejectedValueOnce(new ApiError('network_error', 'Network request failed.', 0));

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByLabelText('Usuário'), 'user_ok');
    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('Nome completo'), 'Nome Completo');
    await userEvent.type(screen.getByLabelText('Organização'), 'Org');
    await userEvent.type(screen.getByLabelText('Cargo'), 'Cargo');
    await userEvent.type(screen.getByLabelText('Telefone'), '+5511999999999');
    await userEvent.type(screen.getByLabelText('Senha'), 'Password123!');
    await userEvent.type(screen.getByLabelText('Confirmar senha'), 'Password123!');
    await userEvent.click(screen.getByLabelText(/Aceito os Termos/));
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(toast.error).toHaveBeenCalledWith('Network request failed.');
  });
});
