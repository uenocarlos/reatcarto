import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Chrome das telas públicas de autenticação: fundo laranja + card branco.
 */
export default function AuthShell({ title, description, children, wide = false }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-4 font-inter">
      <Card className={cn('w-full shadow-2xl', wide ? 'max-w-lg' : 'max-w-md')}>
        <CardHeader className="space-y-1 flex flex-col items-center">
          <div className="flex justify-center mb-6">
            <div className="bg-primary/10 p-4 rounded-2xl">
              <img src="/logo.png" alt="ReatCarto" className="w-40 h-auto object-contain" />
            </div>
          </div>
          {title ? (
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-center">{title}</h1>
          ) : null}
          {description ? (
            <p className="text-sm text-muted-foreground text-center">{description}</p>
          ) : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
