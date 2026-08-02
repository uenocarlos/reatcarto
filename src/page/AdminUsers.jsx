import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [reasonByUser, setReasonByUser] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => api.admin.listUsers({ q: search || undefined }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status, reason }) => api.admin.setUserStatus(userId, status, reason),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(
        vars.status === 'deactivate' ? 'Conta desativada' : 'Conta reativada'
      );
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : 'Falha na operação');
    },
  });

  const handleStatus = async (userId, status) => {
    const reason = (reasonByUser[userId] || '').trim();
    if (!reason) {
      toast.error('Informe um motivo para esta ação.');
      return;
    }
    await statusMutation.mutateAsync({ userId, status, reason });
  };

  return (
    <div className="min-h-screen bg-background p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Administração — Usuários</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/maps">Mapas</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/audit">Auditoria</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">Voltar</Link>
          </Button>
        </div>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <Input
          placeholder="Buscar por nome, email ou usuário"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit">Buscar</Button>
      </form>

      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <div className="space-y-4">
          {(data?.users ?? []).map((u) => (
            <Card key={u.id}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {u.full_name} ({u.username})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>{u.email}</p>
                <p>
                  Status: <strong>{u.status}</strong> · Verificado:{' '}
                  {u.email_verified ? 'sim' : 'não'}
                </p>
                <p>
                  {u.organization} — {u.job_title}
                </p>
                <Input
                  placeholder="Motivo obrigatório"
                  value={reasonByUser[u.id] || ''}
                  onChange={(e) =>
                    setReasonByUser((prev) => ({ ...prev, [u.id]: e.target.value }))
                  }
                />
                <div className="flex gap-2">
                  {u.status !== 'deactivated' ? (
                    <Button
                      variant="destructive"
                      disabled={statusMutation.isPending}
                      onClick={() => handleStatus(u.id, 'deactivate')}
                    >
                      Desativar
                    </Button>
                  ) : (
                    <Button
                      disabled={statusMutation.isPending || !u.email_verified}
                      onClick={() => handleStatus(u.id, 'activate')}
                    >
                      Reativar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {(data?.users ?? []).length === 0 && (
            <p className="text-muted-foreground">Nenhum usuário encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}
