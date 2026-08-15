import { describe, expect, it } from 'vitest';
import { validateRegisterForm } from '@/page/Register';

function validForm(overrides = {}) {
  return {
    username: 'user_ok',
    email: 'user@example.com',
    full_name: 'Nome Completo',
    organization: 'Org',
    job_title: 'Cargo',
    phone: '+5511999999999',
    password: 'Password123!',
    password_confirmation: 'Password123!',
    consent: true,
    ...overrides,
  };
}

describe('validateRegisterForm', () => {
  it('requires consent and filled fields before calling the API', () => {
    expect(validateRegisterForm(validForm({ consent: false })).consent).toMatch(/termos/i);
    expect(Object.keys(validateRegisterForm(validForm({ username: '' })))).toContain('username');
  });

  it('rejects mismatched passwords', () => {
    const errors = validateRegisterForm(validForm({ password_confirmation: 'other' }));
    expect(errors.password_confirmation).toMatch(/não coincidem/i);
  });

  it('accepts a complete form', () => {
    expect(validateRegisterForm(validForm())).toEqual({});
  });
});
