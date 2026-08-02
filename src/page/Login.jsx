import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Lock, User } from 'lucide-react';
import { toast } from 'sonner';

export default function Login({ onLoginSuccess }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [accountStatus, setAccountStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({});
    setAccountStatus(null);

    const errors = {};
    if (!identifier.trim()) errors.identifier = 'Informe email ou usuário';
    if (!password) errors.password = 'Informe a senha';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await onLoginSuccess(identifier.trim(), password);
      toast.success('Login realizado com sucesso!');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'account_pending') {
          setAccountStatus('pending');
          toast.error(error.message);
        } else if (error.code === 'account_deactivated') {
          setAccountStatus('deactivated');
          toast.error(error.message);
        } else if (error.code === 'rate_limited') {
          toast.error(error.message);
        } else if (error.fields && Object.keys(error.fields).length) {
          setFieldErrors(error.fields);
        } else {
          toast.error(error.message || 'Credenciais inválidas');
        }
      } else {
        toast.error('Erro de conexão. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="flex justify-center mb-8">
            <div className="bg-primary/10 p-4 rounded-2xl">
              <img src="/logo.png" alt="ReatCarto Logo" className="w-48 h-auto object-contain" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground text-center mb-2">ReatCarto</h1>
          <p className="text-sm text-muted-foreground text-center">
            Entre com email ou usuário para gerenciar seus mapas
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <label htmlFor="identifier" className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4" aria-hidden="true" /> Email ou usuário
              </label>
              <Input
                id="identifier"
                type="text"
                autoComplete="username"
                placeholder="email ou nome_usuario"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="h-11"
                aria-invalid={!!fieldErrors.identifier}
                aria-describedby={fieldErrors.identifier ? 'identifier-error' : undefined}
              />
              {fieldErrors.identifier && (
                <p id="identifier-error" className="text-sm text-destructive" role="alert">
                  {fieldErrors.identifier}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4" aria-hidden="true" /> Senha
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              />
              {fieldErrors.password && (
                <p id="password-error" className="text-sm text-destructive" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {accountStatus === 'pending' && (
              <p className="text-sm text-muted-foreground" role="status">
                Verifique seu email ou{' '}
                <Link to="/verify" className="underline text-primary">
                  reenviar verificação
                </Link>
                .
              </p>
            )}

            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm space-y-2">
            <p>
              <Link to="/forgot-password" className="text-primary underline">
                Esqueci minha senha
              </Link>
            </p>
            <p>
              Não tem conta?{' '}
              <Link to="/register" className="text-primary underline font-medium">
                Cadastre-se
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
