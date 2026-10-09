import { File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Etapa, FotoServidor, Servicio } from '../api/types';

export interface FotoLocal {
  id: number;
  client_uuid: string;
  valvula_id: number;
  etapa_id: number;
  file_uri: string;
  etiqueta_libre: string | null;
  orden: number | null;
  fecha_captura: string;
  server_id: number | null;
  onedrive_file_id: string | null;
  // 'eliminar_pendiente': el técnico borró una foto que ya se había subido —
  // se oculta de inmediato en la UI (ver valvulas/[id].tsx) mientras se
  // confirma el borrado con el servidor en el siguiente sync.
  sync_status: 'pendiente' | 'subida' | 'error' | 'eliminar_pendiente';
  sync_error: string | null;
}

export type EstatusValvula = 'pendiente' | 'en_proceso' | 'completo';

export interface ValvulaLocal {
  id: number;
  servicio_id: number;
  codigo: string;
  estatus: EstatusValvula;
  total_fotos: number;
  estatus_sync_pendiente: number; // 0 | 1 — 1 mientras el cambio de estatus no se confirma con el servidor
}

export interface ServicioLocal {
  id: number;
  folio: string;
  nombre: string;
  fecha: string;
  estatus: string;
}

/**
 * Reemplaza el cache local de servicios+válvulas con lo que llegó del
 * servidor. Si una válvula tiene un cambio de estatus todavía sin
 * confirmar (`estatus_sync_pendiente=1`, ver [[actualizarEstatusValvulaLocal]]),
 * se conserva ese estatus local en vez de pisarlo con el valor (viejo) del
 * servidor — evita perder el cambio del técnico si un sync de catálogo
 * llega antes de que el cambio de estatus alcance a confirmarse.
 */
export async function guardarServicios(db: SQLiteDatabase, servicios: Servicio[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    const pendientes = await db.getAllAsync<{ id: number; estatus: EstatusValvula }>(
      'SELECT id, estatus FROM valvulas WHERE estatus_sync_pendiente = 1'
    );
    const estatusLocalPendiente = new Map(pendientes.map((p) => [p.id, p.estatus]));

    await db.runAsync('DELETE FROM servicios');
    await db.runAsync('DELETE FROM valvulas');
    for (const s of servicios) {
      await db.runAsync(
        'INSERT INTO servicios (id, folio, nombre, fecha, estatus) VALUES (?, ?, ?, ?, ?)',
        [s.id, s.folio, s.nombre, s.fecha, s.estatus]
      );
      for (const v of s.valvulas) {
        const estatusLocal = estatusLocalPendiente.get(v.id);
        await db.runAsync(
          'INSERT INTO valvulas (id, servicio_id, codigo, estatus, total_fotos, estatus_sync_pendiente) VALUES (?, ?, ?, ?, ?, ?)',
          [v.id, s.id, v.codigo, estatusLocal ?? v.estatus, v.total_fotos, estatusLocal ? 1 : 0]
        );
      }
    }
  });
}

export async function guardarEtapas(db: SQLiteDatabase, etapas: Etapa[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM etapas');
    for (const e of etapas) {
      await db.runAsync('INSERT INTO etapas (id, nombre, orden) VALUES (?, ?, ?)', [
        e.id,
        e.nombre,
        e.orden,
      ]);
    }
  });
}

export function listarServicios(db: SQLiteDatabase): Promise<ServicioLocal[]> {
  return db.getAllAsync<ServicioLocal>('SELECT * FROM servicios ORDER BY fecha DESC');
}

export function obtenerServicio(db: SQLiteDatabase, id: number): Promise<ServicioLocal | null> {
  return db
    .getFirstAsync<ServicioLocal>('SELECT * FROM servicios WHERE id = ?', [id])
    .then((r) => r ?? null);
}

export function listarValvulasDeServicio(db: SQLiteDatabase, servicioId: number): Promise<ValvulaLocal[]> {
  return db.getAllAsync<ValvulaLocal>('SELECT * FROM valvulas WHERE servicio_id = ? ORDER BY id ASC', [
    servicioId,
  ]);
}

export function obtenerValvula(db: SQLiteDatabase, id: number): Promise<ValvulaLocal | null> {
  return db.getFirstAsync<ValvulaLocal>('SELECT * FROM valvulas WHERE id = ?', [id]).then((r) => r ?? null);
}

export function listarEtapas(db: SQLiteDatabase): Promise<Etapa[]> {
  return db.getAllAsync<Etapa>('SELECT * FROM etapas ORDER BY orden ASC');
}

/** Guarda localmente las fotos que ya existen en el servidor para esta válvula (no pisa las pendientes de subir). */
export async function guardarFotosDeServidor(
  db: SQLiteDatabase,
  valvulaId: number,
  fotos: FotoServidor[]
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const f of fotos) {
      const existente = await db.getFirstAsync<{ id: number; sync_status: string }>(
        'SELECT id, sync_status FROM fotos WHERE client_uuid = ?',
        [f.client_uuid]
      );
      // El técnico ya la borró y solo falta que el servidor lo confirme: si
      // se actualizara aquí volvería a 'subida' y la foto reaparecería.
      if (existente?.sync_status === 'eliminar_pendiente') continue;
      if (existente) {
        await db.runAsync(
          'UPDATE fotos SET server_id = ?, onedrive_file_id = ?, sync_status = ? WHERE client_uuid = ?',
          [f.id, f.onedrive_file_id, 'subida', f.client_uuid]
        );
      } else {
        // Foto que vive en el servidor pero no en este dispositivo (la tomó
        // otro técnico) — no tenemos el archivo local, solo la referencia.
        await db.runAsync(
          `INSERT INTO fotos
            (client_uuid, valvula_id, etapa_id, file_uri, etiqueta_libre, orden, fecha_captura, server_id, onedrive_file_id, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'subida')`,
          [
            f.client_uuid,
            valvulaId,
            f.etapa_id,
            '',
            f.etiqueta_libre,
            f.orden,
            f.fecha_captura,
            f.id,
            f.onedrive_file_id,
          ]
        );
      }
    }
  });
}

/** Guarda el archivo descargado de una foto que vive en el servidor (tomada por otro técnico). */
export async function guardarArchivoFotoRemota(
  db: SQLiteDatabase,
  serverId: number,
  fileUri: string
): Promise<void> {
  await db.runAsync("UPDATE fotos SET file_uri = ? WHERE server_id = ? AND file_uri = ''", [fileUri, serverId]);
}

export function listarFotosDeValvula(db: SQLiteDatabase, valvulaId: number): Promise<FotoLocal[]> {
  return db.getAllAsync<FotoLocal>(
    'SELECT * FROM fotos WHERE valvula_id = ? ORDER BY etapa_id ASC, orden ASC, fecha_captura ASC',
    [valvulaId]
  );
}

/** Encola una foto recién capturada — siempre queda 'pendiente', haya o no señal. */
export function encolarFoto(
  db: SQLiteDatabase,
  foto: {
    clientUuid: string;
    valvulaId: number;
    etapaId: number;
    fileUri: string;
    etiquetaLibre?: string | null;
    orden?: number | null;
    fechaCaptura: string;
  }
): Promise<void> {
  return db
    .runAsync(
      `INSERT INTO fotos (client_uuid, valvula_id, etapa_id, file_uri, etiqueta_libre, orden, fecha_captura, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      [
        foto.clientUuid,
        foto.valvulaId,
        foto.etapaId,
        foto.fileUri,
        foto.etiquetaLibre ?? null,
        foto.orden ?? null,
        foto.fechaCaptura,
      ]
    )
    .then(() => undefined);
}

export function listarFotosPendientes(db: SQLiteDatabase): Promise<FotoLocal[]> {
  return db.getAllAsync<FotoLocal>(
    "SELECT * FROM fotos WHERE sync_status IN ('pendiente', 'error') ORDER BY created_at ASC"
  );
}

export function marcarFotoSubida(
  db: SQLiteDatabase,
  clientUuid: string,
  serverId: number,
  onedriveFileId: string | null
): Promise<void> {
  return db
    .runAsync(
      "UPDATE fotos SET sync_status = 'subida', sync_error = NULL, server_id = ?, onedrive_file_id = ? WHERE client_uuid = ?",
      [serverId, onedriveFileId, clientUuid]
    )
    .then(() => undefined);
}

export function marcarFotoError(db: SQLiteDatabase, clientUuid: string, error: string): Promise<void> {
  return db
    .runAsync("UPDATE fotos SET sync_status = 'error', sync_error = ? WHERE client_uuid = ?", [
      error,
      clientUuid,
    ])
    .then(() => undefined);
}

/**
 * Borra una foto por completo: la fila de SQLite y, si tenía un archivo
 * local, el archivo también. Segura de llamar en cualquier momento —para
 * fotos que nunca llegaron a subir (pendiente/error) esto es un borrado
 * real e inmediato; para una foto ya subida, se usa DESPUÉS de que el
 * servidor confirmó el borrado (ver [[marcarFotoParaEliminar]] +
 * `sincronizarEliminacionesFotos`), no antes.
 */
export async function eliminarFotoDeLocal(db: SQLiteDatabase, id: number): Promise<void> {
  const foto = await db.getFirstAsync<{ file_uri: string }>('SELECT file_uri FROM fotos WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM fotos WHERE id = ?', [id]);
  if (foto?.file_uri) {
    try {
      const archivo = new File(foto.file_uri);
      if (archivo.exists) archivo.delete(); // síncrono, ver expo-file-system SDK 57
    } catch {
      // el archivo físico no se pudo borrar (poco probable) — no es crítico,
      // la foto ya desapareció de la app de cualquier forma
    }
  }
}

/**
 * Marca una foto YA SUBIDA para borrar: se oculta de la cuadrícula al
 * instante (ver el filtro en valvulas/[id].tsx) y queda pendiente de que
 * `sincronizarEliminacionesFotos` confirme el borrado con el servidor.
 */
export function marcarFotoParaEliminar(db: SQLiteDatabase, id: number): Promise<void> {
  return db
    .runAsync("UPDATE fotos SET sync_status = 'eliminar_pendiente' WHERE id = ?", [id])
    .then(() => undefined);
}

export function listarFotosPorEliminar(db: SQLiteDatabase): Promise<FotoLocal[]> {
  return db.getAllAsync<FotoLocal>("SELECT * FROM fotos WHERE sync_status = 'eliminar_pendiente'");
}

export async function contarFotosPendientes(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) as n FROM fotos WHERE sync_status IN ('pendiente', 'error')"
  );
  return row?.n ?? 0;
}

/**
 * Cambia el estatus de una válvula de forma optimista: se guarda local de
 * inmediato (se ve reflejado en la UI al instante, haya o no señal) y se
 * marca `estatus_sync_pendiente=1` para que [[sincronizarEstatusValvulas]]
 * lo confirme con el servidor en cuanto pueda.
 */
export function actualizarEstatusValvulaLocal(
  db: SQLiteDatabase,
  valvulaId: number,
  estatus: EstatusValvula
): Promise<void> {
  return db
    .runAsync('UPDATE valvulas SET estatus = ?, estatus_sync_pendiente = 1 WHERE id = ?', [
      estatus,
      valvulaId,
    ])
    .then(() => undefined);
}

export function listarValvulasConEstatusPendiente(db: SQLiteDatabase): Promise<ValvulaLocal[]> {
  return db.getAllAsync<ValvulaLocal>('SELECT * FROM valvulas WHERE estatus_sync_pendiente = 1');
}

export function marcarEstatusSincronizado(db: SQLiteDatabase, valvulaId: number): Promise<void> {
  return db
    .runAsync('UPDATE valvulas SET estatus_sync_pendiente = 0 WHERE id = ?', [valvulaId])
    .then(() => undefined);
}

export async function guardarMeta(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?', [
    key,
    value,
    value,
  ]);
}

export async function leerMeta(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
  return row?.value ?? null;
}
