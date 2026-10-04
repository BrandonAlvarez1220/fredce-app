import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { ApiClientError, getVacaciones } from '../api/client';
import type { VacacionesResumen } from '../api/types';
import { useAuth } from '../auth/AuthContext';

/**
 * Estado de Vacaciones. Se pide al abrir la app, al volver a primer plano y
 * al abrir la pantalla (no hay push). Solo los empleados tienen vacaciones:
 * un 403 (externo, fuera del padrón, baja, sin fecha de ingreso) o un 404
 * (servidor que aún no tiene el módulo) ocultan el acceso. Un error de red
 * conserva lo último que se vio.
 */
interface VacacionesContextValue {
  /** true solo cuando el servidor confirmó que esta cuenta tiene vacaciones. */
  disponible: boolean;
  /** Mensaje del servidor cuando respondió 403 (para mostrarlo tal cual). */
  mensajeNoDisponible: string | null;
  data: VacacionesResumen | null;
  sinVer: number;
  error: string | null;
  refresh: () => Promise<VacacionesResumen | null>;
}

const VacacionesContext = createContext<VacacionesContextValue | undefined>(undefined);

export function VacacionesProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [disponible, setDisponible] = useState(false);
  const [mensajeNoDisponible, setMensaje] = useState<string | null>(null);
  const [data, setData] = useState<VacacionesResumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const refresh = useCallback(async () => {
    const t = tokenRef.current;
    if (!t) return null;
    try {
      const res = await getVacaciones(t);
      if (tokenRef.current !== t) return null; // cambió la sesión mientras tanto
      setData(res);
      setDisponible(true);
      setMensaje(null);
      setError(null);
      return res;
    } catch (err) {
      if (tokenRef.current !== t) return null;
      if (err instanceof ApiClientError && (err.status === 403 || err.status === 404)) {
        setDisponible(false);
        setData(null);
        setMensaje(err.status === 403 ? err.message : null);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo cargar vacaciones');
      }
      return null;
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setDisponible(false);
      setData(null);
      setMensaje(null);
      setError(null);
      return;
    }
    refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [token, refresh]);

  const value = useMemo<VacacionesContextValue>(
    () => ({ disponible, mensajeNoDisponible, data, sinVer: data?.sin_ver ?? 0, error, refresh }),
    [disponible, mensajeNoDisponible, data, error, refresh]
  );
  return <VacacionesContext.Provider value={value}>{children}</VacacionesContext.Provider>;
}

export function useVacaciones(): VacacionesContextValue {
  const ctx = useContext(VacacionesContext);
  if (!ctx) throw new Error('useVacaciones debe usarse dentro de <VacacionesProvider>');
  return ctx;
}
