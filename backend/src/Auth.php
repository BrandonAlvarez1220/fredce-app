<?php

namespace FredceApp;

use PDO;

class Auth
{
    public static function generateToken(): string
    {
        return bin2hex(random_bytes(32));
    }

    public static function tokenTtlSeconds(): int
    {
        return (int) Env::get('TOKEN_TTL_SECONDS', '2592000'); // 30 días por defecto
    }

    /**
     * Valida el header Authorization: Bearer <token> y devuelve el técnico
     * asociado, o corta la respuesta con 401 si no es válido/expiró.
     *
     * @return array{id:int,nombre:string,usuario:string}
     */
    public static function requireTecnico(): array
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
            Response::json(['error' => 'Falta token de autenticación'], 401);
            exit;
        }
        $token = $m[1];

        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT t.id, t.nombre, t.usuario
             FROM api_tokens tok
             JOIN tecnicos t ON t.id = tok.tecnico_id
             WHERE tok.token = :token AND tok.expires_at > NOW() AND t.activo = 1
             LIMIT 1'
        );
        $stmt->execute(['token' => $token]);
        $tecnico = $stmt->fetch();

        if (!$tecnico) {
            Response::json(['error' => 'Token inválido o expirado'], 401);
            exit;
        }

        return $tecnico;
    }
}
