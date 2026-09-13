<?php

namespace FredceApp;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $connection = null;

    public static function connection(): PDO
    {
        if (self::$connection !== null) {
            return self::$connection;
        }

        $host = Env::get('DB_HOST', 'localhost');
        $name = Env::get('DB_NAME', 'fredceapp');
        $user = Env::get('DB_USER', '');
        $pass = Env::get('DB_PASS', '');
        $charset = Env::get('DB_CHARSET', 'utf8mb4');

        $dsn = "mysql:host=$host;dbname=$name;charset=$charset";

        try {
            self::$connection = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            // No exponer detalles de conexión en la respuesta.
            error_log('DB connection error: ' . $e->getMessage());
            Response::json(['error' => 'No se pudo conectar a la base de datos'], 500);
            exit;
        }

        return self::$connection;
    }
}
