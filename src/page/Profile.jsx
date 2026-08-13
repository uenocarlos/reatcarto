import React, { useState } from 'react';
import { api, ApiError } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { clearOfflineAccount } from '@/lib/offline/offlineApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import AppShell, { IDENTITY_CARD_CLASS } from '@/components/layout/AppShell';
import ProfileMediaLibrary from '@/components/profile/ProfileMediaLibrary';

const PROFILE_FIELDS = [
  ['full_name', 'Nome completo'],
  ['organization', 'Organização'],
  ['job_title', 'Cargo'],
  ['phone', 'Telefone'],
];

export default function Profile() {
  const { user, refreshUser, logout } = useAuth();
  const [profile, setProfile] = useState({
    full_name: user?.full_name || '',
    organization: user?.organization || '',
    job_title: user?.job_title || '',
    phone: user?.phone || '',
  });
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState('');
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirmation: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [loadingSection, setLoadingSection] = useState(null);

  const saveProfile = async (e) => {
    e.preventDefault();
    setLoadingSection('profile');
    setFieldErrors({});
    try {
      await api.auth.updateProfile(profile);
      await refreshUser();
      toast.success('Perfil atualizado');
    } catch (error) {
      if (error instanceof ApiError && error.fields) setFieldErrors(error.fields);
      else toast.error(error.message || 'Erro ao salvar perfil');
    } finally {
      setLoadingSection(null);
    }
  };

  const saveUsername = async (e) => {
    e.preventDefault();
    setLoadingSection('username');
    try {
      await api.auth.changeUsername(username);
      await refreshUser();
      toast.success('Usuário atualizado');
    } catch (error) {
      if (error instanceof ApiError && error.fields?.username) {
        toast.error(error.fields.username);
      } else {
        toast.error(error.message || 'Erro ao alterar usuário');
      }
    } finally {
      setLoadingSection(null);
    }
  };

  const saveEmail = async (e) => {
    e.preventDefault();
    setLoadingSection('email');
    try {
      await api.auth.changeEmail(email);
      await refreshUser();
      toast.success('Verifique o novo email para confirmar a alteração');
      setEmail('');
    } catch (error) {
      if (error instanceof ApiError && error.fields?.email) {
        toast.error(error.fields.email);
      } else {
        toast.error(error.message || 'Erro ao alterar email');
      }
    } finally {
      setLoadingSection(null);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setLoadingSection('password');
    try {
      await api.auth.changePassword(passwords.current, passwords.new, passwords.confirmation);
      toast.success('Senha alterada. Outras sessões foram encerradas.');
      setPasswords({ current: '', new: '', confirmation: '' });
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        const msg = Object.values(error.fields)[0];
        toast.error(String(msg));
      } else {
        toast.error(error.message || 'Erro ao alterar senha');
      }
    } finally {
      setLoadingSection(null);
    }
  };

  return (
    <AppShell title="Configurações da conta" maxWidth="max-w-4xl">
      {user?.pending_email && (
        <p className="text-sm text-muted-foreground mb-6" role="status">
          Email pendente de verificação: {user.pending_email}
        </p>
      )}

      <div className="space-y-6">
        <Card className={IDENTITY_CARD_CLASS}>
          <CardHeader>
            <CardTitle>Perfil profissional</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-3">
              {PROFILE_FIELDS.map(([key, label]) => (
                <div key={key}>
                  <label htmlFor={key} className="text-sm font-medium">
                    {label}
                  </label>
                  <Input
                    id={key}
                    value={profile[key]}
                    onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
                    aria-invalid={!!fieldErrors[key]}
                  />
                  {fieldErrors[key] && (
                    <p className="text-sm text-destructive" role="alert">
                      {fieldErrors[key]}
                    </p>
                  )}
                </div>
              ))}
              <Button type="submit" disabled={loadingSection === 'profile'}>
                Salvar perfil
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className={IDENTITY_CARD_CLASS}>
          <CardHeader>
            <CardTitle>Usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveUsername} className="space-y-3">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
              <Button type="submit" disabled={loadingSection === 'username'}>
                Alterar usuário
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className={IDENTITY_CARD_CLASS}>
          <CardHeader>
            <CardTitle>Email</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-2">Atual: {user?.email}</p>
            <form onSubmit={saveEmail} className="space-y-3">
              <Input
                type="email"
                placeholder="Novo email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" disabled={loadingSection === 'email'}>
                Alterar email
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className={IDENTITY_CARD_CLASS}>
          <CardHeader>
            <CardTitle>Senha</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePassword} className="space-y-3">
              <Input
                type="password"
                placeholder="Senha atual"
                value={passwords.current}
                onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
              />
              <Input
                type="password"
                placeholder="Nova senha"
                value={passwords.new}
                onChange={(e) => setPasswords((p) => ({ ...p, new: e.target.value }))}
              />
              <Input
                type="password"
                placeholder="Confirmar nova senha"
                value={passwords.confirmation}
                onChange={(e) => setPasswords((p) => ({ ...p, confirmation: e.target.value }))}
              />
              <Button type="submit" disabled={loadingSection === 'password'}>
                Alterar senha
              </Button>
            </form>
          </CardContent>
        </Card>

        <ProfileMediaLibrary />

        <Card className={`${IDENTITY_CARD_CLASS} border-destructive/40`}>
          <CardHeader>
            <CardTitle className="text-destructive">Excluir conta permanentemente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Esta ação remove permanentemente sua conta, mapas, elementos, fotos, vídeos, ícones,
              acesso público e sessões. Alterações locais ainda não sincronizadas também serão
              descartadas. Esta ação não pode ser desfeita.
            </p>
            <DeleteAccountSection onDeleted={() => logout({ discardConfirmed: true })} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

const DELETE_CONFIRM_PHRASE = 'DELETE MY ACCOUNT';

function DeleteAccountSection({ onDeleted }) {
  const [password, setPassword] = useState('');
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setShowSuccess(false);
    try {
      await api.auth.deleteAccount({ password, confirmPhrase });
      await clearOfflineAccount();
      setShowSuccess(true);
      await onDeleted();
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        const msg = Object.values(error.fields)[0];
        toast.error(String(msg));
      } else {
        toast.error(error.message || 'Falha ao excluir conta');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Input
        type="password"
        placeholder="Senha atual"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Input
        placeholder={`Digite: ${DELETE_CONFIRM_PHRASE}`}
        value={confirmPhrase}
        onChange={(e) => setConfirmPhrase(e.target.value)}
      />
      {showSuccess && (
        <p className="text-sm text-green-600" role="status">
          Conta excluída com sucesso.
        </p>
      )}
      <Button type="submit" variant="destructive" disabled={loading}>
        Excluir minha conta
      </Button>
    </form>
  );
}
