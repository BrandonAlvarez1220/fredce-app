import NetInfo from '@react-native-community/netinfo';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { contarFotosPendientes, leerMeta } from '../db/repository';
import { META_LAST_SYNC, sincronizarCatalogos, sincronizarFotosPendientes, type ResultadoSubida } from './sync';

/**
 * Responde la pregunta de Brandon: ¿cómo/cuándo se sincronizan las fotos?
 *
 * - Automático: en cuanto el teléfono recupera señal (NetInfo) o la app
 *   vuelve a primer plano (AppState), se intenta subir la cola pendiente en
 *   silencio — sin que el técnico tenga que hacer nada ni saber que existe
 *   un botón.
 * - Manual también disponible: botón "Sincronizar ahora" en Inicio, por si
 *   alguien quiere forzarlo antes de que dispare solo (p.ej. antes de
 *   perder el turno de WiFi del hotel).
 * - Visible: contador de fotos pendientes en Inicio + badge "Pendiente"/
 *   "Error" en cada miniatura (pantalla de válvula).
 */
interface SyncContextValue {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  lastResult: ResultadoSubida | null;
  lastError: string | null;
  syncNow: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const { token } = useAuth();

  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ResultadoSubida | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const syncingRef = useRef(false); // evita disparar dos sync en paralelo (NetInfo + AppState + botón)
  const tokenRef = useRef(token);
  tokenRef.current = token;

  async function refreshPendingCount() {
    setPendingCount(await contarFotosPendientes(db));
  }

  async function syncNow() {
    const currentToken = tokenRef.current;
    if (!currentToken || syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    setLastError(null);
    try {
      const resultado = await sincronizarFotosPendientes(db, currentToken);
      await sincronizarCatalogos(db, currentToken);
      setLastResult(resultado);
      setLastSyncAt(await leerMeta(db, META_LAST_SYNC));
    } catch (err) {
      // Silencioso a propósito: sin señal es el caso normal en campo, no un
      // error que deba interrumpir al técnico. Se reintenta solo después.
      setLastError(err instanceof Error ? err.message : 'No se pudo sincronizar');
    } finally {
      await refreshPendingCount();
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }

  // Carga inicial del contador (para que se vea aunque no haya señal todavía).
  useEffect(() => {
    refreshPendingCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  // Auto-sync al recuperar señal.
  useEffect(() => {
    let conectadoAntes = true;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const conectadoAhora = Boolean(state.isConnected && state.isInternetReachable !== false);
      if (conectadoAhora && !conectadoAntes) {
        syncNow();
      }
      conectadoAntes = conectadoAhora;
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  // Auto-sync al volver la app a primer plano (p.ej. el técnico regresa del
  // hotel y abre la app ya con WiFi).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') syncNow();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const value = useMemo<SyncContextValue>(
    () => ({ isSyncing, pendingCount, lastSyncAt, lastResult, lastError, syncNow, refreshPendingCount }),
    [isSyncing, pendingCount, lastSyncAt, lastResult, lastError]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync debe usarse dentro de <SyncProvider>');
  return ctx;
}
