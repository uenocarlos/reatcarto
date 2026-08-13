import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Chrome das telas públicas de autenticação: fundo branco + logo acima do card.
 */
export default function AuthShell({ title, description, children, wide = false, backTo, showLogo = true }) {
  const hasHeader = Boolean(title || description);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4 font-inter">
      <div className={cn('w-full', wide ? 'max-w-lg' : 'max-w-sm')}>
        {showLogo ? (
          <div className="flex justify-center mb-8">
            <img src="/logo.png" alt="ReatCarto" className="w-40 h-auto object-contain" />
          </div>
        ) : null}
        {backTo ? (
          <div className="mb-4">
            <Button variant="outline" size="sm" asChild>
              <Link to={backTo}>
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Link>
            </Button>
          </div>
        ) : null}
        <Card className="w-full shadow-2xl">
          {hasHeader ? (
            <CardHeader className="space-y-1 flex flex-col items-center">
              {title ? (
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-center">{title}</h1>
              ) : null}
              {description ? (
                <p className="text-sm text-muted-foreground text-center">{description}</p>
              ) : null}
            </CardHeader>
          ) : null}
          <CardContent className={hasHeader ? undefined : 'pt-6'}>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
