<?php

namespace FredceApp\Controllers;

use FredceApp\Auth;
use FredceApp\Database;
use FredceApp\Response;

class AuthController
{
    /**
     * POST /api/auth/login
     * body JSON: { usuario, password, device_identifier?, device_name? }
     */
    public static function login(): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $usuario = trim($body['usuario'] ?? '');
        $password = (string) ($body['password'] ?? '');
        $deviceIdentifier = trim($body['device_identifier'] ?? '');
        $deviceName = trim($body['device_name'] ?? '');

        if ($usuario === '' || $password === '') {
            Response::json(['error' => 'usuario y password son requeridos'], 422);
            return;
        }

        $pdo = Database::connection();

        $stmt = $pdo->prepare('SELECT id, nombre, password_hash FROM tecnicos WHERE usuario = :u AND activo = 1 LIMIT 1');
        $stmt->execute(['u' => $usuario]);
        $tecnico = $stmt->fetch();

        if (!$tecnico || !password_verify($password, $tecnico['password_hash'])) {
            Response::json(['error' => 'Usuario o contraseña incorrectos'], 401);
            return;
        }

        $deviceId = null;
        if ($deviceIdentifier !== '') {
            $stmt = $pdo->prepare(
                'INSERT INTO tecnico_dispositivos (tecnico_id, device_identifier, device_name, last_sync_at)
                 VALUES (:tid, :did, :dname, NOW())
                 ON DUPLICATE KEY UPDATE device_name = VALUES(device_name), last_sync_at = NOW()'
            );
            $stmt->execute(['tid' => $tecnico['id'], 'did' => $deviceIdentifier, 'dname' => $deviceName ?: null]);

            $stmt = $pdo->prepare('SELECT id FROM tecnico_dispositivos WHERE tecnico_id = :tid AND device_identifier = :did');
            $stmt->execute(['tid' => $tecnico['id'], 'did' => $deviceIdentifier]);
            $deviceId = $stmt->fetchColumn();
        }

        $token = Auth::generateToken();
        $stmt = $pdo->prepare(
            'INSERT INTO api_tokens (tecnico_id, device_id, token, expires_at)
             VALUES (:tid, :did, :token, DATE_ADD(NOW(), INTERVAL :ttl SECOND))'
        );
        $stmt->execute([
            'tid' => $tecnico['id'],
            'did' => $deviceId,
            'token' => $token,
            'ttl' => Auth::tokenTtlSeconds(),
        ]);

        Response::json([
            'token' => $token,
            'expires_in' => Auth::tokenTtlSeconds(),
            'tecnico' => ['id' => (int) $tecnico['id'], 'nombre' => $tecnico['nombre']],
        ]);
    }
}
