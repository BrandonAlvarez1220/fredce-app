import NetInfo from '@react-native-community/netinfo';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { ApiClientError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { contarFotosPendientes, leerMeta } from '../db/repository';
import {
  META_LAST_SYNC,
  sincronizarCatalogos,
  sincronizarEliminacionesFotos,
  sincronizarEstatusValvulas,
  sincronizarFotosPendientes,
  type ResultadoSubida,
} from './sync';

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
/** Cada cuánto se sincroniza solo mientras la app está abierta. */
const SYNC_PERIODICO_MS = 5 * 60 * 1000;

interface SyncContextValue {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  lastResult: ResultadoSubida | null;
  lastError: string | null;
  // true cuando el servidor rechazó el token (401) en el último intento —
  // a diferencia de lastError (sin señal, error de servidor, etc.), esto
  // NO se arregla solo reintentando: el técnico necesita señal + volver a
  // iniciar sesión. Mientras tanto sigue pudiendo capturar fotos (100%
  // local) y nada lo saca a la fuerza de la app — ver AuthGate.
  sessionExpired: boolean;
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
  const [sessionExpired, setSessionExpired] = useState(false);

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
    setSessionExpired(false);
    try {
      await sincronizarEstatusValvulas(db, currentToken);
      await sincronizarEliminacionesFotos(db, currentToken);
      const resultado = await sincronizarFotosPendientes(db, currentToken);
      await sincronizarCatalogos(db, currentToken);
      setLastResult(resultado);
      setLastSyncAt(await leerMeta(db, META_LAST_SYNC));
    } catch (err) {
      // Sin señal es el caso normal en campo, no un error que deba
      // interrumpir al técnico — se reintenta solo. Un 401 es distinto: no
      // se arregla reintentando, así que se marca aparte (sessionExpired)
      // para que la pantalla de inicio pueda avisar con un mensaje que sí
      // tiene sentido ("vuelve a iniciar sesión") en vez de "se reintenta solo".
      if (err instanceof ApiClientError && err.status === 401) {
        setSessionExpired(true);
        setLastError('Tu sesión venció');
      } else {
        setLastError(err instanceof Error ? err.message : 'No se pudo sincronizar');
      }
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

  // Auto-sync al tener sesión: arranque en frío con sesión guardada y login.
  // El listener de AppState no cubre estos casos (la app ya nace 'active' y
  // el token se carga después), y tokenRef ya trae el token al correr esto.
  // Mientras la app está en primer plano, repite cada SYNC_PERIODICO_MS: el
  // admin puede asignar servicios con la app abierta.
  useEffect(() => {
    if (!token) return;
    syncNow();
    const timer = setInterval(async () => {
      if (AppState.currentState !== 'active') return;
      // Sin señal ni se intenta: evita el parpadeo de "sincronizando" y del
      // aviso de error cada ciclo. Al volver la señal, NetInfo dispara el sync.
      const red = await NetInfo.fetch();
      if (red.isConnected && red.isInternetReachable !== false) syncNow();
    }, SYNC_PERIODICO_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
    () => ({
      isSyncing,
      pendingCount,
      lastSyncAt,
      lastResult,
      lastError,
      sessionExpired,
      syncNow,
      refreshPendingCount,
    }),
    [isSyncing, pendingCount, lastSyncAt, lastResult, lastError, sessionExpired]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync debe usarse dentro de <SyncProvider>');
  return ctx;
}
