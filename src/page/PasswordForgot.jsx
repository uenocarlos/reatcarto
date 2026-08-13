import React, { useState } from 'react';
import { api, ApiError } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import AuthShell from '@/components/layout/AuthShell';

export default function PasswordForgot() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.auth.requestPasswordReset(email.trim());
      setSubmitted(true);
      toast.success('Se existir conta, enviamos instruções de recuperação.');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('Erro de conexão.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Recuperar senha" backTo="/login" showLogo={false}>
          {submitted ? (
            <p role="status">
              Se existir conta para esse email, enviamos instruções. Verifique sua caixa de entrada.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar link'}
              </Button>
            </form>
          )}
    </AuthShell>
  );
}
