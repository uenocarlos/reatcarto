import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import AuthShell from '@/components/layout/AuthShell';

const REGISTER_FIELDS = [
  ['username', 'Usuário', 'text'],
  ['email', 'Email', 'email'],
  ['full_name', 'Nome completo', 'text'],
  ['organization', 'Organização', 'text'],
  ['job_title', 'Cargo', 'text'],
  ['phone', 'Telefone', 'tel'],
  ['password', 'Senha', 'password'],
  ['password_confirmation', 'Confirmar senha', 'password'],
];

/** @internal Exported for unit tests */
export function validateRegisterForm(form) {
  const errors = {};
  for (const [key, label] of REGISTER_FIELDS) {
    if (!String(form[key] ?? '').trim()) {
      errors[key] = `Informe ${label.toLowerCase()}`;
    }
  }
  if (
    form.password
    && form.password_confirmation
    && form.password !== form.password_confirmation
  ) {
    errors.password_confirmation = 'As senhas não coincidem';
  }
  if (!form.consent) {
    errors.consent = 'Aceite os Termos de Uso e a Política de Privacidade';
  }
  return errors;
}

function applyRegisterError(error, setFieldErrors) {
  const fields = error instanceof ApiError ? error.fields : null;
  if (fields && Object.keys(fields).length) {
    setFieldErrors(fields);
    return;
  }
  if (error instanceof ApiError) {
    toast.error(error.message || 'Não foi possível cadastrar.');
    return;
  }
  toast.error('Erro de conexão. Tente novamente.');
}

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    password_confirmation: '',
    full_name: '',
    organization: '',
    job_title: '',
    phone: '',
    consent: false,
  });

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateRegisterForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      return;
    }

    setLoading(true);
    try {
      const result = await api.auth.register({ ...form, consent_accepted: form.consent });
      if (result.email_verification_required) {
        toast.success('Conta criada! Verifique seu email.');
        navigate('/verify', { state: { email: form.email } });
        return;
      }

      await login(form.username, form.password);
      toast.success('Conta criada com sucesso!');
      navigate('/');
    } catch (error) {
      applyRegisterError(error, setFieldErrors);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Criar conta profissional" wide backTo="/login" showLogo={false}>
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            {REGISTER_FIELDS.map(([key, label, type]) => (
              <div key={key} className="space-y-1">
                <label htmlFor={key} className="text-sm font-medium">
                  {label}
                </label>
                <Input
                  id={key}
                  type={type}
                  value={form[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  aria-invalid={!!fieldErrors[key]}
                />
                {fieldErrors[key] && (
                  <p className="text-sm text-destructive" role="alert">
                    {fieldErrors[key]}
                  </p>
                )}
              </div>
            ))}

            <div className="flex items-start gap-3 py-2">
              <Checkbox
                id="consent"
                checked={form.consent}
                onCheckedChange={(v) => setField('consent', !!v)}
                aria-invalid={!!fieldErrors.consent}
                className="mt-0.5 h-5 w-5"
              />
              <label htmlFor="consent" className="text-sm leading-tight min-h-11 flex items-center">
                Aceito os Termos de Uso e a Política de Privacidade
              </label>
            </div>
            {fieldErrors.consent && (
              <p className="text-sm text-destructive" role="alert">
                {fieldErrors.consent}
              </p>
            )}

            <Button type="submit" className="w-full min-h-11" disabled={loading}>
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm">
            Já tem conta?{' '}
            <Link to="/login" className="text-primary underline">
              Entrar
            </Link>
          </p>
    </AuthShell>
  );
}
