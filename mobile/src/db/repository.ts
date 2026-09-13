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
  drive_file_id: string | null;
  sync_status: 'pendiente' | 'subida' | 'error';
  sync_error: string | null;
}

export interface ValvulaLocal {
  id: number;
  servicio_id: number;
  codigo: string;
  estatus: string;
  total_fotos: number;
}

export interface ServicioLocal {
  id: number;
  folio: string;
  nombre: string;
  fecha: string;
  estatus: string;
}

/** Reemplaza el cache local de servicios+válvulas con lo que llegó del servidor. */
export async function guardarServicios(db: SQLiteDatabase, servicios: Servicio[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM servicios');
    await db.runAsync('DELETE FROM valvulas');
    for (const s of servicios) {
      await db.runAsync(
        'INSERT INTO servicios (id, folio, nombre, fecha, estatus) VALUES (?, ?, ?, ?, ?)',
        [s.id, s.folio, s.nombre, s.fecha, s.estatus]
      );
      for (const v of s.valvulas) {
        await db.runAsync(
          'INSERT INTO valvulas (id, servicio_id, codigo, estatus, total_fotos) VALUES (?, ?, ?, ?, ?)',
          [v.id, s.id, v.codigo, v.estatus, v.total_fotos]
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
      const existente = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM fotos WHERE client_uuid = ?',
        [f.client_uuid]
      );
      if (existente) {
        await db.runAsync(
          'UPDATE fotos SET server_id = ?, drive_file_id = ?, sync_status = ? WHERE client_uuid = ?',
          [f.id, f.drive_file_id, 'subida', f.client_uuid]
        );
      } else {
        // Foto que vive en el servidor pero no en este dispositivo (la tomó
        // otro técnico) — no tenemos el archivo local, solo la referencia.
        await db.runAsync(
          `INSERT INTO fotos
            (client_uuid, valvula_id, etapa_id, file_uri, etiqueta_libre, orden, fecha_captura, server_id, drive_file_id, sync_status)
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
            f.drive_file_id,
          ]
        );
      }
    }
  });
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
  driveFileId: string | null
): Promise<void> {
  return db
    .runAsync(
      "UPDATE fotos SET sync_status = 'subida', sync_error = NULL, server_id = ?, drive_file_id = ? WHERE client_uuid = ?",
      [serverId, driveFileId, clientUuid]
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

export async function contarFotosPendientes(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) as n FROM fotos WHERE sync_status IN ('pendiente', 'error')"
  );
  return row?.n ?? 0;
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
