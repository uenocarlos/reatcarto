import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminAudit() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit', search],
    queryFn: () => api.admin.listAudit({ q: search || undefined, pageSize: 50 }),
  });

  return (
    <div className="min-h-screen bg-background p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">Administração — Auditoria</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/users">Usuários</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/maps">Mapas</Link>
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
        <Input placeholder="Buscar ações, alvos ou motivos" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit">Buscar</Button>
      </form>

      {isLoading ? (
        <p>Carregando…</p>
      ) : (
        <div className="space-y-3">
          {(data?.events ?? []).map((ev) => (
            <Card key={ev.id}>
              <CardHeader>
                <CardTitle className="text-base">{ev.action}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>
                  {ev.created_at} · {ev.actor_role} · alvo {ev.target_type}/{ev.target_id}
                </p>
                {ev.reason && <p>Motivo: {ev.reason}</p>}
              </CardContent>
            </Card>
          ))}
          {(data?.events ?? []).length === 0 && (
            <p className="text-muted-foreground">Nenhum evento encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}
