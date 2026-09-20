import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const clear = useCallback(() => {
    setToken(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    if (!getToken()) return;
    api
      .get('/auth/me')
      .then((r) => setUser(r.user))
      .catch((e) => {
        if (e.status === 401) clear(); // offline/other errors keep the token so the app can retry
      })
      .finally(() => setLoading(false));
  }, [clear]);

  const value = useMemo(
    () => ({
      user,
      loading,
      setUser,
      // Store a session (used after sign-in, and after the recovery code has been saved).
      commit: (token, u) => {
        setToken(token);
        setUser(u);
      },
      logout: clear,
    }),
    [user, loading, clear]
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
