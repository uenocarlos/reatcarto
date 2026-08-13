import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import AppShell, { IDENTITY_CARD_CLASS } from '@/components/layout/AppShell';

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
    <AppShell
      title="Administração — Usuários"
      maxWidth="max-w-4xl"
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to="/admin/maps">Mapas</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/audit">Auditoria</Link>
          </Button>
        </>
      }
    >
      <form
        className="flex gap-2 mb-6"
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
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {(data?.users ?? []).map((u) => (
            <Card key={u.id} className={IDENTITY_CARD_CLASS}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                  <span>
                    {u.full_name} ({u.username})
                  </span>
                  {u.status === 'deactivated' ? (
                    <Badge variant="destructive" className="text-[10px]">Desativado</Badge>
                  ) : (
                    <Badge className="text-[10px] bg-green-600">Ativo</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{u.email}</p>
                <p>
                  <strong>Status:</strong> {u.status} · <strong>Verificado:</strong>{' '}
                  {u.email_verified ? 'sim' : 'não'}
                </p>
                <p className="text-muted-foreground">
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
    </AppShell>
  );
}
