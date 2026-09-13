import type { SQLiteDatabase } from 'expo-sqlite';
import { getEtapas, getServicios, subirFoto } from '../api/client';
import {
  guardarEtapas,
  guardarMeta,
  guardarServicios,
  listarFotosPendientes,
  marcarFotoError,
  marcarFotoSubida,
} from '../db/repository';

export const META_LAST_SYNC = 'last_sync_at';

/** Paso 1 del flujo offline-first: bajar servicios/válvulas/etapas asignados. */
export async function sincronizarCatalogos(db: SQLiteDatabase, token: string): Promise<void> {
  const [{ servicios }, { etapas }] = await Promise.all([getServicios(token), getEtapas(token)]);
  await guardarServicios(db, servicios);
  await guardarEtapas(db, etapas);
  await guardarMeta(db, META_LAST_SYNC, new Date().toISOString());
}

export interface ResultadoSubida {
  subidas: number;
  fallidas: number;
}

/**
 * Paso 3 del flujo offline-first: sube lo que se capturó sin señal.
 * Reintentos silenciosos — si una falla, se queda en 'error' y se vuelve a
 * intentar la próxima vez que haya señal, sin bloquear a las demás.
 */
export async function sincronizarFotosPendientes(
  db: SQLiteDatabase,
  token: string
): Promise<ResultadoSubida> {
  const pendientes = await listarFotosPendientes(db);
  let subidas = 0;
  let fallidas = 0;

  for (const foto of pendientes) {
    try {
      const res = await subirFoto(token, {
        clientUuid: foto.client_uuid,
        valvulaId: foto.valvula_id,
        etapaId: foto.etapa_id,
        fechaCaptura: foto.fecha_captura,
        fileUri: foto.file_uri,
        etiquetaLibre: foto.etiqueta_libre,
        orden: foto.orden,
      });
      await marcarFotoSubida(db, foto.client_uuid, res.id, res.drive_file_id);
      subidas++;
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error desconocido';
      await marcarFotoError(db, foto.client_uuid, mensaje);
      fallidas++;
    }
  }

  return { subidas, fallidas };
}
