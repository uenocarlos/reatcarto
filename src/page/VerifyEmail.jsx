import React, { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const token = searchParams.get('token');
  const type = searchParams.get('type');
  const [email, setEmail] = useState(location.state?.email || '');
  const [status, setStatus] = useState(token ? 'verifying' : 'pending');
  const [resendLoading, setResendLoading] = useState(false);
  const [deliveryPending, setDeliveryPending] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        await api.auth.verifyEmail(token, type || undefined);
        if (!cancelled) {
          setStatus('verified');
          toast.success('Email verificado com sucesso!');
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          if (error instanceof ApiError) {
            toast.error(error.message);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, type]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Informe seu email');
      return;
    }
    setResendLoading(true);
    try {
      await api.auth.resendVerification(email.trim());
      setDeliveryPending(true);
      toast.success('Se existir conta pendente, enviamos novas instruções.');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'rate_limited') {
        toast.error(error.message);
      } else {
        toast.error('Não foi possível reenviar agora.');
      }
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <CardTitle>Verificação de email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'verifying' && <p role="status">Verificando...</p>}
          {status === 'verified' && (
            <p role="status">
              Conta ativada!{' '}
              <Link to="/login" className="text-primary underline">
                Fazer login
              </Link>
            </p>
          )}
          {status === 'error' && (
            <p role="alert" className="text-destructive">
              Link inválido ou expirado. Solicite um novo envio abaixo.
            </p>
          )}
          {(status === 'pending' || status === 'error') && (
            <form onSubmit={handleResend} className="space-y-3">
              <label htmlFor="email" className="text-sm font-medium">
                Email da conta
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" disabled={resendLoading}>
                {resendLoading ? 'Enviando...' : 'Reenviar verificação'}
              </Button>
              {deliveryPending && (
                <p className="text-sm text-muted-foreground" role="status">
                  Envio registrado. Se houver fila de entrega, aguarde alguns minutos.
                </p>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
