import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiClientError, login as apiLogin } from '../api/client';
import { getDeviceIdentifier } from './deviceId';

const TOKEN_KEY = 'fredceapp_token';
const TECNICO_KEY = 'fredceapp_tecnico';

interface TecnicoInfo {
  id: number;
  nombre: string;
}

interface AuthContextValue {
  token: string | null;
  tecnico: TecnicoInfo | null;
  isLoading: boolean;
  login: (usuario: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [tecnico, setTecnico] = useState<TecnicoInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [storedToken, storedTecnico] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(TECNICO_KEY),
      ]);
      if (storedToken && storedTecnico) {
        setToken(storedToken);
        setTecnico(JSON.parse(storedTecnico));
      }
      setIsLoading(false);
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      tecnico,
      isLoading,
      async login(usuario: string, password: string) {
        const deviceId = await getDeviceIdentifier();
        try {
          const res = await apiLogin(usuario, password, deviceId, 'App técnico');
          await SecureStore.setItemAsync(TOKEN_KEY, res.token);
          await SecureStore.setItemAsync(TECNICO_KEY, JSON.stringify(res.tecnico));
          setToken(res.token);
          setTecnico(res.tecnico);
        } catch (err) {
          if (err instanceof ApiClientError) throw err;
          throw new ApiClientError('No se pudo iniciar sesión', 0);
        }
      },
      async logout() {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(TECNICO_KEY);
        setToken(null);
        setTecnico(null);
      },
    }),
    [token, tecnico, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
