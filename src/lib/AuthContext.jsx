import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { api, ApiError } from '@/api/apiClient';
import { SyncEngine } from '@/lib/sync/SyncEngine';
import { OfflineStore } from '@/lib/offline/OfflineStore';
import { orchestrateLogout } from '@/lib/offline/logoutFlow';
import { isOnline, onConnectivityChange } from '@/lib/offline/connectivity';
import {
  clearAuthSnapshot,
  loadAuthSnapshot,
  saveAuthSnapshot,
  shouldKeepLocalSession,
} from '@/lib/offline/authSnapshot';

/** @internal Exported for unit tests */
export async function executeOutboxFlush(getEngine) {
  const engine = getEngine?.();
  if (!engine) return { skipped: true };
  if (!isOnline()) return { offline: true };
  if (engine.isFlushing()) return { inProgress: true };
  return engine.flush();
}

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [logoutState, setLogoutState] = useState(null);
  const [syncState, setSyncState] = useState({
    flushing: false,
    progress: { completed: 0, total: 0 },
    lastResult: null,
    error: null,
  });
  const syncEngineRef = useRef(null);
  const syncProgressUnsubRef = useRef(null);

  const getSyncEngine = useCallback(() => {
    if (!user?.id) return null;
    if (!syncEngineRef.current || syncEngineRef.current.userId !== user.id) {
      syncEngineRef.current = new SyncEngine(user.id, api);
    }
    return syncEngineRef.current;
  }, [user?.id]);

  const flushOutbox = useCallback(async () => {
    const engine = getSyncEngine();
    if (!engine) return { skipped: true };
    if (!isOnline()) return { offline: true };
    if (engine.isFlushing()) return { inProgress: true };

    syncProgressUnsubRef.current?.();
    syncProgressUnsubRef.current = engine.onProgress((progress) => {
      setSyncState((prev) => ({ ...prev, progress }));
    });

    setSyncState((prev) => ({
      ...prev,
      flushing: true,
      error: null,
      progress: engine.getProgress(),
    }));

    try {
      const result = await engine.flush();
      setSyncState((prev) => ({
        ...prev,
        flushing: false,
        lastResult: result,
        progress: engine.getProgress(),
      }));
      return result;
    } catch (error) {
      setSyncState((prev) => ({
        ...prev,
        flushing: false,
        error: { message: error?.message ?? 'Sync failed' },
      }));
      throw error;
    } finally {
      syncProgressUnsubRef.current?.();
      syncProgressUnsubRef.current = null;
    }
  }, [getSyncEngine]);

  const applyAuthenticatedUser = useCallback(async (currentUser, { persist = true } = {}) => {
    setUser(currentUser);
    setIsAuthenticated(true);
    api.offline.setUserId(currentUser.id);
    const store = new OfflineStore(currentUser.id);
    await store.bindAccount();
    if (persist) saveAuthSnapshot(currentUser);
  }, []);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      const snapshot = loadAuthSnapshot();
      if (shouldKeepLocalSession(snapshot)) {
        await applyAuthenticatedUser(snapshot, { persist: false });
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }

      if (!isOnline()) {
        if (!shouldKeepLocalSession(snapshot)) {
          setUser(null);
          setIsAuthenticated(false);
          api.offline.setUserId(null);
        }
        return;
      }

      try {
        const currentUser = await api.auth.me();
        await applyAuthenticatedUser(currentUser);
      } catch (error) {
        if (shouldKeepLocalSession(snapshot)) {
          return;
        }
        setUser(null);
        setIsAuthenticated(false);
        api.offline.setUserId(null);
        if (!(error instanceof ApiError && error.status === 401)) {
          setAuthError({ type: 'auth_check_failed', message: error.message });
        }
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [applyAuthenticatedUser]);

  const checkAppState = checkUserAuth;

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return undefined;
    void flushOutbox();
    return undefined;
  }, [isAuthenticated, user?.id, flushOutbox]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return undefined;
    return onConnectivityChange((online) => {
      if (online) void flushOutbox();
    });
  }, [isAuthenticated, user?.id, flushOutbox]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || typeof document === 'undefined') return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isOnline()) {
        void flushOutbox();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isAuthenticated, user?.id, flushOutbox]);

  useEffect(
    () => () => {
      syncProgressUnsubRef.current?.();
    },
    []
  );

  const login = async (identifier, password) => {
    const loggedInUser = await api.auth.login(identifier, password);
    await applyAuthenticatedUser(loggedInUser);
    setAuthError(null);
    return loggedInUser;
  };

  const logout = async (options = {}) => {
    const userId = user?.id;
    if (!userId) {
      setUser(null);
      setIsAuthenticated(false);
      clearAuthSnapshot();
      return { success: true };
    }

    const engine = getSyncEngine();
    const result = await orchestrateLogout({
      userId,
      discardConfirmed: options.discardConfirmed ?? false,
      onProgress: (p) => setLogoutState(p),
      syncFn: async () => {
        if (!engine) return { upToDate: true };
        return engine.flush({ force: true });
      },
      serverLogoutFn: () => api.auth.logout(),
    });

    if (result.needsDiscardConfirm) {
      setLogoutState({ phase: 'confirm_discard', pending: result.pending });
      return result;
    }

    setUser(null);
    setIsAuthenticated(false);
    api.offline.setUserId(null);
    clearAuthSnapshot();
    syncEngineRef.current = null;
    syncProgressUnsubRef.current?.();
    syncProgressUnsubRef.current = null;
    setSyncState({
      flushing: false,
      progress: { completed: 0, total: 0 },
      lastResult: null,
      error: null,
    });
    setLogoutState(null);
    return result;
  };

  const confirmLogoutDiscard = async () => {
    const result = await logout({ discardConfirmed: true });
    return { success: true, discarded: true, ...result };
  };

  const refreshUser = async () => {
    try {
      const currentUser = await api.auth.me();
      await applyAuthenticatedUser(currentUser);
      return currentUser;
    } catch (error) {
      const snapshot = loadAuthSnapshot();
      if (shouldKeepLocalSession(snapshot)) {
        return snapshot;
      }
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        authError,
        authChecked,
        login,
        logout,
        confirmLogoutDiscard,
        logoutState,
        getSyncEngine,
        flushOutbox,
        syncState,
        refreshUser,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
