import { Link, useLocation } from 'react-router-dom';
import { api } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { IDENTITY_CARD_CLASS } from '@/components/layout/identity';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  const { data: authData, isFetched } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        const user = await api.auth.me();
        return { user, isAuthenticated: true };
      } catch {
        return { user: null, isAuthenticated: false };
      }
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background font-inter">
      <Card className={`max-w-md w-full ${IDENTITY_CARD_CLASS}`}>
        <CardContent className="pt-8 text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-7xl font-light text-primary/30">404</h1>
            <div className="h-0.5 w-16 bg-primary/30 mx-auto" />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-foreground">Página não encontrada</h2>
            <p className="text-muted-foreground leading-relaxed">
              A página <span className="font-medium text-foreground">"{pageName}"</span> não existe neste
              aplicativo.
            </p>
          </div>

          {isFetched && authData?.isAuthenticated && authData.user?.role === 'admin' && (
            <div className="mt-4 p-4 bg-accent rounded-lg border text-left">
              <p className="text-sm font-medium text-accent-foreground">Nota de admin</p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                Esta rota ainda pode não ter sido implementada.
              </p>
            </div>
          )}

          <div className="pt-2">
            <Button asChild>
              <Link to="/">Voltar ao início</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
