<?php

namespace FredceApp\Controllers;

use FredceApp\Auth;
use FredceApp\Database;
use FredceApp\DriveUploader;
use FredceApp\Response;

class FotoController
{
    /**
     * POST /api/fotos  (multipart/form-data)
     * campos: client_uuid, valvula_id, etapa_id, fecha_captura, etiqueta_libre?, orden?, file
     *
     * Idempotente en client_uuid: si el dispositivo reintenta una subida que
     * ya llegó (p.ej. se cortó la señal a mitad de la respuesta), regresa el
     * registro existente en vez de duplicar o fallar.
     */
    public static function store(): void
    {
        $tecnico = Auth::requireTecnico();

        $clientUuid = trim($_POST['client_uuid'] ?? '');
        $valvulaId = (int) ($_POST['valvula_id'] ?? 0);
        $etapaId = (int) ($_POST['etapa_id'] ?? 0);
        $fechaCaptura = trim($_POST['fecha_captura'] ?? '');
        $etiquetaLibre = trim($_POST['etiqueta_libre'] ?? '') ?: null;
        $orden = isset($_POST['orden']) ? (int) $_POST['orden'] : null;

        if ($clientUuid === '' || $valvulaId <= 0 || $etapaId <= 0 || $fechaCaptura === '') {
            Response::json(['error' => 'client_uuid, valvula_id, etapa_id y fecha_captura son requeridos'], 422);
            return;
        }
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            Response::json(['error' => 'Archivo "file" faltante o inválido'], 422);
            return;
        }

        $pdo = Database::connection();

        // Idempotencia: ¿ya existe esta foto?
        $stmt = $pdo->prepare('SELECT id, drive_file_id FROM fotos WHERE client_uuid = :uuid LIMIT 1');
        $stmt->execute(['uuid' => $clientUuid]);
        if ($existing = $stmt->fetch()) {
            Response::json(['id' => (int) $existing['id'], 'drive_file_id' => $existing['drive_file_id'], 'ya_existia' => true]);
            return;
        }

        // La válvula debe pertenecer a un servicio asignado a este técnico.
        $stmt = $pdo->prepare(
            'SELECT v.id, v.codigo, s.folio
             FROM valvulas v
             JOIN servicios s ON s.id = v.servicio_id
             JOIN servicio_tecnico st ON st.servicio_id = s.id
             WHERE v.id = :vid AND st.tecnico_id = :tid
             LIMIT 1'
        );
        $stmt->execute(['vid' => $valvulaId, 'tid' => $tecnico['id']]);
        $valvula = $stmt->fetch();
        if (!$valvula) {
            Response::json(['error' => 'Válvula no encontrada o no asignada a este técnico'], 404);
            return;
        }

        $stmt = $pdo->prepare('SELECT id FROM etapas WHERE id = :id AND activo = 1');
        $stmt->execute(['id' => $etapaId]);
        if (!$stmt->fetch()) {
            Response::json(['error' => 'Etapa inválida'], 422);
            return;
        }

        $folderPath = $valvula['folio'] . '/' . $valvula['codigo'];
        $filename = $clientUuid . '_' . basename($_FILES['file']['name']);
        $driveFileId = DriveUploader::upload($_FILES['file']['tmp_name'], $folderPath, $filename);

        $stmt = $pdo->prepare(
            'INSERT INTO fotos (client_uuid, valvula_id, etapa_id, tecnico_id, drive_file_id, orden, etiqueta_libre, fecha_captura)
             VALUES (:uuid, :vid, :eid, :tid, :drive, :orden, :etiqueta, :fecha)'
        );
        $stmt->execute([
            'uuid' => $clientUuid,
            'vid' => $valvulaId,
            'eid' => $etapaId,
            'tid' => $tecnico['id'],
            'drive' => $driveFileId,
            'orden' => $orden,
            'etiqueta' => $etiquetaLibre,
            'fecha' => $fechaCaptura,
        ]);

        Response::json(['id' => (int) $pdo->lastInsertId(), 'drive_file_id' => $driveFileId, 'ya_existia' => false], 201);
    }
}
