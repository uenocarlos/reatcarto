import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppShell, { IDENTITY_CARD_CLASS } from '@/components/layout/AppShell';

export default function AdminAudit() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit', search],
    queryFn: () => api.admin.listAudit({ q: search || undefined, pageSize: 50 }),
  });

  return (
    <AppShell
      title="Administração — Auditoria"
      maxWidth="max-w-4xl"
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to="/admin/users">Usuários</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/maps">Mapas</Link>
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
        <Input placeholder="Buscar ações, alvos ou motivos" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit">Buscar</Button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {(data?.events ?? []).map((ev) => (
            <Card key={ev.id} className={IDENTITY_CARD_CLASS}>
              <CardHeader>
                <CardTitle className="text-base">{ev.action}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="text-muted-foreground">
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
    </AppShell>
  );
}
