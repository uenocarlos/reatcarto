import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import AuthShell from '@/components/layout/AuthShell';

export default function PasswordReset() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({});
    setLoading(true);
    try {
      await api.auth.resetPassword(token, password, confirmation);
      toast.success('Senha alterada! Faça login com a nova senha.');
      navigate('/login');
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        setFieldErrors(error.fields);
      } else if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('Erro de conexão.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Nova senha">
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div>
              <label htmlFor="password" className="text-sm font-medium">
                Nova senha
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!fieldErrors.password}
              />
              {fieldErrors.password && (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="confirmation" className="text-sm font-medium">
                Confirmar senha
              </label>
              <Input
                id="confirmation"
                type="password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                aria-invalid={!!fieldErrors.password_confirmation}
              />
              {fieldErrors.password_confirmation && (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.password_confirmation}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading || !token}>
              {loading ? 'Salvando...' : 'Redefinir senha'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm">
            <Link to="/login" className="text-primary underline">
              Voltar ao login
            </Link>
          </p>
    </AuthShell>
  );
}
