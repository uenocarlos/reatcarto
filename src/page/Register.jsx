import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import AuthShell from '@/components/layout/AuthShell';

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
    setFieldErrors({});
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
      if (error instanceof ApiError && error.fields) {
        setFieldErrors(error.fields);
      } else if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('Erro de conexão. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    ['username', 'Usuário', 'text'],
    ['email', 'Email', 'email'],
    ['full_name', 'Nome completo', 'text'],
    ['organization', 'Organização', 'text'],
    ['job_title', 'Cargo', 'text'],
    ['phone', 'Telefone', 'tel'],
    ['password', 'Senha', 'password'],
    ['password_confirmation', 'Confirmar senha', 'password'],
  ];

  return (
    <AuthShell title="Criar conta profissional" wide>
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            {fields.map(([key, label, type]) => (
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

            <div className="flex items-start gap-2">
              <Checkbox
                id="consent"
                checked={form.consent}
                onCheckedChange={(v) => setField('consent', !!v)}
                aria-invalid={!!fieldErrors.consent}
              />
              <label htmlFor="consent" className="text-sm leading-tight">
                Aceito os Termos de Uso e a Política de Privacidade
              </label>
            </div>
            {fieldErrors.consent && (
              <p className="text-sm text-destructive" role="alert">
                {fieldErrors.consent}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
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
