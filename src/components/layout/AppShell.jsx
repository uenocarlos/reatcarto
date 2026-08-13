import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { APP_HEADER_INNER_CLASS, IDENTITY_CARD_CLASS } from '@/components/layout/identity';

export { IDENTITY_CARD_CLASS };

const headerNavClass =
  'text-primary-foreground hover:bg-primary-foreground/20 gap-2';

function navActiveClass(active) {
  return active ? 'bg-primary-foreground/20' : '';
}

/**
 * Chrome autenticado do sistema: header laranja, saudação e navegação
 * no padrão da tela Meus Mapas.
 */
export default function AppShell({
  children,
  title,
  actions,
  headerActions,
  showHomeLink = true,
  maxWidth = 'max-w-6xl',
  guest = false,
  showGuestCta = true,
  guestTitle = 'ReatCarto',
  guestSubtitle,
}) {
  const location = useLocation();
  const { user, logout, confirmLogoutDiscard } = useAuth();
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const handleLogout = async () => {
    const result = await logout();
    if (result?.needsDiscardConfirm) {
      setShowDiscardConfirm(true);
    }
  };

  const onHome = location.pathname === '/';
  const onProfile = location.pathname === '/profile';
  const onAdmin = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-background font-inter">
      <header className="bg-primary">
        <div className={APP_HEADER_INNER_CLASS}>
          <div className="flex w-full min-w-0 items-center justify-between gap-3 max-sm:flex-wrap sm:gap-4">
            <Link to={guest ? '/gallery' : '/'} className="flex items-center gap-4 min-w-0">
              <img
                src="/logo.png"
                alt="Logo"
                className="w-12 h-12 object-contain bg-white/20 p-1 rounded-lg shrink-0"
              />
              {guest ? (
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold leading-tight text-primary-foreground truncate">
                    {guestTitle}
                  </h1>
                  {guestSubtitle ? (
                    <p className="text-primary-foreground/80 text-sm">{guestSubtitle}</p>
                  ) : null}
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="text-primary-foreground/80 text-sm">Bem vindo,</p>
                  <h1 className="text-2xl font-bold leading-tight text-primary-foreground truncate">
                    {user?.full_name || 'Usuário'}!
                  </h1>
                </div>
              )}
            </Link>

            <nav className="flex shrink-0 items-center justify-end gap-2 max-sm:flex-wrap sm:flex-nowrap sm:gap-3">
              {headerActions}
              {!guest && showHomeLink ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(headerNavClass, navActiveClass(onHome))}
                  asChild
                >
                  <Link to="/">Meus Mapas</Link>
                </Button>
              ) : null}
              {!guest ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(headerNavClass, navActiveClass(onProfile))}
                  asChild
                >
                  <Link to="/profile">Perfil</Link>
                </Button>
              ) : null}
              {!guest && user?.role === 'admin' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(headerNavClass, navActiveClass(onAdmin))}
                  asChild
                >
                  <Link to="/admin/users">Admin</Link>
                </Button>
              ) : null}
              {guest ? (
                showGuestCta ? (
                  <Button variant="secondary" size="sm" asChild>
                    <Link to="/login">Entrar</Link>
                  </Button>
                ) : null
              ) : (
                <>
                  <div className="w-px h-8 bg-primary-foreground/20 mx-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-primary-foreground hover:bg-primary-foreground/20"
                    onClick={handleLogout}
                    aria-label="Sair"
                  >
                    <LogOut className="w-5 h-5" />
                  </Button>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className={cn('mx-auto px-4 py-8', maxWidth)}>
        {title || actions ? (
          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            {title ? <h2 className="text-xl font-semibold text-foreground">{title}</h2> : <div />}
            {actions ? <div className="flex items-center gap-2 flex-wrap">{actions}</div> : null}
          </div>
        ) : null}
        {children}
      </main>

      <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar alterações pendentes?</DialogTitle>
            <DialogDescription>
              Existem alterações que ainda não foram sincronizadas. Descartá-las removerá
              permanentemente esse trabalho local.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiscardConfirm(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await confirmLogoutDiscard();
                setShowDiscardConfirm(false);
              }}
            >
              Descartar e sair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
