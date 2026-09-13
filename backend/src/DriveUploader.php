<?php

namespace FredceApp;

/**
 * Envoltorio para subir fotos a Google Drive.
 *
 * TODO (pendiente, ver spec): crear la cuenta de servicio de la empresa,
 * compartirle la carpeta raíz de Drive, y reemplazar upload() por una
 * llamada real a la Drive API v3 (multipart upload) usando esas credenciales
 * (GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_DRIVE_ROOT_FOLDER_ID en .env).
 *
 * Mientras DRIVE_ENABLED=false, esto NO sube nada de verdad: solo genera un
 * id de marcador de posición para poder construir y probar el resto del
 * flujo (móvil -> API -> MySQL) sin bloquear en la integración de Drive.
 */
class DriveUploader
{
    /**
     * @param string $tmpFilePath ruta local temporal del archivo subido (p.ej. $_FILES[...]['tmp_name'])
     * @param string $folderPath  ruta lógica deseada dentro de Drive, ej. "SERV-2026-0042/VALV-01"
     * @param string $filename    nombre de archivo destino
     * @return string el drive_file_id (o un marcador de posición si Drive sigue deshabilitado)
     */
    public static function upload(string $tmpFilePath, string $folderPath, string $filename): string
    {
        if (!Env::bool('DRIVE_ENABLED', false)) {
            return 'pending:' . bin2hex(random_bytes(8));
        }

        // TODO: implementar subida real con la cuenta de servicio de Google.
        // 1. Resolver/crear la subcarpeta $folderPath bajo GOOGLE_DRIVE_ROOT_FOLDER_ID.
        // 2. Subir $tmpFilePath con ese $filename.
        // 3. Devolver el file id que responde la Drive API.
        throw new \RuntimeException('DRIVE_ENABLED=true pero la subida real a Drive aún no está implementada.');
    }
}
