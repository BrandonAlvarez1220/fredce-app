import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Espejo local (offline) de lo que la app necesita del servidor:
 * servicios/valvulas/etapas (cache de solo lectura, se pisa en cada sync)
 * y `fotos`, que además de cache es la COLA de subida — toda foto nace
 * aquí con sync_status='pendiente' sin importar si hay señal o no.
 */
export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= 1) return;

  await db.execAsync(`
    PRAGMA journal_mode = 'wal';

    CREATE TABLE servicios (
      id      INTEGER PRIMARY KEY,
      folio   TEXT NOT NULL,
      nombre  TEXT NOT NULL,
      fecha   TEXT NOT NULL,
      estatus TEXT NOT NULL
    );

    CREATE TABLE valvulas (
      id            INTEGER PRIMARY KEY,
      servicio_id   INTEGER NOT NULL,
      codigo        TEXT NOT NULL,
      estatus       TEXT NOT NULL,
      total_fotos   INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_valvulas_servicio ON valvulas(servicio_id);

    CREATE TABLE etapas (
      id     INTEGER PRIMARY KEY,
      nombre TEXT NOT NULL,
      orden  INTEGER NOT NULL
    );

    -- cola de subida + cache de fotos ya sincronizadas
    CREATE TABLE fotos (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      client_uuid    TEXT NOT NULL UNIQUE,
      valvula_id     INTEGER NOT NULL,
      etapa_id       INTEGER NOT NULL,
      file_uri       TEXT NOT NULL,
      etiqueta_libre TEXT,
      orden          INTEGER,
      fecha_captura  TEXT NOT NULL,
      server_id      INTEGER,
      drive_file_id  TEXT,
      sync_status    TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | subida | error
      sync_error     TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_fotos_valvula ON fotos(valvula_id);
    CREATE INDEX idx_fotos_sync_status ON fotos(sync_status);

    CREATE TABLE meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    PRAGMA user_version = 1;
  `);
}
