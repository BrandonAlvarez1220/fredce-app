import type { SQLiteDatabase } from 'expo-sqlite';
import { actualizarEstatusValvula, eliminarFoto, getEtapas, getServicios, subirFoto } from '../api/client';
import {
  eliminarFotoDeLocal,
  guardarEtapas,
  guardarMeta,
  guardarServicios,
  listarFotosPendientes,
  listarFotosPorEliminar,
  listarValvulasConEstatusPendiente,
  marcarEstatusSincronizado,
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

/**
 * Paso 0 del flujo offline-first (corre ANTES que el catálogo, a propósito):
 * empuja los cambios de estatus de válvula que el técnico marcó local. Si
 * corriera después de `sincronizarCatalogos`, un cambio todavía sin
 * confirmar podría alcanzar a viajar de ida (aunque `guardarServicios` ya
 * protege contra perderlo, ver su comentario) — mejor intentar confirmarlo
 * primero. Silencioso si falla (sin señal, o el endpoint aún no existe del
 * lado de generador-facturas): se reintenta en el siguiente sync.
 */
export async function sincronizarEstatusValvulas(db: SQLiteDatabase, token: string): Promise<void> {
  const pendientes = await listarValvulasConEstatusPendiente(db);
  for (const v of pendientes) {
    try {
      await actualizarEstatusValvula(v.id, v.estatus, token);
      await marcarEstatusSincronizado(db, v.id);
    } catch {
      // se reintenta solo en el siguiente sync — nada que hacer aquí
    }
  }
}

/**
 * Confirma con el servidor las fotos que el técnico borró después de que ya
 * se habían subido (las nunca-subidas se borran de una vez, local, sin
 * pasar por aquí — ver `eliminarFotoDeLocal` en la pantalla de válvula).
 * La foto ya está oculta en la app desde el momento en que se marcó para
 * borrar; esto solo confirma el borrado del lado del servidor y, si sale
 * bien, limpia la fila local por completo.
 */
export async function sincronizarEliminacionesFotos(db: SQLiteDatabase, token: string): Promise<void> {
  const pendientes = await listarFotosPorEliminar(db);
  for (const f of pendientes) {
    try {
      if (f.server_id) {
        await eliminarFoto(f.server_id, token);
      }
      await eliminarFotoDeLocal(db, f.id);
    } catch {
      // se reintenta en el siguiente sync — la foto sigue oculta mientras tanto
    }
  }
}
